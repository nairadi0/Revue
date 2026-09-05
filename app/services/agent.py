import httpx, re
from ..models import PRFile, Repository, User, ReviewFinding, Severity, Category, RepoMemory
from google.genai import types
from google import genai
from ..config import settings
from sqlalchemy.orm import Session
import textwrap
from pydantic import BaseModel


client = genai.Client(api_key=settings.gemini_api_key)


class Finding(BaseModel):
  line_number: int
  severity: Severity
  category: Category
  finding_text: str
  suggestion: str


class ReviewOutput(BaseModel):
  findings: list[Finding]
  updated_memory_summary: str


def get_diff(pr_file: PRFile):
  diff = pr_file.patch_text

  return diff


async def get_file_history(pr_file: PRFile, repo: Repository, current_user: User):
  owner = repo.owner
  name = repo.name
  access_token = current_user.access_token
  file_path = pr_file.file_path
  base_url = f"https://api.github.com/repos/{owner}/{name}/commits"
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {access_token}"}
    response = await client.get(base_url, headers=auth_header, params={"path" : file_path})
    if response.status_code != 200:
      return f"This tool call failed with status code {response.status_code}. Continue with other methods"
    file_history = response.json()
    commits = []
    for commit in file_history:
      commit_hash = commit['sha']
      commit_message = commit['commit']['message']
      commit_date = commit['commit']['author']['date']
      commit_author = commit['author']['login']
      commits.append({"hash" : commit_hash,
                      "message" : commit_message,
                      "author" : commit_author,
                      "date" : commit_date,
                      })

    return commits


def check_security_patterns(pr_file: PRFile):
  diff = pr_file.patch_text
  patterns = [("eval usage", r"eval\("),
              ("passwords", r"password\s*=\s*[\"']"),
              ("secrets", r"(api_key|secret|token)\s*=\s*[\"']"),
              ("injections", r"shell\s*=\s*True"),
              ("sql", r"f[\"'].*?(SELECT|INSERT|UPDATE|DELETE)")]
  hits = {}
  for label, pattern in patterns:
    match = re.search(pattern, diff, re.IGNORECASE)
    if match:
      hits[label] = f"Match found for {label} : {match.group()}"

  return hits


def get_repo_memory(pr_file: PRFile, repo: Repository, db: Session):
  memory = db.query(RepoMemory).filter(RepoMemory.repo_id == repo.id, RepoMemory.file_path == pr_file.file_path).first()
  if memory:
    return memory.pattern_summary
  else:
    return "No prior memory for this file"

  
get_diff_declaration = types.FunctionDeclaration(
  name = "get_diff",
  description = "Returns the raw code diff (patch) for the file being reviewed in a pull request, showing exactly what lines were added or removed",

)


get_file_history_declaration = types.FunctionDeclaration(
  name = "get_file_history",
  description = "Returns the commit history of the file being reviewed in a pull request, showing commit hash, message, author, and date for a each commit",

)


check_security_patterns_declaration = types.FunctionDeclaration(
  name = "check_security_patterns",
  description = "Returns the results of a basic manual security run of the file, returning label of the check and the raw data of the match for all matches"

)


get_repo_memory_declaration = types.FunctionDeclaration(
  name= "get_repo_memory",
  description= "Returns memory on this file based on previous reviews if it exists, returning a summary of the findings from complied from any previous runs"
)
tools = types.Tool(function_declarations=[get_diff_declaration, get_file_history_declaration, check_security_patterns_declaration,get_repo_memory_declaration])

async def agent_review(pr_file: PRFile, repo: Repository, current_user: User, db: Session):
  file_path = pr_file.file_path
  initial_prompt = textwrap.dedent(f"""
  You are an expert code reviewer tasked with finding bugs and security issues for a given pull request file. 
  The file you have to review is {file_path}. You have 4 tools available.
  Use these tools to your advantage to give a detailed pull request review of your findings""").strip()

  contents = [
    types.Content(role="user", parts=[types.Part(text=initial_prompt)] )
    ]

  max_iterations = 5
  iterations = 0
  while iterations < max_iterations:
    iterations += 1
    response = await client.aio.models.generate_content(
      model="gemini-3.5-flash-lite",
      contents = contents,
      config=types.GenerateContentConfig(tools=[tools])
    )

    contents.append(response.candidates[0].content)
    part = response.candidates[0].content.parts[0]
    if part.function_call:
      function_name = part.function_call.name

      if function_name == "get_diff":
        tool_result = get_diff(pr_file)
      elif function_name == "get_file_history":
        tool_result = await get_file_history(pr_file, repo, current_user)
      elif function_name == "check_security_patterns":
        tool_result = check_security_patterns(pr_file)
      elif function_name == "get_repo_memory":
        tool_result = get_repo_memory(pr_file, repo, db)
      else:
        tool_result = f"'{function_name}' is not a valid tool. Please call one of: get_diff, get_file_history, check_security_patterns, get_repo_memory."
      function_response_part = types.Part.from_function_response(
        name=function_name,
        response={"result": tool_result},
        )
      contents.append(types.Content(role="user", parts=[function_response_part]))
    else:
      break

  contents.append(
    types.Content(role="user", parts=[types.Part(
      text="Based on everything you've gathered, provide your final structured review now, also produce an updated one paragraph memory summary of recurring patterns in this file, incorporating both the prior summary and this review's findings"
    )] )
  )
  response = await client.aio.models.generate_content(
    model="gemini-3.5-flash-lite",
    contents=contents,
    config=types.GenerateContentConfig(
      response_mime_type="application/json",
      response_schema=ReviewOutput,
    )
  )
  review_output = response.parsed
  for finding in review_output.findings:
    pr_id = pr_file.pr_id
    file_id = pr_file.id
    line_number = finding.line_number
    severity = finding.severity
    category = finding.category
    finding_text = finding.finding_text
    suggestion = finding.suggestion
    finding = ReviewFinding(
      pr_id = pr_id,
      file_id = file_id,
      line_number = line_number,
      severity = severity,
      category = category,
      finding_text = finding_text,
      suggestion = suggestion,
    )
    db.add(finding)
  repo_memory = db.query(RepoMemory).filter(RepoMemory.repo_id == repo.id, RepoMemory.file_path == pr_file.file_path).first()
  if repo_memory:
    repo_memory.pattern_summary = review_output.updated_memory_summary
  else:
    repo_memory = RepoMemory(
      repo_id = repo.id,
      file_path = pr_file.file_path,
      pattern_summary = review_output.updated_memory_summary,
    )
    db.add(repo_memory)
  db.commit()
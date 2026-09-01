import httpx, re
from ..models import PRFile, Repository, User


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

  

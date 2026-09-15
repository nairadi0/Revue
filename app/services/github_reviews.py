import re
from collections import Counter
import httpx
from ..config import settings
from ..models import AgentRun, PullRequest, Repository, ReviewFinding, PRFile
from .github_app import GITHUB_API, repo_headers


HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


class ReviewPostError(Exception):
  pass


def diff_lines(patch_text: str) -> set[int]:
  lines: set[int] = set()
  new_line: int | None = None
  for raw in (patch_text or "").splitlines():
    header = HUNK_HEADER.match(raw)
    if header:
      new_line = int(header.group(1))
      continue
    if new_line is None or raw.startswith("\\"):
      continue
    if raw.startswith("-"):
      continue
    lines.add(new_line)
    new_line += 1
  return lines


def format_comment(finding: ReviewFinding) -> str:
  body = f"**{finding.severity.value} · {finding.category.value}**\n\n{finding.finding_text}"
  if finding.suggestion:
    body += f"\n\n**Suggestion:** {finding.suggestion}"
  return body


def _summary_line(file_count: int, findings: list[ReviewFinding]) -> str:
  counts = Counter(f.severity.value.lower() for f in findings)
  breakdown = ", ".join(f"{counts[s]} {s}" for s in ("high", "medium", "low") if counts[s])
  files = f"{file_count} file" if file_count == 1 else f"{file_count} files"
  issues = f"{len(findings)} issue" if len(findings) == 1 else f"{len(findings)} issues"
  return f"Revue reviewed {files} and found {issues} — {breakdown}."


def build_review(run: AgentRun, findings: list[ReviewFinding], files: list[PRFile]) -> dict | None:
  if not findings:
    return None

  files_by_id = {file.id: file for file in files}
  comments = []
  unanchored = []
  for finding in findings:
    file = files_by_id.get(finding.file_id)
    if file is not None and finding.line_number in diff_lines(file.patch_text):
      comments.append({
        "path": file.file_path,
        "line": finding.line_number,
        "side": "RIGHT",
        "body": format_comment(finding),
      })
    else:
      path = file.file_path if file is not None else "unknown file"
      unanchored.append(f"- `{path}:{finding.line_number}` — {format_comment(finding)}")

  body = _summary_line(len(files), findings)
  if unanchored:
    body += "\n\n**Outside the diff** (could not be attached inline):\n\n" + "\n".join(unanchored)
  body += f"\n\n[View this run in Revue]({settings.frontend_url}/runs/{run.id})"

  return {"event": "COMMENT", "body": body, "comments": comments}


async def post_review(repo: Repository, pr: PullRequest, payload: dict) -> int:
  url = f"{GITHUB_API}/repos/{repo.owner}/{repo.name}/pulls/{pr.pr_number}/reviews"
  async with httpx.AsyncClient() as client:
    response = await client.post(url, headers=await repo_headers(repo), json=payload)
  if response.status_code != 200:
    raise ReviewPostError(f"GitHub rejected the review ({response.status_code}): {response.text[:500]}")
  return response.json()["id"]


def review_url(repo: Repository, pr: PullRequest, review_id: int) -> str:
  return f"https://github.com/{repo.owner}/{repo.name}/pull/{pr.pr_number}#pullrequestreview-{review_id}"

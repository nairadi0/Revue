from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, func, ForeignKey, Enum, UniqueConstraint, JSON
from .database import Base
from datetime import datetime
from enum import Enum as PyEnum


class User(Base): 
  __tablename__ = "users"

  id: Mapped[int] = mapped_column(primary_key=True)
  github_id: Mapped[int] = mapped_column(unique=True)
  username: Mapped[str] = mapped_column(String(50), unique=True)
  access_token: Mapped[str] = mapped_column(String(255))
  token_expires_at: Mapped[datetime]
  refresh_token: Mapped[str] = mapped_column(String(255))
  created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())



class Repository(Base):
  __tablename__ = "repositories"

  id: Mapped[int] = mapped_column(primary_key=True)
  github_repo_id: Mapped[int] = mapped_column(unique=True)
  owner: Mapped[str]
  name: Mapped[str]
  default_branch: Mapped[str]


class UserRepository(Base):
  __tablename__ = "user_repositories"
  id: Mapped[int] =  mapped_column(primary_key=True)
  user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
  repo_id: Mapped[int] =  mapped_column(ForeignKey("repositories.id"))
  connected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
  __table_args__ = (
    UniqueConstraint("user_id", "repo_id", name="uq_user_repo"),
  )


class Status(PyEnum):
  OPEN = "OPEN"
  CLOSED = "CLOSED"
  MERGED = "MERGED"


class AgentStatus(PyEnum):
  PENDING = "PENDING"
  RUNNING = "RUNNING"
  SUCCESS = "SUCCESS"
  FAILED = "FAILED"


class Severity(PyEnum):
  LOW = "LOW"
  MEDIUM = "MEDIUM"
  HIGH = "HIGH"


class Category(PyEnum):
  SECURITY = "SECURITY"
  BUG = "BUG"
  PERFORMANCE = "PERFORMANCE"
  STYLE = "STYLE"
  BEST_PRACTICE = "BEST PRACTICE"


class PullRequest(Base):
  __tablename__ = "pull_requests" 

  id: Mapped[int] = mapped_column(primary_key=True)
  repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
  pr_number: Mapped[int] = mapped_column()
  title: Mapped[str]
  author: Mapped[str]
  status: Mapped[Status] = mapped_column(Enum(Status))
  opened_at: Mapped[datetime] 
  __table_args__ = (
    UniqueConstraint("repo_id", "pr_number", name="uq_repo_pr_number"), 
  )


class PRFile(Base):
  __tablename__ = "pr_files"

  id: Mapped[int] = mapped_column(primary_key=True)
  pr_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id"))
  file_path: Mapped[str]
  additions: Mapped[int]
  deletions: Mapped[int]
  patch_text: Mapped[str]


class ReviewFinding(Base):
  __tablename__ = "review_findings"

  id: Mapped[int] = mapped_column(primary_key=True)
  pr_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id"))
  file_id: Mapped[int] = mapped_column(ForeignKey("pr_files.id"))
  line_number: Mapped[int]
  severity: Mapped[Severity] = mapped_column(Enum(Severity))
  category: Mapped[Category] = mapped_column(Enum(Category))
  finding_text: Mapped[str]
  suggestion: Mapped[str]
  created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class RepoMemory(Base):
  __tablename__ = "repo_memory"

  id: Mapped[int] = mapped_column(primary_key=True)
  repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
  file_path: Mapped[str]
  pattern_summary: Mapped[str]
  last_updated: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

class AgentRun(Base):
  __tablename__ = "agent_runs"

  id: Mapped[int] = mapped_column(primary_key=True)
  pr_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id"))
  status: Mapped[AgentStatus] = mapped_column(Enum(AgentStatus))
  started_at: Mapped[datetime]
  completed_at: Mapped[datetime | None]
  tool_calls_log: Mapped[list] = mapped_column(JSON, default=list)
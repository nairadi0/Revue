from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, PullRequest, PRFile, ReviewFinding, UserRepository
from .auth import get_current_user


router = APIRouter()


@router.get("/metrics")
def get_metrics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  base = (
    db.query(ReviewFinding)
    .join(PullRequest, ReviewFinding.pr_id == PullRequest.id)
    .join(UserRepository, PullRequest.repo_id == UserRepository.repo_id)
    .filter(UserRepository.user_id == current_user.id)
  )

  severity_counts = (
    base.with_entities(ReviewFinding.severity, func.count(ReviewFinding.id))
    .group_by(ReviewFinding.severity)
    .all()
  )

  findings_over_time = (
    base.with_entities(func.date(ReviewFinding.created_at), func.count(ReviewFinding.id))
    .group_by(func.date(ReviewFinding.created_at))
    .order_by(func.date(ReviewFinding.created_at))
    .all()
  )

  most_flagged_files = (
    base.join(PRFile, ReviewFinding.file_id == PRFile.id)
    .with_entities(PRFile.file_path, func.count(ReviewFinding.id))
    .group_by(PRFile.file_path)
    .order_by(func.count(ReviewFinding.id).desc())
    .limit(10)
    .all()
  )

  most_flagged_authors = (
    base.with_entities(PullRequest.author, func.count(ReviewFinding.id))
    .group_by(PullRequest.author)
    .order_by(func.count(ReviewFinding.id).desc())
    .limit(10)
    .all()
  )

  return {
    "severity_counts": [{"severity": s, "count": c} for s, c in severity_counts],
    "findings_over_time": [{"date": str(d), "count": c} for d, c in findings_over_time],
    "most_flagged_files": [{"file_path": f, "count": c} for f, c in most_flagged_files],
    "most_flagged_authors": [{"author": a, "count": c} for a, c in most_flagged_authors],
  }

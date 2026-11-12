from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.crud.crud_project import get_projects, get_project
from app.schemas.project_schema import Project, ProjectSummary
from app.api.v1.routes.auth import get_current_user

router = APIRouter(tags=["projects"])

@router.get("", response_model=list[ProjectSummary])
def read_projects(
    phase: Optional[str] = Query(None, description="Filter by phase: Concept, Dev, Live"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    projects = get_projects(db, phase=phase, tag=tag)
    return projects

@router.get("/{project_id}", response_model=Project)
def read_project(project_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    project = get_project(db, project_id=project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.crud.crud_project import get_projects, get_project, create_project, update_project, delete_project
from app.crud.crud_project import get_projects, get_project, create_project, update_project, delete_project
from app.schemas.project_schema import Project, ProjectCreate, ProjectUpdate
from app.schemas.user_schema import User
from app.api.v1.routes.auth import get_current_admin_user
from app.api.v1.routes.auth import get_current_admin_user

router = APIRouter(tags=["admin"])

@router.get("/projects", response_model=List[Project])
def admin_read_projects(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    projects = get_projects(db)
    return projects

@router.get("/projects/{project_id}", response_model=Project)
def admin_read_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    project = get_project(db, project_id=project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects", response_model=Project)
def admin_create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    return create_project(db=db, project=project)

@router.put("/projects/{project_id}", response_model=Project)
def admin_update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    db_project = get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return update_project(db=db, project_id=project_id, project=project)

@router.delete("/projects/{project_id}")
def admin_delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    db_project = get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    delete_project(db=db, project_id=project_id)
    return {"message": "Project deleted successfully"}

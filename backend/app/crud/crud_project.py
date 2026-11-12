from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Union, Dict, Any
from app.db.models import Project, Tag, ProjectCapability, ProjectResource
from app.schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectResourceBase
from app.core.config import settings
from app.crud.firestore_crud import (
    fs_get_projects,
    fs_get_project,
    fs_create_project,
    fs_update_project,
    fs_delete_project
)
from app.utils.video_helpers import generate_embed_code

def get_projects(db: Optional[Session], phase: Optional[str] = None, tag: Optional[str] = None) -> Union[List[Project], List[Dict[str, Any]]]:
    if settings.USE_FIRESTORE:
        return fs_get_projects(phase=phase, tag=tag)
    query = db.query(Project).options(
        joinedload(Project.tags),
        joinedload(Project.capabilities),
        joinedload(Project.resources)
    )
    if phase:
        query = query.filter(Project.phase == phase)
    if tag:
        query = query.join(Project.tags).filter(Tag.name == tag)
    return query.all()

def get_project(db: Optional[Session], project_id: int) -> Union[Optional[Project], Optional[Dict[str, Any]]]:
    if settings.USE_FIRESTORE:
        return fs_get_project(project_id)
    return db.query(Project).options(
        joinedload(Project.tags),
        joinedload(Project.capabilities),
        joinedload(Project.resources)
    ).filter(Project.id == project_id).first()

def create_project(db: Optional[Session], project: ProjectCreate) -> Union[Project, Dict[str, Any]]:
    if settings.USE_FIRESTORE:
        return fs_create_project(project)
    db_project = Project(
        title=project.title,
        description=project.description,
        phase=project.phase,
        client_name=project.client_name,
        hours_saved=project.hours_saved
    )
    db.add(db_project)
    db.flush()

    # Add tags by name (create if not exists)
    tags = get_or_create_tags(db, project.tag_names)
    db_project.tags = tags

    # Add capabilities
    for cap in project.capabilities:
        db_cap = ProjectCapability(project_id=db_project.id, capability=cap)
        db.add(db_cap)

    # Add resources
    for res in project.resources:
        # Auto-generate embed code for video URLs if not provided
        embed_code = res.embed_code
        if res.resource_type == 'video' and not embed_code and res.url:
            embed_code = generate_embed_code(res.url)
        db_res = ProjectResource(
            project_id=db_project.id,
            resource_type=res.resource_type,
            url=res.url,
            embed_code=embed_code
        )
        db.add(db_res)

    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Optional[Session], project_id: int, project: ProjectUpdate) -> Union[Optional[Project], Optional[Dict[str, Any]]]:
    if settings.USE_FIRESTORE:
        return fs_update_project(project_id, project)
    db_project = get_project(db, project_id=project_id)
    if db_project is None:
        return None
    
    if project.title is not None:
        db_project.title = project.title
    if project.description is not None:
        db_project.description = project.description
    if project.phase is not None:
        db_project.phase = project.phase
    if project.client_name is not None:
        db_project.client_name = project.client_name
    if project.hours_saved is not None:
        db_project.hours_saved = project.hours_saved
    
    # Update tags by name (create if not exists)
    if project.tag_names:
        tags = get_or_create_tags(db, project.tag_names)
        db_project.tags = tags
    
    # Update capabilities
    if project.capabilities:
        db_project.capabilities.clear()
        for cap in project.capabilities:
            db_cap = ProjectCapability(project_id=db_project.id, capability=cap)
            db.add(db_cap)
    
    # Update resources
    if project.resources:
        db_project.resources.clear()
        for res in project.resources:
            # Auto-generate embed code for video URLs if not provided
            embed_code = res.embed_code
            if res.resource_type == 'video' and not embed_code and res.url:
                embed_code = generate_embed_code(res.url)
            db_res = ProjectResource(
                project_id=db_project.id,
                resource_type=res.resource_type,
                url=res.url,
                embed_code=embed_code
            )
            db.add(db_res)
    
    db.commit()
    db.refresh(db_project)
    return db_project

def delete_project(db: Optional[Session], project_id: int) -> bool:
    if settings.USE_FIRESTORE:
        return fs_delete_project(project_id)
    db_project = get_project(db, project_id=project_id)
    if db_project is None:
        return False
    db.delete(db_project)
    db.commit()
    return True

def get_or_create_tags(db: Session, tag_names: List[str]) -> List[Tag]:
    tags = []
    for name in tag_names:
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags

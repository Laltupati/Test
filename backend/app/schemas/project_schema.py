from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Ensure Optional is available
__all__ = ["ProjectBase", "ProjectCreate", "ProjectUpdate", "Project", "ProjectSummary", "Tag", "ProjectCapability", "ProjectResource"]

class TagBase(BaseModel):
    name: str

class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True

class ProjectCapabilityBase(BaseModel):
    capability: str

class ProjectCapability(ProjectCapabilityBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True

class ProjectResourceBase(BaseModel):
    resource_type: str
    url: Optional[str] = None
    embed_code: Optional[str] = None

class ProjectResource(ProjectResourceBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    title: str
    description: str
    phase: str
    client_name: Optional[str] = None
    hours_saved: int = 0

class ProjectCreate(ProjectBase):
    tag_names: List[str] = []
    capabilities: List[str] = []
    resources: List[ProjectResourceBase] = []

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    phase: Optional[str] = None
    client_name: Optional[str] = None
    hours_saved: Optional[int] = None
    tag_names: List[str] = []
    capabilities: List[str] = []
    resources: List[ProjectResourceBase] = []

    class Config:
        from_attributes = True

class Project(ProjectBase):
    id: int
    created_at: datetime
    tags: List[Tag] = []
    capabilities: List[ProjectCapability] = []
    resources: List[ProjectResource] = []

    class Config:
        from_attributes = True

class ProjectSummary(BaseModel):
    id: int
    title: str
    description: str
    phase: str
    client_name: Optional[str] = None
    hours_saved: int = 0
    tags: List[Tag] = []
    capabilities: List[ProjectCapability] = []
    resources: List[ProjectResource] = []

    class Config:
        from_attributes = True

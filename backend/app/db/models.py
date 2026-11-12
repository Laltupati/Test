from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

# Many-to-Many association table for Projects and Tags
project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    phase = Column(String, nullable=False)  # 'Concept', 'Dev', 'Live'
    client_name = Column(String, nullable=True)
    hours_saved = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tags = relationship("Tag", secondary=project_tags, back_populates="projects")
    capabilities = relationship("ProjectCapability", back_populates="project", cascade="all, delete-orphan")
    resources = relationship("ProjectResource", back_populates="project", cascade="all, delete-orphan")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    projects = relationship("Project", secondary=project_tags, back_populates="tags")

class ProjectCapability(Base):
    __tablename__ = "project_capabilities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    capability = Column(String, nullable=False)

    project = relationship("Project", back_populates="capabilities")

class ProjectResource(Base):
    __tablename__ = "project_resources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    resource_type = Column(String, nullable=False)  # 'video', 'docs', 'github'
    url = Column(String, nullable=True)
    embed_code = Column(Text, nullable=True)

    project = relationship("Project", back_populates="resources")

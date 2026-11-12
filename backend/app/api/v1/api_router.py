from fastapi import APIRouter
from app.api.v1.routes import auth, projects, admin_projects, admin_users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(admin_projects.router, prefix="/admin", tags=["admin"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["admin-users"])

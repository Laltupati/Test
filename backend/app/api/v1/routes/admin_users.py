from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.crud.crud_user import (
    get_user_by_email,
    get_users,
    get_user_by_id,
    create_user_admin,
    update_user_admin,
    delete_user
)
from app.schemas.user_schema import User, UserAdminCreate, UserAdminUpdate
from app.api.v1.routes.auth import get_current_admin_user

router = APIRouter(tags=["admin-users"])

@router.get("", response_model=List[User])
def admin_read_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    return get_users(db)

@router.get("/{user_id}", response_model=User)
def admin_read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    user = get_user_by_id(db, user_id=user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("", response_model=User)
def admin_create_user(
    user: UserAdminCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    existing = get_user_by_email(db, email=user.email)
    if existing:
        raise HTTPException(status_code=400, detail="User email already registered")
    return create_user_admin(db=db, user=user)

@router.put("/{user_id}", response_model=User)
def admin_update_user(
    user_id: int,
    user_update: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    existing = get_user_by_id(db, user_id=user_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user_update.email:
        email_owner = get_user_by_email(db, email=user_update.email)
        owner_id = email_owner.get("id") if isinstance(email_owner, dict) else getattr(email_owner, "id", None)
        if email_owner and owner_id != user_id:
            raise HTTPException(status_code=400, detail="Email is already used by another user")
    return update_user_admin(db=db, user_id=user_id, user_update=user_update)

@router.delete("/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    target_user = get_user_by_id(db, user_id=user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    admin_email = current_admin.get("email") if isinstance(current_admin, dict) else getattr(current_admin, "email", None)
    target_email = target_user.get("email") if isinstance(target_user, dict) else getattr(target_user, "email", None)
    
    if admin_email and target_email and admin_email.lower() == target_email.lower():
        raise HTTPException(status_code=400, detail="Cannot delete your own active admin account")
        
    delete_user(db=db, user_id=user_id)
    return {"message": "User deleted successfully"}

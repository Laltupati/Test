from typing import Optional, Union, Dict, Any
from sqlalchemy.orm import Session
from app.db.models import User
from app.core.security import get_password_hash, verify_password
from app.schemas.user_schema import UserCreate, UserAdminCreate, UserAdminUpdate, UserLogin
from app.core.config import settings
from app.crud.firestore_crud import (
    fs_get_user_by_email,
    fs_get_user_by_id,
    fs_get_users,
    fs_create_user,
    fs_create_user_admin,
    fs_update_user,
    fs_authenticate_user,
    fs_delete_user
)

def get_user_by_email(db: Optional[Session], email: str):
    if settings.USE_FIRESTORE:
        return fs_get_user_by_email(email)
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Optional[Session], user_id: int):
    if settings.USE_FIRESTORE:
        return fs_get_user_by_id(user_id)
    return db.query(User).filter(User.id == user_id).first()

def get_users(db: Optional[Session]):
    if settings.USE_FIRESTORE:
        return fs_get_users()
    return db.query(User).all()

def delete_user(db: Optional[Session], user_id: int) -> bool:
    if settings.USE_FIRESTORE:
        return fs_delete_user(user_id)
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False

def create_user(db: Optional[Session], user: UserCreate):
    if settings.USE_FIRESTORE:
        return fs_create_user(user)
    hashed_password = get_password_hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_user_admin(db: Optional[Session], user: UserAdminCreate):
    if settings.USE_FIRESTORE:
        return fs_create_user_admin(user)
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        is_admin=user.is_admin,
        is_active=user.is_active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_admin(db: Optional[Session], user_id: int, user_update: UserAdminUpdate):
    if settings.USE_FIRESTORE:
        return fs_update_user(user_id, user_update)
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        return None
    if user_update.email is not None:
        db_user.email = user_update.email
    if user_update.password is not None and user_update.password.strip():
        db_user.hashed_password = get_password_hash(user_update.password)
    if user_update.is_admin is not None:
        db_user.is_admin = user_update.is_admin
    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Optional[Session], email: str, password: str):
    if settings.USE_FIRESTORE:
        return fs_authenticate_user(email, password)
    user = get_user_by_email(db, email)
    if not user:
        return False
    # If user object is a dict or ORM model
    hashed_pwd = getattr(user, "hashed_password", None) if not isinstance(user, dict) else user.get("hashed_password")
    if not hashed_pwd or not verify_password(password, hashed_pwd):
        return False
    return user

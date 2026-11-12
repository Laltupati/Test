from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import secrets
import string
import httpx
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.database import get_db
from app.crud.crud_user import authenticate_user, create_user, get_user_by_email
from app.core.security import create_access_token, decode_access_token
from app.schemas.user_schema import UserCreate, User, Token
from app.core.config import settings

router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class GitHubCallbackRequest(BaseModel):
    code: Optional[str] = None
    email: Optional[EmailStr] = None

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_admin_user(current_user = Depends(get_current_user)):
    is_admin = current_user.get("is_admin") if isinstance(current_user, dict) else getattr(current_user, "is_admin", False)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user

@router.post("/register", response_model=User)
def register(user: UserCreate, db: Session = Depends(get_db)):
    domain = user.email.split("@")[-1].lower() if "@" in user.email else ""
    allowed_domains = [d.lower().strip() for d in settings.ALLOWED_ENTERPRISE_DOMAINS]
    if domain not in allowed_domains:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only @kpmg.com enterprise email addresses are allowed."
        )
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return create_user(db=db, user=user)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_email = user.get("email") if isinstance(user, dict) else user.email
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/github/config")
def get_github_config():
    return {
        "client_id": settings.GITHUB_CLIENT_ID,
        "sso_url": settings.GITHUB_ENTERPRISE_SSO_URL,
        "has_oauth": bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET)
    }

@router.post("/github/callback", response_model=Token)
async def github_callback(req: GitHubCallbackRequest, db: Session = Depends(get_db)):
    user_email: Optional[str] = None

    # Step 1: Exchange OAuth code if provided and credentials are configured
    if req.code and settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
        try:
            async with httpx.AsyncClient() as client:
                token_resp = await client.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data={
                        "client_id": settings.GITHUB_CLIENT_ID,
                        "client_secret": settings.GITHUB_CLIENT_SECRET,
                        "code": req.code,
                    },
                )
                token_data = token_resp.json()
                gh_access_token = token_data.get("access_token")

                if gh_access_token:
                    # Fetch user emails
                    email_resp = await client.get(
                        "https://api.github.com/user/emails",
                        headers={
                            "Authorization": f"Bearer {gh_access_token}",
                            "Accept": "application/vnd.github+json",
                        },
                    )
                    if email_resp.status_code == 200:
                        emails = email_resp.json()
                        for e in emails:
                            if e.get("primary") and e.get("verified"):
                                user_email = e.get("email")
                                break
                        if not user_email and emails:
                            user_email = emails[0].get("email")

                    # Fallback to /user profile if emails endpoint is restricted
                    if not user_email:
                        user_resp = await client.get(
                            "https://api.github.com/user",
                            headers={
                                "Authorization": f"Bearer {gh_access_token}",
                                "Accept": "application/vnd.github+json",
                            },
                        )
                        if user_resp.status_code == 200:
                            user_email = user_resp.json().get("email")
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub OAuth verification failed: {str(err)}"
            )

    # Step 2: Use provided email if JIT provisioning request
    if not user_email and req.email:
        user_email = str(req.email)

    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not retrieve email from GitHub Enterprise authentication.",
        )

    # Validate enterprise domain restriction (e.g. restrict to @kpmg.com)
    domain = user_email.split("@")[-1].lower() if "@" in user_email else ""
    allowed_domains = [d.lower().strip() for d in settings.ALLOWED_ENTERPRISE_DOMAINS]
    if domain not in allowed_domains:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only @kpmg.com enterprise email addresses are allowed.",
        )

    # Step 3: Just-In-Time (JIT) Provisioning - Find or create user in DB
    existing_user = get_user_by_email(db, email=user_email)
    if not existing_user:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        random_password = ''.join(secrets.choice(alphabet) for _ in range(16))
        user_create = UserCreate(email=user_email, password=random_password)
        create_user(db=db, user=user_create)

    # Step 4: Issue QualiVerse AI JWT Access Token
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

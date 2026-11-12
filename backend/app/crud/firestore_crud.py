from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from google.cloud import firestore
from app.db.firestore_db import get_firestore_client
from app.core.security import get_password_hash, verify_password
from app.schemas.user_schema import UserCreate, UserAdminCreate, UserAdminUpdate
from app.schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectResourceBase
from app.utils.video_helpers import generate_embed_code

# Helper function to get atomic sequence IDs in Firestore
def get_next_sequence_id(db: firestore.Client, sequence_name: str) -> int:
    counter_ref = db.collection("counters").document("global")
    
    @firestore.transactional
    def update_counter(transaction, ref):
        snapshot = ref.get(transaction=transaction)
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            current = data.get(sequence_name, 0)
        else:
            current = 0
        new_val = current + 1
        transaction.set(ref, {sequence_name: new_val}, merge=True)
        return new_val

    transaction = db.transaction()
    return update_counter(transaction, counter_ref)


# --- USER OPERATIONS ---

def fs_get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    users_ref = db.collection("users").where("email", "==", email).limit(1)
    docs = list(users_ref.stream())
    if not docs:
        return None
    data = docs[0].to_dict()
    if isinstance(data.get("created_at"), str):
        data["created_at"] = datetime.fromisoformat(data["created_at"])
    return data

def fs_create_user(user: UserCreate) -> Dict[str, Any]:
    db = get_firestore_client()
    user_id = get_next_sequence_id(db, "user_id_seq")
    now = datetime.now(timezone.utc)
    
    user_data = {
        "id": user_id,
        "email": user.email,
        "hashed_password": get_password_hash(user.password),
        "is_active": True,
        "is_admin": False,
        "created_at": now.isoformat()
    }
    
    db.collection("users").document(str(user_id)).set(user_data)
    user_data["created_at"] = now
    return user_data

def fs_create_user_admin(user: UserAdminCreate) -> Dict[str, Any]:
    db = get_firestore_client()
    user_id = get_next_sequence_id(db, "user_id_seq")
    now = datetime.now(timezone.utc)
    
    user_data = {
        "id": user_id,
        "email": user.email,
        "hashed_password": get_password_hash(user.password),
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "created_at": now.isoformat()
    }
    
    db.collection("users").document(str(user_id)).set(user_data)
    user_data["created_at"] = now
    return user_data

def fs_update_user(user_id: int, user_update: UserAdminUpdate) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    doc_ref = db.collection("users").document(str(user_id))
    snapshot = doc_ref.get()
    if not snapshot.exists:
        return None
    
    data = snapshot.to_dict() or {}
    update_data = {}
    if user_update.email is not None:
        update_data["email"] = user_update.email
        data["email"] = user_update.email
    if user_update.password is not None and user_update.password.strip():
        pwd_hash = get_password_hash(user_update.password)
        update_data["hashed_password"] = pwd_hash
        data["hashed_password"] = pwd_hash
    if user_update.is_admin is not None:
        update_data["is_admin"] = user_update.is_admin
        data["is_admin"] = user_update.is_admin
    if user_update.is_active is not None:
        update_data["is_active"] = user_update.is_active
        data["is_active"] = user_update.is_active
        
    if update_data:
        doc_ref.update(update_data)
        
    if isinstance(data.get("created_at"), str):
        data["created_at"] = datetime.fromisoformat(data["created_at"])
    return data

def fs_authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    user = fs_get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user

def fs_get_users() -> List[Dict[str, Any]]:
    db = get_firestore_client()
    docs = db.collection("users").stream()
    users = []
    for doc in docs:
        data = doc.to_dict()
        if isinstance(data.get("created_at"), str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        users.append(data)
    return users

def fs_get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    doc = db.collection("users").document(str(user_id)).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if isinstance(data.get("created_at"), str):
        data["created_at"] = datetime.fromisoformat(data["created_at"])
    return data

def fs_delete_user(user_id: int) -> bool:
    db = get_firestore_client()
    doc_ref = db.collection("users").document(str(user_id))
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    return True


# --- PROJECT OPERATIONS ---

def fs_get_projects(phase: Optional[str] = None, tag: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_firestore_client()
    query = db.collection("projects")
    
    if phase:
        query = query.where("phase", "==", phase)
        
    docs = query.stream()
    projects = []
    
    for doc in docs:
        data = doc.to_dict()
        if isinstance(data.get("created_at"), str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
            
        # Tag filtering in-memory if requested
        if tag:
            tags = [t.get("name") for t in data.get("tags", []) if isinstance(t, dict)]
            if tag not in tags:
                continue
                
        projects.append(data)
        
    projects.sort(key=lambda x: x.get("id", 0))
    return projects

def fs_get_project(project_id: int) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    doc_ref = db.collection("projects").document(str(project_id)).get()
    if not doc_ref.exists:
        return None
    data = doc_ref.to_dict()
    if isinstance(data.get("created_at"), str):
        data["created_at"] = datetime.fromisoformat(data["created_at"])
    return data

def fs_create_project(project: ProjectCreate) -> Dict[str, Any]:
    db = get_firestore_client()
    project_id = get_next_sequence_id(db, "project_id_seq")
    now = datetime.now(timezone.utc)
    
    # Process Tags
    tags = []
    for tag_name in project.tag_names:
        tag_id = get_next_sequence_id(db, f"tag_{tag_name}_seq")
        tags.append({"id": tag_id, "name": tag_name})
        
    # Process Capabilities
    capabilities = []
    for idx, cap in enumerate(project.capabilities, 1):
        capabilities.append({
            "id": idx,
            "project_id": project_id,
            "capability": cap
        })
        
    # Process Resources
    resources = []
    for idx, res in enumerate(project.resources, 1):
        # Auto-generate embed code for video URLs if not provided
        embed_code = res.embed_code
        if res.resource_type == 'video' and not embed_code and res.url:
            embed_code = generate_embed_code(res.url)
        resources.append({
            "id": idx,
            "project_id": project_id,
            "resource_type": res.resource_type,
            "url": res.url,
            "embed_code": embed_code
        })
        
    project_data = {
        "id": project_id,
        "title": project.title,
        "description": project.description,
        "phase": project.phase,
        "client_name": project.client_name,
        "hours_saved": project.hours_saved,
        "created_at": now.isoformat(),
        "tags": tags,
        "capabilities": capabilities,
        "resources": resources
    }
    
    db.collection("projects").document(str(project_id)).set(project_data)
    project_data["created_at"] = now
    return project_data

def fs_update_project(project_id: int, project: ProjectUpdate) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    doc_ref = db.collection("projects").document(str(project_id))
    snapshot = doc_ref.get()
    if not snapshot.exists:
        return None
        
    current_data = snapshot.to_dict()
    
    if project.title is not None:
        current_data["title"] = project.title
    if project.description is not None:
        current_data["description"] = project.description
    if project.phase is not None:
        current_data["phase"] = project.phase
    if project.client_name is not None:
        current_data["client_name"] = project.client_name
    if project.hours_saved is not None:
        current_data["hours_saved"] = project.hours_saved
        
    if project.tag_names:
        tags = []
        for tag_name in project.tag_names:
            tag_id = get_next_sequence_id(db, f"tag_{tag_name}_seq")
            tags.append({"id": tag_id, "name": tag_name})
        current_data["tags"] = tags
        
    if project.capabilities:
        capabilities = []
        for idx, cap in enumerate(project.capabilities, 1):
            capabilities.append({
                "id": idx,
                "project_id": project_id,
                "capability": cap
            })
        current_data["capabilities"] = capabilities
        
    if project.resources:
        resources = []
        for idx, res in enumerate(project.resources, 1):
            # Auto-generate embed code for video URLs if not provided
            embed_code = res.embed_code
            if res.resource_type == 'video' and not embed_code and res.url:
                embed_code = generate_embed_code(res.url)
            resources.append({
                "id": idx,
                "project_id": project_id,
                "resource_type": res.resource_type,
                "url": res.url,
                "embed_code": embed_code
            })
        current_data["resources"] = resources

    doc_ref.set(current_data)
    if isinstance(current_data.get("created_at"), str):
        current_data["created_at"] = datetime.fromisoformat(current_data["created_at"])
    return current_data

def fs_delete_project(project_id: int) -> bool:
    db = get_firestore_client()
    doc_ref = db.collection("projects").document(str(project_id))
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    return True

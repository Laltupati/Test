# API Reference

The FastAPI backend exposes JSON REST API endpoints under `/api/v1`.

---

## 🔐 Authentication Endpoints (`/api/v1/auth`)

### 1. Login & Obtain JWT Token
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Request Body**:
  ```x-www-form-urlencoded
  username=admin@qualiverse.ai
  password=S@ikir@n@12
  ```
- **Response** (`200 OK`):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer"
  }
  ```

### 2. User Registration
- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "email": "newuser@qualiverse.ai",
    "password": "StrongPassword@123"
  }
  ```

### 3. Get Current User Info
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response** (`200 OK`):
  ```json
  {
    "id": 1,
    "email": "admin@qualiverse.ai",
    "is_active": true,
    "is_admin": true,
    "created_at": "2026-08-13T16:05:00Z"
  }
  ```

---

## 📁 Projects Endpoints (`/api/v1/projects`)

### 1. List All Projects
- **Method**: `GET`
- **Path**: `/api/v1/projects`
- **Query Parameters**:
  - `phase` *(optional)*: Filter by phase (`Concept`, `Dev`, `Live`).
  - `tag` *(optional)*: Filter by tag name (e.g. `AI Solutions`).
- **Headers**: `Authorization: Bearer <access_token>`
- **Response** (`200 OK`):
  ```json
  [
    {
      "id": 1,
      "title": "Blaze (IMT)",
      "description": "Develop agent-based architecture for backend/frontend API integration...",
      "phase": "Dev",
      "client_name": "IMT",
      "hours_saved": 120,
      "tags": [
        { "id": 1, "name": "AI Solutions" }
      ],
      "capabilities": [
        { "id": 1, "project_id": 1, "capability": "Automated QA" }
      ],
      "resources": [
        {
          "id": 1,
          "project_id": 1,
          "resource_type": "video",
          "url": null,
          "embed_code": "<iframe ...></iframe>"
        }
      ]
    }
  ]
  ```

### 2. Get Project Details by ID
- **Method**: `GET`
- **Path**: `/api/v1/projects/{project_id}`
- **Headers**: `Authorization: Bearer <access_token>`

---

## 🛡️ Admin Projects CRUD Endpoints (`/api/v1/admin/projects`)

*Requires JWT token of an admin user (`is_admin=true`).*

### 1. List Admin Projects
- **Method**: `GET`
- **Path**: `/api/v1/admin/projects`

### 2. Create Project
- **Method**: `POST`
- **Path**: `/api/v1/admin/projects`
- **Request Body**:
  ```json
  {
    "title": "Enterprise GenAI Assistant",
    "description": "Building automated document QA agents for financial auditing.",
    "phase": "Dev",
    "client_name": "KPMG",
    "hours_saved": 200,
    "tag_names": ["AI Solutions", "Agent Architecture"],
    "capabilities": ["Document Parsing", "RAG Pipeline"],
    "resources": [
      {
        "resource_type": "docs",
        "url": "https://example.com/docs",
        "embed_code": null
      }
    ]
  }
  ```

### 3. Update Project
- **Method**: `PUT`
- **Path**: `/api/v1/admin/projects/{project_id}`

### 4. Delete Project
- **Method**: `DELETE`
- **Path**: `/api/v1/admin/projects/{project_id}`
- **Response**: `{"message": "Project deleted successfully"}`

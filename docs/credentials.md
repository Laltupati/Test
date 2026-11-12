# Credentials & Security

This guide outlines security practices, default credentials, and password management in QualiVerse AI.

---

## 🔑 Default Seeded Accounts

The seeding script (`backend/seed.py`) provisions two default accounts on database initialization:

### 1. Admin Account
- **Role**: Full Admin (`is_admin=true`)
- **Email**: `admin@qualiverse.ai`
- **Password**: `S@ikir@n@12`
- **Permissions**: Can view, create, edit, and delete enterprise projects in the Admin Dashboard (`/admin`).

### 2. Standard User Account
- **Role**: Standard User (`is_admin=false`)
- **Email**: `user@qualiverse.ai`
- **Password**: `Qu@lity@12`
- **Permissions**: Can log in and explore showcase projects and blueprints.

---

## 🔐 Security Architecture

- **Password Hashing**: Uses `passlib[bcrypt]` with `bcrypt==4.0.1` for password hashing and verification.
- **JWT Authentication**: Encodes standard JWT tokens (`HS256` algorithm) with configurable expiration (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`).
- **HTTP Security Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `X-XSS-Protection: 1; mode=block` across all API responses.
- **Service Account Permissions**: Cloud Run uses a dedicated Google Cloud Service Account constrained strictly to `roles/datastore.user`.

---

## 🔄 Updating Seed Credentials

To modify default passwords, update `backend/seed.py`:

```python
# backend/seed.py
admin_data = UserCreate(email="admin@qualiverse.ai", password="YourNewPassword123")
user_data = UserCreate(email="user@qualiverse.ai", password="YourNewUserPassword123")
```

Then re-execute the seeder locally or via Cloud Run job:

```bash
# Local
python backend/seed.py

# Cloud Run
gcloud run jobs execute qualiverse-seed --region us-central1 --wait
```

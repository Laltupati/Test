# QualiVerse AI - Enterprise AI Solutions Directory

Welcome to the official documentation for **QualiVerse AI**, an interactive directory and showcase platform for enterprise AI initiatives.

QualiVerse AI tracks projects across their entire lifecycle (**Concept**, **Dev**, **Live**), filters them by tags, and provides an interactive split-screen viewer for project architecture, video demos, capabilities, and documentation.

---

## 🌟 Key Capabilities

- **Lifecycle Tracking**: Monitor projects across Concept, Development, and Production Live phases.
- **Enterprise Search & Tag Filtering**: Categorize and filter projects by capability and domain tags.
- **Split-Screen Blueprint Viewer**: View project architecture diagrams, embedded YouTube demos, documentation links, and GitHub repositories side-by-side.
- **Role-Based Access Control**: Standard users view showcase projects; Admin users manage projects with full CRUD capabilities.
- **GCP Native Integration**: Powered by Google Cloud Run and Google Cloud Firestore (`qualiverse-db`).
- **Unified Single Container Deployment**: FastAPI backend serves pre-built React frontend assets with full Single Page Application (SPA) routing fallback.

---

## 🚀 Quick Reference

| Resource | Value / URL |
| :--- | :--- |
| **Live App URL** | [https://qualiverse-m3nwxpgwpa-uc.a.run.app](https://qualiverse-m3nwxpgwpa-uc.a.run.app) |
| **API Health Check** | [https://qualiverse-m3nwxpgwpa-uc.a.run.app/health](https://qualiverse-m3nwxpgwpa-uc.a.run.app/health) |
| **GCP Project ID** | `adv-lighthouse-ai-qa-agent` |
| **GCP Firestore DB** | `qualiverse-db` (Dedicated Instance) |
| **GCP Region** | `us-central1` |

---

## 🔑 Default Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin User** | `admin@qualiverse.ai` | `S@ikir@n@12` |
| **Standard User** | `user@qualiverse.ai` | `Qu@lity@12` |

---

## 📚 Documentation Navigation

- 📐 **[System Architecture](architecture.md)** — Deep dive into the single-container model, FastAPI backend, and Firestore database layer.
- ☁️ **[GCP Cloud Deployment](gcp-deployment.md)** — Learn how to deploy to Cloud Run, apply Terraform IaC, and configure Cloud Build CI/CD.
- 💻 **[Local Setup & Scripts](local-setup.md)** — Instructions for running the project locally with `start.ps1`.
- 🔌 **[API Reference](api-reference.md)** — Complete FastAPI REST API endpoints and schema specifications.
- 🗄️ **[Firestore Database Schema](firestore-schema.md)** — Collection models, documents, and sequence counters in `qualiverse-db`.
- 🔐 **[Credentials & Security](credentials.md)** — Security architecture, password management, and JWT authentication.

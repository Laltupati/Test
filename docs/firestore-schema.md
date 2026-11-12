# Firestore Database Schema

QualiVerse AI uses **Google Cloud Firestore Native Mode** in the dedicated database instance **`qualiverse-db`**.

---

## 🗄️ Database Location & Instance Details

- **GCP Project ID**: `adv-lighthouse-ai-qa-agent`
- **Database ID**: `qualiverse-db`
- **Location**: `us-central1`
- **Console Link**: [Firestore `qualiverse-db` Panel](https://console.cloud.google.com/firestore/databases/qualiverse-db/data/panel?project=adv-lighthouse-ai-qa-agent)

---

## 📦 Collections Overview

```
qualiverse-db
├── users / {user_id}
├── projects / {project_id}
└── counters / global
```

---

## 1. `users` Collection

Stores user credentials and access role flags. Document IDs are numeric strings corresponding to user ID (e.g., `1`, `2`).

### Document Fields:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Integer user ID (e.g. `1`) |
| `email` | `string` | User email address (`admin@qualiverse.ai`) |
| `hashed_password` | `string` | Bcrypt hashed password string |
| `is_active` | `boolean` | Flag indicating account activity (`true`) |
| `is_admin` | `boolean` | Flag granting administrative privileges (`true`/`false`) |
| `created_at` | `timestamp` / `ISO string` | Document creation timestamp |

---

## 2. `projects` Collection

Stores enterprise showcase project details, tags, capability lists, and embedded resources. Document IDs match `project_id` (e.g., `1`, `2`).

### Document Fields:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Integer project ID (e.g. `1`) |
| `title` | `string` | Project title (e.g., `Blaze (IMT)`) |
| `description` | `string` | High-level project summary and scope |
| `phase` | `string` | Project phase (`Concept`, `Dev`, `Live`) |
| `client_name` | `string` | Target client name (`Honeywell`, `KPMG`) |
| `hours_saved` | `number` | Estimated delivery hours saved |
| `created_at` | `timestamp` / `ISO string` | Timestamp |
| `tags` | `array<map>` | List of tag objects (`[{"id": 1, "name": "AI Solutions"}]`) |
| `capabilities` | `array<map>` | List of capability objects (`[{"id": 1, "capability": "Automated QA"}]`) |
| `resources` | `array<map>` | List of resource objects (`[{"resource_type": "video", "embed_code": "..."}]`) |

---

## 3. `counters` Collection (`global` Document)

Maintains atomic auto-incrementing integer sequence counters for entities.

### Document Path: `/counters/global`
| Field | Type | Description |
| :--- | :--- | :--- |
| `user_id_seq` | `number` | Atomic sequence counter for user IDs |
| `project_id_seq` | `number` | Atomic sequence counter for project IDs |
| `tag_{name}_seq` | `number` | Sequence counter for unique tags |

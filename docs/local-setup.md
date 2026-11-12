# Local Setup & Development

QualiVerse AI includes automated scripts to simplify local environment configuration and execution.

---

## 📋 Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (with `npm`)
- **PowerShell** (Windows) or **Bash** (Linux/macOS)

---

## ⚡ Quick Start (Automated PowerShell Script)

Run `start.ps1` from the project root in PowerShell:

```powershell
.\start.ps1
```

### What `start.ps1` Automates:
1. **Prerequisite Check**: Validates that Python and Node.js are available on system PATH.
2. **Virtual Environment Creation**: Creates `.venv` in root directory if not present.
3. **Backend Dependency Installation**: Installs requirements from `backend/requirements.txt`.
4. **Database Seeding**: Runs `python backend/seed.py` to create tables and default admin/user accounts.
5. **Frontend Package Installation**: Checks `frontend/node_modules` and runs `npm install` if missing.
6. **Server Launch**: Spawns two PowerShell windows for FastAPI backend (`localhost:8000`) and Vite frontend (`localhost:5173`).

---

## 🛠️ Manual Step-by-Step Local Setup

### 1. Clone & Navigate
```bash
git clone https://github.com/kpmg-us/QualiVerse-AI.git
cd QualiVerse-AI
```

### 2. Backend Virtual Environment & Dependencies
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows)
.\.venv\Scripts\Activate.ps1

# Activate virtual environment (Linux / macOS)
source .venv/bin/activate

# Install backend packages
pip install -r backend/requirements.txt

# Seed SQLite database
python backend/seed.py

# Start backend server
python backend/run.py
```
*Backend runs at `http://localhost:8000`*

### 3. Frontend Setup
```bash
cd frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```
*Frontend runs at `http://localhost:5173`*

---

## 🧪 Local Execution with Cloud Firestore

You can test local backend execution against Google Cloud Firestore:

```powershell
$env:USE_FIRESTORE = "true"
$env:GCP_PROJECT_ID = "adv-lighthouse-ai-qa-agent"
$env:FIRESTORE_DATABASE = "qualiverse-db"

# Seed Firestore database locally
.\.venv\Scripts\python.exe backend/seed.py

# Run backend connected to Firestore
.\.venv\Scripts\python.exe backend/run.py
```

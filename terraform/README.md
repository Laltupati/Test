# 🌍 QualiVerse AI - Multi-Cloud Infrastructure (Terraform)

This folder contains separate, modular Terraform configurations for deploying **QualiVerse AI** to either **Google Cloud Platform (GCP)** or **Microsoft Azure**.

```
terraform/
├── azure/           # Microsoft Azure Infrastructure
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── gcp/             # Google Cloud Platform Infrastructure
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── README.md
```

---

## ☁️ 1. Deploying to Microsoft Azure

Provisions:
- **Azure Resource Group** (`rg-qualiverse-prod`)
- **Azure Container Registry (ACR)** (`acrqualiverse...`)
- **Azure Database for PostgreSQL Flexible Server** (`psql-qualiverse...` + `qualiverse_db`)
- **Azure Container Apps Environment & Backend API** (`ca-qualiverse-api`)
- **Azure Static Web Apps for Frontend SPA** (`swa-qualiverse-frontend...`)

### Execution:
```bash
cd terraform/azure
az login
terraform init
terraform plan
terraform apply -auto-approve
```

---

## ☁️ 2. Deploying to Google Cloud Platform (GCP)

Provisions:
- **GCP APIs** (Cloud Run, Firestore, Artifact Registry, Cloud Build)
- **Google Cloud Firestore Native Database** (`qualiverse-db`)
- **Google Artifact Registry Docker Repository** (`qualiverse-repo`)
- **Google Cloud Run v2 Single Container Service** (`qualiverse`)
- **Service Accounts, IAM bindings, & Cloud Armor WAF**

### Execution:
```bash
cd terraform/gcp
gcloud auth application-default login
terraform init
terraform plan
terraform apply -auto-approve
```

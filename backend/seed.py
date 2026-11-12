from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import SessionLocal, engine
from app.db.models import Base, User, Project, Tag, ProjectCapability, ProjectResource
from app.core.security import get_password_hash
from app.schemas.user_schema import UserCreate
from app.schemas.project_schema import ProjectCreate, ProjectResourceBase
from app.crud.firestore_crud import (
    fs_get_user_by_email,
    fs_create_user,
    fs_get_projects,
    fs_create_project,
    get_firestore_client
)

PROJECTS_DATA = [
    {
        "title": "Blaze (IMT)",
        "description": "Develop agent-based architecture for backend/frontend API integration and automated QA; unify delivery accelerators within Blaze for modernization and testing.",
        "phase": "Dev",
        "client_name": "IMT",
        "hours_saved": 120,
        "tags": ["AI Solutions"],
        "capabilities": ["Backend/Frontend API Integration", "Automated QA", "Delivery Accelerators", "Legacy Modernization"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "Honeywell",
        "description": "Building agentic solutions for Honeywell workflows to achieve zero defects, zero tickets.",
        "phase": "Concept",
        "client_name": "Honeywell",
        "hours_saved": 45,
        "tags": ["AI Solutions"],
        "capabilities": ["Workflow Automation", "Zero Ticket Target", "Defect Elimination", "Enterprise Agents"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "Boston College",
        "description": "Develop agent-based architecture for new UI and generate test cases based on Figma screens & process docs. Generate Playwright scripts via MCP.",
        "phase": "Live",
        "client_name": "Boston College",
        "hours_saved": 200,
        "tags": ["AI Solutions"],
        "capabilities": ["Figma Screen Parsing", "MCP Script Gen", "Playwright Integration", "UI Test Automation"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "KRIS API Agent",
        "description": "Build and test GenAI solutions and specialized API testing interfaces for enterprise integration.",
        "phase": "Concept",
        "client_name": "KRIS",
        "hours_saved": 30,
        "tags": ["AI Solutions"],
        "capabilities": ["GenAI Testing", "API Automation", "Interface Validation"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "Regions Bank",
        "description": "AI-driven solution to auto-generate scalable, domain-aware workflows integrating microservices into unified Concert business flow.",
        "phase": "Live",
        "client_name": "Regions Bank",
        "hours_saved": 350,
        "tags": ["AI Solutions"],
        "capabilities": ["Microservices Integration", "Domain-aware Logic", "Concert Business Flow", "Auto Workflow Generation"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "KPMG Engage (FOT)",
        "description": "Integrate AI accelerators for Salesforce testing; Currently using Copilot Custom Agent for Test case generation.",
        "phase": "Live",
        "client_name": "KPMG",
        "hours_saved": 180,
        "tags": ["AI Solutions"],
        "capabilities": ["Salesforce Testing", "Copilot Custom Agent", "Test Case Generation", "AI Accelerators"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "Workday Close Companion",
        "description": "Automate Workday accounting and analysis tasks using specialized AI Agents for financial reconciliation.",
        "phase": "Live",
        "client_name": "Workday",
        "hours_saved": 250,
        "tags": ["AI Solutions"],
        "capabilities": ["Workday ERP", "Accounting Automation", "Financial Analytics Agents", "Close Cycle Optimization"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "AI Testing Framework",
        "description": "Establish a structured, platform-agnostic AI testing framework ensuring accuracy, reliability, fairness, and ethical compliance.",
        "phase": "Live",
        "client_name": "Internal",
        "hours_saved": 150,
        "tags": ["AI Solutions"],
        "capabilities": ["Ethical Compliance", "Bias & Fairness Testing", "Accuracy Benchmarks", "Platform Agnostic Architecture"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    },
    {
        "title": "Deloitte AI Audit",
        "description": "AI-powered audit automation platform for financial compliance and risk assessment using GenAI models.",
        "phase": "Dev",
        "client_name": "Deloitte",
        "hours_saved": 95,
        "tags": ["AI Solutions"],
        "capabilities": ["Financial Compliance", "Risk Assessment", "GenAI Models", "Audit Automation"],
        "resources": [
            {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
            {"resource_type": "docs", "url": "https://kpmg-us.github.io/QualiVerse-AI/"},
            {"resource_type": "github", "url": "https://github.com/kpmg-us/QualiVerse-AI"}
        ]
    }
]

def seed_firestore():
    print("Seeding Google Cloud Firestore...")
    admin_email = "admin@qualiverse.ai"
    user_email = "user@qualiverse.ai"
    admin_pass = settings.DEFAULT_ADMIN_PASSWORD
    user_pass = settings.DEFAULT_USER_PASSWORD

    admin = fs_get_user_by_email(admin_email)
    if not admin:
        db = get_firestore_client()
        admin_data = UserCreate(email=admin_email, password=admin_pass)
        created_admin = fs_create_user(admin_data)
        db.collection("users").document(str(created_admin["id"])).update({"is_admin": True})
        print(f"Created admin user in Firestore: {admin_email}")
    else:
        print("Admin user already exists in Firestore.")

    user = fs_get_user_by_email(user_email)
    if not user:
        user_data = UserCreate(email=user_email, password=user_pass)
        fs_create_user(user_data)
        print(f"Created normal user in Firestore: {user_email}")
    else:
        print("Normal user already exists in Firestore.")

    existing_projects = fs_get_projects()
    if not existing_projects:
        for p_data in PROJECTS_DATA:
            resources = [
                ProjectResourceBase(
                    resource_type=r["resource_type"],
                    url=r.get("url"),
                    embed_code=r.get("embed_code")
                )
                for r in p_data["resources"]
            ]
            project_create = ProjectCreate(
                title=p_data["title"],
                description=p_data["description"],
                phase=p_data["phase"],
                client_name=p_data.get("client_name"),
                hours_saved=p_data.get("hours_saved", 0),
                tag_names=p_data.get("tags", []),
                capabilities=p_data.get("capabilities", []),
                resources=resources
            )
            fs_create_project(project_create)
            print(f"Created project in Firestore: {p_data['title']}")
    else:
        print("Firestore already contains projects. Skipping default project seeding.")

    print("Firestore seeded successfully!")

def seed_sqlalchemy():
    print("Seeding SQLite/SQLAlchemy Database...")
    admin_email = "admin@qualiverse.ai"
    user_email = "user@qualiverse.ai"
    admin_pass = settings.DEFAULT_ADMIN_PASSWORD
    user_pass = settings.DEFAULT_USER_PASSWORD

    db = SessionLocal()
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)

        # Create default admin user
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                email=admin_email,
                hashed_password=get_password_hash(admin_pass),
                is_active=True,
                is_admin=True
            )
            db.add(admin)
            db.commit()
            print(f"Created admin user: {admin_email}")
        else:
            admin.hashed_password = get_password_hash(admin_pass)
            db.commit()
            print(f"Updated admin user: {admin_email}")

        # Create normal test user
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            user = User(
                email=user_email,
                hashed_password=get_password_hash(user_pass),
                is_active=True,
                is_admin=False
            )
            db.add(user)
            db.commit()
            print(f"Created normal user: {user_email}")
        else:
            user.hashed_password = get_password_hash(user_pass)
            db.commit()
            print(f"Updated normal user: {user_email}")

        # Seed projects
        projects_data = [
            {
                "title": "Blaze (IMT)",
                "description": "Develop agent-based architecture for backend/frontend API integration and automated QA; unify delivery accelerators within Blaze for modernization and testing.",
                "phase": "Dev",
                "client_name": "IMT",
                "hours_saved": 120,
                "tags": ["AI Solutions"],
                "capabilities": ["Backend/Frontend API Integration", "Automated QA", "Delivery Accelerators", "Legacy Modernization"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "Honeywell",
                "description": "Building agentic solutions for Honeywell workflows to achieve zero defects, zero tickets.",
                "phase": "Concept",
                "client_name": "Honeywell",
                "hours_saved": 45,
                "tags": ["AI Solutions"],
                "capabilities": ["Workflow Automation", "Zero Ticket Target", "Defect Elimination", "Enterprise Agents"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://adk.dev/"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "Boston College",
                "description": "Develop agent-based architecture for new UI and generate test cases based on Figma screens & process docs. Generate Playwright scripts via MCP.",
                "phase": "Live",
                "client_name": "Boston College",
                "hours_saved": 200,
                "tags": ["AI Solutions"],
                "capabilities": ["Figma Screen Parsing", "MCP Script Gen", "Playwright Integration", "UI Test Automation"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "KRIS API Agent",
                "description": "Build and test GenAI solutions and specialized API testing interfaces for enterprise integration.",
                "phase": "Concept",
                "client_name": "KRIS",
                "hours_saved": 30,
                "tags": ["AI Solutions"],
                "capabilities": ["GenAI Testing", "API Automation", "Interface Validation"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "Regions Bank",
                "description": "AI-driven solution to auto-generate scalable, domain-aware workflows integrating microservices into unified Concert business flow.",
                "phase": "Live",
                "client_name": "Regions Bank",
                "hours_saved": 350,
                "tags": ["AI Solutions"],
                "capabilities": ["Microservices Integration", "Domain-aware Logic", "Concert Business Flow", "Auto Workflow Generation"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "KPMG Engage (FOT)",
                "description": "Integrate AI accelerators for Salesforce testing; Currently using Copilot Custom Agent for Test case generation.",
                "phase": "Live",
                "client_name": "KPMG",
                "hours_saved": 180,
                "tags": ["AI Solutions"],
                "capabilities": ["Salesforce Testing", "Copilot Custom Agent", "Test Case Generation", "AI Accelerators"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "Workday Close Companion",
                "description": "Automate Workday accounting and analysis tasks using specialized AI Agents for financial reconciliation.",
                "phase": "Live",
                "client_name": "Workday",
                "hours_saved": 250,
                "tags": ["AI Solutions"],
                "capabilities": ["Workday ERP", "Accounting Automation", "Financial Analytics Agents", "Close Cycle Optimization"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            },
            {
                "title": "AI Testing Framework",
                "description": "Establish a structured, platform-agnostic AI testing framework ensuring accuracy, reliability, fairness, and ethical compliance.",
                "phase": "Live",
                "client_name": "Internal",
                "hours_saved": 150,
                "tags": ["AI Solutions"],
                "capabilities": ["Ethical Compliance", "Bias & Fairness Testing", "Accuracy Benchmarks", "Platform Agnostic Architecture"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            }
        ,
            {
                "title": "Deloitte AI Audit",
                "description": "AI-powered audit automation platform for financial compliance and risk assessment using GenAI models.",
                "phase": "Dev",
                "client_name": "Deloitte",
                "hours_saved": 95,
                "tags": ["AI Solutions"],
                "capabilities": ["Financial Compliance", "Risk Assessment", "GenAI Models", "Audit Automation"],
                "resources": [
                    {"resource_type": "video", "url": None, "embed_code": "<iframe width=\"839\" height=\"472\" src=\"https://www.youtube.com/embed/m3htIdHnK4g\" title=\"Our Impact Plan 2024 - Planet\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"},
                    {"resource_type": "docs", "url": "https://example.com"},
                    {"resource_type": "github", "url": "https://github.com"}
                ]
            }
        ]

        existing_project_count = db.query(Project).count()
        if existing_project_count == 0:
            for p_data in projects_data:
                tags = []
                for tag_name in p_data["tags"]:
                    tag = db.query(Tag).filter(Tag.name == tag_name).first()
                    if not tag:
                        tag = Tag(name=tag_name)
                        db.add(tag)
                        db.flush()
                    tags.append(tag)

                project = Project(
                    title=p_data["title"],
                    description=p_data["description"],
                    phase=p_data["phase"],
                    client_name=p_data.get("client_name"),
                    hours_saved=p_data.get("hours_saved", 0),
                    tags=tags
                )
                db.add(project)
                db.flush()

                for cap in p_data["capabilities"]:
                    db_cap = ProjectCapability(project_id=project.id, capability=cap)
                    db.add(db_cap)

                for res in p_data["resources"]:
                    db_res = ProjectResource(
                        project_id=project.id,
                        resource_type=res["resource_type"],
                        url=res.get("url"),
                        embed_code=res.get("embed_code")
                    )
                    db.add(db_res)

                db.commit()
                print(f"Created project: {p_data['title']}")
        else:
            print("SQLite/SQLAlchemy database already contains projects. Skipping default project seeding.")

        print("Database seeded successfully!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

def seed_database():
    if settings.USE_FIRESTORE:
        seed_firestore()
    else:
        seed_sqlalchemy()

if __name__ == "__main__":
    seed_database()

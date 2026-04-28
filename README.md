# FitGyldrah

> A fitness platform connecting gym owners, trainers, and members into a unified system for managing gyms, scheduling sessions, and generating AI-assisted diet plans.

---

## Overview

FitGyldrah is a multi-role fitness management platform where:

- **Gym owners** can register and manage gyms.
- **Trainers** can apply to gyms and manage members.
- **Members** can join gyms and track their fitness journey.
- **Trainers** can generate AI-assisted diet plans based on user data.

---

## Current Status

This project is in early development.

### Implemented
- Django project setup
- Basic configuration using `.env`
- Core project structure

### In Progress / Planned
- User authentication (JWT)
- Role system (Owner / Trainer / Member)
- Gym management system
- Trainer-member workflow
- AI diet generation

---

## Tech Stack (Current)

- **Backend:** Django
- **Environment Management:** python-dotenv
- **Database (current):** SQLite
- **Future Plans:** PostgreSQL, AI integration

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <YOUR_REPO_URL>
cd fitgyldrah
```

### 2. Create Virtual Environment

```bash
python -m venv venv

# Linux / Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Setup Environment Variables

Create a `.env` file in the backend root directory:

```ini
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

 **Do NOT commit `.env` to GitHub.**

### 5. Run Migrations

```bash
python manage.py migrate
```

### 6. Run Development Server

```bash
python manage.py runserver
```

The server will start at: `http://127.0.0.1:8000/`

---

## Git Workflow

### Rules
- **Do NOT** push directly to `main`
- Always create a new branch

### Create a Branch
```bash
git checkout -b feature/<feature-name>
```

### Commit Changes
```bash
git add .
git commit -m "your message"
```

### Push Branch
```bash
git push -u origin feature/<feature-name>
```

### Open Pull Request
1. Go to GitHub
2. Create a PR
3. Get it reviewed before merging

---

## 📁 Project Structure (Basic)

```text
fitgyldrah/
│
├── backend/
│   ├── manage.py
│   ├── backend/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── ...
│
├── .env
├── requirements.txt
└── README.md
```

---

## ⚠️ Important Notes

- The `.env` file **must** remain private.
- Currently using SQLite (no PostgreSQL yet).
- Docker is **NOT** used at this stage.
- Keep commits clean and meaningful.

---

## 📌 Future Scope

- PostgreSQL integration
- JWT authentication
- Role-based access control
- AI-powered recommendations
- Full frontend (Next.js)

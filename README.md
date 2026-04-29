# FitGyldrah

> A fitness platform connecting gym owners, trainers, and members into a unified system for managing gyms, scheduling sessions, and generating AI-assisted diet plans.

---

## Overview

FitGyldrah is a multi-role fitness management platform where:

- Gym owners can register and manage gyms.
- Trainers can apply to gyms and manage members.
- Members can join gyms and track their fitness journey.
- Trainers can generate AI-assisted diet plans based on user data.

---

## Current Status

### Implemented
- Django backend and Next.js frontend setup
- PostgreSQL database integration
- Full containerization using Docker and Docker Compose
- Root environment variable configuration

### In Progress / Planned
- User authentication (JWT)
- Role system (Owner / Trainer / Member)
- Gym management system
- Trainer-member workflow
- AI diet generation (Local LLM)

---

## Tech Stack

- **Frontend:** Next.js (React), Tailwind CSS
- **Backend:** Django, Django REST Framework
- **Database:** PostgreSQL
- **Infrastructure:** Docker, Docker Compose

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <YOUR_REPO_URL>
cd fitgyldrah
```

---

### 2. Setup Environment Variables

Create a `.env` file in the root directory of the project:

```env
# Django Settings
SECRET_KEY=your-secure-secret-key-without-dollar-signs
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# PostgreSQL Database Settings
POSTGRES_DB=FitGyldrah
POSTGRES_USER=GyldrahUser
POSTGRES_PASSWORD=your_secure_password
DB_HOST=db
DB_PORT=5432
```

⚠️ Do NOT commit `.env` to GitHub.

---

### 3. Build and Run with Docker

Make sure Docker Desktop is running on your machine.

```bash
docker-compose up --build
```

After initial build:

```bash
docker-compose up
```

---

### 4. Access the Application

- Frontend (Next.js): http://localhost:3000  
- Backend API (Django): http://localhost:8000  
- Django Admin: http://localhost:8000/admin  

To stop the servers:

```bash
docker-compose down
```

---

## Git Workflow

### Rules

- Do NOT push directly to `main`
- Always create a new branch

---

### Create a Branch

```bash
git checkout -b feature/<feature-name>
```

---

### Commit Changes

```bash
git add .
git commit -m "your clear, descriptive message"
```

---

### Push Branch

```bash
git push -u origin feature/<feature-name>
```

---

### Open Pull Request

- Go to GitHub
- Create a PR
- Get it reviewed before merging

---

## Project Structure

```
FitGyldrah/
│
├── backend/
│   ├── backend/          # Django core settings
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
│
├── frontend/
│   ├── src/              # Next.js source code
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── .env                  # Root environment variables (Ignored by Git)
├── .gitignore
├── docker-compose.yml
└── README.md
```

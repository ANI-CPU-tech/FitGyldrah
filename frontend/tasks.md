# FitGyldrah Frontend — Implementation Tasks

## Backend API Contract (verified from source)

### Auth
| Endpoint | Method | Auth | Key fields |
|---|---|---|---|
| `/api/auth/login/` | POST | None | `email, password` → `{ access, refresh, user: { role } }` |
| `/api/auth/claim-role/` | POST | Bearer | `{ role: "MEMBER"\|"TRAINER"\|"OWNER" }` |

### Trainer
| Endpoint | Method | Auth | Key fields |
|---|---|---|---|
| `/api/trainers/profile/setup/` | POST | Bearer+IsTrainer | multipart: `certifications, years_experience, specialty, bio, cv_file, profile_picture, is_available` |
| `/api/trainers/profile/` | GET/PATCH | Bearer+IsTrainer | same fields (PATCH is always partial) |
| `/api/trainers/apply/` | POST | Bearer+IsTrainer | `{ gym: uuid, cover_letter? }` |
| `/api/trainers/applications/mine/` | GET | Bearer+IsTrainer | → `GymApplication[]` |

### Biometrics (trainer-scoped)
| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/biometrics/member/<member_id>/` | GET | Bearer+IsTrainer | Member must be actively assigned to trainer |
| `/api/biometrics/trends/` | GET | Bearer+IsMember | `?granularity=weekly\|monthly` |

### Schedules
| Endpoint | Method | Auth | Key fields |
|---|---|---|---|
| `/api/schedules/trainer/` | GET | Bearer+IsTrainer | `?status=PENDING\|ACCEPTED\|...` `?upcoming=true` |
| `/api/schedules/trainer/` | POST | Bearer+IsTrainer | `member (uuid), gym (uuid), session_type, proposed_time (ISO), duration_minutes, location?, notes?` |
| `/api/schedules/trainer/<id>/complete/` | PUT | Bearer+IsTrainer | No body — marks ACCEPTED→COMPLETED |

### Plans
| Endpoint | Method | Auth | Key fields |
|---|---|---|---|
| `/api/plans/trainer/` | GET | Bearer+IsTrainer | `?status= ?plan_type= ?member_id=` |
| `/api/plans/trainer/generate/` | POST | Bearer+IsTrainer | `{ member_id, plan_type: "DIET"\|"WORKOUT", extra_instructions? }` → `{ task_id }` |
| `/api/plans/trainer/generate/<task_id>/status/` | GET | Bearer+IsTrainer | → `{ state: "PENDING"\|"STARTED"\|"SUCCESS"\|"FAILURE", plan? }` |
| `/api/plans/trainer/<id>/` | PATCH | Bearer+IsTrainer | `{ content_json, title?, notes? }` — DRAFT only |
| `/api/plans/trainer/<id>/approve/` | PUT | Bearer+IsTrainer | No body — DRAFT→APPROVED |

### AI Logs
| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/ai/logs/` | GET | Bearer+IsTrainer | `?plan_type= ?status=` → summary list |
| `/api/ai/logs/<id>/` | GET | Bearer+IsTrainer | Full detail: system_prompt, user_prompt, raw_response, token counts |

---

## Tasks

- [x] **Task 1 — api.ts** — added `multipartRequest`, `trainerApi`, `biometricsApi`, `scheduleApi`, `planApi`, `aiApi` + all new TypeScript interfaces
- [x] **Task 2 — Login page** — already correct (role-based routing: OWNER/TRAINER/MEMBER/null)
- [x] **Task 3 — RoleGuard** — already correct (no changes needed)
- [x] **Task 4 — Trainer layout** (`src/app/dashboard/trainer/layout.tsx`) — `RoleGuard allowed={["TRAINER"]}` + sidebar nav
- [x] **Task 5 — Trainer overview** (`src/app/dashboard/trainer/page.tsx`) — profile summary + upcoming sessions table
- [x] **Task 6 — Profile & Gyms** (`src/app/dashboard/trainer/profile/page.tsx`)
  - Multipart POST/PATCH to setup/update profile (cv_file + profile_picture)
  - Apply to gym form (gym dropdown from public list + cover letter)
  - Application history table
- [x] **Task 7 — Clients** (`src/app/dashboard/trainer/clients/page.tsx`)
  - Derives assigned clients: approved applications → gym member lists → filter by trainer name
  - Click "View Trends" → fetches `GET /api/biometrics/member/<id>/`
  - Renders biometric history in `<table border="1">`
- [x] **Task 8 — Schedule** (`src/app/dashboard/trainer/schedule/page.tsx`)
  - Lists sessions with status filter dropdown
  - "Mark Complete" button → `PUT /api/schedules/trainer/<id>/complete/`
  - Propose session form: member UUID, gym (approved only), session type, datetime-local, duration, location, notes
- [x] **Task 9 — Plans** (`src/app/dashboard/trainer/plans/page.tsx`)
  - AI generate form → `POST /api/plans/trainer/generate/`
  - `setInterval` polling at 3s → `GET /api/plans/trainer/generate/<task_id>/status/`
  - Stops on SUCCESS/FAILURE or after 40 polls (2 min timeout)
  - Generated plan opens in `<textarea>` for JSON editing → PATCH to save
  - "Approve Plan" button → `PUT /api/plans/trainer/<id>/approve/`
  - Full plan list table with inline edit/approve actions
- [x] **Task 10 — AI Logs** (`src/app/dashboard/trainer/ai-logs/page.tsx`)
  - Filterable by plan_type and status
  - Table with `<details>`/`<summary>` per row — loads full detail on expand
  - Nested `<details>` for System Prompt, User Prompt, Raw Response
  - Token breakdown shown in expanded view

---

## File Tree

```
frontend/src/
├── components/
│   └── RoleGuard.tsx          (unchanged)
├── utils/
│   └── api.ts                 (expanded with trainer/bio/schedule/plan/ai APIs)
└── app/
    ├── login/page.tsx         (unchanged — already has role routing)
    ├── register/page.tsx      (unchanged)
    ├── claim-role/page.tsx    (unchanged)
    └── dashboard/
        ├── owner/             (unchanged)
        └── trainer/
            ├── layout.tsx
            ├── page.tsx
            ├── profile/page.tsx
            ├── clients/page.tsx
            ├── schedule/page.tsx
            ├── plans/page.tsx
            └── ai-logs/page.tsx
```

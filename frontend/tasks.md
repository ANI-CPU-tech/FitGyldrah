# FitGyldrah Frontend — Implementation Tasks

## Backend API Contract (verified from source)

### Auth
| Endpoint | Method | Auth | Payload | Response |
|---|---|---|---|---|
| `/api/auth/register/` | POST | None | `email, name, password, password2, height?, weight?, body_fat_pct?, goals?` | UserProfile |
| `/api/auth/login/` | POST | None | `email, password` | `{ access, refresh, user }` |
| `/api/auth/claim-role/` | POST | Bearer | `{ role: "MEMBER"\|"TRAINER"\|"OWNER" }` | `{ detail, user }` |

### Gyms
| Endpoint | Method | Auth | Payload | Response |
|---|---|---|---|---|
| `/api/gyms/` | POST | Bearer (OWNER) | `name, location, facilities, operating_hours (JSON), logo_url?` | GymReadSerializer |
| `/api/gyms/mine/` | GET | Bearer (OWNER) | — | `Gym[]` |
| `/api/gyms/<id>/tiers/` | POST | Bearer (OWNER) | `name, price, duration_type ("MONTHLY"\|"YEARLY"), description?` | SubscriptionTier |
| `/api/gyms/<id>/applications/?status=PENDING` | GET | Bearer (OWNER) | — | `GymApplication[]` |
| `/api/gyms/<id>/applications/<app_id>/review/` | PUT | Bearer (OWNER) | `{ action: "approve"\|"reject", owner_note? }` | `{ detail, application }` |
| `/api/gyms/<id>/members/?status=ACTIVE` | GET | Bearer (OWNER) | — | `MemberEnrollment[]` |
| `/api/gyms/<id>/members/<enrollment_id>/assign-trainer/` | PUT | Bearer (OWNER) | `{ trainer_id: uuid }` | `{ detail, enrollment }` |
| `/api/gyms/<id>/trainers/` | GET | Public | — | `TrainerProfile[]` (approved only) |

### Payments
| Endpoint | Method | Auth | Payload | Response |
|---|---|---|---|---|
| `/api/payments/connect-bank/` | POST | Bearer (OWNER) | `{ gym_id, account_number, ifsc_code }` | `{ detail, gym_id, linked_account_hint, is_payment_ready }` |

---

## Tasks

- [x] **Task 1 — API utility** (`src/utils/api.ts`)
  - `apiRequest<T>` core wrapper
  - `authApi`: register, login, claimRole
  - `gymApi`: mine, create, createTier, applications, reviewApplication, members, assignTrainer, trainers
  - `paymentApi`: connectBank
  - All TypeScript interfaces: UserProfile, Gym, SubscriptionTier, GymApplication, MemberEnrollment, TrainerProfile, ConnectBankPayload/Response, etc.

- [x] **Task 2 — Register page** (`src/app/register/page.tsx`) — unchanged

- [x] **Task 3 — Login page** (`src/app/login/page.tsx`)
  - Smart role-based routing after login:
    - No role / MEMBER → `/claim-role`
    - OWNER → `/dashboard/owner`
    - TRAINER → `/dashboard/trainer`
    - MEMBER (confirmed) → `/dashboard/member`

- [x] **Task 4 — Claim-role page** (`src/app/claim-role/page.tsx`)
  - Updated to use `dashboardForRole()` for post-claim redirect

- [x] **Task 5 — RoleGuard** (`src/components/RoleGuard.tsx`)
  - Reads token + user from localStorage on mount
  - No token → `/login`
  - Wrong role → user's own dashboard
  - Correct role → renders children

- [x] **Task 6 — Owner layout** (`src/app/dashboard/owner/layout.tsx`)
  - Wraps all owner pages in `<RoleGuard allowed={["OWNER"]}>`
  - Sidebar `<nav>` with `<Link>` to Overview, Facilities, Trainers, Members, Financials

- [x] **Task 7 — Owner overview** (`src/app/dashboard/owner/page.tsx`)
  - Fetches `GET /api/gyms/mine/`
  - Lists gyms with payment-ready status and quick-links

- [x] **Task 8 — Financials** (`src/app/dashboard/owner/financials/page.tsx`)
  - Gym selector dropdown (pre-selectable via `?gym=<id>`)
  - `POST /api/payments/connect-bank/` with `gym_id`, `account_number`, `ifsc_code`
  - Hides form and shows `linked_account_hint` on success
  - Shows "already linked" message if `gym.is_payment_ready`

- [x] **Task 9 — Facilities** (`src/app/dashboard/owner/facilities/page.tsx`)
  - Lists existing gyms with their tiers in a `<table>`
  - `POST /api/gyms/` form: name, location, facilities, operating_hours (JSON), logo_url
  - Per-gym `POST /api/gyms/<id>/tiers/` form: name, price, duration_type, description
  - Optimistic tier append on success

- [x] **Task 10 — Trainer Roster** (`src/app/dashboard/owner/trainers/page.tsx`)
  - Gym selector
  - Fetches `GET /api/gyms/<id>/applications/?status=PENDING`
  - Table: trainer name, email, specialty, experience, cover letter, CV link, applied date
  - Approve / Reject buttons → `PUT /api/gyms/<id>/applications/<app_id>/review/`
  - Removes reviewed row from list on success

- [x] **Task 11 — Member Directory** (`src/app/dashboard/owner/members/page.tsx`)
  - Gym selector
  - Fetches `GET /api/gyms/<id>/members/?status=ACTIVE` + `GET /api/gyms/<id>/trainers/` in parallel
  - Table: member name, email, tier, price, trainer, dates, days remaining
  - Per-row trainer `<select>` + Assign button → `PUT /api/gyms/<id>/members/<enrollment_id>/assign-trainer/`
  - Updates trainer_name in local state on success

---

## File Tree

```
frontend/src/
├── components/
│   └── RoleGuard.tsx
├── utils/
│   └── api.ts
└── app/
    ├── login/page.tsx
    ├── register/page.tsx
    ├── claim-role/page.tsx
    └── dashboard/
        └── owner/
            ├── layout.tsx
            ├── page.tsx
            ├── facilities/page.tsx
            ├── trainers/page.tsx
            ├── members/page.tsx
            └── financials/page.tsx
```

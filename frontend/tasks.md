# Authentication Module — Implementation Tasks

## Backend Analysis Findings

| Item | Value |
|---|---|
| Register endpoint | `POST /api/auth/register/` |
| Login endpoint | `POST /api/auth/login/` |
| Token refresh endpoint | `POST /api/auth/token/refresh/` |
| Register request fields | `email`, `name`, `password`, `password2`, `height?`, `weight?`, `body_fat_pct?`, `goals?` |
| Login request fields | `email`, `password` |
| Login response shape | `{ access, refresh, user: { id, email, name, role, … } }` |
| Register response shape | User profile object (no tokens — user must log in separately) |
| Error format | DRF validation dict: `{ field: ["msg"], detail: "msg" }` |

---

## Tasks

- [x] **Task 1 — API utility** (`src/utils/api.ts`)
  - Generic `apiRequest<T>` wrapper around native `fetch`
  - Returns `{ data, error, status }` — never throws
  - Typed convenience helpers: `authApi.register()`, `authApi.login()`
  - Shared TypeScript interfaces: `RegisterPayload`, `LoginPayload`, `UserProfile`, `LoginResponse`
  - Base URL driven by `NEXT_PUBLIC_API_URL` env var, falls back to `http://localhost:8000`

- [x] **Task 2 — Register page** (`src/app/register/page.tsx`)
  - `"use client"` component
  - Controlled inputs via `useState` for all fields discovered in `RegisterSerializer`
  - Client-side password match validation before network call
  - Calls `authApi.register()` on submit
  - On success → `router.push("/login")`
  - On failure → flattens DRF error dict and renders in `<p role="alert">`
  - Zero CSS / zero UI library components

- [x] **Task 3 — Login page** (`src/app/login/page.tsx`)
  - `"use client"` component
  - Controlled inputs for `email` and `password`
  - Calls `authApi.login()` on submit
  - On success → saves `access_token`, `refresh_token`, `user` to `localStorage` → `router.push("/dashboard")`
  - On failure → flattens DRF error dict and renders in `<p role="alert">`
  - Zero CSS / zero UI library components

---

## Files Created

```
frontend/
└── src/
    ├── utils/
    │   └── api.ts              ← fetch wrapper + types
    └── app/
        ├── login/
        │   └── page.tsx        ← login page
        └── register/
            └── page.tsx        ← registration page
```

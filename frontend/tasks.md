# Authentication Module — Implementation Tasks

## Backend Analysis Findings

| Item | Value |
|---|---|
| Register endpoint | `POST /api/auth/register/` |
| Login endpoint | `POST /api/auth/login/` |
| Claim-role endpoint | `POST /api/auth/claim-role/` |
| Token refresh endpoint | `POST /api/auth/token/refresh/` |
| Register request fields | `email`, `name`, `password`, `password2`, `height?`, `weight?`, `body_fat_pct?`, `goals?` |
| Login request fields | `email`, `password` |
| Claim-role request fields | `{ "role": "MEMBER" \| "TRAINER" \| "OWNER" }` + `Authorization: Bearer <token>` |
| Login response shape | `{ access, refresh, user: { id, email, name, role, … } }` |
| Claim-role response shape | `{ detail: "Role successfully set to …", user: { … } }` |
| Register response shape | User profile object (no tokens — user must log in separately) |
| Error format | DRF validation dict: `{ field: ["msg"], detail: "msg" }` |
| Default role on registration | `"MEMBER"` |
| Role re-claim restriction | `RoleClaimSerializer` blocks changes if `user.role !== "MEMBER"` |

---

## Tasks

- [x] **Task 1 — API utility** (`src/utils/api.ts`)
  - Generic `apiRequest<T>` wrapper around native `fetch`
  - Returns `{ data, error, status }` — never throws
  - Typed convenience helpers: `authApi.register()`, `authApi.login()`, `authApi.claimRole()`
  - Shared TypeScript interfaces: `RegisterPayload`, `LoginPayload`, `UserProfile`, `LoginResponse`, `ClaimRolePayload`, `ClaimRoleResponse`, `RoleValue`
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
  - On success → saves `access_token`, `refresh_token`, `user` to `localStorage`
  - **Smart redirect**: if `user.role !== "MEMBER"` (role already claimed) → `/dashboard`; otherwise → `/claim-role`
  - On failure → flattens DRF error dict and renders in `<p role="alert">`
  - Zero CSS / zero UI library components

- [x] **Task 4 — Claim-role page** (`src/app/claim-role/page.tsx`)
  - `"use client"` component
  - On mount: reads `access_token` from `localStorage`; if missing → `router.replace("/login")`
  - Three raw `<div>` cards, one per role (`MEMBER`, `OWNER`, `TRAINER`), each with `<h2>`, `<p>`, `<button>`
  - `handleRoleSelection(role)` sends `POST /api/auth/claim-role/` with `Authorization` header
  - Disables all buttons while a request is in-flight; shows "Setting role…" on the active button
  - On success → updates cached `user` in `localStorage` → `router.push("/dashboard")`
  - On failure → flattens DRF error dict and renders in `<p role="alert">`
  - Zero CSS / zero UI library components

---

## Files Created / Modified

```
frontend/
└── src/
    ├── utils/
    │   └── api.ts              ← added claimRole helper + ClaimRolePayload/Response/RoleValue types
    └── app/
        ├── login/
        │   └── page.tsx        ← updated redirect: /claim-role (or /dashboard if role already set)
        ├── register/
        │   └── page.tsx        ← unchanged
        └── claim-role/
            └── page.tsx        ← new role selection page
```

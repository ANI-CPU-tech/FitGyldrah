# Trainer Dashboard — Member Dropdown UX Fix

## Problem
Both Plan Builder and Calendar forms had a raw `<input type="text">` for "Member UUID",
forcing trainers to manually paste UUIDs. This is unusable in practice.

## Solution
Fetch the trainer's assigned client roster on mount via `GET /api/members/clients/`
(trainerApi.clients) and replace the UUID text inputs with `<select>` dropdowns.
The select option value is `member_id` (user UUID); display text is `member_name`.

## Tasks
- [x] plans/page.tsx — add clients state + fetch on mount, replace UUID input with select
- [x] schedule/page.tsx — add clients state + fetch on mount, replace UUID input with select

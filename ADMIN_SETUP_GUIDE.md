# AXIOM 4.0 — ADMIN SETUP & ONBOARDING GUIDE

This guide explains how to promote any Google/Clerk account to **Admin** so you can access the Admin Dashboard (`/admin`), manage rounds, configure rooms, generate pairings, and publish results.

---

## Architecture Overview

In AXIOM, Admins are stored in a dedicated `"Admin"` table in PostgreSQL (completely separated from the regular participant `"User"` table).

When an authenticated user signs in:
1. The app verifies their Clerk token.
2. It queries `/api/admin/me` to check if their account exists in the `"Admin"` table.
3. If they are in the `"Admin"` table, they are automatically routed to `/admin`.
4. If not, they are treated as a participant and routed to `/complete-profile` or `/dashboard`.

---

## Method 1: Direct Database Insert (Fastest & Recommended)

Open your PostgreSQL database tool (Render DB Console, psql, DBeaver, or Supabase SQL editor) and run:

### Option A: You know their Google Email address
You don't even need their Clerk User ID yet. Just insert their email into `"Admin"`. When they sign in with Google for the first time, the backend will automatically link their Clerk ID!

```sql
INSERT INTO "Admin" ("id", "clerkId", "email", "firstName", "lastName", "updatedAt")
VALUES (
  gen_random_uuid(),
  'pending_' || gen_random_uuid(),
  'admin_email@gmail.com',  -- Replace with your actual Google email
  'Admin',                  -- First Name
  'User',                   -- Last Name
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET "updatedAt" = NOW();
```

### Option B: The user has already signed in once
If the user already signed in through Google, you can find their Clerk ID in Clerk Dashboard (e.g. `user_2...`) or copy their record from the `"User"` table:

```sql
INSERT INTO "Admin" ("id", "clerkId", "email", "firstName", "lastName", "updatedAt")
SELECT gen_random_uuid(), "clerkId", "email", "firstName", "lastName", NOW()
FROM "User"
WHERE "email" = 'admin_email@gmail.com'
ON CONFLICT ("email") DO NOTHING;
```

---

## Method 2: Using the Secret Admin Onboarding API Endpoint

If you prefer not to touch the database directly, any signed-in user can promote themselves via the `/api/admin/onboard` endpoint using the `ADMIN_SECRET_KEY`.

### 1. Check your Backend Secret Key
In your Render backend environment variables:
`ADMIN_SECRET_KEY="Axiom@26"` (or whatever secret key you configured).

### 2. Get your Clerk JWT Token
1. Open the website and sign in with Google.
2. Open Browser DevTools (F12) -> Console.
3. Type:
   ```javascript
   await window.Clerk.session.getToken();
   ```
4. Copy the long JWT token string.

### 3. Send the Onboard Request
Using Postman, cURL, or directly in the browser console:

```javascript
fetch("https://axiom26.onrender.com/api/admin/onboard", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + await window.Clerk.session.getToken()
  },
  body: JSON.stringify({
    secretKey: "Axiom@26",
    firstName: "YourFirstName",
    lastName: "YourLastName"
  })
}).then(r => r.json()).then(console.log);
```

Response:
```json
{
  "success": true,
  "message": "Admin onboarded successfully"
}
```

---

## Verification: How to Test

1. Visit `https://axiom40.vercel.app` (or your domain).
2. Click **Sign in** and log in with the promoted Google account.
3. You will be routed directly to:
   ```text
   https://axiom40.vercel.app/admin
   ```
4. You will see the **Admin Control Panel**:
   - Event Management (`/admin/events`)
   - Round Controls & Pairings (`/admin/rounds`)
   - Participant Management (`/admin/participants`)
   - Room Allocations (`/admin/rooms`)
   - Live Tournament Tabulation (`/admin/results`)

---

## Troubleshooting

- **"Access Denied" when visiting `/admin`**:
  Make sure the email in the `"Admin"` table matches your Google email exactly (case-insensitive).
- **"Admin onboarding is not configured"**:
  Add `ADMIN_SECRET_KEY="Axiom@26"` to your Render environment variables and redeploy the backend.
- **Still routed to `/dashboard`**:
  Log out, then log back in so your token refreshes and the admin status cache clears.

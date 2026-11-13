# Google Sign-In Setup (Clerk Authentication)

AXIOM 4.0 uses **Clerk** for user authentication and Google OAuth.

When configuring Google OAuth in **Google Cloud Console**, the redirect URI must point to Clerk's OAuth callback handler, **NOT** the old backend `/api/auth/callback/google` endpoint.

---

## 1. Google Cloud Console Configuration

Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
Open your OAuth 2.0 Client ID (Web Application): `1077600303741-m9h1662lodadgnq4kts1kfhjhv65k5gs.apps.googleusercontent.com`.

### Authorized JavaScript origins
- `https://www.axiom4.online`
- `https://axiom4.online`
- `https://clerk.axiom4.online`
- `https://axiom40.vercel.app`
- `http://localhost:5173` (for local development)
- `http://localhost:3000`

### Authorized redirect URIs
- `https://clerk.axiom4.online/v1/oauth_callback`
- *(If using development instance)*: `https://<your-instance>.clerk.accounts.dev/v1/oauth_callback` (check Clerk Dashboard > Social Connections > Google)

> **CRITICAL**:
> Do NOT set the redirect URI to `https://axiom40.vercel.app/api/auth/callback/google` or `https://axiom4.online/sso-callback`.
> Google interacts directly with Clerk's callback URL (`/v1/oauth_callback`), and Clerk redirects the user back to the frontend.

---

## 2. Clerk Dashboard Configuration

1. Open [Clerk Dashboard](https://dashboard.clerk.com).
2. Go to **User & Authentication** > **Social Connections** > **Google**.
3. Ensure **Google** is enabled.
4. If using custom credentials, verify your **Client ID** and **Client Secret** match the Google Cloud Console credentials.
5. In **Configure** > **Domains & Paths**, ensure `https://www.axiom4.online` and `https://axiom40.vercel.app` are allowed domains / redirect destinations.

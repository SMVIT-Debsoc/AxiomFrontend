import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('AuthRedirectHandler handles explicit error query params from Google/Better Auth', async () => {
    const handlerCode = await readFile(new URL('../src/components/AuthRedirectHandler.jsx', import.meta.url), 'utf8');
    assert.match(handlerCode, /URLSearchParams/, 'Must parse URL search parameters');
    assert.match(handlerCode, /access_denied/, 'Must handle access_denied user cancellation');
    assert.match(handlerCode, /state_mismatch/, 'Must handle state_mismatch security failures');
    assert.doesNotMatch(handlerCode, /if \(!user\) {\s*navigate\("\/", \{replace: true\}\);/s,
        'Must NOT silently navigate to "/" when user is null without surfacing an error');
});

test('AuthRedirectHandler presents recovery actions instead of redirect loop', async () => {
    const handlerCode = await readFile(new URL('../src/components/AuthRedirectHandler.jsx', import.meta.url), 'utf8');
    assert.match(handlerCode, /Return to Sign in/, 'Must provide return to sign in button on failure');
    assert.match(handlerCode, /Retry verification/, 'Must provide retry button on failure');
});

test('GoogleAuthButton constructs correct callback URL and error states', async () => {
    const clientCode = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
    assert.match(clientCode, /strategy: "oauth_google"/, 'Must specify strategy oauth_google');
    assert.match(clientCode, /redirectUrl: "\/sso-callback"/, 'Must redirect to /sso-callback');
    assert.match(clientCode, /redirectUrlComplete: "\/auth-redirect"/, 'Must complete redirect to /auth-redirect');
    assert.match(clientCode, /VITE_CLERK_PUBLISHABLE_KEY/, 'Must respect publishable key env');
});

test('Sign-in triggers redirect to /auth-redirect when session already exists and AdminAccessModal unlocks via secret key only', async () => {
    const clientCode = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
    const modalCode = await readFile(new URL('../src/components/brand/AdminAccessModal.jsx', import.meta.url), 'utf8');
    assert.match(clientCode, /export function isSessionExistsError/, 'Must export isSessionExistsError helper');
    assert.match(clientCode, /if \(isSignedIn\)\s*{\s*window\.location\.assign\("\/auth-redirect"\)/s, 'GoogleAuthButton must redirect active session');
    assert.match(clientCode, /if \(isSessionExistsError\(failure\)\)\s*{\s*window\.location\.assign\("\/auth-redirect"\)/s, 'GoogleAuthButton must recover from session_exists error');
    assert.doesNotMatch(modalCode, /authenticateWithRedirect/, 'AdminAccessModal must NOT trigger Google OAuth login');
    assert.match(modalCode, /VITE_ADMIN_SECRET_KEY|ADMIN_SECRET_KEY/, 'AdminAccessModal must validate configured secret key');
    assert.match(modalCode, /navigate\("\/admin"\)/, 'AdminAccessModal must navigate directly to /admin');
});

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
    assert.match(clientCode, /provider: "google"/, 'Must specify provider google');
    assert.match(clientCode, /callbackURL: new URL\("\/auth-redirect"/, 'Must redirect to /auth-redirect');
    assert.match(clientCode, /VITE_GOOGLE_AUTH_ENABLED/, 'Must respect build flag');
});

import {Auth} from "@auth/core";
import Credentials from "@auth/core/providers/credentials";
import {timingSafeEqual} from "node:crypto";

/**
 * TEMPORARY sign-in (Auth.js) used while Clerk is not configured.
 *
 * Environment:
 *   AUTH_SECRET                  required, signs the session cookie
 *   TEMP_ADMIN_PASSCODE          passcode that signs in as an ADMIN
 *   TEMP_PARTICIPANT_PASSCODE    passcode that signs in as a participant
 *
 * With no passcodes configured nobody can sign in (fails closed).
 * The AXIOM backend verifies Clerk tokens, so this session does not
 * authorise backend API calls; it only gates the UI.
 */
function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function roleFor(passcode) {
  const {TEMP_ADMIN_PASSCODE, TEMP_PARTICIPANT_PASSCODE} = process.env;
  if (TEMP_ADMIN_PASSCODE && same(passcode, TEMP_ADMIN_PASSCODE)) return "ADMIN";
  if (TEMP_PARTICIPANT_PASSCODE && same(passcode, TEMP_PARTICIPANT_PASSCODE)) return "USER";
  return null;
}

const config = {
  basePath: "/api/auth",
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {strategy: "jwt", maxAge: 60 * 60 * 12},
  providers: [
    Credentials({
      credentials: {email: {}, passcode: {}},
      authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const role = roleFor(credentials?.passcode ?? "");
        if (!role || !/^[^@\s]+@[^@\s]+$/.test(email)) return null;
        return {id: email, email, name: email.split("@")[0], role};
      },
    }),
  ],
  callbacks: {
    jwt({token, user}) {
      if (user) token.role = user.role;
      return token;
    },
    session({session, token}) {
      session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
};

const handler = (request) => Auth(request, config);

export const GET = handler;
export const POST = handler;

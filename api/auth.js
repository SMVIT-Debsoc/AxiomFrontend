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

/**
 * Node handler. vercel.json rewrites /api/auth/* to /api/auth?authpath=*, because
 * Vercel applies the /api/* backend rewrite before dynamic [...catch-all] files.
 */
async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  // Vercel's Node helpers may already have parsed the body.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return req.body;
    return String(req.headers["content-type"] ?? "").includes("json")
      ? JSON.stringify(req.body)
      : new URLSearchParams(req.body).toString();
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    const proto = req.headers["x-forwarded-proto"]?.split(",")[0] ?? "http";
    const url = new URL(req.url, `${proto}://${req.headers.host}`);
    const rest = url.searchParams.get("authpath");
    if (rest !== null) {
      url.searchParams.delete("authpath");
      if (!url.pathname.startsWith("/api/auth/")) url.pathname = `/api/auth/${rest}`;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const response = await Auth(
      new Request(url, {method: req.method, headers, body: await readBody(req)}),
      config,
    );
    res.statusCode = response.status;
    for (const [name, value] of response.headers) {
      if (name !== "set-cookie") res.setHeader(name, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("temporary auth failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({error: "Temporary sign-in failed"}));
  }
}

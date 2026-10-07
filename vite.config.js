import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const temporaryAuthModule = fileURLToPath(new URL('./src/auth/temporary/index.jsx', import.meta.url))

/** Serves api/auth.js under `vite dev`, as Vercel does in production. */
function devAuthRoute(authEnv) {
  return {
    name: 'axiom-temporary-auth-route',
    configureServer(server) {
      Object.assign(process.env, authEnv)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/auth')) return next()
        const { default: handler } = await server.ssrLoadModule('/api/auth.js')
        await handler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Clerk is used when configured. Without a key (or when forced) the temporary Auth.js sign-in is used.
  const requested = env.VITE_AUTH_PROVIDER
  const temporary = requested ? requested === 'temporary' : !env.VITE_CLERK_PUBLISHABLE_KEY
  const authEnv = Object.fromEntries(
    ['AUTH_SECRET', 'TEMP_ADMIN_PASSCODE', 'TEMP_PARTICIPANT_PASSCODE']
      .filter((key) => env[key])
      .map((key) => [key, env[key]]),
  )

  return {
    plugins: [react(), ...(temporary ? [devAuthRoute(authEnv)] : [])],
    define: {
      'import.meta.env.VITE_AUTH_MODE': JSON.stringify(temporary ? 'temporary' : 'clerk'),
    },
    resolve: {
      alias: temporary ? { '@clerk/clerk-react': temporaryAuthModule } : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 8080,
      allowedHosts: true,
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})

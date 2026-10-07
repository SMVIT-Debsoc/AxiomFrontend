import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const temporaryAuthModule = fileURLToPath(new URL('./src/auth/temporary/index.jsx', import.meta.url))

/** Serves api/auth/[...nextauth].js under `vite dev`, as Vercel does in production. */
function devAuthRoute(authEnv) {
  return {
    name: 'axiom-temporary-auth-route',
    configureServer(server) {
      Object.assign(process.env, authEnv)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/auth')) return next()
        try {
          const { GET, POST } = await server.ssrLoadModule('/api/auth/[...nextauth].js')
          const origin = `http://${req.headers.host}`
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const hasBody = !['GET', 'HEAD'].includes(req.method)
          const response = await (req.method === 'POST' ? POST : GET)(
            new Request(origin + req.url, {
              method: req.method,
              headers: req.headers,
              body: hasBody ? Buffer.concat(chunks) : undefined,
            }),
          )
          res.statusCode = response.status
          for (const [name, value] of response.headers) {
            if (name !== 'set-cookie') res.setHeader(name, value)
          }
          res.setHeader('set-cookie', response.headers.getSetCookie())
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
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

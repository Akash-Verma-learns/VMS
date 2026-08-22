import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

// Fail fast — no silent JWT degradation
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters. Generate one with: openssl rand -base64 32')
  process.exit(1)
}

import { requireAuth } from './middleware/auth.middleware'
import {
  authRoutes,
  examRoutes,
  venueRoutes,
  approvalRoutes,
  falRoutes,
  financeRoutes,
  fieldReportRoutes,
  fieldRoutes,
  materialRoutes,
  inspectionRoutes,
  surveyRoutes,
  faceauthRoutes,
  cockpitRouter,
  reportRouter,
  candidateRoutes,
  admitCardRoutes,
} from './routes'

const app = express()

// Security headers
app.use(helmet())

// CORS — restrict to configured origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174']

const isDevEnv = process.env.NODE_ENV !== 'production'

/**
 * True for an origin on this machine or on a private LAN, any port.
 *
 * Only consulted outside production. The field PWA is opened on a phone over
 * a hotspot whose DHCP lease reassigns the laptop's address between sessions,
 * so pinning literal IPs in ALLOWED_ORIGINS breaks roughly every time the
 * network is cycled — and it surfaces as an unexplained 500 at login rather
 * than as anything that points at CORS. Public origins are still refused.
 */
function isPrivateLanOrigin(origin: string): boolean {
  let url: URL
  try { url = new URL(origin) } catch { return false }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true

  const octets = host.split('.')
  if (octets.length !== 4) return false
  const nums = octets.map((o) => (/^\d{1,3}$/.test(o) ? Number(o) : NaN))
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return false

  const [a, b] = nums
  return a === 10                          // 10.0.0.0/8
    || (a === 192 && b === 168)            // 192.168.0.0/16
    || (a === 172 && b >= 16 && b <= 31)   // 172.16.0.0/12
    || (a === 169 && b === 254)            // link-local, for ad-hoc pairing
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    if (isDevEnv && isPrivateLanOrigin(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Serve uploaded bill documents (auth required is handled at the route level)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Serialize BigInt fields as strings in all JSON responses
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
)

// Global rate limiter — 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})
app.use(globalLimiter)

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
  skipSuccessfulRequests: false,
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// MOD-01: Auth with strict rate limiting
app.use('/api/auth', authLimiter, authRoutes)

// MOD-02 through MOD-06
app.use('/api/exams', examRoutes)
app.use('/api/venues', venueRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/fal', falRoutes)
app.use('/api/finance', financeRoutes)
app.use('/api/field-report', fieldReportRoutes)

// MOD-07 through MOD-12
app.use('/api/field', fieldRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api/surveys', surveyRoutes)
app.use('/api/faceauth', faceauthRoutes)
app.use('/api/cockpit', cockpitRouter)
app.use('/api/reports', reportRouter)
app.use('/api/candidates', candidateRoutes)
app.use('/api/admit-cards', admitCardRoutes)

app.get('/api/me', requireAuth, (req: any, res) => {
  res.json({ user: req.user })
})

// Global error handler — catches thrown errors and prevents stack traces leaking to clients
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500
  const isProd = process.env.NODE_ENV === 'production'
  console.error('[ERROR]', err.message, err.stack)
  res.status(status).json({
    error: isProd && status === 500 ? 'Internal server error' : (err.message ?? 'Internal server error'),
  })
})

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`UPSC VMS API running on http://localhost:${PORT}`)
})

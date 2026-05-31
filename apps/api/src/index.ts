import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { requireAuth } from './middleware/auth.middleware'
import { authRoutes, examRoutes, venueRoutes, approvalRoutes, falRoutes, financeRoutes } from './routes'

const app = express()
app.use(cors())
app.use(express.json())

// Serialize BigInt fields as strings in all JSON responses
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/venues', venueRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/fal', falRoutes)
app.use('/api/finance', financeRoutes)

app.get('/api/me', requireAuth, (req: any, res) => {
  res.json({ user: req.user })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`UPSC VMS API running on http://localhost:${PORT}`)
})

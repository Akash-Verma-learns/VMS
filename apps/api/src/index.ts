import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import authRoutes from './routes/auth.routes'
import { requireAuth } from './middleware/auth.middleware'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)

app.get('/api/me', requireAuth, (req: any, res) => {
  res.json({ user: req.user })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`UPSC VMS API running on http://localhost:${PORT}`)
})
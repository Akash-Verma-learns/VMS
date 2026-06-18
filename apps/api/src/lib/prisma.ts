import { PrismaClient } from '@prisma/client'

// 1. The Primary Database (Used for all inserts, updates, and deletes)
const prisma = new PrismaClient()

// 2. The Read-Replica (Used ONLY for heavy dashboard queries and MIS reports)
// It defaults to the main DB if a read-replica URL isn't provided in the .env file yet
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.READ_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
})

// Export both so the controllers can choose which database to talk to
export { prisma, prismaRead }
export default prisma
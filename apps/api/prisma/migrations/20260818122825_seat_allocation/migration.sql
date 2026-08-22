-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'RELEASED');

-- CreateTable
CREATE TABLE "SeatAllocation" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "candidateName" TEXT,
    "venueId" TEXT,
    "allottedCity" TEXT,
    "seatNo" TEXT,
    "preferenceRank" INTEGER,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatAllocation_examId_status_idx" ON "SeatAllocation"("examId", "status");

-- CreateIndex
CREATE INDEX "SeatAllocation_venueId_status_idx" ON "SeatAllocation"("venueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_examId_rollNo_key" ON "SeatAllocation"("examId", "rollNo");

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

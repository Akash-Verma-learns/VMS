-- CreateEnum
CREATE TYPE "Role" AS ENUM ('JS', 'DS', 'US', 'SO', 'ASO', 'CS', 'VS', 'IO');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('PRELIMINARY', 'MAINS', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PENDING_SO', 'PENDING_US', 'RELEASED');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('GOVERNMENT', 'AIDED', 'PRIVATE', 'UNIVERSITY');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PROPOSED', 'SUBMITTED', 'SO_REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('VENUE_LIST', 'FAL_SANCTION', 'BILL_SETTLEMENT', 'ADVANCE_CALCULATION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FALStatus" AS ENUM ('DRAFT', 'PENDING_DS', 'SANCTIONED', 'ISSUED', 'ACKNOWLEDGED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('HONORARIUM', 'STATIONERY', 'CONTINGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PRE_EXAM_READINESS', 'EXAM_DAY_GATE_CLOSURE', 'SESSION_START', 'MATERIAL_DISPATCH');

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('PRE_EXAM_READINESS', 'ARRANGEMENT_DAY', 'EXAM_DAY_GATE_CLOSURE', 'EXAM_DAY_SECURITY', 'EXAM_DAY_PAPER_OPENING', 'EXAM_DAY_SESSION_START', 'EXAM_DAY_SESSION_END', 'EXAM_DAY_ATTENDANCE', 'POST_EXAM_DISPATCH', 'CCTV_ARCHIVAL_CONFIRMATION', 'BIOMETRIC_CONFIRMATION');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "TrackingEvent" AS ENUM ('DISPATCHED', 'RECEIVED', 'DISCREPANCY_REPORTED', 'POST_EXAM_DISPATCHED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'REMEDIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuthResult" AS ENUM ('MATCH', 'NO_MATCH', 'INCONCLUSIVE', 'NOT_CAPTURED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDING_REVIEW', 'UNDER_INVESTIGATION', 'CLOSED_LEGITIMATE', 'CLOSED_MALPRACTICE', 'ESCALATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "cityName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 1,
    "session1Start" TEXT,
    "session1End" TEXT,
    "session2Start" TEXT,
    "session2End" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Centre" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "suggestedCapacity" INTEGER NOT NULL,
    "finalCapacity" INTEGER,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "type" "VenueType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "VenueStatus" NOT NULL DEFAULT 'APPROVED',
    "rejectionNote" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "vsId" TEXT,
    "csId" TEXT NOT NULL,
    "seatsAllocated" INTEGER,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "rejectionComment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedBy" TEXT NOT NULL,
    "currentRole" "Role" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAudit" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAL" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "csId" TEXT NOT NULL,
    "falNumber" TEXT NOT NULL,
    "advanceAmount" BIGINT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "status" "FALStatus" NOT NULL DEFAULT 'DRAFT',
    "sanctionedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FALReminder" (
    "id" TEXT NOT NULL,
    "falId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,

    CONSTRAINT "FALReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceCalculation" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "candidateCount" INTEGER NOT NULL,
    "honorarium" BIGINT NOT NULL,
    "stationery" BIGINT NOT NULL,
    "contingency" BIGINT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedById" TEXT NOT NULL,

    CONSTRAINT "AdvanceCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "type" "BillType" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'SUBMITTED',
    "documentUrl" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "isDrill" BOOLEAN NOT NULL DEFAULT false,
    "reportType" "ReportType" NOT NULL,
    "data" JSONB NOT NULL,
    "deviceTime" TIMESTAMP(3) NOT NULL,
    "serverTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldPhoto" (
    "id" TEXT NOT NULL,
    "fieldReportId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckpointSubmission" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "type" "CheckpointType" NOT NULL,
    "data" JSONB NOT NULL,
    "photoUrls" TEXT[],
    "isDrillMode" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckpointSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillSubmission" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "type" "CheckpointType" NOT NULL,
    "data" JSONB NOT NULL,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueReadiness" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "vsId" TEXT NOT NULL,
    "status" "ReadinessStatus" NOT NULL DEFAULT 'PENDING',
    "checklistData" JSONB,
    "submittedAt" TIMESTAMP(3),
    "isDrillMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPin" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "omrCount" INTEGER NOT NULL DEFAULT 0,
    "salCount" INTEGER NOT NULL DEFAULT 0,
    "stationeryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialTracking" (
    "id" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "eventType" "TrackingEvent" NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "quantity" INTEGER,
    "remarks" TEXT,
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "ioId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "isExamDay" BOOLEAN NOT NULL DEFAULT false,
    "status" "InspectionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "checklistData" JSONB,
    "photoUrls" TEXT[],
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "findings" TEXT,
    "requiresRemediation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examId" TEXT,
    "createdBy" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "recipientRoles" TEXT[],
    "recipientCities" TEXT[],
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceAuthRecord" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "candidateRollNo" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION,
    "matchResult" "AuthResult" NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "caseStatus" "CaseStatus" NOT NULL DEFAULT 'PENDING_REVIEW',

    CONSTRAINT "FaceAuthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JammerStatus" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "jammerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JammerStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePreference" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "candidateName" TEXT,
    "priority1" TEXT NOT NULL,
    "priority2" TEXT,
    "priority3" TEXT,
    "priority4" TEXT,
    "priority5" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpToken_email_idx" ON "OtpToken"("email");

-- CreateIndex
CREATE INDEX "OtpToken_expiresAt_idx" ON "OtpToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_examCode_key" ON "Exam"("examCode");

-- CreateIndex
CREATE INDEX "VenueAssignment_examId_status_idx" ON "VenueAssignment"("examId", "status");

-- CreateIndex
CREATE INDEX "VenueAssignment_csId_idx" ON "VenueAssignment"("csId");

-- CreateIndex
CREATE UNIQUE INDEX "FAL_falNumber_key" ON "FAL"("falNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPin_pin_key" ON "MaterialPin"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPin_qrCode_key" ON "MaterialPin"("qrCode");

-- CreateIndex
CREATE INDEX "FaceAuthRecord_examId_flagged_idx" ON "FaceAuthRecord"("examId", "flagged");

-- CreateIndex
CREATE INDEX "FaceAuthRecord_examId_caseStatus_idx" ON "FaceAuthRecord"("examId", "caseStatus");

-- CreateIndex
CREATE INDEX "CandidatePreference_examId_idx" ON "CandidatePreference"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePreference_examId_rollNo_key" ON "CandidatePreference"("examId", "rollNo");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Centre" ADD CONSTRAINT "Centre_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_vsId_fkey" FOREIGN KEY ("vsId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_csId_fkey" FOREIGN KEY ("csId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAudit" ADD CONSTRAINT "ApprovalAudit_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAudit" ADD CONSTRAINT "ApprovalAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAL" ADD CONSTRAINT "FAL_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAL" ADD CONSTRAINT "FAL_csId_fkey" FOREIGN KEY ("csId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAL" ADD CONSTRAINT "FAL_sanctionedById_fkey" FOREIGN KEY ("sanctionedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FALReminder" ADD CONSTRAINT "FALReminder_falId_fkey" FOREIGN KEY ("falId") REFERENCES "FAL"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceCalculation" ADD CONSTRAINT "AdvanceCalculation_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceCalculation" ADD CONSTRAINT "AdvanceCalculation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceCalculation" ADD CONSTRAINT "AdvanceCalculation_computedById_fkey" FOREIGN KEY ("computedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldPhoto" ADD CONSTRAINT "FieldPhoto_fieldReportId_fkey" FOREIGN KEY ("fieldReportId") REFERENCES "FieldReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointSubmission" ADD CONSTRAINT "CheckpointSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointSubmission" ADD CONSTRAINT "CheckpointSubmission_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointSubmission" ADD CONSTRAINT "CheckpointSubmission_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSubmission" ADD CONSTRAINT "DrillSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSubmission" ADD CONSTRAINT "DrillSubmission_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSubmission" ADD CONSTRAINT "DrillSubmission_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReadiness" ADD CONSTRAINT "VenueReadiness_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReadiness" ADD CONSTRAINT "VenueReadiness_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReadiness" ADD CONSTRAINT "VenueReadiness_vsId_fkey" FOREIGN KEY ("vsId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPin" ADD CONSTRAINT "MaterialPin_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPin" ADD CONSTRAINT "MaterialPin_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTracking" ADD CONSTRAINT "MaterialTracking_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "MaterialPin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTracking" ADD CONSTRAINT "MaterialTracking_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_ioId_fkey" FOREIGN KEY ("ioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceAuthRecord" ADD CONSTRAINT "FaceAuthRecord_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceAuthRecord" ADD CONSTRAINT "FaceAuthRecord_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceAuthRecord" ADD CONSTRAINT "FaceAuthRecord_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JammerStatus" ADD CONSTRAINT "JammerStatus_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JammerStatus" ADD CONSTRAINT "JammerStatus_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JammerStatus" ADD CONSTRAINT "JammerStatus_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePreference" ADD CONSTRAINT "CandidatePreference_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

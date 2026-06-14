import Dexie, { type Table } from "dexie"

interface PendingRecord {
  id: string
  type: "checkpoint" | "readiness" | "material" | "survey" | "inspection"
  payload: any
  status: "pending" | "syncing"
  createdAt: number
  retries?: number
}
interface CheckpointDraft { id: string; venueId: string; examId: string; type: string; data: any; savedAt: number }
interface ReadinessDraft { id: string; venueId: string; items: any[]; savedAt: number }
interface SurveyDraft { id: string; surveyId: string; answers: any; savedAt: number }

class VmsDatabase extends Dexie {
  pendingSync!: Table<PendingRecord>
  checkpointDrafts!: Table<CheckpointDraft>
  readinessDrafts!: Table<ReadinessDraft>
  surveyDrafts!: Table<SurveyDraft>

  constructor() {
    super("VmsDatabase")
    this.version(1).stores({
      pendingSync: "id, type, status, createdAt",
      checkpointDrafts: "id, venueId, examId, savedAt",
      readinessDrafts: "id, venueId, savedAt",
      surveyDrafts: "id, surveyId, savedAt",
    })
  }
}

export const db = new VmsDatabase()

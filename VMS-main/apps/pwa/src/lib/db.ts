import Dexie, { type Table } from 'dexie'

export interface OutboxItem {
  id: string
  venueId: string
  reportType: string
  isDrill: boolean
  data: any
  status: 'pending' | 'syncing' | 'failed'
  createdAt: number
}

export interface DraftForm {
  id: string
  data: any
  updatedAt: number
}

// MOD-08: Material tracking logs
export interface MaterialLogItem {
  id: string
  pinId: string
  venueId: string
  event: string
  packageCount?: number
  sealIntact?: boolean
  remarks?: string
  latitude?: number
  longitude?: number
  status: 'pending' | 'syncing' | 'failed'
  createdAt: number
}

// MOD-10: Cached surveys for offline access
export interface CachedSurvey {
  id: string
  title: string
  description?: string
  questions: any[]
  dueAt?: number
  cachedAt: number
}

// MOD-10: Offline survey responses
export interface SurveyResponseItem {
  id: string
  surveyId: string
  answers: { questionId: string; value: string }[]
  deviceTime: number
  status: 'pending' | 'syncing' | 'failed'
  createdAt: number
}

export class FieldReportingDB extends Dexie {
  outbox!: Table<OutboxItem>
  drafts!: Table<DraftForm>
  staticData!: Table<any>
  materialLogs!: Table<MaterialLogItem>
  surveys!: Table<CachedSurvey>
  surveyResponses!: Table<SurveyResponseItem>

  constructor() {
    super('FieldReportingDB')
    this.version(1).stores({
      outbox: 'id, status, createdAt',
      drafts: 'id, updatedAt',
      staticData: 'id'
    })

    // MOD-08 + MOD-10: New tables
    this.version(2).stores({
      outbox: 'id, status, createdAt',
      drafts: 'id, updatedAt',
      staticData: 'id',
      materialLogs: 'id, status, createdAt, event',
      surveys: 'id, cachedAt',
      surveyResponses: 'id, surveyId, status, createdAt'
    })
  }
}

export const db = new FieldReportingDB()

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

export class FieldReportingDB extends Dexie {
  outbox!: Table<OutboxItem>
  drafts!: Table<DraftForm>
  staticData!: Table<any>

  constructor() {
    super('FieldReportingDB')
    this.version(1).stores({
      outbox: 'id, status, createdAt',
      drafts: 'id, updatedAt',
      staticData: 'id'
    })
  }
}

export const db = new FieldReportingDB()

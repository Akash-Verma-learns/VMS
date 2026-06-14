import { db } from './db'

const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS as string | undefined) !== 'false'
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api'

export async function syncOutbox() {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' }
  }

  const pendingItems = await db.outbox.where('status').equals('pending').toArray()
  if (pendingItems.length === 0) {
    return { success: true, synced: 0 }
  }

  // Mark items as syncing
  await db.outbox.bulkPut(pendingItems.map((item) => ({ ...item, status: 'syncing' as const })))

  // ---- Mock mode: simulate the server accepting all reports ----
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 600))
    await db.outbox.bulkDelete(pendingItems.map((i) => i.id))
    return { success: true, synced: pendingItems.length }
  }

  try {
    const reportsPayload = pendingItems.map((item) => ({
      id: item.id,
      venueId: item.venueId,
      isDrill: item.isDrill,
      reportType: item.reportType,
      data: item.data,
      deviceTime: new Date(item.createdAt).toISOString(),
    }))

    const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'
    const response = await fetch(`${API_URL}/field-report/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reports: reportsPayload }),
    })
    if (!response.ok) throw new Error(`Sync failed with status: ${response.status}`)

    const { results } = await response.json()
    const syncedIds = results.map((r: any) => r.id)
    await db.outbox.bulkDelete(syncedIds)

    const failedItems = pendingItems.filter((i) => !syncedIds.includes(i.id))
    if (failedItems.length > 0) {
      await db.outbox.bulkPut(failedItems.map((item) => ({ ...item, status: 'pending' as const })))
    }
    return { success: true, synced: syncedIds.length }
  } catch (error) {
    console.error('Sync error:', error)
    await db.outbox.bulkPut(pendingItems.map((item) => ({ ...item, status: 'pending' as const })))
    return { success: false, reason: 'error', error }
  }
}

export function initSync() {
  window.addEventListener('online', () => { void syncOutbox() })

  // Periodic retry + heartbeat (skipped in mock mode).
  setInterval(() => {
    if (!navigator.onLine) return
    void syncOutbox()
    if (USE_MOCKS) return
    const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'
    db.outbox.count().then((queueSize) => {
      fetch(`${API_URL}/field-report/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId: 'V-MOCK-1', batteryLevel: 85, queueSize }),
      }).catch(() => {})
    })
  }, 600000)
}

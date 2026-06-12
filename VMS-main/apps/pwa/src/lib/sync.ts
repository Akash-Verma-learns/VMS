import { db } from './db'

const API_URL = 'http://localhost:3001/api'

function getToken(): string {
  return localStorage.getItem('vms_token') || 'MOCK_TOKEN'
}

export async function syncOutbox() {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' }
  }

  const pendingItems = await db.outbox.where('status').equals('pending').toArray()
  
  if (pendingItems.length === 0) {
    return { success: true, synced: 0 }
  }

  // Mark items as syncing
  await db.outbox.bulkPut(
    pendingItems.map(item => ({ ...item, status: 'syncing' as const }))
  )

  try {
    // Convert to API payload format
    const reportsPayload = pendingItems.map(item => ({
      id: item.id,
      venueId: item.venueId,
      isDrill: item.isDrill,
      reportType: item.reportType,
      data: item.data,
      deviceTime: new Date(item.createdAt).toISOString()
    }))

    const token = getToken()

    const response = await fetch(`${API_URL}/field-report/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reports: reportsPayload })
    })

    if (!response.ok) {
      throw new Error(`Sync failed with status: ${response.status}`)
    }

    const { results } = await response.json()

    // Delete synced items
    const syncedIds = results.map((r: any) => r.id)
    await db.outbox.bulkDelete(syncedIds)

    // Mark remaining as pending to retry later
    const failedItems = pendingItems.filter(i => !syncedIds.includes(i.id))
    if (failedItems.length > 0) {
      await db.outbox.bulkPut(
        failedItems.map(item => ({ ...item, status: 'pending' as const }))
      )
    }

    return { success: true, synced: syncedIds.length }
  } catch (error) {
    console.error('Sync error:', error)
    // Revert status to pending so they can be retried
    await db.outbox.bulkPut(
      pendingItems.map(item => ({ ...item, status: 'pending' as const }))
    )
    return { success: false, reason: 'error', error }
  }
}

// MOD-08: Sync material tracking logs
export async function syncMaterialLogs() {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' }
  }

  const pendingLogs = await db.materialLogs.where('status').equals('pending').toArray()

  if (pendingLogs.length === 0) {
    return { success: true, synced: 0 }
  }

  await db.materialLogs.bulkPut(
    pendingLogs.map(item => ({ ...item, status: 'syncing' as const }))
  )

  try {
    const token = getToken()

    const logsPayload = pendingLogs.map(item => ({
      id: item.id,
      pinId: item.pinId,
      venueId: item.venueId,
      event: item.event,
      packageCount: item.packageCount,
      sealIntact: item.sealIntact,
      remarks: item.remarks,
      latitude: item.latitude,
      longitude: item.longitude,
      deviceTime: new Date(item.createdAt).toISOString()
    }))

    const response = await fetch(`${API_URL}/material-tracking/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ logs: logsPayload })
    })

    if (!response.ok) {
      throw new Error(`Material sync failed with status: ${response.status}`)
    }

    const { results } = await response.json()

    const syncedIds = results.map((r: any) => r.id)
    await db.materialLogs.bulkDelete(syncedIds)

    const failedItems = pendingLogs.filter(i => !syncedIds.includes(i.id))
    if (failedItems.length > 0) {
      await db.materialLogs.bulkPut(
        failedItems.map(item => ({ ...item, status: 'pending' as const }))
      )
    }

    return { success: true, synced: syncedIds.length }
  } catch (error) {
    console.error('Material sync error:', error)
    await db.materialLogs.bulkPut(
      pendingLogs.map(item => ({ ...item, status: 'pending' as const }))
    )
    return { success: false, reason: 'error', error }
  }
}

// MOD-10: Sync survey responses
export async function syncSurveyResponses() {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' }
  }

  const pendingResponses = await db.surveyResponses.where('status').equals('pending').toArray()

  if (pendingResponses.length === 0) {
    return { success: true, synced: 0 }
  }

  await db.surveyResponses.bulkPut(
    pendingResponses.map(item => ({ ...item, status: 'syncing' as const }))
  )

  try {
    const token = getToken()

    const responsesPayload = pendingResponses.map(item => ({
      id: item.id,
      surveyId: item.surveyId,
      answers: item.answers,
      deviceTime: new Date(item.deviceTime).toISOString()
    }))

    const response = await fetch(`${API_URL}/surveys/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ responses: responsesPayload })
    })

    if (!response.ok) {
      throw new Error(`Survey sync failed with status: ${response.status}`)
    }

    const { results } = await response.json()

    const syncedIds = results.map((r: any) => r.id)
    await db.surveyResponses.bulkDelete(syncedIds)

    const failedItems = pendingResponses.filter(i => !syncedIds.includes(i.id))
    if (failedItems.length > 0) {
      await db.surveyResponses.bulkPut(
        failedItems.map(item => ({ ...item, status: 'pending' as const }))
      )
    }

    return { success: true, synced: syncedIds.length }
  } catch (error) {
    console.error('Survey sync error:', error)
    await db.surveyResponses.bulkPut(
      pendingResponses.map(item => ({ ...item, status: 'pending' as const }))
    )
    return { success: false, reason: 'error', error }
  }
}

export function initSync() {
  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Network connected. Attempting background sync...')
    syncOutbox()
    syncMaterialLogs()
    syncSurveyResponses()
  })

  // Heartbeat every 10 minutes (600000ms)
  setInterval(() => {
    if (navigator.onLine) {
      syncOutbox()
      syncMaterialLogs()
      syncSurveyResponses()
      // Send heartbeat
      const token = getToken()
      db.outbox.count().then(queueSize => {
        const batteryLevel = 85
        fetch(`${API_URL}/field-report/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ venueId: 'V-MOCK-1', batteryLevel, queueSize })
        }).catch(console.error)
      })
    }
  }, 600000)
}

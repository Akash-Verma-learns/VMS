import { db } from './db'

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
    pendingItems.map(item => ({ ...item, status: 'syncing' }))
  )

  try {
    // In a real app, URL comes from env
    const API_URL = 'http://localhost:3001/api'
    
    // Convert to API payload format
    const reportsPayload = pendingItems.map(item => ({
      id: item.id,
      venueId: item.venueId,
      isDrill: item.isDrill,
      reportType: item.reportType,
      data: item.data,
      deviceTime: new Date(item.createdAt).toISOString()
    }))

    // Needs actual token handling in prod
    const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'

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
        failedItems.map(item => ({ ...item, status: 'pending' }))
      )
    }

    return { success: true, synced: syncedIds.length }
  } catch (error) {
    console.error('Sync error:', error)
    // Revert status to pending so they can be retried
    await db.outbox.bulkPut(
      pendingItems.map(item => ({ ...item, status: 'pending' }))
    )
    return { success: false, reason: 'error', error }
  }
}

export function initSync() {
  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Network connected. Attempting background sync...')
    syncOutbox()
  })

  // Heartbeat every 10 minutes (600000ms)
  setInterval(() => {
    if (navigator.onLine) {
      syncOutbox()
      // Send heartbeat
      const API_URL = 'http://localhost:3001/api'
      const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'
      db.outbox.count().then(queueSize => {
        // Battery level might not be supported everywhere, spoofing for now
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

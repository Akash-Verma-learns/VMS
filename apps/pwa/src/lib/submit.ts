import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import { syncOutbox } from './sync'

// Write a field report into the offline outbox (IndexedDB) and try to sync.
// Works fully offline — the item stays queued until connectivity returns.
export async function submitReport(opts: {
  venueId: string
  reportType: string
  data: unknown
  isDrill: boolean
}): Promise<string> {
  const id = uuidv4()
  await db.outbox.add({
    id,
    venueId: opts.venueId,
    reportType: opts.reportType,
    isDrill: opts.isDrill,
    data: opts.data,
    status: 'pending',
    createdAt: Date.now(),
  })
  if (navigator.onLine) void syncOutbox()
  return id
}

export interface GeoPoint { lat: number; lng: number; accuracy: number }

// Best-effort device geolocation for geo-tagged inspections.
export function getGeoPoint(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000 },
    )
  })
}

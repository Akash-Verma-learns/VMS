import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { syncOutbox } from '../lib/sync'

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const pendingCount = useLiveQuery(() => db.outbox.where('status').equals('pending').count(), [])

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  async function manualSync() {
    if (!isOnline) return
    setIsSyncing(true)
    await syncOutbox()
    setIsSyncing(false)
  }

  const pending = pendingCount ?? 0
  return (
    <div className={`sync-bar ${isOnline ? 'online' : 'offline'}`}>
      <span className="sync-dot" />
      <span className="sync-label">{isOnline ? 'Online' : 'Offline — queued locally'}</span>
      <span className="sync-spacer" />
      {pending > 0 ? (
        <>
          <span className="sync-count">{pending} pending</span>
          {isOnline && <button className="sync-now" onClick={manualSync} disabled={isSyncing}>{isSyncing ? 'Syncing…' : 'Sync'}</button>}
        </>
      ) : (
        <span className="sync-count">All synced</span>
      )}
    </div>
  )
}

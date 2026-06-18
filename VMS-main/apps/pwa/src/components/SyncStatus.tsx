import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { syncOutbox } from '../lib/sync'

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Real-time count of pending items in IndexedDB
  const pendingCount = useLiveQuery(
    () => db.outbox.where('status').equals('pending').count(),
    []
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleManualSync = async () => {
    if (!isOnline) return
    setIsSyncing(true)
    await syncOutbox()
    setIsSyncing(false)
  }

  return (
    <div className={`sync-status ${isOnline ? 'online' : 'offline'}`}>
      <div className="status-indicator">
        <span className="dot"></span>
        <span>{isOnline ? 'Online' : 'Offline Mode (2G/None)'}</span>
      </div>
      
      <div className="queue-info">
        {pendingCount !== undefined && pendingCount > 0 ? (
          <>
            <span>{pendingCount} items pending</span>
            {isOnline && (
              <button 
                onClick={handleManualSync} 
                disabled={isSyncing}
                className="sync-btn"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </>
        ) : (
          <span>Synced</span>
        )}
      </div>
    </div>
  )
}

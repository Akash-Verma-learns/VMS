import { db } from "./db"
import { useAuthStore } from "../store/auth"

const API = "http://localhost:3001/api"

function getToken() { return useAuthStore.getState().token ?? "" }

async function pushRecord(record: any): Promise<boolean> {
  const { type, payload } = record
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }
  try {
    if (type === "checkpoint") {
      await fetch(`${API}/field/checkpoint`, { method: "POST", headers, body: JSON.stringify(payload) })
    } else if (type === "readiness") {
      await fetch(`${API}/readiness`, { method: "POST", headers, body: JSON.stringify(payload) })
    } else if (type === "material") {
      await fetch(`${API}/material/confirm`, { method: "POST", headers, body: JSON.stringify(payload) })
    } else if (type === "survey") {
      await fetch(`${API}/surveys/${payload.surveyId}/respond`, { method: "POST", headers, body: JSON.stringify(payload) })
    } else if (type === "inspection") {
      await fetch(`${API}/inspections/${payload.inspectionId}/submit`, { method: "POST", headers, body: JSON.stringify(payload) })
    }
    return true
  } catch { return false }
}

export async function syncPendingRecords() {
  if (!navigator.onLine) return { synced: 0, failed: 0 }
  const pending = await db.pendingSync.where("status").equals("pending").toArray()
  let synced = 0, failed = 0
  for (const record of pending) {
    await db.pendingSync.update(record.id, { status: "syncing" })
    const ok = await pushRecord(record)
    if (ok) { await db.pendingSync.delete(record.id); synced++ }
    else { await db.pendingSync.update(record.id, { status: "pending", retries: (record.retries ?? 0) + 1 }); failed++ }
  }
  return { synced, failed }
}

export function initSync() {
  window.addEventListener("online", () => syncPendingRecords())
  setInterval(() => { if (navigator.onLine) syncPendingRecords() }, 600_000)
}

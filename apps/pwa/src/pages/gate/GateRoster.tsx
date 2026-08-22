import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import toast from "react-hot-toast"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { GATE_NAV, roleHome } from "./GateNav"
import { Card, Field, Button, Empty, inputClass } from "./ui"
import { fetchState, groupRoster, deleteTemplate, mapTemplate } from "../../lib/gateway"

export default function GateRoster() {
  const { user } = useAuthStore()
  const [mapId, setMapId] = useState("")
  const [mapRoll, setMapRoll] = useState("")
  const [mapName, setMapName] = useState("")
  const [showMap, setShowMap] = useState(false)
  const [filter, setFilter] = useState("")

  const { data, error, refetch } = useQuery({
    queryKey: ["gate-state"], queryFn: fetchState, refetchInterval: 2000, retry: false,
  })

  const online = !!data?.device?.online
  const all = groupRoster(data?.roster ?? [])
  const needle = filter.trim().toLowerCase()
  const people = needle
    ? all.filter((p) =>
        p.roll.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle) ||
        p.seat.toLowerCase().includes(needle))
    : all

  async function onDelete(templateId: number, roll: string) {
    if (!confirm(`Delete print #${templateId} (${roll}) from the sensor? This cannot be undone.`)) return
    try { await deleteTemplate(templateId); toast.success(`Deleted #${templateId}`); refetch() }
    catch (e: any) { toast.error(e.message) }
  }

  async function onMap() {
    const id = Number(mapId)
    if (!id || !mapRoll.trim()) { toast.error("Print # and roll are both required"); return }
    try {
      await mapTemplate(id, mapRoll.trim(), mapName.trim())
      toast.success(`#${id} is now ${mapRoll.trim()}`)
      setMapId(""); setMapRoll(""); setMapName(""); refetch()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <>
      <PWALayout title="Enrolled Candidates" back={roleHome(user?.role)}>
        <div className="p-3.5 space-y-3.5">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3.5 py-3">
              Gateway unreachable — check the Terminal tab.
            </p>
          )}

          {all.length > 0 && (
            <div className="flex items-center gap-3">
              <input value={filter} onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by roll, name or seat" className={inputClass} />
            </div>
          )}

          {all.length > 0 && (
            <p className="text-xs text-gray-400 px-1">
              {all.length} candidate{all.length > 1 ? "s" : ""} ·{" "}
              {all.reduce((n, p) => n + p.ids.length, 0)} prints
            </p>
          )}

          {people.length === 0 && !error && (
            <Empty>
              {all.length === 0
                ? "Nobody enrolled yet. Add someone from the Terminal tab."
                : "No candidate matches that filter."}
            </Empty>
          )}

          {people.map((p) => (
            <Card key={p.roll}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-gray-900 text-[15px]">{p.roll}</div>
                  <div className="text-sm text-gray-600 truncate">{p.name || "—"}</div>
                </div>
                {p.seat && (
                  <div className="text-right shrink-0">
                    <div className="text-[11px] uppercase tracking-wider text-gray-400">Seat</div>
                    <div className="font-mono font-semibold text-gray-900">{p.seat}</div>
                  </div>
                )}
              </div>

              {(p.venue || p.city) && (
                <div className="text-xs text-gray-500 mt-2">
                  {p.venue}{p.venue && p.city ? " · " : ""}{p.city}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 mr-auto">
                  {p.ids.length} print{p.ids.length > 1 ? "s" : ""}
                </span>
                {p.ids.map((id) => (
                  <Button key={id} variant="danger" disabled={!online}
                    onClick={() => onDelete(id, p.roll)}>
                    delete #{id}
                  </Button>
                ))}
              </div>
            </Card>
          ))}

          <Card
            title="Unmapped prints"
            action={
              <button onClick={() => setShowMap((v) => !v)} className="text-xs text-blue-600">
                {showMap ? "Hide" : "Map one"}
              </button>
            }
          >
            {showMap ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  A finger enrolled through enroll.ino sits on the sensor with no
                  roll number here, so the gate refuses it. Give it one — the
                  sensor itself is not touched.
                </p>
                <Field label="Print number (1–127)">
                  <input value={mapId} onChange={(e) => setMapId(e.target.value)}
                    inputMode="numeric" placeholder="3" className={inputClass} />
                </Field>
                <Field label="Roll number">
                  <input value={mapRoll} onChange={(e) => setMapRoll(e.target.value)}
                    inputMode="numeric" placeholder="0001236" className={inputClass} />
                </Field>
                <Field label="Name (optional)">
                  <input value={mapName} onChange={(e) => setMapName(e.target.value)}
                    placeholder="Name" className={inputClass} />
                </Field>
                <Button onClick={onMap}>Map print</Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Sensor holds {data?.device?.templates ?? "—"} prints; this list
                accounts for {all.reduce((n, p) => n + p.ids.length, 0)}.
              </p>
            )}
          </Card>
        </div>
      </PWALayout>
      <BottomNav items={GATE_NAV} />
    </>
  )
}

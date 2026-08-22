import { Fingerprint, Users, Activity, ShieldCheck } from "lucide-react"

/** Where "back" goes when leaving gate mode. The gate tabs replace the role's
 *  own bottom nav, so without this the operator is stranded in gate mode. */
export function roleHome(role?: string): string {
  switch (role) {
    case "CS": return "/cs/home"
    case "IO": return "/io/home"
    default:   return "/vs/home"
  }
}

export const GATE_NAV = [
  { label: "Terminal", icon: Fingerprint, path: "/gate/terminal" },
  { label: "Roster", icon: Users, path: "/gate/roster" },
  { label: "Activity", icon: Activity, path: "/gate/activity" },
  { label: "Checks", icon: ShieldCheck, path: "/gate/readiness" },
]

export function DeviceChip({ online, version }: { online: boolean; version?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
      <span className={`text-sm font-semibold ${online ? "text-green-700" : "text-red-600"}`}>
        {online ? "Terminal connected" : "Terminal offline"}
      </span>
      {online && version && <span className="text-xs text-gray-400 font-mono">{version}</span>}
    </div>
  )
}

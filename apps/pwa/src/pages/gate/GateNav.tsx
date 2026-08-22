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
      <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: online ? "var(--ux4g-color-green-600)" : "var(--ux4g-color-red-600)" }} />
      <span className="ux4g-label-m-strong"
            style={{ color: online ? "var(--ux4g-color-green-800)" : "var(--ux4g-color-red-800)" }}>
        {online ? "Terminal connected" : "Terminal offline"}
      </span>
      {online && version && (
        <span className="ux4g-body-xs-default font-mono opacity-60">{version}</span>
      )}
    </div>
  )
}

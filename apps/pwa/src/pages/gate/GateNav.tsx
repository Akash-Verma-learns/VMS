import { Fingerprint, Home, FileText, Search, Building2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Navigation for the field app.
 *
 * One bottom bar per role, always present. Three destinations each: the hub,
 * the gate, and the one other place that role goes often. Everything else is
 * a row on the hub — a phone bottom bar past four tabs stops being scannable,
 * and VS had six.
 *
 * The gate's own screens are sub-navigation (see SectionTabs), not a second
 * bottom bar. Swapping the bar out was the app changing modes underneath the
 * user, which is why leaving the gate needed a back arrow.
 */
interface Tab { label: string; icon: LucideIcon; path: string }

export const VS_NAV: Tab[] = [
  { label: "Home",  icon: Home,        path: "/vs/home" },
  { label: "Gate",  icon: Fingerprint, path: "/gate/terminal" },
  { label: "Surveys", icon: FileText, path: "/vs/survey" },
]

export const CS_NAV: Tab[] = [
  { label: "Home",    icon: Home,        path: "/cs/home" },
  { label: "Gate",    icon: Fingerprint, path: "/gate/terminal" },
  { label: "Surveys", icon: FileText,    path: "/cs/surveys" },
]

export const IO_NAV: Tab[] = [
  { label: "Assignments", icon: Building2, path: "/io/home" },
  { label: "Gate",        icon: Fingerprint, path: "/gate/terminal" },
  { label: "Inspect",     icon: Search,    path: "/io/inspect" },
]

export function navFor(role?: string): Tab[] {
  if (role === "CS") return CS_NAV
  if (role === "IO") return IO_NAV
  return VS_NAV
}

/** Sub-navigation within the gate section. */
export const GATE_TABS = [
  { label: "Terminal", path: "/gate/terminal" },
  { label: "Roster",   path: "/gate/roster" },
  { label: "Activity", path: "/gate/activity" },
  { label: "Checks",   path: "/gate/readiness" },
]

/** Where "back" goes when a screen is opened from the hub rather than a tab. */
export function roleHome(role?: string): string {
  if (role === "CS") return "/cs/home"
  if (role === "IO") return "/io/home"
  return "/vs/home"
}

export function DeviceChip({ online, version }: { online: boolean; version?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: online ? "var(--ux4g-color-green-600)" : "var(--ux4g-color-red-600)" }} />
      <span className="ux4g-title-s-strong"
            style={{ color: online ? "var(--ux4g-color-green-800)" : "var(--ux4g-color-red-800)" }}>
        {online ? "Terminal connected" : "Terminal offline"}
      </span>
      {online && version && (
        <span className="ux4g-body-xs-default font-mono opacity-60">{version}</span>
      )}
    </div>
  )
}

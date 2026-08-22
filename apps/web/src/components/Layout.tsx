import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import clsx from "clsx"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, FileText, CheckSquare, Banknote, ClipboardList,
  BarChart2, Monitor, Building2, Receipt, CreditCard, Menu, X, LogOut,
  Landmark, ScanFace, Users, Fingerprint, IdCard,
} from "lucide-react"

/**
 * Application shell.
 *
 * The sidebar is grouped rather than a flat list: a US officer sees twelve
 * destinations, and an unstructured column of twelve makes every one of them
 * equally hard to find. Groups follow the working day — set the exam up, run
 * exam day, clear approvals, settle money, review — so a destination is found
 * by remembering what you are doing, not where a link sat.
 *
 * Labels match the heading of the page they open. "FAL & Finance" used to
 * lead to a page titled "FAL Management", and "Face Auth" to one titled
 * "Flagged Records".
 */

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  /** Restricts the item; undefined means every role in the group's branch. */
  roles?: string[]
  /** Active when the path starts with `to` rather than matching exactly. */
  prefix?: boolean
}

interface NavGroup {
  heading?: string
  items: NavItem[]
}

const OFFICER_NAV: NavGroup[] = [
  { items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
  {
    heading: "Examinations",
    items: [
      { to: "/exams", icon: FileText, label: "Exams", prefix: true },
      { to: "/preferences", icon: Users, label: "City preferences" },
      { to: "/admit-cards", icon: IdCard, label: "Admit cards" },
    ],
  },
  {
    heading: "Exam day",
    items: [
      { to: "/gate", icon: Fingerprint, label: "Gate feed" },
      { to: "/faceauth", icon: ScanFace, label: "Flagged entries", roles: ["US", "DS", "JS"] },
      { to: "/cockpit", icon: Monitor, label: "War room", roles: ["US", "DS", "JS"] },
    ],
  },
  {
    heading: "Approvals and field",
    items: [
      { to: "/approvals", icon: CheckSquare, label: "Approval queue" },
      { to: "/inspections", icon: ClipboardList, label: "Inspections" },
      { to: "/surveys", icon: FileText, label: "Surveys" },
    ],
  },
  {
    heading: "Finance",
    items: [
      { to: "/fal", icon: Banknote, label: "Advance letters" },
      { to: "/finance", icon: Landmark, label: "Bills and settlement", roles: ["US", "DS", "JS"] },
    ],
  },
  {
    heading: "Insight",
    items: [{ to: "/reports", icon: BarChart2, label: "Reports", roles: ["US", "DS", "JS"] }],
  },
]

const CS_NAV: NavGroup[] = [
  { items: [{ to: "/cs/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
  {
    heading: "My centre",
    items: [
      { to: "/cs/venues", icon: Building2, label: "Venues" },
      { to: "/cs/bills", icon: Receipt, label: "Bills" },
      { to: "/cs/fal", icon: Landmark, label: "Advance letters" },
      { to: "/surveys", icon: FileText, label: "Surveys" },
    ],
  },
]

const VS_NAV: NavGroup[] = [
  { items: [{ to: "/vs/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
  {
    heading: "My venue",
    items: [
      { to: "/vs/fal", icon: CreditCard, label: "Advance letters" },
      { to: "/surveys", icon: FileText, label: "Surveys" },
    ],
  },
]

function navFor(role: string): NavGroup[] {
  if (["JS", "DS", "US", "SO", "ASO"].includes(role)) return OFFICER_NAV
  if (role === "CS") return CS_NAV
  if (role === "VS") return VS_NAV
  return [{ items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }] }]
}

function NavLink({ item, active, onNavigate }: {
  item: NavItem; active: boolean; onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        // 40px keeps a comfortable pointer target without making a twelve-item
        // sidebar taller than the viewport.
        "min-h-[40px]",
        active
          ? "ux4g-label-m-strong text-white"
          : "ux4g-label-m-default hover:bg-black/[0.04]",
      )}
      style={active
        ? { background: "var(--ux4g-color-primary-700)" }
        : { color: "var(--ux4g-color-neutral-700)" }}
    >
      <Icon size={18} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const role = user?.role ?? ""
  const p = location.pathname

  // A drawer that traps you is worse than no drawer. Escape closes it, and the
  // page behind it does not scroll while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // Route change closes the drawer; otherwise it stays over the page you just
  // navigated to.
  useEffect(() => { setOpen(false) }, [location.pathname])

  const groups = navFor(role)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0)

  const isActive = (i: NavItem) => (i.prefix ? p.startsWith(i.to) : p === i.to)

  const nav = (onNavigate?: () => void) => (
    <nav aria-label="Main" className="flex flex-col gap-5 p-4">
      {groups.map((g, gi) => (
        <div key={g.heading ?? `g${gi}`} className="flex flex-col gap-1">
          {g.heading && (
            <h2 className="ux4g-label-s-strong uppercase tracking-wide px-3 pb-1"
                style={{ color: "var(--ux4g-color-neutral-600)" }}>
              {g.heading}
            </h2>
          )}
          {g.items.map((item) => (
            <NavLink key={item.to} item={item} active={isActive(item)} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Keyboard users should not have to tab through twelve nav links to
          reach the page they just opened. */}
      <a href="#main"
         className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2
                    ux4g-btn ux4g-btn-primary ux4g-btn-md">
        Skip to content
      </a>

      <header
        className="text-white px-4 py-3 flex items-center justify-between shadow-md z-30 shrink-0"
        style={{ background: "var(--ux4g-color-primary-800)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="md:hidden p-1 -ml-1 rounded"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <Menu size={20} aria-hidden />
          </button>
          <div className="min-w-0">
            <div className="ux4g-label-l-strong tracking-wide">UPSC VMS</div>
            <div className="ux4g-label-s-default leading-none text-white/75 truncate">
              Venue Management System
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <div className="text-right min-w-0 hidden sm:block">
            <div className="ux4g-label-m-strong truncate">{user?.name}</div>
            {/* The role is who you are here, and it decides what you can do —
                so it reads as a word, not as one of eight colour-coded pills. */}
            <div className="ux4g-label-s-default text-white/75 leading-none">{role}</div>
          </div>
          <button
            onClick={() => { clearAuth(); navigate("/") }}
            aria-label="Sign out"
            className="flex items-center gap-1.5 px-3 min-h-[40px] rounded ux4g-label-m-default
                       text-white/85 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            {/* aria-label carries the name; a second sr-only copy made screen
                readers announce "Sign out Sign out". */}
            <span className="hidden sm:inline" aria-hidden>Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r overflow-y-auto"
               style={{ background: "var(--ux4g-color-neutral-0, #fff)",
                        borderColor: "var(--ux4g-color-neutral-200)" }}>
          {nav()}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true"
               aria-label="Navigation">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 shadow-xl overflow-y-auto"
                   style={{ background: "var(--ux4g-color-neutral-0, #fff)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b"
                   style={{ borderColor: "var(--ux4g-color-neutral-200)" }}>
                <span className="ux4g-label-l-strong">Menu</span>
                <button ref={closeRef} onClick={() => setOpen(false)}
                        aria-label="Close navigation menu"
                        className="p-1 rounded hover:bg-black/[0.06]">
                  <X size={20} aria-hidden />
                </button>
              </div>
              {nav(() => setOpen(false))}
            </aside>
          </div>
        )}

        <main id="main" tabIndex={-1} className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import clsx from "clsx"
import {
  LayoutDashboard, FileText, CheckSquare, Banknote, ClipboardList,
  BarChart2, Monitor, Building2, Receipt, CreditCard, Menu, X, LogOut,
} from "lucide-react"

const roleBadge: Record<string, string> = {
  JS: "bg-yellow-200 text-yellow-900",
  DS: "bg-amber-200 text-amber-900",
  US: "bg-blue-600 text-white",
  SO: "bg-indigo-600 text-white",
  ASO: "bg-slate-400 text-white",
  CS: "bg-teal-600 text-white",
  VS: "bg-green-600 text-white",
  IO: "bg-orange-500 text-white",
}

function NavLink({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) {
  return (
    <Link to={to} className={clsx(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active ? "bg-navy text-white" : "text-gray-600 hover:bg-gray-100"
    )}>
      <Icon size={18} />
      {label}
    </Link>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const role = user?.role ?? ""
  const p = location.pathname

  const isOfficer = ["JS", "DS", "US", "SO", "ASO"].includes(role)

  function handleLogout() {
    clearAuth()
    navigate("/")
  }

  const nav = (
    <nav className="flex flex-col gap-1 p-4">
      <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={p === "/dashboard"} />
      {isOfficer && <>
        <NavLink to="/exams" icon={FileText} label="Exams" active={p.startsWith("/exams")} />
        <NavLink to="/approvals" icon={CheckSquare} label="Approvals" active={p === "/approvals"} />
        <NavLink to="/fal" icon={Banknote} label="FAL & Finance" active={p === "/fal" || p === "/finance"} />
        <NavLink to="/inspections" icon={ClipboardList} label="Inspections" active={p === "/inspections"} />
        <NavLink to="/surveys" icon={FileText} label="Surveys" active={p === "/surveys"} />
        {["US", "DS", "JS"].includes(role) && <>
          <NavLink to="/reports" icon={BarChart2} label="Reports" active={p === "/reports"} />
          <NavLink to="/cockpit" icon={Monitor} label="Cockpit" active={p === "/cockpit"} />
          <NavLink to="/finance" icon={Banknote} label="Finance" active={p === "/finance"} />
        </>}
      </>}
      {role === "CS" && <>
        <NavLink to="/cs/dashboard" icon={LayoutDashboard} label="Dashboard" active={p === "/cs/dashboard"} />
        <NavLink to="/cs/venues" icon={Building2} label="My Venues" active={p === "/cs/venues"} />
        <NavLink to="/cs/bills" icon={Receipt} label="Bills" active={p === "/cs/bills"} />
        <NavLink to="/surveys" icon={FileText} label="Surveys" active={p === "/surveys"} />
      </>}
      {role === "VS" && <>
        <NavLink to="/vs/dashboard" icon={LayoutDashboard} label="My Venue" active={p === "/vs/dashboard"} />
        <NavLink to="/vs/fal" icon={CreditCard} label="FAL" active={p === "/vs/fal"} />
        <NavLink to="/surveys" icon={FileText} label="Surveys" active={p === "/surveys"} />
      </>}
    </nav>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between shadow-md z-30">
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div>
            <div className="font-bold text-lg tracking-wide">UPSC VMS</div>
            <div className="text-xs text-blue-200 leading-none">Venue Management System</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:block">{user?.name}</span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-semibold", roleBadge[role] ?? "bg-gray-200 text-gray-800")}>
            {role}
          </span>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-blue-200 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
          {nav}
        </aside>

        {/* Sidebar — mobile overlay */}
        {open && (
          <div className="fixed inset-0 z-20 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl pt-16">
              {nav}
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

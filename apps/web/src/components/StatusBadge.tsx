import clsx from "clsx"

const map: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_SO: "bg-amber-100 text-amber-800",
  PENDING_US: "bg-amber-100 text-amber-800",
  PENDING_DS: "bg-amber-100 text-amber-800",
  PENDING: "bg-amber-100 text-amber-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  RELEASED: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  SANCTIONED: "bg-green-100 text-green-800",
  ACKNOWLEDGED: "bg-green-100 text-green-800",
  ISSUED: "bg-teal-100 text-teal-800",
  REJECTED: "bg-red-100 text-red-700",
  OVERDUE: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-indigo-100 text-indigo-800",
  FLAGGED: "bg-orange-100 text-orange-800",
  ASSIGNED: "bg-gray-100 text-gray-700",
  REVIEWED: "bg-green-100 text-green-800",
  REMEDIATION_REQUIRED: "bg-red-100 text-red-700",
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
}

interface Props { status: string }
export default function StatusBadge({ status }: Props) {
  const isOverdue = status === "OVERDUE"
  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      map[status] ?? "bg-gray-100 text-gray-700",
      isOverdue && "animate-pulse"
    )}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

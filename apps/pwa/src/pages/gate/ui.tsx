import { WifiOff, RefreshCw } from "lucide-react"
/**
 * The gate screens were built on local primitives before UX4G was adopted.
 * This maps that surface onto the shared UX4G components so every screen moves
 * together; `variant="ghost"` becomes UX4G's outline button, which is the same
 * intent in its vocabulary.
 */
import type { ReactNode, ButtonHTMLAttributes } from "react"
import {
  Button as UxButton, Card, Field, Input, Select, Alert, Badge, Status,
  Empty, Row, inputClass,
} from "../../components/ux"

export { Card, Field, Input, Select, Alert, Badge, Status, Empty, Row, inputClass }

export function Button({ variant = "primary", ...rest }: {
  variant?: "primary" | "ghost" | "danger"
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <UxButton variant={variant === "ghost" ? "outline" : variant}
                   size={variant === "danger" ? "sm" : "lg"}
                   block={variant !== "danger"} {...rest} />
}

export function Dot({ ok }: { ok: boolean }) {
  return <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
    style={{ background: ok ? "var(--ux4g-color-green-600)" : "var(--ux4g-color-red-600)" }} />
}

/**
 * The gateway is unreachable.
 *
 * This used to be a bare red sentence above an empty screen: no icon, no
 * address, and no way to act. On a field surface the operator needs to know
 * *which* machine is not answering and what to do about it — the laptop is
 * usually in the room.
 */
export function GatewayDown({ url, onRetry }: { url: string; onRetry?: () => void }) {
  return (
    <div className="ux4g-alert ux4g-alert-error" role="alert">
      <span className="ux4g-alert-icon"><WifiOff size={20} strokeWidth={2} aria-hidden /></span>
      <div className="ux4g-alert-content">
        <p className="ux4g-alert-title">Cannot reach the gateway</p>
        <p className="ux4g-alert-message">
          No answer from <span className="font-mono break-all">{url}</span>.
          Check the laptop is running the gateway and is on this network.
        </p>
        {onRetry && (
          <button onClick={onRetry}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 -mx-1 mt-1 rounded-lg
                       ux4g-label-m-strong active:bg-black/[0.05]"
            style={{ color: "var(--ux4g-color-red-800)" }}>
            <RefreshCw size={16} strokeWidth={2} aria-hidden /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

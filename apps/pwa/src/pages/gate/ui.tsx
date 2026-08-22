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

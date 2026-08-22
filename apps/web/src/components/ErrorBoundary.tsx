import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

/**
 * Catches render errors so one broken page does not take the portal with it.
 *
 * Without a boundary React unmounts the entire tree on any render error,
 * leaving a blank white page. Since the session survives in storage, the next
 * click looks like an unexplained sign-out rather than a crash — the two are
 * indistinguishable to the person using it, and neither leaves anything to
 * report.
 *
 * The failure stays local: the session is untouched, and the error text is
 * shown rather than swallowed, so it can be quoted in a defect report.
 */
interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[page crashed]", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6"
           style={{ background: "var(--ux4g-color-neutral-50)" }}>
        <div className="ux4g-card ux4g-card-solid w-full max-w-md p-6">
          <AlertTriangle size={28} strokeWidth={2} aria-hidden
                         style={{ color: "var(--ux4g-color-orange-700)" }} />
          <h1 className="ux4g-title-m-strong mt-3">This page could not load</h1>
          <p className="ux4g-body-s-default mt-1" style={{ color: "var(--ux4g-color-neutral-700)" }}>
            You are still signed in. Nothing you submitted has been lost.
          </p>

          <p className="ux4g-body-xs-default mt-4 p-3 rounded font-mono break-words"
             style={{ background: "var(--ux4g-color-neutral-100)",
                      color: "var(--ux4g-color-neutral-800)" }}>
            {error.message || String(error)}
          </p>

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => this.setState({ error: null })}
              className="ux4g-btn ux4g-btn-primary ux4g-btn-md min-h-[40px]"
            >
              Try again
            </button>
            <button
              onClick={() => { window.location.href = "/dashboard" }}
              className="ux4g-btn ux4g-btn-secondary ux4g-btn-md min-h-[40px]"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}

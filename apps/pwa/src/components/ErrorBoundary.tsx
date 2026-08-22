import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

/**
 * Catches render errors so one broken screen does not take the app with it.
 *
 * Without a boundary React unmounts the entire tree on any render error,
 * leaving a blank page. On an installed field app that is indistinguishable
 * from the app closing itself — and because the session survives in storage,
 * the next launch looks like a random sign-out rather than a crash. Neither
 * reading tells the user what happened, and neither leaves anything to report.
 *
 * The failure is kept local: the session is untouched, the message names the
 * screen that failed, and both recoveries are one thumb-sized tap. The error
 * text is shown rather than hidden — a supervisor standing in a hall can read
 * it down the phone, which is the only diagnostic that exists in the field.
 */
interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[screen crashed]", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5"
           style={{ background: "var(--ux4g-color-neutral-50)" }}>
        <div className="ux4g-card ux4g-card-solid w-full max-w-sm p-6">
          <AlertTriangle size={28} strokeWidth={2} aria-hidden
                         style={{ color: "var(--ux4g-color-orange-700)" }} />
          <h1 className="ux4g-title-m-strong mt-3">This screen could not load</h1>
          <p className="ux4g-body-s-default mt-1" style={{ color: "var(--ux4g-color-neutral-700)" }}>
            You are still signed in. Your saved work is untouched — anything not
            yet uploaded stays on this device and syncs when you are back online.
          </p>

          <p className="ux4g-body-xs-default mt-4 p-3 rounded font-mono break-words"
             style={{ background: "var(--ux4g-color-neutral-100)",
                      color: "var(--ux4g-color-neutral-800)" }}>
            {error.message || String(error)}
          </p>

          <div className="flex flex-col gap-2 mt-5">
            <button
              onClick={() => this.setState({ error: null })}
              className="ux4g-btn ux4g-btn-primary ux4g-btn-lg w-full min-h-[48px]"
            >
              Try this screen again
            </button>
            <button
              onClick={() => { window.location.href = "/" }}
              className="ux4g-btn ux4g-btn-secondary ux4g-btn-lg w-full min-h-[48px]"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

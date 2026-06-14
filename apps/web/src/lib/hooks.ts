import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

// Fetch-on-mount with manual reload. `loader` is re-run when any dep changes.
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    run()
      .then((d) => { if (active) setData(d) })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : 'Failed to load') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [run, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

// Imperative async action with busy state (for buttons/forms).
export function useMutation<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): { run: (...args: Args) => Promise<R | undefined>; busy: boolean; error: string | null } {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(...args: Args): Promise<R | undefined> {
    setBusy(true)
    setError(null)
    try {
      return await fn(...args)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed')
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, error }
}

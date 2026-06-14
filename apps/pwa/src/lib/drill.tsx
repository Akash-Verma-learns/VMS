import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const KEY = 'vms_drill_mode'

interface DrillValue {
  drill: boolean
  setDrill: (on: boolean) => void
}

const DrillContext = createContext<DrillValue | null>(null)

export function DrillProvider({ children }: { children: ReactNode }) {
  const [drill, setDrillState] = useState(false)

  useEffect(() => { setDrillState(localStorage.getItem(KEY) === '1') }, [])

  function setDrill(on: boolean) {
    setDrillState(on)
    localStorage.setItem(KEY, on ? '1' : '0')
  }

  const value = useMemo(() => ({ drill, setDrill }), [drill])
  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDrill(): DrillValue {
  const ctx = useContext(DrillContext)
  if (!ctx) throw new Error('useDrill must be used within DrillProvider')
  return ctx
}

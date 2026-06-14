// Tiny inline SVG icon set (Feather-style strokes) — avoids an icon dependency.

export type IconName =
  | 'dashboard'
  | 'exam'
  | 'centre'
  | 'venue'
  | 'approval'
  | 'fal'
  | 'finance'
  | 'inspection'
  | 'users'
  | 'venue-bank'
  | 'assignment'
  | 'diff'
  | 'submit'
  | 'bill'
  | 'ack'
  | 'logout'
  | 'lock'

const PATHS: Record<IconName, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  exam: 'M8 2h8l4 4v16H4V2zM14 2v5h5M8 12h8M8 16h8M8 8h3',
  centre: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01',
  venue: 'M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0zM12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  approval: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.1l-3-3',
  fal: 'M4 4h16v16H4zM4 6l8 6 8-6',
  finance: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  inspection: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  'venue-bank': 'M3 21h18M3 10h18M5 6l7-3 7 3M5 10v11M19 10v11M9 14v3M15 14v3',
  assignment: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4',
  diff: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6a3 3 0 0 0 3 3h3M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15V9a3 3 0 0 0-3-3h-3',
  submit: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  bill: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  ack: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

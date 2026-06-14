import type { IconName } from '../components/Icon'
import type { Role } from '../lib/types'

export interface NavItem {
  path: string
  label: string
  icon: IconName
  roles: Role[]
  // Shown on the feature's placeholder screen until it's built.
  description: string
  endpoints: string[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const INTERNAL: Role[] = ['ASO', 'SO', 'US', 'DS', 'JS']

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        roles: ['ASO', 'SO', 'US', 'DS', 'JS', 'CS', 'VS'],
        description: 'Role-aware landing with quick actions and pending work.',
        endpoints: ['GET /api/me'],
      },
    ],
  },
  {
    title: 'Examinations',
    items: [
      {
        path: '/exams/new',
        label: 'Create Exam',
        icon: 'exam',
        roles: ['ASO', 'SO'],
        description: 'Create an exam: name, year, type, schedule, cities + capacities.',
        endpoints: ['POST /api/exams'],
      },
      {
        path: '/exams',
        label: 'Exams',
        icon: 'exam',
        roles: INTERNAL,
        description: 'Browse and open exams.',
        endpoints: ['GET /api/exams', 'GET /api/exams/:id'],
      },
      {
        path: '/centres',
        label: 'Centre Management',
        icon: 'centre',
        roles: ['SO', 'US'],
        description: 'Review/override suggested capacities and release centres.',
        endpoints: ['PATCH /api/exams/:id/centre/:centreId', 'PATCH /api/exams/:id/release'],
      },
    ],
  },
  {
    title: 'Venues & Approvals',
    items: [
      {
        path: '/venues/review',
        label: 'Venue Review Queue',
        icon: 'venue',
        roles: ['SO', 'US'],
        description: 'Approve / annotate / reject submitted venues.',
        endpoints: ['GET /api/venues', 'PATCH /api/inspections/:id/review'],
      },
      {
        path: '/approvals',
        label: 'Approvals',
        icon: 'approval',
        roles: ['SO', 'US', 'DS', 'JS'],
        description: 'Maker-checker chain for each approval type.',
        endpoints: ['GET /api/approvals', 'PATCH /api/approvals/:id/action'],
      },
    ],
  },
  {
    title: 'FAL & Finance',
    items: [
      {
        path: '/fal',
        label: 'FAL Management',
        icon: 'fal',
        roles: INTERNAL,
        description: 'Create, sanction, track acknowledgements, overdue alerts.',
        endpoints: ['GET /api/fal', 'POST /api/fal', 'PATCH /api/fal/:id/sanction', 'POST /api/fal/:id/reminder'],
      },
      {
        path: '/finance/advance',
        label: 'Advance Calculation',
        icon: 'finance',
        roles: INTERNAL,
        description: 'Compute and view advance calculations per exam.',
        endpoints: ['POST /api/finance/calculate', 'GET /api/finance/calculate/:examId'],
      },
      {
        path: '/finance/bills',
        label: 'Bill Verification',
        icon: 'bill',
        roles: ['US', 'DS', 'JS'],
        description: 'Verify and approve submitted bills.',
        endpoints: ['GET /api/finance/bills/:examId', 'PATCH /api/finance/bills/:billId/verify', 'PATCH /api/finance/bills/:billId/approve'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        path: '/users',
        label: 'User Management',
        icon: 'users',
        roles: ['DS', 'JS'],
        description: 'Create users and assign roles.',
        endpoints: ['(admin endpoints)'],
      },
    ],
  },
  // ---------------- External portal (CS / VS) ----------------
  {
    title: 'Centre Operations',
    items: [
      {
        path: '/venue-bank',
        label: 'Venue Bank',
        icon: 'venue-bank',
        roles: ['CS'],
        description: 'Browse the venue bank and add new venues with document uploads.',
        endpoints: ['GET /api/venues', 'POST /api/venues'],
      },
      {
        path: '/assignments',
        label: 'VS Assignment',
        icon: 'assignment',
        roles: ['CS'],
        description: 'Assign venue supervisors from the supervisor pool.',
        endpoints: ['POST /api/exams/:examId/assignments', 'GET /api/exams/:examId/assignments'],
      },
      {
        path: '/assignments/diff',
        label: 'Diff vs Previous',
        icon: 'diff',
        roles: ['CS'],
        description: 'Confirm or justify changes vs the previous cycle.',
        endpoints: ['GET /api/exams/:examId/assignments'],
      },
      {
        path: '/assignments/submit',
        label: 'Submit to UPSC',
        icon: 'submit',
        roles: ['CS'],
        description: 'Submit the finalised venue list to UPSC.',
        endpoints: ['POST /api/exams/:examId/assignments/submit'],
      },
    ],
  },
  {
    title: 'Bills & FAL',
    items: [
      {
        path: '/external/bills',
        label: 'Bills & Vouchers',
        icon: 'bill',
        roles: ['VS', 'CS'],
        description: 'Upload bills and vouchers.',
        endpoints: ['POST /api/finance/bills'],
      },
      {
        path: '/external/fal',
        label: 'FAL Acknowledgement',
        icon: 'ack',
        roles: ['CS'],
        description: 'Acknowledge received FAL.',
        endpoints: ['PATCH /api/fal/:id/acknowledge'],
      },
    ],
  },
]

// All nav items the given role can see, flattened.
export function navItemsForRole(role: Role): NavItem[] {
  return NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.roles.includes(role))
}

export function sectionsForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    title: s.title,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0)
}

export function findNavItem(path: string): NavItem | undefined {
  return NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.path === path)
}

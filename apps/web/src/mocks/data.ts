import type { Role, User } from '../lib/types'

// One demo account per role. In mock mode any of these can log in with the
// universal demo OTP below.
export interface DemoUser extends User {
  role: Role
}

export const DEMO_OTP = '123456'

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-aso', name: 'Aarav Mehta',    email: 'aso@upsc.gov.in', role: 'ASO' },
  { id: 'u-so',  name: 'Sneha Iyer',     email: 'so@upsc.gov.in',  role: 'SO'  },
  { id: 'u-us',  name: 'Rahul Verma',    email: 'us@upsc.gov.in',  role: 'US'  },
  { id: 'u-ds',  name: 'Priya Nair',     email: 'ds@upsc.gov.in',  role: 'DS'  },
  { id: 'u-js',  name: 'Vikram Rao',     email: 'js@upsc.gov.in',  role: 'JS'  },
  { id: 'u-cs',  name: 'Anjali Gupta',   email: 'cs@centre.gov.in', role: 'CS' },
  { id: 'u-vs',  name: 'Imran Khan',     email: 'vs@centre.gov.in', role: 'VS' },
  { id: 'u-io',  name: 'Deepa Menon',    email: 'io@upsc.gov.in',  role: 'IO'  },
]

export function findDemoUserByEmail(email: string): DemoUser | undefined {
  const e = email.trim().toLowerCase()
  return DEMO_USERS.find((u) => u.email.toLowerCase() === e)
}

export function findDemoUserById(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id)
}

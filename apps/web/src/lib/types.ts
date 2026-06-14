// Core domain types — aligned with apps/api contract.

export type Role = 'ASO' | 'SO' | 'US' | 'DS' | 'JS' | 'CS' | 'VS' | 'IO'

export type Portal = 'internal' | 'external' | 'field'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface AuthSuccess {
  token: string
  user: User
}

export interface RoleInfo {
  code: Role
  label: string
  portal: Portal
}

export const ROLES: Record<Role, RoleInfo> = {
  ASO: { code: 'ASO', label: 'Assistant Section Officer', portal: 'internal' },
  SO:  { code: 'SO',  label: 'Section Officer',           portal: 'internal' },
  US:  { code: 'US',  label: 'Under Secretary',           portal: 'internal' },
  DS:  { code: 'DS',  label: 'Deputy Secretary',          portal: 'internal' },
  JS:  { code: 'JS',  label: 'Joint Secretary',           portal: 'internal' },
  CS:  { code: 'CS',  label: 'Centre Superintendent',     portal: 'external' },
  VS:  { code: 'VS',  label: 'Venue Supervisor',          portal: 'external' },
  IO:  { code: 'IO',  label: 'Inspecting Officer',        portal: 'field' },
}

export function roleLabel(role: Role): string {
  return ROLES[role]?.label ?? role
}

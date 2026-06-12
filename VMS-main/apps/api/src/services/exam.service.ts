const CITY_DEFAULTS: Record<string, number> = {
  'Delhi NCR': 115000,
  'Mumbai': 80000,
  'Chennai': 65000,
  'Kolkata': 70000,
  'Hyderabad': 55000,
  'Bengaluru': 60000,
}

const EXAM_TYPE_CODES: Record<string, string> = {
  PRELIMINARY: 'CSP',
  MAINS: 'CSM',
  INTERVIEW: 'CSI',
}

export function getSuggestedCapacity(cityName: string): number {
  const base = CITY_DEFAULTS[cityName] ?? 40000
  return Math.ceil(base * 1.1)
}

export function generateExamCode(year: number, examType: string): string {
  const code = EXAM_TYPE_CODES[examType] ?? 'CSP'
  return `UPSC/${year}/${code}`
}

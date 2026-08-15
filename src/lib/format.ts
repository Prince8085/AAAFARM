const inrFmt = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrFmt0 = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

/** ₹1,23,456.00 (Indian formatting, always 2 decimals). Negatives: −₹1,23,456.00 */
export const inr = (n: number) => `${n < 0 ? '−' : ''}₹${inrFmt.format(Math.abs(n || 0))}`

/** ₹1,23,456 (drops trailing zeros, e.g. for rates) */
export const inrShort = (n: number) => `₹${inrFmt0.format(n || 0)}`

/** D/M/YYYY, e.g. 14/8/2026 */
export function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}/${y}`
}

/** YYYY-MM-DD for today, local timezone */
export function todayISO(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${fmtDate(iso.slice(0, 10))} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

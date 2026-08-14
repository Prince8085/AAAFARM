import type { BillItem, TripItem } from '../types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const itemAmount = (item: BillItem) => round2((item.qty || 0) * (item.rate || 0))

export const totalAmount = (items: BillItem[]) => round2(items.reduce((s, i) => s + itemAmount(i), 0))

export const commissionAmount = (total: number, pct: number) => round2((total * (pct || 0)) / 100)

export const grandTotal = (total: number, commission: number, bhada: number, labourCost: number) =>
  round2(total - commission - (bhada || 0) - (labourCost || 0))

export interface BillTotals {
  total: number
  commission: number
  bhada: number
  labour: number
  grand: number
}

export function computeTotals(items: BillItem[], commissionPct: number, bhada: number, labourCost: number): BillTotals {
  const total = totalAmount(items)
  const commission = commissionAmount(total, commissionPct)
  const bhadaN = round2(bhada || 0)
  const labourN = round2(labourCost || 0)
  return { total, commission, bhada: bhadaN, labour: labourN, grand: grandTotal(total, commission, bhadaN, labourN) }
}

// ---------- Trip (party ledger) calculations ----------

/** Trip line amount is stored directly (user can override qty × rate). */
export const tripItemAmount = (i: TripItem) => round2(i.amount || 0)

/** Sum of all trip item amounts. */
export const tripItemTotal = (items: TripItem[]) => round2(items.reduce((s, i) => s + tripItemAmount(i), 0))

/**
 * Net owed to the party for one trip:
 * net = itemTotal − commission − diesel/driver − toll − labour (palledari)
 */
export function tripNetTotal(
  itemTotal: number,
  commissionAmount: number,
  dieselDriverCost: number,
  tollTax: number,
  labourCost: number,
): number {
  return round2(itemTotal - (commissionAmount || 0) - (dieselDriverCost || 0) - (tollTax || 0) - (labourCost || 0))
}

export interface TripTotals {
  itemTotal: number
  commission: number
  diesel: number
  toll: number
  labour: number
  net: number
}

export function computeTripTotals(trip: {
  items: TripItem[]
  commissionAmount: number
  dieselDriverCost: number
  tollTax: number
  labourCost: number
}): TripTotals {
  const itemTotal = tripItemTotal(trip.items)
  const commission = round2(trip.commissionAmount || 0)
  const diesel = round2(trip.dieselDriverCost || 0)
  const toll = round2(trip.tollTax || 0)
  const labour = round2(trip.labourCost || 0)
  return { itemTotal, commission, diesel, toll, labour, net: tripNetTotal(itemTotal, commission, diesel, toll, labour) }
}

/** Groups trip lines by (groupLabel || itemName) and subtotals them, like the
 *  handwritten ledger groups similar entries within a trip. */
export function groupTripItems(items: TripItem[]) {
  const groups = new Map<string, { label: string; items: TripItem[]; amount: number }>()
  for (const i of items) {
    if (!i.itemName.trim()) continue
    const key = `${i.groupLabel.trim() || ''}·${i.itemName.trim().toLowerCase()}`
    const label = i.groupLabel.trim() ? `${i.itemName.trim()} (${i.groupLabel.trim()})` : i.itemName.trim()
    const g = groups.get(key) ?? { label, items: [] as TripItem[], amount: 0 }
    g.items.push(i)
    g.amount = round2(g.amount + tripItemAmount(i))
    groups.set(key, g)
  }
  return [...groups.values()]
}

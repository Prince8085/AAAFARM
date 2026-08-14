import type { Bill, Trip } from '../types'
import { computeTotals, computeTripTotals } from './calc'

/** Balance due on a bill = grand total − all payments against it. */
export function paidForBill(payments: { billId: string; amount: number }[], billId: string): number {
  return payments.filter((p) => p.billId === billId).reduce((s, p) => s + (p.amount || 0), 0)
}

export function billBalance(payments: { billId: string; amount: number }[], bill: Bill): number {
  const t = computeTotals(bill.items, bill.commissionPct, bill.bhada, bill.labourCost)
  return Math.round((t.grand - paidForBill(payments, bill.id)) * 100) / 100
}

// ---------- Party ledger balances ----------

export const partyNetTotal = (trip: Trip) => computeTripTotals(trip).net

export function partyTotals(trips: Trip[]) {
  const billed = Math.round(trips.reduce((s, t) => s + partyNetTotal(t), 0) * 100) / 100
  return billed
}

export function partyPaid(payments: { partyId: string; amount: number }[], partyId: string): number {
  return Math.round(payments.filter((p) => p.partyId === partyId).reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
}

export function partyBalance(billed: number, paid: number): number {
  return Math.round((billed - paid) * 100) / 100
}

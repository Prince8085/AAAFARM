import { INVOICE_START, LS_KEYS } from '../config'
import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Payment, Trip } from '../types'
import type { DataRepo } from './types'

const DEFAULT_BUSINESS: BusinessInfo = {
  name: 'AAA FARM',
  tagline: 'Professional Mandi Accounting System',
  address: 'Katni Mandi · Vegetable Commission Business',
  phone: '',
  footerNote: 'Thank you for your business!',
  nextInvoiceNo: INVOICE_START,
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * localStorage-backed repository — the default until the Neon API is wired up.
 * Works fully offline; data lives in this browser only.
 */
export const localRepo: DataRepo = {
  async getBusiness() {
    return read<BusinessInfo>(LS_KEYS.business, DEFAULT_BUSINESS)
  },

  async saveBusiness(info) {
    write(LS_KEYS.business, info)
  },

  async listCustomers() {
    return read<Customer[]>(LS_KEYS.customers, [])
  },

  async upsertCustomer(c) {
    const all = await this.listCustomers()
    const idx = all.findIndex((x) => x.id === c.id)
    if (idx >= 0) all[idx] = c
    else all.push(c)
    write(LS_KEYS.customers, all)
    return c
  },

  async deleteCustomer(id) {
    const all = await this.listCustomers()
    write(
      LS_KEYS.customers,
      all.filter((c) => c.id !== id),
    )
  },

  async listBills() {
    return read<Bill[]>(LS_KEYS.bills, [])
  },

  async getBill(id) {
    const all = await this.listBills()
    return all.find((b) => b.id === id) ?? null
  },

  async saveBill(bill) {
    const all = await this.listBills()
    const idx = all.findIndex((b) => b.id === bill.id)
    let saved = bill
    if (!bill.invoiceNo) {
      const biz = await this.getBusiness()
      saved = { ...bill, invoiceNo: `BILL-${biz.nextInvoiceNo}` }
      await this.saveBusiness({ ...biz, nextInvoiceNo: biz.nextInvoiceNo + 1 })
    }
    if (idx >= 0) all[idx] = saved
    else all.push(saved)
    write(LS_KEYS.bills, all)
    return saved
  },

  async deleteBill(id) {
    const all = await this.listBills()
    write(
      LS_KEYS.bills,
      all.filter((b) => b.id !== id),
    )
  },

  async listPayments() {
    return read<Payment[]>(LS_KEYS.payments, [])
  },

  async addPayment(p) {
    const all = await this.listPayments()
    all.push(p)
    write(LS_KEYS.payments, all)
    return p
  },

  async deletePayment(id) {
    const all = await this.listPayments()
    write(
      LS_KEYS.payments,
      all.filter((p) => p.id !== id),
    )
  },

  // ---------- Party / Supplier ledger ----------

  async listParties() {
    return read<Party[]>(LS_KEYS.parties, [])
  },

  async upsertParty(p) {
    const all = await this.listParties()
    const idx = all.findIndex((x) => x.id === p.id)
    if (idx >= 0) all[idx] = p
    else all.push(p)
    write(LS_KEYS.parties, all)
    return p
  },

  async listTrips() {
    return read<Trip[]>(LS_KEYS.trips, [])
  },

  async getTrip(id) {
    const all = await this.listTrips()
    return all.find((t) => t.id === id) ?? null
  },

  async saveTrip(trip) {
    const all = await this.listTrips()
    const idx = all.findIndex((t) => t.id === trip.id)
    let saved = trip
    if (!trip.tripNumber) {
      const partyTrips = all.filter((t) => t.partyId === trip.partyId)
      saved = { ...trip, tripNumber: partyTrips.length + 1 }
    }
    if (idx >= 0) all[idx] = saved
    else all.push(saved)
    write(LS_KEYS.trips, all)
    return saved
  },

  async deleteTrip(id) {
    const all = await this.listTrips()
    write(
      LS_KEYS.trips,
      all.filter((t) => t.id !== id),
    )
  },

  async listPartyPayments() {
    return read<PartyPayment[]>(LS_KEYS.partyPayments, [])
  },

  async addPartyPayment(p) {
    const all = await this.listPartyPayments()
    all.push(p)
    write(LS_KEYS.partyPayments, all)
    return p
  },

  async deletePartyPayment(id) {
    const all = await this.listPartyPayments()
    write(
      LS_KEYS.partyPayments,
      all.filter((p) => p.id !== id),
    )
  },
}

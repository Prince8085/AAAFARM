export type Unit = 'kg' | 'quintal' | 'piece' | 'bag'

export type BillStatus = 'DRAFT' | 'SAVED' | 'PRINTED'

export interface Customer {
  id: string
  name: string
  mobile: string
  email: string
  address: string
  createdAt: string
}

export interface BillItem {
  id: string
  itemName: string
  qty: number
  unit: Unit
  rate: number
}

export interface Bill {
  id: string
  invoiceNo: string // BILL-XXXXXX, assigned on save
  customerId: string
  billDate: string // YYYY-MM-DD
  status: BillStatus
  commissionPct: number
  bhada: number
  labourCost: number
  /** Interest / credit charge on udhaar sales (₹), added on top. */
  byaj: number
  notes: string
  items: BillItem[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  billId: string
  amount: number
  paidDate: string // YYYY-MM-DD
  method: string // Cash / UPI / Bank / Other
  createdAt: string
}

export interface BusinessInfo {
  name: string
  tagline: string
  address: string
  phone: string
  footerNote: string
  nextInvoiceNo: number // auto-increment counter
}

// ---------- Party / Supplier Ledger (khata) ----------

export interface Party {
  id: string
  name: string
  phone: string
  address: string
  createdAt: string
}

/** One line in a trip. Amount is independently editable (source ledger does not
 *  always equal qty × rate) — qty × rate is only a suggestion. */
export interface TripItem {
  id: string
  itemName: string
  groupLabel: string // optional free-text grouping tag
  quantity: number
  rate: number
  amount: number
  bags: number // number of bags/packets for this item
  packagingTag: string // e.g. "पन्नी", "बोरी", "डब्बा" — packaging type
}

export interface TripExpenseItem {
  id: string
  label: string // e.g. "Bhada", "Banvai", "Palledari", "Toll", etc.
  amount: number
}

export interface Trip {
  id: string
  partyId: string
  tripNumber: number // sequential per party: 1, 2, 3…
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  dieselDriverCost: number // kept for backward compat, total of expenseItems
  tollTax: number // kept for backward compat
  labourCost: number // kept for backward compat (palledari)
  commissionAmount: number // flat ₹ amount entered directly per trip
  expenseItems: TripExpenseItem[] // detailed breakdown: Bhada, Banvai, Palledari, etc.
  items: TripItem[]
  createdAt: string
  updatedAt: string
}

/** Advance/partial payment against a party's running account (khata). */
export interface PartyPayment {
  id: string
  partyId: string
  amount: number
  paidDate: string // YYYY-MM-DD
  notes: string
  createdAt: string
}

export const UNITS: Unit[] = ['kg', 'quintal', 'piece', 'bag']

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Other'] as const

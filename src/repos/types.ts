import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Payment, Trip } from '../types'

/**
 * Single interface for all data access.
 * localRepo implements it against localStorage; apiRepo implements it against
 * your future Neon-backed API. Switch with DATA_SOURCE in src/config.ts.
 */
export interface DataRepo {
  getBusiness(): Promise<BusinessInfo>
  saveBusiness(info: BusinessInfo): Promise<void>

  listCustomers(): Promise<Customer[]>
  upsertCustomer(c: Customer): Promise<Customer>
  deleteCustomer(id: string): Promise<void>

  /** Returns bill with invoiceNo assigned if it didn't have one. */
  saveBill(bill: Bill): Promise<Bill>
  listBills(): Promise<Bill[]>
  getBill(id: string): Promise<Bill | null>
  deleteBill(id: string): Promise<void>

  listPayments(): Promise<Payment[]>
  addPayment(p: Payment): Promise<Payment>
  deletePayment(id: string): Promise<void>

  // ---------- Party / Supplier ledger ----------

  listParties(): Promise<Party[]>
  upsertParty(p: Party): Promise<Party>

  /** Returns trip with tripNumber assigned if it didn't have one. */
  saveTrip(trip: Trip): Promise<Trip>
  listTrips(): Promise<Trip[]>
  getTrip(id: string): Promise<Trip | null>
  deleteTrip(id: string): Promise<void>

  listPartyPayments(): Promise<PartyPayment[]>
  addPartyPayment(p: PartyPayment): Promise<PartyPayment>
  deletePartyPayment(id: string): Promise<void>
}

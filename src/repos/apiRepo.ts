import { API_BASE_URL } from '../config'
import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Payment, Trip } from '../types'
import type { DataRepo } from './types'

/**
 * API repository stub for your Neon-backed backend.
 *
 * TODO (you): implement your API and keep the endpoints below in sync.
 * Suggested REST contract (documented in README too):
 *
 *   GET    /business            → BusinessInfo
 *   PUT    /business            → 200
 *   GET    /customers           → Customer[]
 *   POST   /customers           → Customer        (body: Customer)
 *   PUT    /customers/:id       → Customer
 *   DELETE /customers/:id       → 204
 *   GET    /bills               → Bill[]          (items embedded)
 *   GET    /bills/:id           → Bill
 *   POST   /bills               → Bill            (server assigns invoiceNo
 *                                                   atomically via counter)
 *   PUT    /bills/:id           → Bill
 *   DELETE /bills/:id           → 204
 *   GET    /payments            → Payment[]
 *   POST   /payments            → Payment
 *   DELETE /payments/:id        → 204
 *
 * Party / supplier ledger:
 *   GET    /parties             → Party[]
 *   POST   /parties             → Party
 *   GET    /trips               → Trip[] (items embedded)
 *   GET    /trips/:id           → Trip
 *   POST   /trips               → Trip (server assigns trip_number per party)
 *   PUT    /trips/:id           → Trip
 *   DELETE /trips/:id           → 204
 *   GET    /party-payments      → PartyPayment[]
 *   POST   /party-payments      → PartyPayment
 *   DELETE /party-payments/:id  → 204
 *
 * IMPORTANT: invoice numbers must be allocated server-side (in the POST /bills
 * handler) with a database counter so they can never repeat — never trust a
 * client-sent invoiceNo.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const apiRepo: DataRepo = {
  getBusiness: () => request<BusinessInfo>('/business'),
  saveBusiness: (info) => request('/business', { method: 'PUT', body: JSON.stringify(info) }),

  listCustomers: () => request<Customer[]>('/customers'),
  upsertCustomer: (c) =>
    request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(c),
    }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  saveBill: (bill) =>
    request<Bill>('/bills', { method: 'POST', body: JSON.stringify(bill) }),
  listBills: () => request<Bill[]>('/bills'),
  getBill: (id) => request<Bill>(`/bills/${id}`),
  deleteBill: (id) => request(`/bills/${id}`, { method: 'DELETE' }),

  listPayments: () => request<Payment[]>('/payments'),
  addPayment: (p) =>
    request<Payment>('/payments', { method: 'POST', body: JSON.stringify(p) }),
  deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),

  // ---------- Party / Supplier ledger ----------

  listParties: () => request<Party[]>('/parties'),
  upsertParty: (p) =>
    request<Party>('/parties', { method: 'POST', body: JSON.stringify(p) }),

  saveTrip: (trip) =>
    request<Trip>('/trips', { method: 'POST', body: JSON.stringify(trip) }),
  listTrips: () => request<Trip[]>('/trips'),
  getTrip: (id) => request<Trip>(`/trips/${id}`),
  deleteTrip: (id) => request(`/trips/${id}`, { method: 'DELETE' }),

  listPartyPayments: () => request<PartyPayment[]>('/party-payments'),
  addPartyPayment: (p) =>
    request<PartyPayment>('/party-payments', { method: 'POST', body: JSON.stringify(p) }),
  deletePartyPayment: (id) => request(`/party-payments/${id}`, { method: 'DELETE' }),
}

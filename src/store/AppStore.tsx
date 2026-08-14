import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { repo } from '../repos'
import { uid } from '../lib/format'
import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Payment, Trip } from '../types'

interface StoreValue {
  business: BusinessInfo | null
  customers: Customer[]
  bills: Bill[]
  payments: Payment[]
  parties: Party[]
  trips: Trip[]
  partyPayments: PartyPayment[]
  loading: boolean
  refresh: () => Promise<void>
  saveBusiness: (info: BusinessInfo) => Promise<void>
  saveCustomer: (c: Customer) => Promise<void>
  saveBill: (bill: Bill) => Promise<Bill>
  deleteBill: (id: string) => Promise<void>
  markPrinted: (bill: Bill) => Promise<void>
  addPayment: (billId: string, amount: number, paidDate: string, method: string) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  saveParty: (p: Party) => Promise<void>
  saveTrip: (trip: Trip) => Promise<Trip>
  deleteTrip: (id: string) => Promise<void>
  addPartyPayment: (partyId: string, amount: number, paidDate: string, notes: string) => Promise<void>
  deletePartyPayment: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<BusinessInfo | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [partyPayments, setPartyPayments] = useState<PartyPayment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [b, cs, bs, ps, prs, ts, pps] = await Promise.all([
        repo.getBusiness(),
        repo.listCustomers(),
        repo.listBills(),
        repo.listPayments(),
        repo.listParties(),
        repo.listTrips(),
        repo.listPartyPayments(),
      ])
      setBusiness(b)
      setCustomers(cs)
      setBills(bs)
      setPayments(ps)
      setParties(prs)
      setTrips(ts)
      setPartyPayments(pps)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
  }, [refresh])

  const saveBusiness = useCallback(async (info: BusinessInfo) => {
    await repo.saveBusiness(info)
    setBusiness(info)
  }, [])

  const saveCustomer = useCallback(async (c: Customer) => {
    const saved = await repo.upsertCustomer(c)
    setCustomers((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }, [])

  const saveBill = useCallback(async (bill: Bill) => {
    const saved = await repo.saveBill(bill)
    setBills((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
    return saved
  }, [])

  const deleteBill = useCallback(async (id: string) => {
    await repo.deleteBill(id)
    setBills((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const markPrinted = useCallback(
    async (bill: Bill) => {
      if (bill.status === 'PRINTED') return
      await saveBill({ ...bill, status: 'PRINTED', updatedAt: new Date().toISOString() })
    },
    [saveBill],
  )

  const addPayment = useCallback(
    async (billId: string, amount: number, paidDate: string, method: string) => {
      const p: Payment = { id: uid(), billId, amount, paidDate, method, createdAt: new Date().toISOString() }
      const saved = await repo.addPayment(p)
      setPayments((prev) => [...prev, saved])
    },
    [],
  )

  const deletePayment = useCallback(async (id: string) => {
    await repo.deletePayment(id)
    setPayments((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // ---------- Party / Supplier ledger ----------

  const saveParty = useCallback(async (p: Party) => {
    const saved = await repo.upsertParty(p)
    setParties((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }, [])

  const saveTrip = useCallback(async (trip: Trip) => {
    const saved = await repo.saveTrip(trip)
    setTrips((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
    return saved
  }, [])

  const deleteTrip = useCallback(async (id: string) => {
    await repo.deleteTrip(id)
    setTrips((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addPartyPayment = useCallback(
    async (partyId: string, amount: number, paidDate: string, notes: string) => {
      const p: PartyPayment = { id: uid(), partyId, amount, paidDate, notes, createdAt: new Date().toISOString() }
      const saved = await repo.addPartyPayment(p)
      setPartyPayments((prev) => [...prev, saved])
    },
    [],
  )

  const deletePartyPayment = useCallback(async (id: string) => {
    await repo.deletePartyPayment(id)
    setPartyPayments((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      business,
      customers,
      bills,
      payments,
      parties,
      trips,
      partyPayments,
      loading,
      refresh,
      saveBusiness,
      saveCustomer,
      saveBill,
      deleteBill,
      markPrinted,
      addPayment,
      deletePayment,
      saveParty,
      saveTrip,
      deleteTrip,
      addPartyPayment,
      deletePartyPayment,
    }),
    [business, customers, bills, payments, parties, trips, partyPayments, loading, refresh, saveBusiness, saveCustomer, saveBill, deleteBill, markPrinted, addPayment, deletePayment, saveParty, saveTrip, deleteTrip, addPartyPayment, deletePartyPayment],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside AppProvider')
  return ctx
}

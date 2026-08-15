import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { computeTotals, computeTripTotals } from '../lib/calc'
import { paidForBill, partyPaid } from '../lib/balance'
import { inr, todayISO } from '../lib/format'
import { Card, SectionTitle } from '../components/ui'

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Aaj' },
  { key: 'yesterday', label: 'Kal' },
  { key: 'week', label: 'Is hafte' },
  { key: 'month', label: 'Is mahine' },
  { key: 'custom', label: 'Custom' },
]

function StatCard({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone: 'brand' | 'blue' | 'red' | 'amber' }) {
  const tones = {
    brand: 'from-brand-600 to-brand-400',
    blue: 'from-blue-700 to-blue-500',
    red: 'from-rose-600 to-rose-400',
    amber: 'from-amber-600 to-amber-400',
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br p-[1px] shadow-[0_2px_10px_rgba(16,42,32,0.08)]">
      <div className="rounded-2xl bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
          <span className="text-base">{icon}</span>
        </div>
        <div className="mt-1 truncate text-xl font-extrabold tabular-nums text-gray-900">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
        <div className={`mt-2 h-1 w-full rounded-full bg-gradient-to-r ${tones[tone]} opacity-60`} />
      </div>
    </div>
  )
}

export function Dashboard() {
  const { bills, payments, parties, trips, partyPayments, loading } = useStore()

  const today = todayISO()
  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(addDays(today, -6))
  const [customTo, setCustomTo] = useState(today)

  const range = useMemo<[string, string]>(() => {
    switch (period) {
      case 'today':
        return [today, today]
      case 'yesterday':
        return [addDays(today, -1), addDays(today, -1)]
      case 'week':
        return [addDays(today, -6), today]
      case 'month':
        return [today.slice(0, 8) + '01', today]
      case 'custom':
        return [customFrom, customTo]
    }
  }, [period, customFrom, customTo, today])

  const inRange = (date: string) => date >= range[0] && date <= range[1]

  const billTotals = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeTotals>>()
    for (const b of bills) map.set(b.id, computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost, b.byaj))
    return map
  }, [bills])

  // ---- Period metrics ----
  const periodBills = bills.filter((b) => inRange(b.billDate))
  const sales = periodBills.reduce((s, b) => s + (billTotals.get(b.id)?.grand ?? 0), 0)
  const collected = payments.filter((p) => inRange(p.paidDate)).reduce((s, p) => s + (p.amount || 0), 0)
  const income = periodBills.reduce((s, b) => {
    const t = billTotals.get(b.id)
    return t ? s + t.commission + t.bhada + t.labour + t.byaj : s
  }, 0)
  const expense = trips.filter((t) => inRange(t.startDate)).reduce(
    (s, t) => s + (t.dieselDriverCost || 0) + (t.tollTax || 0) + (t.labourCost || 0),
    0,
  )
  const profit = income - expense

  // ---- Balance sheet (all time, point-in-time) ----
  const udhaar = bills.reduce((s, b) => s + Math.max(0, (billTotals.get(b.id)?.grand ?? 0) - paidForBill(payments, b.id)), 0)
  const partyDue = parties.reduce((s, p) => {
    const billed = trips.filter((t) => t.partyId === p.id).reduce((x, t) => x + computeTripTotals(t).net, 0)
    return s + Math.max(0, billed - partyPaid(partyPayments, p.id))
  }, 0)

  // ---- 7-day sales chart (always last 7 days) ----
  const chart = useMemo(() => {
    const days: { label: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = addDays(todayISO(), -i)
      const total = bills.filter((b) => b.billDate === d).reduce((s, b) => s + computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost, b.byaj).grand, 0)
      days.push({ label: d.slice(8), total })
    }
    return days
  }, [bills])

  const chartMax = Math.max(...chart.map((d) => d.total), 1)
  const vasooli = sales > 0 ? Math.min(100, Math.round((collected / sales) * 100)) : 0
  const hasData = bills.length > 0 || trips.length > 0 || payments.length > 0

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">Dashboard</h2>
        <Link to="/bills/new" className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]">
          + Naya Bill
        </Link>
      </div>

      {/* Period chips */}
      <div className="no-print flex gap-1.5 overflow-x-auto pb-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              period === p.key ? 'bg-brand-500 text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="no-print grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Se</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value || today)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Tak</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value || today)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {!hasData ? (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-300 text-2xl">
            📊
          </div>
          <p className="text-sm font-semibold text-gray-700">Abhi koi data nahi hai</p>
          <p className="mt-1 text-xs text-gray-400">
            Pehla bill banayein — dashboard me bikri, udhaar aur P&L apne aap dikhne lagega.
          </p>
          <Link
            to="/bills/new"
            className="mt-3 inline-block rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]"
          >
            + Pehla Bill Banayein
          </Link>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon="💰" label="Bikri" value={inr(sales)} sub={`${periodBills.length} bills`} tone="brand" />
            <StatCard icon="🧾" label="Collection" value={inr(collected)} sub={`Vasooli ${vasooli}%`} tone="blue" />
            <StatCard icon="⚠️" label="Udhaar Baaki" value={inr(udhaar)} sub="Customers se aana" tone="red" />
            <StatCard icon="🚛" label="Parties ko Dena" value={inr(partyDue)} sub="Dena baaki" tone="amber" />
          </div>

          {/* Billed vs collected */}
          <Card className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-700">Billed vs Collected</span>
              <span className="text-xs font-bold text-gray-500">{vasooli}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${Math.max(vasooli, 2)}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-gray-400">
              <span>Billed {inr(sales)}</span>
              <span>Collected {inr(collected)}</span>
            </div>
          </Card>

          {/* 7-day chart */}
          <Card className="p-3">
            <SectionTitle>Pichhle 7 din ki bikri</SectionTitle>
            <div className="mt-2 flex h-32 items-end gap-1.5">
              {chart.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-md ${d.total > 0 ? 'bg-gradient-to-t from-brand-600 to-brand-400' : 'bg-gray-100'}`}
                    style={{ height: `${Math.max((d.total / chartMax) * 90, d.total > 0 ? 6 : 3)}px` }}
                    title={inr(d.total)}
                  />
                  <span className="text-[10px] text-gray-400">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* P&L */}
          <Card className="p-3">
            <SectionTitle>Profit &amp; Loss</SectionTitle>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Income (Commission + Byaj + Bhada/Labour)</span>
                <span className="font-semibold tabular-nums text-brand-700">{inr(income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expense (Party: Diesel + Toll + Labour)</span>
                <span className="font-semibold tabular-nums text-rose-600">−{inr(expense)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t-2 border-gray-800 pt-2 text-base font-extrabold">
                <span>Net Profit</span>
                <span className={`tabular-nums ${profit >= 0 ? 'text-brand-700' : 'text-rose-600'}`}>{inr(profit)}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
              Income = commission, byaj, bhada aur labour jo customer se liya ({range[0]} se {range[1]}). Expense =
              party trips par diesel, toll aur labour. General kharcha (rent/salary) abhi add nahi hai.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}

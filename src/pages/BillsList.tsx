import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { computeTotals } from '../lib/calc'
import { fmtDate, inr } from '../lib/format'
import { Card, EmptyState, StatusBadge, TextInput } from '../components/ui'

export function BillsList() {
  const { bills, customers, payments } = useStore()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(() => {
    const byId = new Map(customers.map((c) => [c.id, c]))
    const filtered = bills
      .filter((b) => {
        const cust = byId.get(b.customerId)
        const hay = `${b.invoiceNo} ${cust?.name ?? ''} ${cust?.mobile ?? ''}`.toLowerCase()
        const matchesQ = !q || hay.includes(q.toLowerCase())
        const matchesFrom = !from || b.billDate >= from
        const matchesTo = !to || b.billDate <= to
        return matchesQ && matchesFrom && matchesTo
      })
      .sort((a, b) => (a.billDate === b.billDate ? b.createdAt.localeCompare(a.createdAt) : b.billDate.localeCompare(a.billDate)))

    return filtered.map((b) => ({
      bill: b,
      customer: byId.get(b.customerId),
      totals: computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost),
    }))
  }, [bills, customers, q, from, to])

  const totals = useMemo(() => {
    const billed = bills.reduce((s, b) => s + computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost).grand, 0)
    const collected = payments.reduce((s, p) => s + (p.amount || 0), 0)
    return { billed, collected, balance: billed - collected }
  }, [bills, payments])

  return (
    <div>
      <h2 className="mb-3 text-lg font-extrabold text-gray-800">Bills ({rows.length})</h2>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="chip-gradient-green rounded-2xl p-3 text-white shadow-soft">
          <div className="text-[11px] font-medium opacity-85">Billed</div>
          <div className="money mt-0.5 truncate text-sm font-extrabold tracking-tight">{inr(totals.billed)}</div>
        </div>
        <div className="chip-gradient-blue rounded-2xl p-3 text-white shadow-soft">
          <div className="text-[11px] font-medium opacity-85">Collected</div>
          <div className="money mt-0.5 truncate text-sm font-extrabold tracking-tight">{inr(totals.collected)}</div>
        </div>
        <div className="chip-gradient-ink rounded-2xl p-3 text-white shadow-soft">
          <div className="text-[11px] font-medium opacity-85">Balance Due</div>
          <div className="money mt-0.5 truncate text-sm font-extrabold tracking-tight">{inr(totals.balance)}</div>
        </div>
      </div>

      {/* Search + date filter */}
      <Card className="no-print mb-3 space-y-2 p-3">
        <TextInput placeholder="🔍 Invoice no ya customer search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" title="Koi bill nahi mila" subtitle="Naya bill banane ke liye 'New Bill' dabayein" />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ bill, customer, totals: t }) => (
            <Link key={bill.id} to={`/bills/${bill.id}`} className="block">
              <Card className="p-3 transition-shadow active:shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-invoice">{bill.invoiceNo}</div>
                  <StatusBadge status={bill.status} />
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-800">{customer?.name ?? '—'}</div>
                    <div className="text-xs text-gray-400">
                      {fmtDate(bill.billDate)}
                      {customer?.mobile ? ` · ${customer.mobile}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-gray-900">{inr(t.grand)}</div>
                    <div className="text-[11px] text-gray-400">{bill.items.length} items</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

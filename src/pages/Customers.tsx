import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { computeTotals } from '../lib/calc'
import { inr } from '../lib/format'
import { paidForBill } from '../lib/balance'
import { Card, EmptyState, TextInput } from '../components/ui'
import { useState } from 'react'

export function Customers() {
  const { customers, bills, payments } = useStore()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    return customers
      .map((c) => {
        const cBills = bills.filter((b) => b.customerId === c.id)
        const billed = cBills.reduce((s, b) => s + computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost).grand, 0)
        const paid = cBills.reduce((s, b) => s + paidForBill(payments, b.id), 0)
        return { customer: c, count: cBills.length, billed, balance: Math.round((billed - paid) * 100) / 100 }
      })
      .filter((r) => {
        const hay = `${r.customer.name} ${r.customer.mobile}`.toLowerCase()
        return !q || hay.includes(q.toLowerCase())
      })
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name))
  }, [customers, bills, payments, q])

  return (
    <div>
      <h2 className="mb-3 text-lg font-extrabold text-gray-800">Customers ({rows.length})</h2>
      <div className="no-print mb-3">
        <TextInput placeholder="🔍 Naam ya mobile search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="👥" title="Koi customer nahi" subtitle="New Bill me customer add karne par yahan dikhega" />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ customer, count, billed, balance }) => (
            <Link key={customer.id} to={`/customers/${customer.id}`} className="block">
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{customer.name}</div>
                    <div className="text-xs text-gray-400">{customer.mobile || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-gray-500">
                      {count} bill{count !== 1 ? 's' : ''} · <span className="font-semibold">{inr(billed)}</span>
                    </div>
                    <div className={balance > 0 ? 'font-bold text-red-600' : 'text-gray-400'}>
                      {balance > 0 ? `Due ${inr(balance)}` : 'No due'}
                    </div>
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

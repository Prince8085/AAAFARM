import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { computeTotals } from '../lib/calc'
import { fmtDate, inr } from '../lib/format'
import { paidForBill } from '../lib/balance'
import { Card, EmptyState, StatusBadge } from '../components/ui'

export function CustomerDetail() {
  const { id } = useParams()
  const { customers, bills, payments } = useStore()

  const customer = customers.find((c) => c.id === id)
  if (!customer) {
    return (
      <Card>
        <EmptyState icon="❓" title="Customer nahi mila" />
      </Card>
    )
  }

  const cBills = bills
    .filter((b) => b.customerId === customer.id)
    .sort((a, b) => (a.billDate === b.billDate ? b.createdAt.localeCompare(a.createdAt) : b.billDate.localeCompare(a.billDate)))

  const billed = cBills.reduce((s, b) => s + computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost, b.byaj).grand, 0)
  const paid = cBills.reduce((s, b) => s + paidForBill(payments, b.id), 0)
  const balance = Math.round((billed - paid) * 100) / 100

  return (
    <div className="space-y-3">
      <Link to="/customers" className="text-sm font-semibold text-brand-600">
        ← Customers
      </Link>

      <Card className="p-3">
        <h2 className="text-lg font-extrabold text-gray-900">{customer.name}</h2>
        <div className="mt-0.5 text-sm text-gray-500">
          {[customer.mobile, customer.email, customer.address].filter(Boolean).join(' · ') || '—'}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Bills</div>
            <div className="font-extrabold">{cBills.length}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Billed</div>
            <div className="font-extrabold">{inr(billed)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Due</div>
            <div className={`font-extrabold ${balance > 0 ? 'text-red-600' : 'text-gray-800'}`}>{inr(balance)}</div>
          </div>
        </div>
      </Card>

      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Bill History</h3>
      {cBills.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" title="Abhi koi bill nahi" subtitle="New Bill page se is customer ka bill banayein" />
        </Card>
      ) : (
        <div className="space-y-2">
          {cBills.map((b) => {
            const t = computeTotals(b.items, b.commissionPct, b.bhada, b.labourCost, b.byaj)
            const bal = Math.round((t.grand - paidForBill(payments, b.id)) * 100) / 100
            return (
              <Link key={b.id} to={`/bills/${b.id}`} className="block">
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-invoice">{b.invoiceNo}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-xs text-gray-400">{fmtDate(b.billDate)}</span>
                    <span className="font-extrabold">{inr(t.grand)}</span>
                  </div>
                  {bal > 0 && <div className="mt-1 text-right text-xs font-bold text-red-600">Due {inr(bal)}</div>}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

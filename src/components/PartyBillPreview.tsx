import type { BusinessInfo, Party, PartyPayment, Trip } from '../types'
import { computeTripTotals } from '../lib/calc'
import { fmtDate, inr } from '../lib/format'

interface Props {
  party: Party
  trips: Trip[]
  payments: PartyPayment[]
  business: BusinessInfo | null
  className?: string
}

export function PartyBillPreview({ party, trips, payments, business, className = '' }: Props) {
  const b = business ?? { name: 'AAA FARM', tagline: '', address: '', phone: '', footerNote: 'Thank you for your business!', nextInvoiceNo: 0 }
  const sorted = [...trips].sort((a, z) => a.tripNumber - z.tripNumber)
  const totalBill = sorted.reduce((s, t) => s + computeTripTotals(t).net, 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const balance = Math.round((totalBill - totalPaid) * 100) / 100

  return (
    <div className={`print-area overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm ${className}`}>
      <div className="print-full max-h-[70vh] overflow-y-auto p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-invoice pb-3">
          <div>
            <div className="text-xl font-extrabold tracking-tight text-gray-900">{b.name}</div>
            <div className="text-[11px] text-gray-500">{b.tagline}</div>
            <div className="text-[11px] text-gray-500">{b.address}</div>
            {b.phone && <div className="text-[11px] text-gray-500">Phone: {b.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-invoice">Party Statement (Khata)</div>
            <div className="text-xs font-semibold text-gray-800">{party.name}</div>
            <div className="text-[11px] text-gray-500">
              {sorted.length} trip{sorted.length !== 1 ? 's' : ''} · {fmtDate(new Date().toISOString().slice(0, 10))}
            </div>
          </div>
        </div>

        {/* Trips table */}
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-invoice text-white">
              <th className="px-2 py-1.5 text-left font-bold">Trip</th>
              <th className="px-2 py-1.5 text-left font-bold">Dates</th>
              <th className="px-2 py-1.5 text-right font-bold">Item Total</th>
              <th className="px-2 py-1.5 text-right font-bold">Commission</th>
              <th className="px-2 py-1.5 text-right font-bold">Expenses</th>
              <th className="px-2 py-1.5 text-right font-bold">Net Bill Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-gray-400">
                  Koi trip select nahi hui
                </td>
              </tr>
            )}
            {sorted.map((t, i) => {
              const tt = computeTripTotals(t)
              return (
                <tr key={t.id} className={i % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                  <td className="px-2 py-1.5 font-medium">Trip {t.tripNumber}</td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {fmtDate(t.startDate)} to {fmtDate(t.endDate)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{inr(tt.itemTotal)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(tt.commission)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(tt.diesel + tt.toll + tt.labour)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{inr(tt.net)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Two-column payments summary */}
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Bill Amount</div>
            <div className="mt-1 space-y-0.5 text-xs">
              {sorted.map((t) => (
                <div key={t.id} className="flex justify-between gap-2">
                  <span className="text-gray-600">
                    Trip {t.tripNumber} ({fmtDate(t.startDate)})
                  </span>
                  <span className="font-medium">{inr(computeTripTotals(t).net)}</span>
                </div>
              ))}
              {sorted.length === 0 && <div className="text-gray-400">—</div>}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Paid Amount</div>
            <div className="mt-1 space-y-0.5 text-xs">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-2">
                  <span className="text-gray-600">
                    {fmtDate(p.paidDate)}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </span>
                  <span className="font-medium">{inr(p.amount)}</span>
                </div>
              ))}
              {payments.length === 0 && <div className="text-gray-400">—</div>}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-3 border-t border-gray-300 pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-gray-700">Total Bill</span>
            <span className="font-bold">{inr(totalBill)}</span>
          </div>
          <div className="mt-0.5 flex justify-between text-xs">
            <span className="font-bold text-gray-700">Total Paid</span>
            <span className="font-bold">{inr(totalPaid)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t-2 border-gray-800 pt-2 text-base font-extrabold text-gray-900">
            <span>Balance Due</span>
            <span className={balance > 0 ? 'text-brand-700' : 'text-gray-900'}>{inr(balance)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-gray-200 pt-2 text-center text-[11px] text-gray-400">
          <div className="font-semibold">{b.footerNote}</div>
          <div className="font-bold text-gray-500">{b.name}</div>
        </div>
      </div>
    </div>
  )
}

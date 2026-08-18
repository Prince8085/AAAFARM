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
  const tts = sorted.map((t) => computeTripTotals(t))
  const totalBill = tts.reduce((s, t) => s + t.net, 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const balance = Math.round((totalBill - totalPaid) * 100) / 100
  const grossTotal = tts.reduce((s, t) => s + t.itemTotal, 0)
  const totalComm = tts.reduce((s, t) => s + t.commission, 0)
  const totalExp = tts.reduce((s, t) => s + t.totalExpenses, 0)
  const netAfterComm = Math.round((grossTotal - totalComm) * 100) / 100

  return (
    <div className={`print-area overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm ${className}`}>
      <div className="print-full max-h-[70vh] overflow-y-auto p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-invoice pb-3">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AAA Farm logo" className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
            <div>
              <div className="text-xl font-extrabold tracking-tight text-gray-900">{b.name}</div>
              <div className="text-[11px] text-gray-500">{b.tagline}</div>
              <div className="text-[11px] text-gray-500">{b.address}</div>
              {b.phone && <div className="text-[11px] text-gray-500">Phone: {b.phone}</div>}
            </div>
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
              <th className="px-2 py-1.5 text-right font-bold">Commission (−)</th>
              <th className="px-2 py-1.5 text-right font-bold">Expenses (−)</th>
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
              const tt = tts[i]
              return (
                <tr key={t.id} className={i % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                  <td className="px-2 py-1.5 font-medium">Trip {t.tripNumber}</td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {fmtDate(t.startDate)} to {fmtDate(t.endDate)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{inr(tt.itemTotal)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(tt.commission)}</td>
                  <td className="px-2 py-1.5 text-right">
                  {inr(tt.totalExpenses)}
                  {tt.expenseItems.filter((e) => e.label.trim()).length > 0 && (
                    <div className="text-[10px] text-gray-400">
                      {tt.expenseItems.filter((e) => e.label.trim()).map((e) => e.label).join(', ')}
                    </div>
                  )}
                </td>
                  <td className="px-2 py-1.5 text-right font-medium">{inr(tt.net)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>          {/* Expense breakdown — per-trip expense detail */}
          {sorted.some((t) => (t.expenseItems ?? []).filter((e) => e.label.trim()).length > 0) && (
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Expense Breakdown (Hisaab)</div>
              {sorted.map((t) => {
                const exps = (t.expenseItems ?? []).filter((e) => e.label.trim())
                if (exps.length === 0) return null
                return (
                  <div key={t.id} className="mt-2">
                    <div className="flex items-center justify-between rounded-t-md bg-gray-800 px-2 py-1.5 text-xs font-bold text-white">
                      <span>Trip {t.tripNumber} · {fmtDate(t.startDate)} to {fmtDate(t.endDate)}</span>
                      <span>Total {inr(exps.reduce((s, e) => s + (e.amount || 0), 0))}</span>
                    </div>
                    <table className="w-full border-collapse border border-gray-200 text-xs">
                      <thead>
                        <tr className="bg-invoice text-white">
                          <th className="px-2 py-1 text-left font-bold">Expense</th>
                          <th className="px-2 py-1 text-right font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exps.map((e, ei) => (
                          <tr key={e.id} className={ei % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                            <td className="px-2 py-1 font-medium">{e.label}</td>
                            <td className="px-2 py-1 text-right font-medium">{inr(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}

          {/* Trip goods (saman) — per-trip itemized detail */}
          <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Trip Goods (Saman)</div>
          {sorted.map((t, ti) => {
            const tt = tts[ti]
            const goods = t.items.filter((i) => i.itemName.trim())
            if (goods.length === 0) return null
            return (
              <div key={t.id} className="mt-2">
                <div className="flex items-center justify-between rounded-t-md bg-gray-800 px-2 py-1.5 text-xs font-bold text-white">
                  <span>
                    Trip {t.tripNumber} · {fmtDate(t.startDate)} to {fmtDate(t.endDate)}
                  </span>
                  <span>Net {inr(tt.net)}</span>
                </div>
                <table className="w-full border-collapse border border-gray-200 text-xs">
                  <thead>
                    <tr className="bg-invoice text-white">
                      <th className="px-2 py-1 text-left font-bold">Item</th>
                      <th className="px-2 py-1 text-right font-bold">Kg</th>
                      <th className="px-2 py-1 text-right font-bold">Rate</th>
                      <th className="px-2 py-1 text-right font-bold">Bags</th>
                      <th className="px-2 py-1 text-center font-bold">Pack</th>
                      <th className="px-2 py-1 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goods.map((g, gi) => (
                      <tr key={g.id} className={gi % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {g.itemName}
                          {g.groupLabel && <span className="text-gray-400"> ({g.groupLabel})</span>}
                        </td>
                        <td className="px-2 py-1 text-right">{g.quantity}</td>
                        <td className="px-2 py-1 text-right">{inr(g.rate)}</td>
                        <td className="px-2 py-1 text-right">{g.bags || '—'}</td>
                        <td className="px-2 py-1 text-center text-gray-500">{g.packagingTag || '—'}</td>
                        <td className="px-2 py-1 text-right font-medium">{inr(g.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-brand-50 font-bold">
                      <td className="px-2 py-1 text-gray-700" colSpan={5}>
                        Trip {t.tripNumber} Item Total
                      </td>
                      <td className="px-2 py-1 text-right text-gray-900">{inr(tt.itemTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                {/* Bags sub-grouping summary */}
                {goods.some((g) => (g.bags || 0) > 0) && (
                  <div className="mt-1 flex flex-wrap gap-2 px-2 py-1 text-[11px] text-gray-500">
                    {(() => {
                      const bagMap = new Map<string, number>()
                      for (const g of goods) {
                        if ((g.bags || 0) > 0) {
                          const key = g.packagingTag || 'Bags'
                          bagMap.set(key, (bagMap.get(key) || 0) + g.bags)
                        }
                      }
                      return [...bagMap.entries()].map(([tag, count]) => (
                        <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                          {tag}: {count} bags
                        </span>
                      ))
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Two-column payments summary */}
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Bill Amount</div>
            <div className="mt-1 space-y-0.5 text-xs">
              {sorted.map((t, ti) => (
                <div key={t.id} className="flex justify-between gap-2">
                  <span className="text-gray-600">
                    Trip {t.tripNumber} ({fmtDate(t.startDate)})
                  </span>
                  <span className="font-medium">{inr(tts[ti].net)}</span>
                </div>
              ))}
              {sorted.length === 0 && <div className="text-gray-400">—</div>}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Paid Amount</div>
            <div className="mt-1 space-y-0.5 text-xs">
              {(() => {
                // Per-trip payments
                const tripPaid = new Map<string, { total: number; payments: typeof payments }>()
                const genPayments: typeof payments = []
                for (const p of payments) {
                  if (p.tripId) {
                    const entry = tripPaid.get(p.tripId) || { total: 0, payments: [] }
                    entry.total += p.amount || 0
                    entry.payments.push(p)
                    tripPaid.set(p.tripId, entry)
                  } else {
                    genPayments.push(p)
                  }
                }
                return (
                  <>
                    {sorted.map((t) => {
                      const tp = tripPaid.get(t.id)
                      if (!tp) return null
                      return (
                        <div key={t.id} className="flex justify-between gap-2">
                          <span className="text-gray-600">
                            Trip {t.tripNumber} ({tp.payments.length} payment{tp.payments.length !== 1 ? 's' : ''})
                          </span>
                          <span className="font-medium text-green-600">{inr(tp.total)}</span>
                        </div>
                      )
                    })}
                    {genPayments.length > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600">
                          General ({genPayments.length} payment{genPayments.length !== 1 ? 's' : ''})
                        </span>
                        <span className="font-medium">{inr(genPayments.reduce((s, p) => s + (p.amount || 0), 0))}</span>
                      </div>
                    )}
                    {payments.length === 0 && <div className="text-gray-400">—</div>}
                  </>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Bill Summary (शेष पुर्जा) */}
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Bill Summary</div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Gross Item Total</span>
              <span className="font-medium">{inr(grossTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Commission (−)</span>
              <span>{inr(totalComm)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span>Net after Commission</span>
              <span>{inr(netAfterComm)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Total Expenses (−)</span>
              <span>{inr(totalExp)}</span>
            </div>
            {/* Expense detail lines */}
            {(() => {
              const allExp = sorted.flatMap((t) => (t.expenseItems ?? []).filter((e) => e.label.trim()))
              if (allExp.length === 0) return null
              const expMap = new Map<string, number>()
              for (const e of allExp) {
                expMap.set(e.label, (expMap.get(e.label) || 0) + (e.amount || 0))
              }
              return (
                <div className="ml-3 space-y-0.5">
                  {[...expMap.entries()].map(([label, amt]) => (
                    <div key={label} className="flex justify-between text-[11px] text-gray-400">
                      <span>{label}</span>
                      <span>{inr(amt)}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div className="mt-1 flex justify-between border-t border-gray-300 pt-1.5 text-sm font-extrabold text-brand-700">
              <span>Net Payable (शेष पुर्जा)</span>
              <span>{inr(totalBill)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Total Paid</span>
              <span className="font-medium">{inr(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-800 pt-1.5 text-base font-extrabold text-gray-900">
              <span>Balance Due</span>
              <span className={balance > 0 ? 'text-brand-700' : 'text-gray-900'}>{inr(balance)}</span>
            </div>
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

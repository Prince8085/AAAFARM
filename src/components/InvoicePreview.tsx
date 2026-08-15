import type { Bill, BusinessInfo, Customer } from '../types'
import { computeTotals, itemAmount } from '../lib/calc'
import { fmtDate, inr, inrShort } from '../lib/format'
import { StatusBadge } from './ui'

interface Props {
  bill: Bill
  customer?: Customer | null
  business: BusinessInfo | null
  className?: string
}

/** Renders the invoice in the exact printed style — used for the live preview
 *  on the New Bill page and as the print target. */
export function InvoicePreview({ bill, customer, business, className = '' }: Props) {
  const t = computeTotals(bill.items, bill.commissionPct, bill.bhada, bill.labourCost)
  const b = business ?? { name: 'AAA FARM', tagline: '', address: '', phone: '', footerNote: 'Thank you for your business!', nextInvoiceNo: 0 }

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
            <div className="text-sm font-bold text-invoice">Invoice {bill.invoiceNo || 'BILL-______'}</div>
            <div className="text-xs text-gray-600">Date: {fmtDate(bill.billDate)}</div>
            <div className="mt-1"><StatusBadge status={bill.status} /></div>
          </div>
        </div>

        {/* Customer */}
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer Details</div>
          <div className="mt-0.5 text-sm text-gray-800">
            {customer ? (
              <>
                <div className="font-semibold">{customer.name || '—'}</div>
                {customer.mobile && <div className="text-xs">Mobile: {customer.mobile}</div>}
                {customer.email && <div className="text-xs">Email: {customer.email}</div>}
                {customer.address && <div className="text-xs">Address: {customer.address}</div>}
              </>
            ) : (
              <div className="text-gray-400">Select / add a customer</div>
            )}
          </div>
        </div>

        {/* Items table */}
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-invoice text-white">
              <th className="px-2 py-1.5 text-left font-bold">Item</th>
              <th className="px-2 py-1.5 text-right font-bold">Qty</th>
              <th className="px-2 py-1.5 text-center font-bold">Unit</th>
              <th className="px-2 py-1.5 text-right font-bold">Rate</th>
              <th className="px-2 py-1.5 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-center text-gray-400">
                  Add items to see the bill
                </td>
              </tr>
            )}
            {bill.items.map((item, i) => (
              <tr key={item.id} className={i % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                <td className="px-2 py-1.5 font-medium">{item.itemName || '—'}</td>
                <td className="px-2 py-1.5 text-right">{item.qty}</td>
                <td className="px-2 py-1.5 text-center">{item.unit}</td>
                <td className="px-2 py-1.5 text-right">{inrShort(item.rate)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{inr(itemAmount(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-[240px] space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-medium">{inr(t.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Commission ({bill.commissionPct}%) (−)</span>
              <span>{inr(t.commission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Bhada (−)</span>
              <span>{inr(t.bhada)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Labour Cost (−)</span>
              <span>{inr(t.labour)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t-2 border-gray-800 pt-2 text-base font-extrabold text-gray-900">
              <span>Grand Total</span>
              <span>{inr(t.grand)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {bill.notes && <div className="mt-2 text-[11px] italic text-gray-500">Notes: {bill.notes}</div>}

        {/* Footer */}
        <div className="mt-4 border-t border-gray-200 pt-2 text-center text-[11px] text-gray-400">
          <div className="font-semibold">{b.footerNote}</div>
          <div className="font-bold text-gray-500">{b.name}</div>
        </div>
      </div>
    </div>
  )
}

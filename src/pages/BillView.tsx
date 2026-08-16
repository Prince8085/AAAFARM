import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { BillForm } from '../components/BillForm'
import { InvoicePreview } from '../components/InvoicePreview'
import { computeTotals } from '../lib/calc'
import { inr, todayISO } from '../lib/format'
import { downloadBillPdf } from '../lib/pdf'
import { paidForBill } from '../lib/balance'
import { PAYMENT_METHODS } from '../types'
import { Button, Card, EmptyState, NumInput, SectionTitle, Select, TextInput } from '../components/ui'

export function BillView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { bills, customers, payments, business, markPrinted, deleteBill, addPayment, deletePayment } = useStore()
  const [editing, setEditing] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [payDate, setPayDate] = useState(todayISO())
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const bill = bills.find((b) => b.id === id)
  if (!bill) {
    return (
      <Card>
        <EmptyState icon="❓" title="Bill nahi mila" />
        <div className="pb-4 text-center">
          <Button variant="secondary" onClick={() => navigate('/bills')}>
            ← Bills list
          </Button>
        </div>
      </Card>
    )
  }

  const customer = customers.find((c) => c.id === bill.customerId)
  const totals = computeTotals(bill.items, bill.commissionPct, bill.bhada, bill.labourCost, bill.byaj)
  const paid = paidForBill(payments, bill.id)
  const balance = Math.round((totals.grand - paid) * 100) / 100
  const billPayments = payments.filter((p) => p.billId === bill.id).sort((a, b) => b.paidDate.localeCompare(a.paidDate))

  const handleDownload = async () => {
    await markPrinted(bill)
    downloadBillPdf(bill, customer, business, billPayments)
  }

  const handlePrint = () => {
    markPrinted(bill)
    setTimeout(() => window.print(), 50)
  }

  const handleDelete = async () => {
    await deleteBill(bill.id)
    navigate('/bills')
  }

  const handleAddPayment = async () => {
    if (!payAmount || payAmount <= 0) return
    await addPayment(bill.id, payAmount, payDate, payMethod)
    setPayAmount(0)
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Link to="/bills" className="text-sm font-semibold text-brand-600">
          ← Bills
        </Link>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              ✏️ Edit
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            🗑️
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-800">
            Ye bill delete karein? ({bill.invoiceNo} — {customer?.name}) Ye wapas nahi aayega.
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={handleDelete}>
              Haan, delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editing ? (
        <BillForm
          initial={bill}
          initialCustomer={customer}
          onSaved={() => setEditing(false)}
          submitLabel="Save Changes"
        />
      ) : (
        <>
          <InvoicePreview bill={bill} customer={customer} business={business} />

          <div className="no-print grid grid-cols-2 gap-2">
            <Button onClick={handleDownload}>⬇️ Download PDF</Button>
            <Button onClick={handlePrint} variant="secondary">
              🖨️ Print
            </Button>
          </div>

          {/* Payment status */}
          <Card className="no-print p-3">
            <SectionTitle>Payment</SectionTitle>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px] text-gray-400">Grand Total</div>
                <div className="font-extrabold">{inr(totals.grand)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">Paid</div>
                <div className="font-bold text-green-700">{inr(paid)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">Balance Due</div>
                <div className={`font-extrabold ${balance > 0 ? 'text-red-600' : 'text-gray-800'}`}>{inr(balance)}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumInput value={payAmount} onValue={setPayAmount} placeholder="Payment ₹" />
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              <Button onClick={handleAddPayment} disabled={!payAmount}>
                + Add Payment
              </Button>
            </div>

            {billPayments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {billPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{inr(p.amount)}</span>
                      <span className="text-gray-400"> · {p.method} · {p.paidDate}</span>
                    </span>
                    <button onClick={() => deletePayment(p.id)} className="text-red-500" aria-label="Delete payment">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import type { Bill, BillItem, Customer, Unit } from '../types'
import { UNITS } from '../types'
import { useStore } from '../store/AppStore'
import { itemAmount, computeTotals } from '../lib/calc'
import { inr, todayISO, uid } from '../lib/format'
import { downloadBillPdf } from '../lib/pdf'
import { PRODUCE } from '../data/produce'
import { Button, Card, Field, NumInput, SectionTitle, TextInput } from './ui'
import { InvoicePreview } from './InvoicePreview'

export interface BillFormState {
  customer: Customer | null // id === '' means "new customer, create on save"
  billDate: string
  items: BillItem[]
  commissionPct: number
  bhada: number
  labourCost: number
  byaj: number // interest / credit charge on udhaar sales
  notes: string
}

export const emptyFormState = (): BillFormState => ({
  customer: null,
  billDate: todayISO(),
  items: [newItemRow()],
  commissionPct: 8,
  bhada: 0,
  labourCost: 0,
  byaj: 0,
  notes: 'FINAL BILL',
})

export function newItemRow(): BillItem {
  return { id: uid(), itemName: '', qty: 1, unit: 'kg', rate: 0 }
}

export function formStateFromBill(bill: Bill, customer: Customer | null): BillFormState {
  return {
    customer,
    billDate: bill.billDate,
    items: bill.items.length ? bill.items.map((i) => ({ ...i })) : [newItemRow()],
    commissionPct: bill.commissionPct,
    bhada: bill.bhada,
    labourCost: bill.labourCost,
    byaj: bill.byaj ?? 0,
    notes: bill.notes,
  }
}

interface Props {
  initial?: Bill
  initialCustomer?: Customer | null
  /** Pre-filled state (used to restore a locally saved draft). */
  initialState?: BillFormState
  onSaved?: (bill: Bill) => void // called after the bill is persisted
  onStateChange?: (state: BillFormState) => void
  showDownloadPdf?: boolean
  showPrint?: boolean
  submitLabel?: string
}

export function BillForm({ initial, initialCustomer = null, initialState, onSaved, onStateChange, showDownloadPdf = true, showPrint = true, submitLabel = 'Save Bill' }: Props) {
  const { customers, business, payments, saveCustomer, saveBill, markPrinted } = useStore()
  const [state, setState] = useState<BillFormState>(() =>
    initial ? formStateFromBill(initial, initialCustomer) : (initialState ?? emptyFormState()),
  )
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(initialCustomer ? 'existing' : 'new')
  const [customerQuery, setCustomerQuery] = useState(initialCustomer?.name ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const customerList = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  )

  const update = (patch: Partial<BillFormState>) => {
    const next = { ...state, ...patch }
    setState(next)
    onStateChange?.(next)
  }

  const previewBill = useMemo<Bill>(() => {
    const now = new Date().toISOString()
    return {
      id: initial?.id ?? 'preview',
      invoiceNo: initial?.invoiceNo ?? '',
      customerId: state.customer?.id ?? '',
      billDate: state.billDate,
      status: initial?.status ?? 'DRAFT',
      commissionPct: state.commissionPct,
      bhada: state.bhada,
      labourCost: state.labourCost,
      byaj: state.byaj,
      notes: state.notes,
      items: state.items,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
  }, [state, initial])

  const totals = computeTotals(state.items, state.commissionPct, state.bhada, state.labourCost, state.byaj)

  const pickCustomer = (value: string) => {
    setCustomerQuery(value)
    const match = customerList.find(
      (c) => c.name.toLowerCase() === value.trim().toLowerCase() || c.mobile === value.trim(),
    )
    if (match) {
      setCustomerMode('existing')
      update({ customer: match })
    } else {
      // Typed something unknown — treat as a fresh customer
      setCustomerMode('new')
      update({ customer: { id: '', name: value, mobile: '', email: '', address: '', createdAt: '' } })
    }
  }

  const setNewField = (patch: Partial<Customer>) => {
    const base = state.customer ?? { id: '', name: '', mobile: '', email: '', address: '', createdAt: '' }
    update({ customer: { ...base, ...patch } })
  }

  const updateItem = (id: string, patch: Partial<BillItem>) => {
    update({ items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  }

  const removeItem = (id: string) => {
    const items = state.items.length > 1 ? state.items.filter((i) => i.id !== id) : [newItemRow()]
    update({ items })
  }

  const addItem = () => update({ items: [...state.items, newItemRow()] })

  /** Validates, creates the customer if new, persists, returns the saved bill (with invoice no). */
  const buildAndSave = async (): Promise<Bill | null> => {
    setError('')
    if (!state.customer?.name.trim()) {
      setError('Kripya customer ka naam bharein.')
      return null
    }
    const validItems = state.items.filter((i) => i.itemName.trim() && i.qty > 0 && i.rate > 0)
    if (validItems.length === 0) {
      setError('Kam se kam ek item qty aur rate ke saath bharein.')
      return null
    }

    let customer = state.customer
    if (!customer.id) {
      customer = { ...customer, id: uid(), createdAt: new Date().toISOString() }
      await saveCustomer(customer)
    }

    const now = new Date().toISOString()
    const bill: Bill = {
      id: initial?.id ?? uid(),
      invoiceNo: initial?.invoiceNo ?? '',
      customerId: customer.id,
      billDate: state.billDate,
      status: initial?.status && initial.status !== 'DRAFT' ? initial.status : 'SAVED',
      commissionPct: state.commissionPct,
      bhada: state.bhada,
      labourCost: state.labourCost,
      byaj: state.byaj,
      notes: state.notes,
      items: validItems,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    setBusy(true)
    try {
      return await saveBill(bill)
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    const saved = await buildAndSave()
    if (saved) onSaved?.(saved)
  }

  const handleDownload = async () => {
    const saved = await buildAndSave()
    if (!saved) return
    await markPrinted(saved)
    downloadBillPdf(
      saved,
      customers.find((c) => c.id === saved.customerId),
      business,
      payments.filter((p) => p.billId === saved.id),
    )
    onSaved?.(saved)
  }

  const handlePrint = async () => {
    const saved = await buildAndSave()
    if (!saved) return
    await markPrinted(saved)
    onSaved?.(saved)
    setTimeout(() => window.print(), 50)
  }

  const allItemNames = useMemo(
    () => [...new Set([...PRODUCE, ...state.items.map((i) => i.itemName)].filter(Boolean))],
    [state.items],
  )

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
        )}

        {/* Customer */}
        <Card className="p-3">
          <SectionTitle>Customer</SectionTitle>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
              customerMode === 'existing' ? 'bg-brand-500 text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]' : 'bg-gray-100 text-gray-600'
            }`}
            >
              Existing
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode('new')
                update({ customer: { id: '', name: '', mobile: '', email: '', address: '', createdAt: '' } })
                setCustomerQuery('')
              }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
              customerMode === 'new' ? 'bg-brand-500 text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]' : 'bg-gray-100 text-gray-600'
            }`}
            >
              + New Customer
            </button>
          </div>

          {customerMode === 'existing' ? (
            <div className="mt-2">
              <TextInput
                list="customer-list"
                placeholder="Naam ya mobile number search karein…"
                value={customerQuery}
                onChange={(e) => pickCustomer(e.target.value)}
              />
              <datalist id="customer-list">
                {customerList.map((c) => (
                  <option key={c.id} value={`${c.name}${c.mobile ? ` — ${c.mobile}` : ''}`} />
                ))}
              </datalist>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <Field label="Name *">
                <TextInput value={state.customer?.name ?? ''} onChange={(e) => setNewField({ name: e.target.value })} placeholder="Customer ka naam" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Mobile">
                  <TextInput inputMode="tel" value={state.customer?.mobile ?? ''} onChange={(e) => setNewField({ mobile: e.target.value })} placeholder="10 digit" />
                </Field>
                <Field label="Email">
                  <TextInput inputMode="email" value={state.customer?.email ?? ''} onChange={(e) => setNewField({ email: e.target.value })} placeholder="(optional)" />
                </Field>
              </div>
              <Field label="Address">
                <TextInput value={state.customer?.address ?? ''} onChange={(e) => setNewField({ address: e.target.value })} placeholder="(optional)" />
              </Field>
            </div>
          )}
        </Card>

        {/* Bill date + commission + deductions */}
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bill Date">
              <TextInput type="date" value={state.billDate} onChange={(e) => update({ billDate: e.target.value })} />
            </Field>
            <Field label="Commission %" hint="0–100">
              <NumInput value={state.commissionPct} onValue={(v) => update({ commissionPct: v })} />
            </Field>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Field label="Bhada (₹)">
              <NumInput value={state.bhada} onValue={(v) => update({ bhada: v })} />
            </Field>
            <Field label="Labour (₹)">
              <NumInput value={state.labourCost} onValue={(v) => update({ labourCost: v })} />
            </Field>
            <Field label="Byaj (₹)" hint="Udhaar par lage">
              <NumInput value={state.byaj} onValue={(v) => update({ byaj: v })} />
            </Field>
          </div>
        </Card>

        {/* Items */}
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Items</SectionTitle>
            <button type="button" onClick={addItem} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]">
              + Add Item
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {state.items.map((item, idx) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                <div className="flex gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Item Name</div>
                    <input
                      list="produce-list"
                      value={item.itemName}
                      onChange={(e) => updateItem(item.id, { itemName: e.target.value })}
                      placeholder={`Item ${idx + 1}`}
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="mt-5 shrink-0 self-start rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-red-600"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1.5">
                  <div className="mb-0.5 grid grid-cols-4 gap-1.5 text-[11px] font-bold text-gray-500">
                    <div className="px-1">Qty</div>
                    <div className="px-1">Unit</div>
                    <div className="px-1">Rate</div>
                    <div className="px-1 text-right">Amount</div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <NumInput
                      value={item.qty}
                      onValue={(v) => updateItem(item.id, { qty: v })}
                      placeholder="0"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value as Unit })}
                      className="rounded-md border border-gray-300 bg-white px-1 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <NumInput
                      value={item.rate}
                      onValue={(v) => updateItem(item.id, { rate: v })}
                      placeholder="0"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end rounded-md bg-brand-50 px-2 text-sm font-bold text-brand-700">
                      {inr(itemAmount(item))}
                    </div>
                  </div>
                  {item.unit === 'quintal' && (
                    <div className="mt-0.5 text-right text-[10px] text-gray-400">1 quintal = 100 kg · amount ×100</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <datalist id="produce-list">
            {allItemNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Card>

        {/* Notes */}
        <Card className="p-3">
          <Field label="Notes" hint="Bill par niche dikhega">
            <TextInput value={state.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="FINAL BILL" />
          </Field>
        </Card>

        {/* Live totals */}
        <Card className="p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-semibold">{inr(totals.total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Commission ({state.commissionPct}%) +</span>
            <span>{inr(totals.commission)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Bhada −</span>
            <span>{inr(totals.bhada)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Labour +</span>
            <span>{inr(totals.labour)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Byaj +</span>
            <span>{inr(totals.byaj)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-gray-800 pt-2 text-base font-extrabold">
            <span>Grand Total</span>
            <span className="text-brand-700">{inr(totals.grand)}</span>
          </div>
        </Card>
      </div>

      {/* Live preview */}
      <div>
        <SectionTitle>Live Preview</SectionTitle>
        <div className="mt-2">
          <InvoicePreview bill={previewBill} customer={state.customer?.name ? state.customer : null} business={business} />
        </div>
      </div>

      {/* Actions */}
      <div className="no-print grid grid-cols-2 gap-2">
        <Button onClick={handleSave} disabled={busy} className="col-span-2">
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {showDownloadPdf && (
          <Button onClick={handleDownload} disabled={busy} variant="secondary">
            ⬇️ Download PDF
          </Button>
        )}
        {showPrint && (
          <Button onClick={handlePrint} disabled={busy} variant="secondary">
            🖨️ Print
          </Button>
        )}
      </div>
    </div>
  )
}

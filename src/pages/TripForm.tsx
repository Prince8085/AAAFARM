import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import type { Trip, TripExpenseItem, TripItem } from '../types'
import { computeTripTotals } from '../lib/calc'
import { inr, todayISO, uid } from '../lib/format'
import { PRODUCE } from '../data/produce'
import { Button, Card, Field, NumInput, SectionTitle, TextInput } from '../components/ui'

function newRow(amountEdited = false): TripItem & { amountEdited: boolean } {
  return { id: uid(), itemName: '', groupLabel: '', quantity: 1, rate: 0, amount: 0, bags: 0, packagingTag: '', amountEdited }
}

function newExpenseRow(): TripExpenseItem {
  return { id: uid(), label: '', amount: 0 }
}

export function TripForm() {
  const { partyId, tripId } = useParams()
  const navigate = useNavigate()
  const { parties, trips, saveTrip, loading } = useStore()

  const party = parties.find((p) => p.id === partyId)
  const existing = tripId ? trips.find((t) => t.id === tripId) : undefined

  // If the store was still loading when this page mounted (e.g. opened the edit
  // URL directly), re-fill the form once the trip data arrives.
  useEffect(() => {
    if (loading || !existing) return
    setStartDate(existing.startDate)
    setEndDate(existing.endDate)
    setDiesel(existing.dieselDriverCost)
    setToll(existing.tollTax)
    setLabour(existing.labourCost)
    setCommission(existing.commissionAmount)
    setRows(existing.items.length ? existing.items.map((i) => ({ ...i, amountEdited: true })) : [newRow()])
    // Load expense breakdown (new field, backward compat: if empty, pre-fill from old fields)
    if (existing.expenseItems && existing.expenseItems.length > 0) {
      setExpenseRows(existing.expenseItems)
    } else if ((existing.dieselDriverCost || 0) + (existing.tollTax || 0) + (existing.labourCost || 0) > 0) {
      const legacy: TripExpenseItem[] = []
      if (existing.dieselDriverCost) legacy.push({ id: uid(), label: 'Diesel / Driver', amount: existing.dieselDriverCost })
      if (existing.tollTax) legacy.push({ id: uid(), label: 'Toll Tax', amount: existing.tollTax })
      if (existing.labourCost) legacy.push({ id: uid(), label: 'Labour / Palledari', amount: existing.labourCost })
      setExpenseRows(legacy)
    }
  }, [loading, existing])

  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(existing?.endDate ?? todayISO())
  const [diesel, setDiesel] = useState(existing?.dieselDriverCost ?? 0)
  const [toll, setToll] = useState(existing?.tollTax ?? 0)
  const [labour, setLabour] = useState(existing?.labourCost ?? 0)
  const [commission, setCommission] = useState(existing?.commissionAmount ?? 0)
  const [rows, setRows] = useState<(TripItem & { amountEdited: boolean })[]>(() =>
    existing && existing.items.length ? existing.items.map((i) => ({ ...i, amountEdited: true })) : [newRow()],
  )
  const [expenseRows, setExpenseRows] = useState<TripExpenseItem[]>(() => {
    if (existing?.expenseItems && existing.expenseItems.length > 0) return existing.expenseItems
    if (existing && (existing.dieselDriverCost || existing.tollTax || existing.labourCost)) {
      const legacy: TripExpenseItem[] = []
      if (existing.dieselDriverCost) legacy.push({ id: uid(), label: 'Diesel / Driver', amount: existing.dieselDriverCost })
      if (existing.tollTax) legacy.push({ id: uid(), label: 'Toll Tax', amount: existing.tollTax })
      if (existing.labourCost) legacy.push({ id: uid(), label: 'Labour / Palledari', amount: existing.labourCost })
      return legacy
    }
    return [newExpenseRow()]
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const previewTrip: Trip = {
    id: existing?.id ?? 'preview',
    partyId: partyId ?? '',
    tripNumber: existing?.tripNumber ?? 0,
    startDate,
    endDate,
    dieselDriverCost: Number(diesel) || 0,
    tollTax: Number(toll) || 0,
    labourCost: Number(labour) || 0,
    commissionAmount: Number(commission) || 0,
    expenseItems: expenseRows,
    items: rows,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const totals = computeTripTotals(previewTrip)

  const itemNames = useMemo(() => [...new Set([...PRODUCE, ...rows.map((r) => r.itemName)].filter(Boolean))], [rows])

  if (!party) {
    return (
      <Card>
        <div className="p-4 text-center text-gray-500">Party nahi mili.</div>
        <div className="pb-4 text-center">
          <Link to="/parties" className="text-sm font-semibold text-brand-600">
            ← Parties
          </Link>
        </div>
      </Card>
    )
  }

  const updateRow = (id: string, patch: Partial<TripItem> & { amountEdited?: boolean }) => {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r
        const merged = { ...r, ...patch }
        // Auto-suggest amount from qty × rate whenever qty or rate changes,
        // unless the user has manually overridden the amount.
        if (!merged.amountEdited && (patch.quantity !== undefined || patch.rate !== undefined)) {
          merged.amount = Math.round((merged.quantity || 0) * (merged.rate || 0) * 100) / 100
        }
        return merged
      })
      return next.length ? next : [newRow()]
    })
  }

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [newRow()]))
  }

  const updateExpenseRow = (id: string, patch: Partial<TripExpenseItem>) => {
    setExpenseRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeExpenseRow = (id: string) => {
    setExpenseRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [newExpenseRow()]))
  }

  const mergeSimilar = () => {
    const map = new Map<string, TripItem & { amountEdited: boolean }>()
    for (const r of rows) {
      const name = r.itemName.trim()
      if (!name) continue
      const key = `${r.groupLabel.trim() || ''}·${name.toLowerCase()}`
      const existingRow = map.get(key)
      if (existingRow) {
        existingRow.quantity = (existingRow.quantity || 0) + (r.quantity || 0)
        existingRow.bags = (existingRow.bags || 0) + (r.bags || 0)
        existingRow.amount = Math.round(((existingRow.amount || 0) + (r.amount || 0)) * 100) / 100
        existingRow.amountEdited = true
      } else {
        map.set(key, { ...r })
      }
    }
    const kept = [...map.values()]
    setRows(kept.length ? kept : [newRow()])
  }

  const handleSave = async () => {
    setError('')
    if (!party) return
    const validItems = rows.filter((i) => i.itemName.trim() && (i.quantity > 0 || i.rate > 0))
    if (validItems.length === 0) {
      setError('Kam se kam ek item bharein (naam, qty/rate ya amount).')
      return
    }
    if (!startDate || !endDate) {
      setError('Trip ki start aur end date bharein.')
      return
    }
    const trip: Trip = {
      id: existing?.id ?? uid(),
      partyId: party.id,
      tripNumber: existing?.tripNumber ?? 0,
      startDate,
      endDate,
      dieselDriverCost: Number(diesel) || 0,
      tollTax: Number(toll) || 0,
      labourCost: Number(labour) || 0,
      commissionAmount: Number(commission) || 0,
      expenseItems: expenseRows.filter((e) => e.label.trim() || e.amount > 0),
      items: validItems.map(({ amountEdited: _drop, ...item }) => item),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setSaving(true)
    try {
      await saveTrip(trip)
      navigate(`/parties/${party.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Link to={`/parties/${party.id}`} className="text-sm font-semibold text-brand-600">
          ← {party.name}
        </Link>
        <h2 className="text-lg font-extrabold text-gray-800">{existing ? `Trip ${existing.tripNumber} (Edit)` : 'Add Trip'}</h2>
      </div>

      <div className="no-print space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

        {/* Dates + money fields */}
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Date">
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End Date">
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Commission (₹)">
              <NumInput value={commission} onValue={setCommission} />
            </Field>
            <Field label="Diesel / Driver (₹)">
              <NumInput value={diesel} onValue={setDiesel} />
            </Field>
            <Field label="Toll Tax (₹)">
              <NumInput value={toll} onValue={setToll} />
            </Field>
            <Field label="Labour / Palledari (₹)">
              <NumInput value={labour} onValue={setLabour} />
            </Field>
          </div>
        </Card>

        {/* Expense Breakdown */}
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Expense Breakdown (Hisaab)</SectionTitle>
            <button type="button" onClick={() => setExpenseRows((prev) => [...prev, newExpenseRow()])} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]">
              + Add Expense
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Har expense ka naam aur amount daalo — ye breakdown sirf hisaab ke liye hai, Grand Total me ye wapas minus nahi hoga.
          </p>
          <div className="mt-2 space-y-2">
            {expenseRows.map((row, idx) => (
              <div key={row.id} className="flex gap-2 items-center">
                <div className="flex-1">
                  <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Expense Name</div>
                  <input
                    value={row.label}
                    onChange={(e) => updateExpenseRow(row.id, { label: e.target.value })}
                    placeholder={`e.g. Bhada, Banvai, Palledari ${idx + 1}`}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="w-32">
                  <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Amount (₹)</div>
                  <NumInput
                    value={row.amount}
                    onValue={(v) => updateExpenseRow(row.id, { amount: v })}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <button type="button" onClick={() => removeExpenseRow(row.id)} className="mt-5 shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-red-600" aria-label="Remove expense">
                  ✕
                </button>
              </div>
            ))}
          </div>
          {expenseRows.filter((e) => e.label.trim() || e.amount > 0).length > 0 && (
            <div className="mt-2 flex justify-between rounded-md bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
              <span>Total Expenses</span>
              <span>{inr(expenseRows.reduce((s, e) => s + (e.amount || 0), 0))}</span>
            </div>
          )}
        </Card>

        {/* Items */}
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Items</SectionTitle>
            <div className="flex gap-1.5">
              <button type="button" onClick={mergeSimilar} className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600">
                Merge same items
              </button>
              <button type="button" onClick={() => setRows((prev) => [...prev, newRow()])} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]">
                + Add Item
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Amount qty × rate se <b className="text-brand-600">khud calculate</b> hota hai — bharne ki zaroorat nahi. (Chaaho to manually badal bhi sakte ho.)
          </p>

          <div className="mt-2 space-y-2">
            {rows.map((row, idx) => {
              const suggested = Math.round((row.quantity || 0) * (row.rate || 0) * 100) / 100
              return (
                <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <div className="flex gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Item Name</div>
                      <input
                        list="party-produce-list"
                        value={row.itemName}
                        onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
                        placeholder={`Item ${idx + 1}`}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div className="w-20">
                      <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Group</div>
                      <input
                        value={row.groupLabel}
                        onChange={(e) => updateRow(row.id, { groupLabel: e.target.value })}
                        placeholder="optional"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div className="w-16">
                      <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Bags</div>
                      <NumInput
                        value={row.bags}
                        onValue={(v) => updateRow(row.id, { bags: v })}
                        placeholder="0"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div className="w-20">
                      <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Packaging</div>
                      <input
                        list="packaging-list"
                        value={row.packagingTag}
                        onChange={(e) => updateRow(row.id, { packagingTag: e.target.value })}
                        placeholder="पन्नी"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <button type="button" onClick={() => removeRow(row.id)} className="mt-5 shrink-0 self-start rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-red-600" aria-label="Remove item">
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5">
                    <div className="mb-0.5 grid grid-cols-4 gap-1.5 text-[11px] font-bold text-gray-500">
                      <div className="px-1">Qty</div>
                      <div className="px-1">Rate</div>
                      <div className="px-1">Amount (₹)</div>
                      <div className="px-1 text-right">Total</div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <NumInput
                        value={row.quantity}
                        onValue={(v) => updateRow(row.id, { quantity: v })}
                        placeholder="0"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                      />
                      <NumInput
                        value={row.rate}
                        onValue={(v) => updateRow(row.id, { rate: v })}
                        placeholder="0"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                      />
                      <NumInput
                        value={row.amount}
                        onValue={(v) => updateRow(row.id, { amount: v, amountEdited: true })}
                        placeholder="0"
                        className={`w-full rounded-md border px-2 py-2 text-sm text-right focus:outline-none ${
                          row.amountEdited
                            ? 'border-gray-300 bg-white focus:border-brand-500'
                            : 'border-brand-100 bg-brand-50 font-semibold text-brand-800 focus:border-brand-500'
                        }`}
                      />
                      <div className="flex items-center justify-end rounded-md bg-brand-50 px-2 text-sm font-bold text-brand-700">
                        {inr(row.amount)}
                      </div>
                    </div>
                  </div>
                  {suggested !== row.amount && row.itemName && (
                    <div className="mt-1 text-right text-[11px] text-gray-400">
                      Suggested: {inr(suggested)}
                      {row.amountEdited ? ' (overridden)' : ''}
                    </div>
                  )}
                  {!row.amountEdited && row.amount > 0 && row.itemName && (
                    <div className="mt-0.5 text-right text-[10px] font-semibold text-brand-600">✓ Auto — qty × rate</div>
                  )}
                </div>
              )
            })}
          </div>
          <datalist id="party-produce-list">
            {itemNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <datalist id="packaging-list">
            {['पन्नी', 'बोरी', 'डब्बा', 'क्रेट', 'Thaila', 'Box'].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Card>

        {/* Live totals */}
        <Card className="p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Item Total</span>
            <span className="font-semibold">{inr(totals.itemTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Commission −</span>
            <span>{inr(totals.commission)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-600">Expenses (−)</span>
            <span>{inr(totals.totalExpenses)}</span>
          </div>
          {totals.expenseItems.filter((e) => e.label.trim()).length > 0 && (
            <div className="mt-0.5 space-y-0.5 pl-3">
              {totals.expenseItems.filter((e) => e.label.trim()).map((e) => (
                <div key={e.id} className="flex justify-between text-xs text-gray-500">
                  <span>{e.label}</span>
                  <span>{inr(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-between border-t-2 border-gray-800 pt-2 text-base font-extrabold">
            <span>Net Trip Bill</span>
            <span className="text-brand-700">{inr(totals.net)}</span>
          </div>
        </Card>
      </div>

      {/* Preview */}
      <div>
        <SectionTitle>Live Preview</SectionTitle>
        <div className="mt-2">
          <Card className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-extrabold text-gray-900">{party.name}</div>
                <div className="text-xs text-gray-500">
                  Trip {existing?.tripNumber ? `Trip ${existing.tripNumber} · ` : ''}
                  {startDate} to {endDate}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Net Trip Bill</div>
                <div className="text-lg font-extrabold text-brand-700">{inr(totals.net)}</div>
              </div>
            </div>
            {rows.filter((r) => r.itemName).length > 0 && (
              <table className="mt-2 w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-invoice text-white">
                    <th className="px-2 py-1 text-left">Item</th>
                    <th className="px-2 py-1 text-right">Kg</th>
                    <th className="px-2 py-1 text-right">Rate</th>
                    <th className="px-2 py-1 text-right">Bags</th>
                    <th className="px-2 py-1 text-center">Packaging</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((r) => r.itemName)
                    .map((r, i) => (
                      <tr key={r.id} className={i % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {r.itemName}
                          {r.groupLabel && <span className="text-gray-400"> ({r.groupLabel})</span>}
                        </td>
                        <td className="px-2 py-1 text-right">{r.quantity}</td>
                        <td className="px-2 py-1 text-right">{inr(r.rate)}</td>
                        <td className="px-2 py-1 text-right">{r.bags || '—'}</td>
                        <td className="px-2 py-1 text-center text-gray-500">{r.packagingTag || '—'}</td>
                        <td className="px-2 py-1 text-right font-medium">{inr(r.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Trip'}
      </Button>
    </div>
  )
}

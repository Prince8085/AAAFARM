import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import type { Trip, TripItem } from '../types'
import { computeTripTotals } from '../lib/calc'
import { inr, todayISO, uid } from '../lib/format'
import { PRODUCE } from '../data/produce'
import { Button, Card, Field, SectionTitle, TextInput } from '../components/ui'

function newRow(amountEdited = false): TripItem & { amountEdited: boolean } {
  return { id: uid(), itemName: '', groupLabel: '', quantity: 1, rate: 0, amount: 0, amountEdited }
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
        // Auto-suggest amount from qty × rate unless the user overrode it
        if (!merged.amountEdited && patch.quantity !== undefined && patch.rate !== undefined) {
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

  const mergeSimilar = () => {
    const map = new Map<string, TripItem & { amountEdited: boolean }>()
    for (const r of rows) {
      const name = r.itemName.trim()
      if (!name) continue
      const key = `${r.groupLabel.trim() || ''}·${name.toLowerCase()}`
      const existingRow = map.get(key)
      if (existingRow) {
        existingRow.quantity = (existingRow.quantity || 0) + (r.quantity || 0)
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
              <TextInput type="number" inputMode="decimal" min={0} value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
            </Field>
            <Field label="Diesel / Driver (₹)">
              <TextInput type="number" inputMode="decimal" min={0} value={diesel} onChange={(e) => setDiesel(Number(e.target.value))} />
            </Field>
            <Field label="Toll Tax (₹)">
              <TextInput type="number" inputMode="decimal" min={0} value={toll} onChange={(e) => setToll(Number(e.target.value))} />
            </Field>
            <Field label="Labour / Palledari (₹)">
              <TextInput type="number" inputMode="decimal" min={0} value={labour} onChange={(e) => setLabour(Number(e.target.value))} />
            </Field>
          </div>
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
            Amount khud likha jaa sakta hai (qty × rate sirf suggestion hai — handwritten ledger jaisa).
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
                    <div className="w-24">
                      <div className="mb-0.5 px-0.5 text-[11px] font-bold text-gray-500">Group</div>
                      <input
                        value={row.groupLabel}
                        onChange={(e) => updateRow(row.id, { groupLabel: e.target.value })}
                        placeholder="optional"
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
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
                        placeholder="0"
                        className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.rate}
                        onChange={(e) => updateRow(row.id, { rate: Number(e.target.value) })}
                        placeholder="0"
                        className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: Number(e.target.value), amountEdited: true })}
                        placeholder="0"
                        className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-right focus:border-brand-500 focus:outline-none"
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
                </div>
              )
            })}
          </div>
          <datalist id="party-produce-list">
            {itemNames.map((n) => (
              <option key={n} value={n} />
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
            <span className="text-gray-600">Expenses (Diesel + Toll + Labour) −</span>
            <span>{inr(totals.diesel + totals.toll + totals.labour)}</span>
          </div>
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
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Rate</th>
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

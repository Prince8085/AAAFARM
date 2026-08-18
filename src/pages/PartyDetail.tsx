import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { computeTripTotals } from '../lib/calc'
import { fmtDate, inr, todayISO } from '../lib/format'
import { partyPaid, partyTotals, partyBalance } from '../lib/balance'
import { downloadPartyKhataPdf } from '../lib/pdf'
import { Button, Card, EmptyState, NumInput, SectionTitle, TextInput } from '../components/ui'

export function PartyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { parties, trips, partyPayments, business, deleteTrip, addPartyPayment, deletePartyPayment } = useStore()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [payAmount, setPayAmount] = useState(0)
  const [payDate, setPayDate] = useState(todayISO())
  const [payNotes, setPayNotes] = useState('')
  const [payTripId, setPayTripId] = useState('') // which trip this payment is against
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<string | null>(null)

  const party = parties.find((p) => p.id === id)
  const pTrips = useMemo(
    () =>
      trips
        .filter((t) => t.partyId === id)
        .sort((a, b) => a.tripNumber - b.tripNumber),
    [trips, id],
  )
  const pPayments = useMemo(
    () => partyPayments.filter((p) => p.partyId === id).sort((a, b) => b.paidDate.localeCompare(a.paidDate)),
    [partyPayments, id],
  )

  if (!party) {
    return (
      <Card>
        <EmptyState icon="❓" title="Party nahi mili" />
        <div className="pb-4 text-center">
          <Button variant="secondary" onClick={() => navigate('/parties')}>
            ← Parties
          </Button>
        </div>
      </Card>
    )
  }

  const billed = partyTotals(pTrips)
  const paid = partyPaid(pPayments, party.id)
  const balance = partyBalance(billed, paid)

  // Per-trip payment totals
  const tripPaidMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pPayments) {
      if (p.tripId) {
        map.set(p.tripId, (map.get(p.tripId) || 0) + (p.amount || 0))
      }
    }
    return map
  }, [pPayments])

  // Payments without tripId (general payments)
  const generalPaid = useMemo(
    () => pPayments.filter((p) => !p.tripId).reduce((s, p) => s + (p.amount || 0), 0),
    [pPayments],
  )

  const toggleTrip = (tripId: string) => {
    const next = new Set(selected)
    if (next.has(tripId)) next.delete(tripId)
    else next.add(tripId)
    setSelected(next)
  }

  const handleAddPayment = async () => {
    if (!payAmount || payAmount <= 0) return
    await addPartyPayment(party.id, payTripId, payAmount, payDate, payNotes)
    setPayAmount(0)
    setPayNotes('')
  }

  const goToBill = () => {
    if (selected.size === 0) return
    navigate(`/parties/${party.id}/bill/${[...selected].join(',')}`)
  }

  const handleKhataPdf = () => {
    downloadPartyKhataPdf(party, pTrips, pPayments, business)
  }

  return (
    <div className="space-y-3">
      <Link to="/parties" className="text-sm font-semibold text-brand-600">
        ← Parties
      </Link>

      {/* Summary */}
      <Card className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">{party.name}</h2>
            <div className="text-xs text-gray-500">{[party.phone, party.address].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-[11px] text-gray-400">Balance Due</div>
            <div className={`text-lg font-extrabold ${balance > 0 ? 'text-red-600' : 'text-gray-800'}`}>{inr(balance)}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Trips</div>
            <div className="font-extrabold">{pTrips.length}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Total Billed</div>
            <div className="font-extrabold">{inr(billed)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] text-gray-400">Total Paid</div>
            <div className="font-extrabold">{inr(paid)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleKhataPdf}
          className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
        >
          ⬇️ Party Bill (Khata) PDF
        </button>
      </Card>

      {/* Trips */}
      <div className="flex items-center justify-between">
        <SectionTitle>Trips</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(`/parties/${party.id}/trip/new`)}
          className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]"
        >
          + Add Trip
        </button>
      </div>

      {pTrips.length === 0 ? (
        <Card>
          <EmptyState icon="🚛" title="Abhi koi trip nahi" subtitle="'+ Add Trip' se pehli gaadi ka hisaab daalein" />
        </Card>
      ) : (
        <div className="space-y-2">
          {pTrips.map((t) => {
            const tt = computeTripTotals(t)
            const tripPaid = tripPaidMap.get(t.id) || 0
            const tripBalance = Math.round((tt.net - tripPaid) * 100) / 100
            const isFullyPaid = tripBalance <= 0
            return (
              <Card key={t.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleTrip(t.id)}
                      className="h-4 w-4 accent-brand-500"
                      aria-label={`Select trip ${t.tripNumber}`}
                    />
                    <div>
                      <div className="font-bold text-gray-900">
                        Trip {t.tripNumber}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {fmtDate(t.startDate)} to {fmtDate(t.endDate)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {t.items.length} items · Commission {inr(tt.commission)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <div className="text-[11px] text-gray-400">Net</div>
                      <div className="font-extrabold text-gray-900">{inr(tt.net)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/parties/${party.id}/trip/${t.id}`)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-600"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTrip(t.id)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-red-600"
                      aria-label={`Delete trip ${t.tripNumber}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {/* Per-trip payment status */}
                <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">Paid: <span className={`font-bold ${tripPaid > 0 ? 'text-green-600' : 'text-gray-400'}`}>{inr(tripPaid)}</span></span>
                    <span className="text-gray-500">Balance: <span className={`font-bold ${tripBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{inr(tripBalance)}</span></span>
                  </div>
                  {isFullyPaid && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">✓ PAID</span>}
                </div>
                {confirmDeleteTrip === t.id && (
                  <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs">
                    <span className="font-semibold text-red-800">Trip {t.tripNumber} delete karein?</span>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteTrip(t.id)
                          setConfirmDeleteTrip(null)
                        }}
                        className="rounded-md bg-red-600 px-3 py-1 font-bold text-white"
                      >
                        Haan
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteTrip(null)} className="rounded-md border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Consolidated bill */}
      {pTrips.length > 0 && (
        <Card className="no-print p-3">
          <SectionTitle>Consolidated Bill</SectionTitle>
          <p className="mt-1 text-xs text-gray-500">
            Bill me shamil karne ke liye trips select karein ({selected.size} selected), phir neeche dabayein.
          </p>
          <Button onClick={goToBill} disabled={selected.size === 0} className="mt-2 w-full">
            View Consolidated Bill
          </Button>
        </Card>
      )}

      {/* Payments */}
      <Card className="p-3">
        <SectionTitle>Payments (Advance / Partial)</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumInput value={payAmount} onValue={setPayAmount} placeholder="Payment ₹" />
          <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          <div className="col-span-2">
            <div className="mb-1 text-[11px] font-bold text-gray-500">Kaunsi Gaadi? (Optional)</div>
            <select
              value={payTripId}
              onChange={(e) => setPayTripId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">— General Payment (sab trips ke liye) —</option>
              {pTrips.map((t) => {
                const tt = computeTripTotals(t)
                const tp = tripPaidMap.get(t.id) || 0
                const bal = Math.round((tt.net - tp) * 100) / 100
                return (
                  <option key={t.id} value={t.id}>
                    Trip {t.tripNumber} — Net {inr(tt.net)} — Balance {inr(bal)}
                  </option>
                )
              })}
            </select>
          </div>
          <TextInput placeholder="Notes (e.g. A/c द्वारा)" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="col-span-2" />
        </div>
        <Button onClick={handleAddPayment} disabled={!payAmount} className="mt-2 w-full">
          + Add Payment
        </Button>

        {generalPaid > 0 && (
          <div className="mt-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            General payments (trip assign nahi): <span className="font-bold">{inr(generalPaid)}</span>
          </div>
        )}

        {pPayments.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pPayments.map((p) => {
              const assignedTrip = p.tripId ? pTrips.find((t) => t.id === p.tripId) : null
              return (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{inr(p.amount)}</span>
                    <span className="text-gray-400">
                      {' '}
                      · {fmtDate(p.paidDate)}
                      {assignedTrip ? ` · Trip ${assignedTrip.tripNumber}` : ''}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </span>
                  </span>
                  <button onClick={() => deletePartyPayment(p.id)} className="text-red-500" aria-label="Delete payment">
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

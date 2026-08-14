import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { partyPaid, partyTotals, partyBalance } from '../lib/balance'
import { inr, uid } from '../lib/format'
import { Card, EmptyState, Field, SectionTitle, TextInput } from '../components/ui'

export function Parties() {
  const { parties, trips, partyPayments, saveParty } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const rows = useMemo(
    () =>
      parties
        .map((p) => {
          const pTrips = trips.filter((t) => t.partyId === p.id)
          const billed = partyTotals(pTrips)
          const paid = partyPaid(partyPayments, p.id)
          return { party: p, tripCount: pTrips.length, billed, paid, balance: partyBalance(billed, paid) }
        })
        .sort((a, b) => a.party.name.localeCompare(b.party.name)),
    [parties, trips, partyPayments],
  )

  const handleAdd = async () => {
    if (!name.trim()) return
    await saveParty({ id: uid(), name: name.trim(), phone, address, createdAt: new Date().toISOString() })
    setName('')
    setPhone('')
    setAddress('')
    setShowForm(false)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">Parties ({rows.length})</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,42,32,0.2)]"
        >
          + Add Party
        </button>
      </div>

      {showForm && (
        <Card className="no-print mb-3 space-y-2 p-3">
          <SectionTitle>New Party</SectionTitle>
          <Field label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gorajji" />
          </Field>
          <Field label="Phone">
            <TextInput inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(optional)" />
          </Field>
          <Field label="Address">
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="(optional)" />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={!name.trim()} className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              Save Party
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="🚛" title="Koi party nahi" subtitle="Kisan/trader party add karne ke liye '+ Add Party'" />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ party, tripCount, billed, balance }) => (
            <Link key={party.id} to={`/parties/${party.id}`} className="block">
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{party.name}</div>
                    <div className="text-xs text-gray-400">{party.phone || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-gray-500">
                      {tripCount} trip{tripCount !== 1 ? 's' : ''} · <span className="font-semibold">{inr(billed)}</span>
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

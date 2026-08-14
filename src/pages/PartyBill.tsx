import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { PartyBillPreview } from '../components/PartyBillPreview'
import { downloadPartyBillPdf } from '../lib/pdf'
import { computeTripTotals } from '../lib/calc'
import { inr } from '../lib/format'
import { partyPaid } from '../lib/balance'
import { Button, Card, EmptyState } from '../components/ui'

export function PartyBill() {
  const { partyId, tripIds } = useParams()
  const navigate = useNavigate()
  const { parties, trips, partyPayments, business } = useStore()

  const party = parties.find((p) => p.id === partyId)
  const selected = (tripIds ?? '').split(',').filter(Boolean)
  const selectedTrips = trips
    .filter((t) => selected.includes(t.id))
    .sort((a, b) => a.tripNumber - b.tripNumber)

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

  const totalBill = selectedTrips.reduce((s, t) => s + computeTripTotals(t).net, 0)
  const totalPaid = partyPaid(partyPayments, party.id)
  const balance = Math.round((totalBill - totalPaid) * 100) / 100

  const handleDownload = () => {
    downloadPartyBillPdf(party, selectedTrips, partyPayments.filter((p) => p.partyId === party.id), business)
  }

  const handlePrint = () => setTimeout(() => window.print(), 50)

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Link to={`/parties/${party.id}`} className="text-sm font-semibold text-brand-600">
          ← {party.name}
        </Link>
        <h2 className="text-lg font-extrabold text-gray-800">Consolidated Bill</h2>
      </div>

      <PartyBillPreview
        party={party}
        trips={selectedTrips}
        payments={partyPayments.filter((p) => p.partyId === party.id)}
        business={business}
      />

      <div className="no-print grid grid-cols-2 gap-2">
        <Button onClick={handleDownload}>⬇️ Download PDF</Button>
        <Button onClick={handlePrint} variant="secondary">
          🖨️ Print
        </Button>
      </div>

      <Card className="no-print p-3 text-center">
        <div className="text-sm text-gray-500">
          {selectedTrips.length} trip{selectedTrips.length !== 1 ? 's' : ''} · Total Bill {inr(totalBill)} · Paid{' '}
          {inr(totalPaid)} · <span className="font-bold text-red-600">Balance Due {inr(balance)}</span>
        </div>
      </Card>
    </div>
  )
}

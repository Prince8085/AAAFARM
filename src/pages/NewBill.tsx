import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BillForm } from '../components/BillForm'
import type { BillFormState } from '../components/BillForm'
import { LS_KEYS } from '../config'
import type { Bill } from '../types'

function loadDraft(): BillFormState | null {
  try {
    const raw = localStorage.getItem(LS_KEYS.draft)
    return raw ? (JSON.parse(raw) as BillFormState) : null
  } catch {
    return null
  }
}

function clearDraft() {
  localStorage.removeItem(LS_KEYS.draft)
}

export function NewBill() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<BillFormState | null>(() => loadDraft())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onStateChange = (state: BillFormState) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEYS.draft, JSON.stringify(state))
      } catch {
        /* storage full / private mode — ignore */
      }
    }, 400)
  }

  const onSaved = (bill: Bill) => {
    clearDraft()
    navigate(`/bills/${bill.id}`)
  }

  const onClearDraft = () => {
    clearDraft()
    setDraft(null)
  }

  return (
    <div>
      <div className="no-print mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">New Bill</h2>
        {draft && (
          <button
            type="button"
            onClick={onClearDraft}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
          >
            Draft restored — Clear
          </button>
        )}
      </div>
      <BillForm key={draft ? 'draft' : 'new'} initialState={draft ?? undefined} onSaved={onSaved} onStateChange={onStateChange} />
    </div>
  )
}

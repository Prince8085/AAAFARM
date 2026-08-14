import { useEffect, useState } from 'react'
import { useStore } from '../store/AppStore'
import { DATA_SOURCE, INVOICE_START } from '../config'
import type { BusinessInfo } from '../types'
import { Button, Card, Field, SectionTitle, TextInput } from '../components/ui'

export function Settings() {
  const { business, saveBusiness } = useStore()
  const [form, setForm] = useState<BusinessInfo | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (business && !form) setForm(business)
  }, [business, form])

  if (!form) return null

  const handleSave = async () => {
    await saveBusiness(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-gray-800">Settings</h2>

      <Card className="p-3">
        <SectionTitle>Business Info</SectionTitle>
        <div className="mt-2 space-y-2">
          <Field label="Business Name">
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <TextInput value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </Field>
          <Field label="Address / Location">
            <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Footer Note">
            <TextInput value={form.footerNote} onChange={(e) => setForm({ ...form, footerNote: e.target.value })} />
          </Field>
        </div>
        <Button onClick={handleSave} className="mt-3 w-full">
          {saved ? '✓ Saved' : 'Save Settings'}
        </Button>
      </Card>

      <Card className="p-3">
        <SectionTitle>App Info</SectionTitle>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>
            <b>Data storage:</b> {DATA_SOURCE === 'local' ? 'Is phone/browser me (local)' : 'API (Neon DB)'}
          </li>
          <li>
            <b>Next invoice number:</b> BILL-{form.nextInvoiceNo}
          </li>
          <li>
            <b>Invoice counter started at:</b> BILL-{INVOICE_START}
          </li>
          <li className="pt-1 text-xs text-gray-400">
            Data source aur API URL src/config.ts me badle ja sakte hain.
          </li>
        </ul>
      </Card>
    </div>
  )
}

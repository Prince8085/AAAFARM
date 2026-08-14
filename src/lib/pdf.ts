import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Trip } from '../types'
import { computeTotals, computeTripTotals } from './calc'
import { fmtDate, inr } from './format'
const BLUE: [number, number, number] = [46, 109, 164]
const GRAY: [number, number, number] = [110, 110, 110]
const DARK: [number, number, number] = [30, 40, 35]

const FALLBACK_BUSINESS: BusinessInfo = {
  name: 'AAA FARM',
  tagline: 'Professional Mandi Accounting System',
  address: 'Katni Mandi · Vegetable Commission Business',
  phone: '',
  footerNote: 'Thank you for your business!',
  nextInvoiceNo: 0,
}

const CHUNK = 0x8000
function bufToBase64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u8.length; i += CHUNK) s += String.fromCharCode(...u8.subarray(i, i + CHUNK))
  return btoa(s)
}

/** Roboto TTFs are served as static assets (public/fonts) so the main bundle
 *  stays small and the service worker can precache them. Cached after the
 *  first fetch so repeat PDF downloads are instant. */
let fontCache: { regular: string; bold: string } | null = null
async function loadRoboto(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache
  const base = import.meta.env.BASE_URL || '/'
  const [reg, bold] = await Promise.all([
    fetch(`${base}fonts/roboto-regular.ttf`).then((r) => {
      if (!r.ok) throw new Error('font fetch failed')
      return r.arrayBuffer()
    }),
    fetch(`${base}fonts/roboto-bold.ttf`).then((r) => {
      if (!r.ok) throw new Error('font fetch failed')
      return r.arrayBuffer()
    }),
  ])
  fontCache = { regular: bufToBase64(reg), bold: bufToBase64(bold) }
  return fontCache
}

/**
 * Builds the invoice PDF exactly matching the business's printed bill layout
 * and triggers a download ("save to phone"). On Android this lands in the
 * Downloads folder; on iPhone it opens the share sheet / Files.
 *
 * Roboto is embedded so the ₹ symbol renders correctly (jsPDF's built-in
 * Helvetica has no rupee glyph). If font loading ever fails we fall back to
 * Helvetica and print "Rs." instead.
 */
export async function downloadBillPdf(bill: Bill, customer: Customer | undefined, business: BusinessInfo | null) {
  const b = business ?? FALLBACK_BUSINESS
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const t = computeTotals(bill.items, bill.commissionPct, bill.bhada, bill.labourCost)

  // ---- Fonts: Roboto (₹ capable) with Helvetica + "Rs." fallback ----
  let face = 'roboto'
  let money = inr
  try {
    const { regular, bold } = await loadRoboto()
    doc.addFileToVFS('roboto-regular.ttf', regular)
    doc.addFileToVFS('roboto-bold.ttf', bold)
    doc.addFont('roboto-regular.ttf', 'roboto', 'normal')
    doc.addFont('roboto-bold.ttf', 'roboto', 'bold')
    doc.setFont('roboto', 'normal')
  } catch {
    face = 'helvetica'
    money = (n: number) => `Rs. ${inr(n).slice(1)}`
    doc.setFont('helvetica', 'normal')
  }

  const setStyle = (style: 'normal' | 'bold', size: number) => {
    doc.setFont(face, style)
    doc.setFontSize(size)
  }

  // ---------- Header ----------
  setStyle('bold', 20)
  doc.setTextColor(...DARK)
  doc.text(b.name, margin, 22)

  setStyle('normal', 9)
  doc.setTextColor(...GRAY)
  doc.text(b.tagline, margin, 28)
  doc.text(b.address, margin, 33)
  if (b.phone) doc.text(`Phone: ${b.phone}`, margin, 38)

  // Header right: invoice no, date, status
  setStyle('bold', 14)
  doc.setTextColor(...BLUE)
  doc.text(`Invoice ${bill.invoiceNo}`, pageW - margin, 22, { align: 'right' })

  setStyle('normal', 10)
  doc.setTextColor(...DARK)
  doc.text(`Date: ${fmtDate(bill.billDate)}`, pageW - margin, 28, { align: 'right' })
  doc.setTextColor(...GRAY)
  doc.text(`Status: ${bill.status}`, pageW - margin, 33, { align: 'right' })

  // Divider
  doc.setDrawColor(46, 109, 164)
  doc.setLineWidth(0.6)
  doc.line(margin, 44, pageW - margin, 44)

  // ---------- Customer details ----------
  let y = 52
  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Customer Details', margin, y)

  setStyle('normal', 9.5)
  y += 6
  if (customer) {
    if (customer.name) { doc.text(`Name: ${customer.name}`, margin, y); y += 5 }
    if (customer.mobile) { doc.text(`Mobile: ${customer.mobile}`, margin, y); y += 5 }
    if (customer.email) { doc.text(`Email: ${customer.email}`, margin, y); y += 5 }
    if (customer.address) { doc.text(`Address: ${customer.address}`, margin, y); y += 5 }
  } else {
    doc.text('Customer: —', margin, y)
    y += 5
  }
  y += 3

  // ---------- Items table ----------
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Item', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: bill.items.map((i) => [
      i.itemName || '—',
      String(i.qty),
      i.unit,
      money(i.rate),
      money((i.qty || 0) * (i.rate || 0)),
    ]),
    theme: 'grid',
    styles: {
      font: face,
      fontSize: 9.5,
      cellPadding: 2.2,
      textColor: DARK,
      lineColor: [210, 218, 226],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: [242, 247, 252] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // ---------- Summary block (right aligned) ----------
  const labelX = pageW - margin - 78
  const valueX = pageW - margin
  const rowH = 6.5
  let sy = tableEnd + 10

  const summaryRow = (label: string, value: string, opts?: { bold?: boolean; topBorder?: boolean }) => {
    if (opts?.topBorder) {
      // Line well above the text (4mm) so it never crosses the glyphs
      doc.setDrawColor(...DARK)
      doc.setLineWidth(0.6)
      doc.line(labelX, sy - 4, valueX, sy - 4)
    }
    if (opts?.bold) {
      setStyle('bold', 12)
    } else {
      setStyle('normal', 10)
    }
    doc.setTextColor(...DARK)
    doc.text(label, labelX, sy)
    doc.text(value, valueX, sy, { align: 'right' })
    sy += opts?.bold ? rowH + 1 : rowH
  }

  summaryRow('Total Amount', money(t.total))
  summaryRow(`Commission (${bill.commissionPct}%) (−)`, money(t.commission))
  summaryRow('Bhada (Transport) (−)', money(t.bhada))
  summaryRow('Labour Cost (−)', money(t.labour))
  summaryRow('Grand Total', money(t.grand), { bold: true, topBorder: true })
  sy += 4

  // ---------- Notes ----------
  if (bill.notes) {
    setStyle('normal', 9.5)
    doc.setTextColor(...GRAY)
    doc.text(`Notes: ${bill.notes}`, margin, sy)
  }

  // ---------- Footer ----------
  const footerY = doc.internal.pageSize.getHeight() - 18
  setStyle('bold', 10)
  doc.setTextColor(...GRAY)
  doc.text(b.footerNote, pageW / 2, footerY, { align: 'center' })
  setStyle('bold', 10)
  doc.text(b.name, pageW / 2, footerY + 5.5, { align: 'center' })

  const safeName = bill.invoiceNo.replace(/[^A-Za-z0-9-]/g, '')
  doc.save(`${safeName || 'invoice'}.pdf`)
}

/** Shared font-loading + money formatter setup for party bill PDFs. */
async function setupFonts(doc: jsPDF): Promise<{ face: string; money: (n: number) => string }> {
  try {
    const { regular, bold } = await loadRoboto()
    doc.addFileToVFS('roboto-regular.ttf', regular)
    doc.addFileToVFS('roboto-bold.ttf', bold)
    doc.addFont('roboto-regular.ttf', 'roboto', 'normal')
    doc.addFont('roboto-bold.ttf', 'roboto', 'bold')
    doc.setFont('roboto', 'normal')
    return { face: 'roboto', money: inr }
  } catch {
    doc.setFont('helvetica', 'normal')
    return { face: 'helvetica', money: (n: number) => `Rs. ${inr(n).slice(1)}` }
  }
}

/**
 * Consolidated party statement (khata bill): selected trips on the left
 * (Bill Amount), all payments on the right (Paid Amount), and the balance due
 * in bold at the bottom. Downloads to the phone like the customer bill.
 */
export async function downloadPartyBillPdf(
  party: Party,
  trips: Trip[],
  payments: PartyPayment[],
  business: BusinessInfo | null,
) {
  const b = business ?? FALLBACK_BUSINESS
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const { face, money } = await setupFonts(doc)

  const setStyle = (style: 'normal' | 'bold', size: number) => {
    doc.setFont(face, style)
    doc.setFontSize(size)
  }

  // Header
  setStyle('bold', 20)
  doc.setTextColor(...DARK)
  doc.text(b.name, margin, 22)
  setStyle('normal', 9)
  doc.setTextColor(...GRAY)
  doc.text(b.tagline, margin, 28)
  doc.text(b.address, margin, 33)
  if (b.phone) doc.text(`Phone: ${b.phone}`, margin, 38)

  setStyle('bold', 13)
  doc.setTextColor(...BLUE)
  doc.text('Party Statement (Khata)', pageW - margin, 22, { align: 'right' })
  setStyle('normal', 10)
  doc.setTextColor(...DARK)
  doc.text(`Party: ${party.name}`, pageW - margin, 28, { align: 'right' })
  doc.setTextColor(...GRAY)
  doc.text(`Trips: ${trips.length} · Date: ${fmtDate(new Date().toISOString().slice(0, 10))}`, pageW - margin, 33, { align: 'right' })

  doc.setDrawColor(46, 109, 164)
  doc.setLineWidth(0.6)
  doc.line(margin, 44, pageW - margin, 44)

  // Trip details table
  let y = 52
  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Trip Details', margin, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Trip', 'Dates', 'Item Total', 'Commission', 'Expenses', 'Net Bill Amount']],
    body: trips
      .sort((a, z) => a.tripNumber - z.tripNumber)
      .map((t) => {
        const tt = computeTripTotals(t)
        return [
          `Trip ${t.tripNumber}`,
          `${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`,
          money(tt.itemTotal),
          money(tt.commission),
          money(tt.diesel + tt.toll + tt.labour),
          money(tt.net),
        ]
      }),
    theme: 'grid',
    styles: { font: face, fontSize: 9, cellPadding: 2, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
    alternateRowStyles: { fillColor: [242, 247, 252] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  })

  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // Two-column summary: payments vs bill
  const midX = pageW / 2
  const colLeft = margin
  const colRight = midX + 6
  const colRightEnd = pageW - margin
  let sy = tableEnd + 10

  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Bill Amount', colLeft, sy)
  doc.text('Paid Amount', colRight, sy)
  sy += 5

  setStyle('normal', 9.5)
  const totalBill = trips.reduce((s, t) => s + computeTripTotals(t).net, 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const rows = Math.max(trips.length, payments.length, 1)

  for (let i = 0; i < rows; i++) {
    const t = trips[i]
    const p = payments[i]
    if (t) doc.text(`Trip ${t.tripNumber} (${fmtDate(t.startDate)})`, colLeft, sy)
    if (p) doc.text(`${fmtDate(p.paidDate)}${p.notes ? ` · ${p.notes}` : ''}`, colRight, sy)
    if (t) {
      setStyle('normal', 9.5)
      doc.setTextColor(...DARK)
      doc.text(money(computeTripTotals(t).net), colLeft + 45, sy)
    }
    if (p) {
      doc.text(money(p.amount), colRightEnd, sy, { align: 'right' })
    }
    setStyle('normal', 9.5)
    doc.setTextColor(...DARK)
    sy += 5.5
  }

  sy += 3
  // Totals — line 4mm above the text so it stays clear
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.4)
  doc.line(colLeft, sy - 4, colRightEnd, sy - 4)
  setStyle('bold', 11)
  doc.text('Total Bill', colLeft, sy)
  doc.text(money(totalBill), colLeft + 45, sy)
  doc.text('Total Paid', colRight, sy)
  doc.text(money(totalPaid), colRightEnd, sy, { align: 'right' })
  sy += 9

  // Balance due, large and bold — line clear of the text
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.6)
  doc.line(colLeft, sy - 4, colRightEnd, sy - 4)
  setStyle('bold', 14)
  doc.setTextColor(...BLUE)
  doc.text('Balance Due', colLeft, sy)
  doc.text(money(totalBill - totalPaid), colRightEnd, sy, { align: 'right' })

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 18
  setStyle('bold', 10)
  doc.setTextColor(...GRAY)
  doc.text(b.footerNote, pageW / 2, footerY, { align: 'center' })
  doc.text(b.name, pageW / 2, footerY + 5.5, { align: 'center' })

  doc.save(`party-${party.name.replace(/[^A-Za-z0-9-]/g, '') || 'statement'}.pdf`)
}

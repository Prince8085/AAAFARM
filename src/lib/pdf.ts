import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Bill, BusinessInfo, Customer, Party, PartyPayment, Payment, Trip } from '../types'
import { computeTotals, computeTripTotals, itemAmount } from './calc'
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

/** Brand logo (public/logo.png, transparent) — fetched once and cached so
 *  repeat PDF downloads embed it instantly. Returns a data URL or null. */
let logoCache: string | null | undefined
export async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache
  try {
    const base = import.meta.env.BASE_URL || '/'
    const resp = await fetch(`${base}logo.png`)
    if (!resp.ok) throw new Error('logo fetch failed')
    const blob = await resp.blob()
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = rej
      fr.readAsDataURL(blob)
    })
    logoCache = dataUrl
  } catch {
    logoCache = null
  }
  return logoCache
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
export async function downloadBillPdf(
  bill: Bill,
  customer: Customer | undefined,
  business: BusinessInfo | null,
  payments: Payment[] = [],
) {
  const b = business ?? FALLBACK_BUSINESS
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const t = computeTotals(bill.items, bill.commissionPct, bill.bhada, bill.labourCost, bill.byaj)

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
  let leftX = margin
  try {
    const logo = await loadLogo()
    if (logo) {
      doc.addImage(logo, 'PNG', margin, 9, 20, 20)
      leftX = margin + 24
    }
  } catch {
    /* logo is optional — bill works without it */
  }
  setStyle('bold', 20)
  doc.setTextColor(...DARK)
  doc.text(b.name, leftX, 22)

  setStyle('normal', 9)
  doc.setTextColor(...GRAY)
  doc.text(b.tagline, leftX, 28)
  doc.text(b.address, leftX, 33)
  if (b.phone) doc.text(`Phone: ${b.phone}`, leftX, 38)

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
      money(itemAmount(i)),
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
  summaryRow(`Commission (${bill.commissionPct}%) (+)`, money(t.commission))
  summaryRow('Bhada (Transport) (−)', money(t.bhada))
  summaryRow('Labour Cost (+)', money(t.labour))
  if (t.byaj) summaryRow('Byaj (Credit Charge) (+)', money(t.byaj))
  summaryRow('Grand Total', money(t.grand), { bold: true, topBorder: true })
  sy += 4

  // ---------- Payment summary (consolidated bill) ----------
  if (payments.length > 0) {
    const paid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
    const balance = Math.round((t.grand - paid) * 100) / 100

    sy += 6
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text('Payment Summary', margin, sy)
    sy += 3

    autoTable(doc, {
      startY: sy,
      margin: { left: margin, right: margin },
      head: [['Date', 'Method', 'Amount']],
      body: payments
        .slice()
        .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
        .map((p) => [fmtDate(p.paidDate), p.method, money(p.amount)]),
      theme: 'grid',
      styles: { font: face, fontSize: 9, cellPadding: 2, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
      alternateRowStyles: { fillColor: [242, 247, 252] },
      columnStyles: { 2: { halign: 'right' } },
    })

    const payEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    sy = payEnd + 10

    const payRow = (label: string, value: string, opts?: { bold?: boolean; topBorder?: boolean }) => {
      if (opts?.topBorder) {
        doc.setDrawColor(...DARK)
        doc.setLineWidth(0.6)
        doc.line(labelX, sy - 4, valueX, sy - 4)
      }
      if (opts?.bold) setStyle('bold', 12)
      else setStyle('normal', 10)
      doc.setTextColor(...DARK)
      doc.text(label, labelX, sy)
      doc.text(value, valueX, sy, { align: 'right' })
      sy += opts?.bold ? rowH + 1 : rowH
    }

    payRow('Total Paid', money(paid))
    payRow('Balance Due', money(balance), { bold: true, topBorder: true })
    sy += 4
  }

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
  let leftX = margin
  try {
    const logo = await loadLogo()
    if (logo) {
      doc.addImage(logo, 'PNG', margin, 9, 20, 20)
      leftX = margin + 24
    }
  } catch {
    /* logo is optional */
  }
  setStyle('bold', 20)
  doc.setTextColor(...DARK)
  doc.text(b.name, leftX, 22)
  setStyle('normal', 9)
  doc.setTextColor(...GRAY)
  doc.text(b.tagline, leftX, 28)
  doc.text(b.address, leftX, 33)
  if (b.phone) doc.text(`Phone: ${b.phone}`, leftX, 38)

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
    head: [['Trip', 'Dates', 'Item Total', 'Commission (−)', 'Expenses (−)', 'Net Bill Amount']],
    body: trips
      .sort((a, z) => a.tripNumber - z.tripNumber)
      .map((t) => {
        const tt = computeTripTotals(t)
        return [
          `Trip ${t.tripNumber}`,
          `${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`,
          money(tt.itemTotal),
          money(tt.commission),
          money(tt.totalExpenses),
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
  const pageH = doc.internal.pageSize.getHeight()
  let gy = tableEnd + 8

  // ---------- Expense breakdown (Hisaab) — per-trip expense detail ----------
  const withExpenses = trips.filter((t) => (t.expenseItems ?? []).some((e) => e.label.trim()))
  if (withExpenses.length > 0) {
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text('Expense Breakdown (Hisaab)', margin, gy)
    gy += 4
    for (const t of [...trips].sort((a, z) => a.tripNumber - z.tripNumber)) {
      const exps = (t.expenseItems ?? []).filter((e) => e.label.trim())
      if (!exps.length) continue
      const totExp = exps.reduce((s, e) => s + (e.amount || 0), 0)
      if (gy > pageH - 40) {
        doc.addPage()
        gy = 20
      }
      setStyle('bold', 9.5)
      doc.setTextColor(...DARK)
      doc.text(`Trip ${t.tripNumber} — ${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`, margin, gy)
      doc.text(money(totExp), pageW - margin, gy, { align: 'right' })
      gy += 2
      autoTable(doc, {
        startY: gy,
        margin: { left: margin, right: margin },
        head: [['Expense', 'Amount']],
        body: exps.map((e) => [e.label, money(e.amount)]),
        theme: 'grid',
        styles: { font: face, fontSize: 8.5, cellPadding: 1.8, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [242, 247, 252] },
        columnStyles: { 1: { halign: 'right' } },
      })
      gy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    }
    gy += 2
  }

  // ---------- Trip items (saman) — per-trip itemized goods ----------
  const withGoods = trips.filter((t) => t.items.some((i) => i.itemName.trim()))
  if (withGoods.length > 0) {
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text('Trip Goods (Saman)', margin, gy)
    gy += 4
    for (const t of [...trips].sort((a, z) => a.tripNumber - z.tripNumber)) {
      const goods = t.items.filter((i) => i.itemName.trim())
      if (!goods.length) continue
      const tt = computeTripTotals(t)
      if (gy > pageH - 52) {
        doc.addPage()
        gy = 20
      }
      setStyle('bold', 9.5)
      doc.setTextColor(...DARK)
      doc.text(`Trip ${t.tripNumber} — ${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`, margin, gy)
      doc.text(money(tt.net), pageW - margin, gy, { align: 'right' })
      gy += 2
      autoTable(doc, {
        startY: gy,
        margin: { left: margin, right: margin },
        head: [['Item', 'Kg', 'Rate', 'Bags', 'Pack', 'Amount']],
        body: goods.map((g) => [
          g.groupLabel ? `${g.itemName} (${g.groupLabel})` : g.itemName,
          String(g.quantity),
          money(g.rate),
          (g.bags || 0) > 0 ? String(g.bags) : '—',
          g.packagingTag || '—',
          money(g.amount),
        ]),
        theme: 'grid',
        styles: { font: face, fontSize: 8.5, cellPadding: 1.8, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [242, 247, 252] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
      })
      // Bags sub-grouping summary
      const hasBags = goods.some((g) => (g.bags || 0) > 0)
      if (hasBags) {
        gy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
        const bagMap = new Map<string, number>()
        for (const g of goods) {
          if ((g.bags || 0) > 0) {
            const key = g.packagingTag || 'Bags'
            bagMap.set(key, (bagMap.get(key) || 0) + g.bags)
          }
        }
        setStyle('normal', 8)
        doc.setTextColor(...GRAY)
        const bagText = [...bagMap.entries()].map(([tag, count]) => `${tag}: ${count} bags`).join('  |  ')
        doc.text(bagText, margin, gy)
        gy += 4
      }
      gy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    }
    gy += 2
  }

  // Clear settlement summary (शेष पुर्जा)
  let sy = gy + 4
  if (pageH - sy < 70) {
    doc.addPage()
    sy = 20
  }
  const totalBill = trips.reduce((s, t) => s + computeTripTotals(t).net, 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const allTts = trips.map((t) => computeTripTotals(t))
  const grossTotal = allTts.reduce((s, t) => s + t.itemTotal, 0)
  const totalComm = allTts.reduce((s, t) => s + t.commission, 0)
  const totalExp = allTts.reduce((s, t) => s + t.totalExpenses, 0)
  const netAfterComm = Math.round((grossTotal - totalComm) * 100) / 100

  const summaryLeft = margin
  const summaryRight = pageW - margin
  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Bill Summary', summaryLeft, sy)
  sy += 5
  setStyle('normal', 9.5)
  doc.text('Gross Item Total', summaryLeft, sy)
  doc.text(money(grossTotal), summaryRight, sy, { align: 'right' })
  sy += 5
  doc.text('Commission (−)', summaryLeft, sy)
  doc.text(money(totalComm), summaryRight, sy, { align: 'right' })
  sy += 5
  setStyle('bold', 9.5)
  doc.text('Net after Commission', summaryLeft, sy)
  doc.text(money(netAfterComm), summaryRight, sy, { align: 'right' })
  sy += 5
  setStyle('normal', 9.5)
  doc.text('Total Expenses (−)', summaryLeft, sy)
  doc.text(money(totalExp), summaryRight, sy, { align: 'right' })
  sy += 5
  // Expense breakdown detail lines (indented)
  const allExpenseItems = trips.flatMap((t) => (t.expenseItems ?? []).filter((e) => e.label.trim()))
  if (allExpenseItems.length > 0) {
    const expMap = new Map<string, number>()
    for (const e of allExpenseItems) {
      expMap.set(e.label, (expMap.get(e.label) || 0) + (e.amount || 0))
    }
    for (const [label, amt] of expMap) {
      setStyle('normal', 8.5)
      doc.setTextColor(...GRAY)
      doc.text(`  ${label}`, summaryLeft + 6, sy)
      doc.text(money(amt), summaryRight, sy, { align: 'right' })
      sy += 4.5
    }
    sy += 1
  }
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.4)
  doc.line(summaryLeft, sy - 3, summaryRight, sy - 3)
  setStyle('bold', 12)
  doc.setTextColor(...BLUE)
  doc.text('Net Payable (शेष पुर्जा)', summaryLeft, sy)
  doc.text(money(totalBill), summaryRight, sy, { align: 'right' })
  sy += 8

  // Two-column: payments vs bill
  const midX = pageW / 2
  const colLeft = margin
  const colRight = midX + 6
  const colRightEnd = pageW - margin
  if (pageH - sy < 50) {
    doc.addPage()
    sy = 20
  }

  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Bill Amount', colLeft, sy)
  doc.text('Paid Amount', colRight, sy)
  sy += 5

  setStyle('normal', 9.5)
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
  sy += 6
  // Per-trip payment allocation
  const tripPaidMap2 = new Map<string, number>()
  const generalPayments2: typeof payments = []
  for (const p of payments) {
    if (p.tripId) {
      tripPaidMap2.set(p.tripId, (tripPaidMap2.get(p.tripId) || 0) + (p.amount || 0))
    } else {
      generalPayments2.push(p)
    }
  }
  if (tripPaidMap2.size > 0 || generalPayments2.length > 0) {
    setStyle('normal', 8.5)
    for (const t of trips.sort((a, z) => a.tripNumber - z.tripNumber)) {
      const tp = tripPaidMap2.get(t.id) || 0
      if (tp > 0) {
        doc.setTextColor(...GRAY)
        doc.text(`  Trip ${t.tripNumber} paid`, colRight, sy)
        doc.text(money(tp), colRightEnd, sy, { align: 'right' })
        sy += 4.5
      }
    }
    if (generalPayments2.length > 0) {
      const genTotal = generalPayments2.reduce((s, p) => s + (p.amount || 0), 0)
      doc.setTextColor(...GRAY)
      doc.text('  General payment', colRight, sy)
      doc.text(money(genTotal), colRightEnd, sy, { align: 'right' })
      sy += 4.5
    }
  }
  sy += 3
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

/**
 * Single-tap party khata statement: no trip selection needed. One clean A4
 * page with the party's full account — party details, per-trip summary table,
 * totals and the running balance — the "proof of account" to hand to the
 * kisan/trader. Trip goods (saman) stay in the consolidated bill.
 */
export async function downloadPartyKhataPdf(
  party: Party,
  trips: Trip[],
  payments: PartyPayment[],
  business: BusinessInfo | null,
) {
  const b = business ?? FALLBACK_BUSINESS
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const { face, money } = await setupFonts(doc)

  const setStyle = (style: 'normal' | 'bold', size: number) => {
    doc.setFont(face, style)
    doc.setFontSize(size)
  }

  // Header
  let leftX = margin
  try {
    const logo = await loadLogo()
    if (logo) {
      doc.addImage(logo, 'PNG', margin, 9, 20, 20)
      leftX = margin + 24
    }
  } catch {
    /* logo is optional */
  }
  setStyle('bold', 20)
  doc.setTextColor(...DARK)
  doc.text(b.name, leftX, 22)
  setStyle('normal', 9)
  doc.setTextColor(...GRAY)
  doc.text(b.tagline, leftX, 28)
  doc.text(b.address, leftX, 33)
  if (b.phone) doc.text(`Phone: ${b.phone}`, leftX, 38)

  setStyle('bold', 13)
  doc.setTextColor(...BLUE)
  doc.text('Party Bill (Khata)', pageW - margin, 22, { align: 'right' })
  setStyle('normal', 10)
  doc.setTextColor(...DARK)
  doc.text(`Party: ${party.name}`, pageW - margin, 28, { align: 'right' })
  doc.setTextColor(...GRAY)
  doc.text(`Date: ${fmtDate(new Date().toISOString().slice(0, 10))}`, pageW - margin, 33, { align: 'right' })

  doc.setDrawColor(46, 109, 164)
  doc.setLineWidth(0.6)
  doc.line(margin, 44, pageW - margin, 44)

  // Party details
  let y = 52
  setStyle('bold', 11)
  doc.setTextColor(...DARK)
  doc.text('Party Details', margin, y)
  y += 6
  setStyle('normal', 9.5)
  if (party.name) { doc.text(`Name: ${party.name}`, margin, y); y += 5 }
  if (party.phone) { doc.text(`Phone: ${party.phone}`, margin, y); y += 5 }
  if (party.address) { doc.text(`Address: ${party.address}`, margin, y); y += 5 }
  y += 3

  const sorted = [...trips].sort((a, z) => a.tripNumber - z.tripNumber)
  const tts = sorted.map((t) => computeTripTotals(t))
  const itemTotal = Math.round(tts.reduce((s, t) => s + t.itemTotal, 0) * 100) / 100
  const commission = Math.round(tts.reduce((s, t) => s + t.commission, 0) * 100) / 100
  const expenses = Math.round(tts.reduce((s, t) => s + t.totalExpenses, 0) * 100) / 100
  const totalBill = Math.round(tts.reduce((s, t) => s + t.net, 0) * 100) / 100
  const totalPaid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
  const balance = Math.round((totalBill - totalPaid) * 100) / 100

  // Trip summary table
  if (sorted.length > 0) {
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text(`Trips (${sorted.length}) · ${fmtDate(first.startDate)} to ${fmtDate(last.endDate)}`, margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Trip', 'Dates', 'Item Total', 'Commission (−)', 'Expenses (−)', 'Net Bill Amount']],
      body: sorted.map((t, i) => {
        const tt = tts[i]
        return [
          `Trip ${t.tripNumber}`,
          `${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`,
          money(tt.itemTotal),
          money(tt.commission),
          money(tt.totalExpenses),
          money(tt.net),
        ]
      }),
      theme: 'grid',
      styles: { font: face, fontSize: 9, cellPadding: 2, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
      alternateRowStyles: { fillColor: [242, 247, 252] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  } else {
    y += 4
    setStyle('normal', 9.5)
    doc.setTextColor(...GRAY)
    doc.text('Koi trip nahi — is party ke liye abhi koi hisaab nahi hai.', margin, y)
    y += 8
  }

  // ---------- Expense breakdown (Hisaab) — per-trip expense detail ----------
  const withExpenses = sorted.filter((t) => (t.expenseItems ?? []).some((e) => e.label.trim()))
  if (withExpenses.length > 0) {
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text('Expense Breakdown (Hisaab)', margin, y)
    y += 4
    for (const t of sorted) {
      const exps = (t.expenseItems ?? []).filter((e) => e.label.trim())
      if (!exps.length) continue
      const totExp = exps.reduce((s, e) => s + (e.amount || 0), 0)
      if (y > pageH - 40) {
        doc.addPage()
        y = 20
      }
      setStyle('bold', 9.5)
      doc.setTextColor(...DARK)
      doc.text(`Trip ${t.tripNumber} — ${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`, margin, y)
      doc.text(money(totExp), pageW - margin, y, { align: 'right' })
      y += 2
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Expense', 'Amount']],
        body: exps.map((e) => [e.label, money(e.amount)]),
        theme: 'grid',
        styles: { font: face, fontSize: 8.5, cellPadding: 1.8, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [242, 247, 252] },
        columnStyles: { 1: { halign: 'right' } },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    }
    y += 2
  }

  // Trip goods (saman) — per-trip itemized detail, so the khata shows exactly
  // which goods came in which trip
  const withGoods = sorted.filter((t) => t.items.some((i) => i.itemName.trim()))
  if (withGoods.length > 0) {
    setStyle('bold', 11)
    doc.setTextColor(...DARK)
    doc.text('Trip Goods (Saman)', margin, y)
    y += 4
    for (const t of sorted) {
      const goods = t.items.filter((i) => i.itemName.trim())
      if (!goods.length) continue
      const tt = computeTripTotals(t)
      if (y > pageH - 52) {
        doc.addPage()
        y = 20
      }
      setStyle('bold', 9.5)
      doc.setTextColor(...DARK)
      doc.text(`Trip ${t.tripNumber} — ${fmtDate(t.startDate)} to ${fmtDate(t.endDate)}`, margin, y)
      doc.text(money(tt.net), pageW - margin, y, { align: 'right' })
      y += 2
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Item', 'Kg', 'Rate', 'Bags', 'Pack', 'Amount']],
        body: goods.map((g) => [
          g.groupLabel ? `${g.itemName} (${g.groupLabel})` : g.itemName,
          String(g.quantity),
          money(g.rate),
          (g.bags || 0) > 0 ? String(g.bags) : '—',
          g.packagingTag || '—',
          money(g.amount),
        ]),
        theme: 'grid',
        styles: { font: face, fontSize: 8.5, cellPadding: 1.8, textColor: DARK, lineColor: [210, 218, 226], lineWidth: 0.2 },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [242, 247, 252] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
      })
      // Bags sub-grouping summary
      const hasBags = goods.some((g) => (g.bags || 0) > 0)
      if (hasBags) {
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
        const bagMap = new Map<string, number>()
        for (const g of goods) {
          if ((g.bags || 0) > 0) {
            const key = g.packagingTag || 'Bags'
            bagMap.set(key, (bagMap.get(key) || 0) + g.bags)
          }
        }
        setStyle('normal', 8)
        doc.setTextColor(...GRAY)
        const bagText = [...bagMap.entries()].map(([tag, count]) => `${tag}: ${count} bags`).join('  |  ')
        doc.text(bagText, margin, y)
        y += 4
      }
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    }
    y += 2
  }

  // Right-aligned summary block
  const labelX = pageW - margin - 78
  const valueX = pageW - margin
  const rowH = 6.5
  if (pageH - y < 55) {
    doc.addPage()
    y = 20
  }
  let sy = y

  const summaryRow = (label: string, value: string, opts?: { bold?: boolean; topBorder?: boolean; blue?: boolean }) => {
    if (opts?.topBorder) {
      doc.setDrawColor(...DARK)
      doc.setLineWidth(0.6)
      doc.line(labelX, sy - 4, valueX, sy - 4)
    }
    if (opts?.bold) setStyle('bold', 12)
    else setStyle('normal', 10)
    if (opts?.blue) doc.setTextColor(...BLUE)
    else doc.setTextColor(...DARK)
    doc.text(label, labelX, sy)
    doc.text(value, valueX, sy, { align: 'right' })
    sy += opts?.bold ? rowH + 1 : rowH
  }

  summaryRow(`Gross Item Total (${sorted.length} trip${sorted.length !== 1 ? 's' : ''})`, money(itemTotal))
  summaryRow('Commission (−)', money(commission))
  const netAfterComm = Math.round((itemTotal - commission) * 100) / 100
  summaryRow('Net after Commission', money(netAfterComm), { bold: true })
  summaryRow('Total Expenses (−)', money(expenses))
  // Expense breakdown detail lines (indented under Total Expenses)
  const allExpenseItems = sorted.flatMap((t) => (t.expenseItems ?? []).filter((e) => e.label.trim()))
  if (allExpenseItems.length > 0) {
    const expMap = new Map<string, number>()
    for (const e of allExpenseItems) {
      expMap.set(e.label, (expMap.get(e.label) || 0) + (e.amount || 0))
    }
    for (const [label, amt] of expMap) {
      setStyle('normal', 8.5)
      doc.setTextColor(...GRAY)
      doc.text(`  ${label}`, labelX + 6, sy)
      doc.text(money(amt), valueX, sy, { align: 'right' })
      sy += 5
    }
  }
  summaryRow('Net Payable (शेष पुर्जा)', money(totalBill), { bold: true, topBorder: true, blue: true })
  summaryRow('Total Paid', money(totalPaid))
  // Per-trip payment allocation
  const tripPaidMap = new Map<string, number>()
  const generalPayments: typeof payments = []
  for (const p of payments) {
    if (p.tripId) {
      tripPaidMap.set(p.tripId, (tripPaidMap.get(p.tripId) || 0) + (p.amount || 0))
    } else {
      generalPayments.push(p)
    }
  }
  if (tripPaidMap.size > 0) {
    for (const t of sorted) {
      const tp = tripPaidMap.get(t.id) || 0
      if (tp > 0) {
        setStyle('normal', 8.5)
        doc.setTextColor(...GRAY)
        doc.text(`  Trip ${t.tripNumber} paid`, labelX + 6, sy)
        doc.text(money(tp), valueX, sy, { align: 'right' })
        sy += 5
      }
    }
  }
  if (generalPayments.length > 0) {
    const genTotal = generalPayments.reduce((s, p) => s + (p.amount || 0), 0)
    setStyle('normal', 8.5)
    doc.setTextColor(...GRAY)
    doc.text('  General payment', labelX + 6, sy)
    doc.text(money(genTotal), valueX, sy, { align: 'right' })
    sy += 5
  }
  summaryRow('Balance Due', money(balance), { bold: true, topBorder: true })

  // Footer
  const footerY = pageH - 18
  setStyle('bold', 10)
  doc.setTextColor(...GRAY)
  doc.text(b.footerNote, pageW / 2, footerY, { align: 'center' })
  doc.text(b.name, pageW / 2, footerY + 5.5, { align: 'center' })

  doc.save(`party-${party.name.replace(/[^A-Za-z0-9-]/g, '') || 'khata'}-khata.pdf`)
}

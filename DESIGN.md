# AAA Farm Mandi Billing — DESIGN.md

Independent design language for the AAA Farm billing app — a mobile-first mandi (wholesale vegetable commission) accounting tool for a non-technical business owner in Katni, India. Used daily on a phone at the mandi, often one-handed, in sunlight. Legibility, big touch targets, and trust in money numbers come before decoration.

## Design direction

**"Calm khata, clear numbers."** Deep green trust + blue invoice authority on a warm, light, spacious canvas. Think modern Indian fintech (UPI/payments apps): high-contrast numbers, soft gradients, generous whitespace, zero clutter. The app must feel like it *handles money carefully* — every amount is big, tabular, and unmistakable.

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| brand-500 (primary) | `#1F6D4C` | Primary buttons, header base, active nav, positive money |
| brand-600 | `#1A5C40` | Header gradient end, pressed states |
| brand-700 | `#154B34` | Deep hover / footer base |
| brand-50 | `#EEF6F1` | Selected chips, positive money tint |
| invoice (blue) | `#2E6DA4` | Invoice/statement table headers — matches the business's existing printed bills. Do not change. |
| invoice-dark | `#245683` | Table header hover/shadow |
| bg | `#F4F7F5` | App background (warm off-white, low glare) |
| surface | `#FFFFFF` | Cards |
| ink-900 | `#1C2B24` | Primary text |
| ink-500 | `#5B6B62` | Secondary text |
| ink-300 | `#94A39A` | Muted / hints |
| due (red) | `#DC2626` | Balance due, delete — only for danger/due |
| paid (green) | `#16A34A` | Collected / positive amounts |
| draft (amber) | `#B45309` | DRAFT status |

Rules: color means something — green = own money/positive, red = due/danger, blue = printed invoice surface. Never decorate with color.

## Typography

- Stack: system-ui, -apple-system, Segoe UI, Roboto (Android Roboto matches the PDF font — print fidelity).
- **Numbers:** always `tabular-nums`, always 2 decimals, always ₹ with Indian grouping (`₹1,23,456.00`). Money is the hero — bigger than surrounding labels.
- Scale: page title `text-lg font-extrabold tracking-tight` · section label `text-[11px] font-bold uppercase tracking-wider` · body `text-sm` · money display `text-base/base` bold.
- Headings tight tracking (`tracking-tight`), labels letter-spaced uppercase for scannability.

## Spacing & shape

- Cards: `rounded-2xl`, `border-gray-200/70`, soft layered shadow (`0 1px 2px rgba(16,42,32,.05), 0 8px 24px rgba(16,42,32,.06)`).
- Buttons: `rounded-xl`, min-height 44px, `active:scale-[.98]` press feedback.
- Generous vertical rhythm (space-y-3), content max-width 28rem (phone-first), safe-area padding at bottom nav.
- Touch targets ≥ 44px everywhere; primary action full-width at bottom of forms.

## Components

- **Header:** deep-green vertical gradient (`brand-600 → brand-500`), white bold brand name, tagline in white/80.
- **Bottom nav:** 5 tabs, active tab = brand-50 pill with brand-600 icon+label; inactive = muted gray. No borders except hairline top.
- **Primary button:** solid brand-500 → hover brand-700, white text, `shadow-sm`.
- **Secondary button:** white surface, gray border, ink text.
- **Summary chips:** soft gradient fills for money stats (Billed = green tint, Collected = blue tint, Due = ink/dark) with label over number.
- **Status badge:** pill, tinted bg (DRAFT amber, SAVED blue, PRINTED green).
- **Invoice/statement preview:** the printed format — white surface, blue `#2E6DA4` table head, alternating blue-tinted rows, right-aligned summary with a bold top-bordered **Grand Total / Balance Due**. This is print-identical; never restyle it.
- **Empty states:** big emoji inside a soft gradient circle + one-line explanation.

## Motion

- Buttons: subtle press scale. Nav transitions color. No spinners beyond brief "Saving…".
- Everything must feel instant — this is a mandi tool, not a showpiece.

## Reasoning

- The owner may be older, non-technical, outdoors: contrast + size + clarity beat aesthetics (WCAG-friendly).
- Printed bills are a legal/trust artifact — the blue invoice table and summary math stay byte-stable with the PDF.
- Green = money coming to the business (brand trust); red is reserved for what the owner must act on (due balances).

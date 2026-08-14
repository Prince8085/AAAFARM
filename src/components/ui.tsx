import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import type { BillStatus } from '../types'

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-ink-900 ' +
  'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`${inputCls} ${className}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`${inputCls} ${className}`}>
      {children}
    </select>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold ' +
    'transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<string, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-700 shadow-[0_1px_2px_rgba(16,42,32,0.2)]',
    secondary: 'border border-gray-200 bg-white text-ink-900 hover:bg-gray-50 shadow-[0_1px_2px_rgba(16,42,32,0.04)]',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-brand-600 hover:bg-brand-50',
  }
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-200/70 bg-white shadow-soft ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-300">{children}</h2>
}

export function StatusBadge({ status }: { status: BillStatus }) {
  const styles: Record<BillStatus, string> = {
    DRAFT: 'bg-amber-100 text-amber-800',
    SAVED: 'bg-blue-100 text-blue-800',
    PRINTED: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${styles[status]}`}>{status}</span>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-14 text-center">
      <div className="emoji-circle flex h-20 w-20 items-center justify-center rounded-full text-4xl">{icon}</div>
      <div className="mt-3 font-semibold text-ink-900">{title}</div>
      {subtitle && <div className="max-w-60 text-sm text-gray-400">{subtitle}</div>}
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="no-print fixed bottom-20 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>{message}</span>
        <button onClick={onClose} className="shrink-0 rounded p-1 hover:bg-white/20" aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  )
}

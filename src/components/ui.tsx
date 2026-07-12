import { useEffect, useState, type ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border-t border-felt-700 bg-felt-900 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-bold text-gold-300">{title}</h2>
          {onClose && (
            <button
              className="flex h-12 w-12 items-center justify-center rounded-full text-xl text-ink-2"
              onClick={onClose}
              aria-label="閉じる"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-felt-700 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** 整数入力(3桁区切り表示、numeric キーボード) */
export function NumInput({
  value,
  onChange,
  placeholder,
  className = '',
  disabled,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const fmt = (v: number | null) => (v == null ? '' : v.toLocaleString('ja-JP'))
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    setText(fmt(value))
  }, [value])
  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      className={`num h-12 w-full rounded-lg border border-felt-700 bg-felt-950 px-3 text-right text-ink placeholder:text-ink-3 focus:border-gold-500 focus:outline-none disabled:opacity-40 ${className}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        if (digits === '') {
          setText('')
          onChange(null)
        } else {
          const n = Number(digits)
          setText(n.toLocaleString('ja-JP'))
          onChange(n)
        }
      }}
    />
  )
}

/** 小数可の数値入力(為替レート・%用) */
export function DecInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    setText((prev) => {
      const cur = prev === '' ? null : Number(prev)
      return cur === value ? prev : value == null ? '' : String(value)
    })
  }, [value])
  return (
    <input
      type="text"
      inputMode="decimal"
      className={`num h-12 w-full rounded-lg border border-felt-700 bg-felt-950 px-3 text-right text-ink placeholder:text-ink-3 focus:border-gold-500 focus:outline-none ${className}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.]/g, '')
        setText(t)
        const n = Number(t)
        onChange(t === '' || Number.isNaN(n) ? null : n)
      }}
    />
  )
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex overflow-hidden rounded-lg border border-felt-700 ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`h-12 flex-1 text-sm font-bold ${
            o.value === value ? 'bg-gold-500 text-felt-950' : 'bg-felt-900 text-ink-2'
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-ink-2">{label}</span>
      {children}
    </label>
  )
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      className={`h-14 w-full rounded-xl bg-gold-500 text-base font-bold text-felt-950 active:bg-gold-600 disabled:opacity-40 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function GhostBtn({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      className={`h-12 w-full rounded-lg border border-felt-700 text-sm font-bold text-ink-2 active:bg-felt-800 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** 確認ダイアログ */
export function Confirm({
  message,
  detail,
  okLabel = 'OK',
  onOk,
  onCancel,
}: {
  message: string
  detail?: string
  okLabel?: string
  onOk: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-felt-700 bg-felt-900 p-5">
        <p className="text-base font-bold">{message}</p>
        {detail && <p className="mt-2 text-sm text-ink-2">{detail}</p>}
        <div className="mt-5 flex gap-3">
          <GhostBtn onClick={onCancel}>キャンセル</GhostBtn>
          <PrimaryBtn className="h-12" onClick={onOk}>
            {okLabel}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

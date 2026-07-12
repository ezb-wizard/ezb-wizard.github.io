import { useEffect, useRef, useState } from 'react'

/** 数値変化を200ms前後でカウントアップ表示するフック(操作を妨げない短いモーション) */
export function useCountUp(value: number, duration = 220): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = value
    if (from === value) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - (1 - k) ** 3
      setDisplay(from + (value - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return display
}

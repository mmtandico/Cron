import { useEffect, useRef, useState } from 'react'

/** Debounced POST /api/convert with request cancellation. */
export function useConvert(text, delay = 220) {
  const [state, setState] = useState({ result: null, error: '', loading: false })
  const controller = useRef(null)

  useEffect(() => {
    const value = text.trim()
    if (!value) {
      setState({ result: null, error: '', loading: false })
      return undefined
    }

    setState((s) => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      controller.current?.abort()
      const ac = new AbortController()
      controller.current = ac
      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }),
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState((s) => ({ ...s, error: data.error || 'Conversion failed', loading: false }))
          return
        }
        setState({ result: data, error: '', loading: false })
      } catch (err) {
        if (err.name === 'AbortError') return
        setState((s) => ({ ...s, error: 'Cannot reach the API. Is the server running?', loading: false }))
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [text, delay])

  return state
}

/** Polls /api/health so the header can show connection state. */
export function useApiStatus(interval = 15000) {
  const [online, setOnline] = useState(null)
  useEffect(() => {
    let alive = true
    const check = () =>
      fetch('/api/health')
        .then((r) => alive && setOnline(r.ok))
        .catch(() => alive && setOnline(false))
    check()
    const id = setInterval(check, interval)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [interval])
  return online
}

/** Re-renders periodically so relative times stay fresh. */
export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

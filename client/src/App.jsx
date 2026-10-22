import { useEffect, useRef, useState } from 'react'
import { useApiStatus, useConvert, useNow } from './lib/hooks.js'
import { fieldHint, formatDate, formatTime, relativeTime } from './lib/format.js'
import './App.css'

const FIELDS = [
  { key: 'minute', label: 'Minute', kind: 'minute', range: '0-59' },
  { key: 'hour', label: 'Hour', kind: 'hour', range: '0-23' },
  { key: 'dayOfMonth', label: 'Day', kind: 'dom', range: '1-31' },
  { key: 'month', label: 'Month', kind: 'month', range: '1-12' },
  { key: 'dayOfWeek', label: 'Weekday', kind: 'dow', range: '0-6' },
]

const WORDS_EXAMPLES = [
  'every weekday at 9:30am',
  'every 15 minutes between 9am and 5pm',
  'every Tuesday at 3 PM (*/5 * * * *)',
  'on the 1st and 15th at 6am',
  'every sunday at midnight',
  'every 2 hours on weekends',
  'quarterly',
  'half past 6 pm every friday',
]

const CRON_EXAMPLES = [
  '*/5 15 * * 2',
  '0 9 * * 1-5',
  '*/15 9-17 * * 1-5',
  '0 0 1,15 * *',
  '0 12 * * 0,6',
  '0 */2 * * *',
  '0 0 1 1,4,7,10 *',
  '@hourly',
  '@daily',
]

function isLikelyCron(str) {
  const s = String(str || '').trim().replace(/^[\(\[\{"']\s*|\s*[\)\]\}"']$/g, '')
  if (/^@(hourly|daily|midnight|weekly|monthly|yearly|annually)$/i.test(s)) return true
  const parts = s.split(/\s+/)
  return parts.length === 5 && parts.every((p) => /^[\d*?,/\-LlA-Za-z]+$/.test(p))
}

function FieldCell({ field, value, active }) {
  return (
    <div className={`cell${active ? ' is-active' : ''}`} id={`field-${field.key}`}>
      <span className="cell__value" key={value}>
        {value ?? '-'}
      </span>
      <span className="cell__label">{field.label}</span>
      <span className="cell__hint">{value ? fieldHint(value, field.kind) : field.range}</span>
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const id = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <button
      id={`copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
      type="button"
      className={`btn${copied ? ' is-done' : ''}`}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

export default function App() {
  const [mode, setMode] = useState('words') // 'words' | 'cron'
  const [text, setText] = useState(WORDS_EXAMPLES[0])
  const inputRef = useRef(null)
  const { result, error, loading } = useConvert(text)
  const online = useApiStatus()
  const now = useNow()

  // Auto-detect mode when input strongly matches cron or words
  useEffect(() => {
    if (isLikelyCron(text) && mode !== 'cron') {
      setMode('cron')
    }
  }, [text, mode])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSwap = () => {
    if (mode === 'words') {
      setMode('cron')
      setText(result?.cron || CRON_EXAMPLES[0])
    } else {
      setMode('words')
      setText(result?.description ? result.description.toLowerCase() : WORDS_EXAMPLES[0])
    }
    inputRef.current?.focus()
  }

  const showError = Boolean(error) && Boolean(text.trim())
  const fields = result?.fields ?? {}
  const isCronMode = mode === 'cron'

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />

      <main className="shell">
        <header className="top">
          <a className="brand" href="/" aria-label="Cron Words home">
            <img src="/favicon.png" alt="Logo" className="brand__logo" width="36" height="36" />
            <span className="brand__mark">CRON</span>
            <span className="brand__slash">/</span>
            <span className="brand__sub">words</span>
          </a>
          <span className={`status status--${online === null ? 'idle' : online ? 'on' : 'off'}`} id="api-status">
            <i />
            {online === false ? 'API offline' : 'API'}
          </span>
        </header>

        {/* Mode Switcher */}
        <div className="mode-bar">
          <div className="mode-toggle" role="tablist" aria-label="Conversion mode">
            <button
              type="button"
              role="tab"
              id="tab-words"
              aria-selected={!isCronMode}
              className={`mode-btn${!isCronMode ? ' is-active' : ''}`}
              onClick={() => {
                if (isCronMode) {
                  setMode('words')
                  setText(result?.description ? result.description.toLowerCase() : WORDS_EXAMPLES[0])
                  inputRef.current?.focus()
                }
              }}
            >
              Words &rarr; Cron
            </button>
            <button
              type="button"
              role="tab"
              id="tab-cron"
              aria-selected={isCronMode}
              className={`mode-btn${isCronMode ? ' is-active' : ''}`}
              onClick={() => {
                if (!isCronMode) {
                  setMode('cron')
                  setText(result?.cron || CRON_EXAMPLES[0])
                  inputRef.current?.focus()
                }
              }}
            >
              Cron &rarr; Plain English
            </button>
          </div>

          <button
            type="button"
            className="swap-btn"
            id="swap-direction"
            title="Swap conversion direction"
            aria-label="Swap conversion direction"
            onClick={handleSwap}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 5h11M10.5 2l3 3-3 3M13.5 11h-11M5.5 8l-3 3 3 3" />
            </svg>
            <span>Swap</span>
          </button>
        </div>

        <section className="intro">
          {isCronMode ? (
            <>
              <h1>
                Cron code in. <em>Plain English out.</em>
              </h1>
              <p>Type or paste any 5-field cron expression to translate it into a clear sentence.</p>
            </>
          ) : (
            <>
              <h1>
                Plain English in. <em>Cron out.</em>
              </h1>
              <p>Describe a schedule the way you say it. Generates standard 5-field cron syntax.</p>
            </>
          )}
        </section>

        <label
          className={`prompt${loading ? ' is-loading' : ''}${showError ? ' is-error' : ''}${isCronMode ? ' prompt--mono' : ''}`}
          htmlFor="schedule-input"
        >
          <span className="prompt__caret" aria-hidden="true">&gt;</span>
          <input
            id="schedule-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isCronMode ? 'e.g. */5 15 * * 2' : 'e.g. every weekday at 9:30am'}
            autoComplete="off"
            spellCheck="false"
            maxLength={300}
            autoFocus
          />
          {text ? (
            <button type="button" className="prompt__clear" id="clear-button" onClick={() => { setText(''); inputRef.current?.focus() }}>
              Clear
            </button>
          ) : (
            <kbd>/</kbd>
          )}
          <span className="prompt__bar" aria-hidden="true" />
        </label>

        {/* Main Result Display */}
        <section className={`panel${showError ? ' is-dim' : ''}`} aria-live="polite">
          {isCronMode ? (
            /* Cron -> Plain English Mode: Hero Plain English Translation */
            <div className="panel__content panel__content--cron-mode">
              <div className="panel__head">
                <span className="eyebrow">Plain English Meaning</span>
                <div className="panel__actions">
                  <CopyButton text={result?.description} label="Copy English" />
                </div>
              </div>

              <div className="hero-english">
                {showError ? (
                  <p className="message message--error" id="error-message">{error}</p>
                ) : (
                  <p className="hero-english__sentence" id="description" key={result?.description}>
                    {result?.description ?? 'Waiting for a valid cron expression'}
                  </p>
                )}
                <div className="hero-english__meta">
                  <span className="hero-english__label">Expression:</span>
                  <code className="hero-english__code" id="cron-output">{result?.cron ?? '- - - - -'}</code>
                </div>
              </div>

              <div className="cells-label">Field Breakdown</div>
              <div className="cells">
                {FIELDS.map((f) => (
                  <FieldCell key={f.key} field={f} value={fields[f.key]} active={fields[f.key] && fields[f.key] !== '*'} />
                ))}
              </div>

              {!showError &&
                result?.warnings?.length > 0 && (
                  <div className="panel__foot">
                    {result.warnings.map((w) => (
                      <p className="message message--warn" key={w}>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            /* Words -> Cron Mode: Hero 5-field Dot Matrix Cells */
            <div className="panel__content panel__content--words-mode">
              <div className="panel__head">
                <span className="eyebrow">Generated Expression</span>
                <div className="panel__actions">
                  <code className="panel__raw" id="cron-output">{result?.cron ?? '- - - - -'}</code>
                  <CopyButton text={result?.cron} label="Copy Cron" />
                </div>
              </div>

              <div className="cells">
                {FIELDS.map((f) => (
                  <FieldCell key={f.key} field={f} value={fields[f.key]} active={fields[f.key] && fields[f.key] !== '*'} />
                ))}
              </div>

              <div className="panel__foot">
                {showError ? (
                  <p className="message message--error" id="error-message">{error}</p>
                ) : (
                  <p className="message" id="description" key={result?.description}>
                    {result?.description ?? 'Waiting for a schedule'}
                  </p>
                )}
                {!showError &&
                  result?.warnings?.map((w) => (
                    <p className="message message--warn" key={w}>
                      {w}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </section>

        <div className="split">
          <section className="card" aria-labelledby="next-title">
            <h2 className="eyebrow" id="next-title">Next runs</h2>
            <ol className="runs" id="next-runs">
              {(result?.next ?? []).map((iso, i) => (
                <li key={iso} style={{ '--i': i }}>
                  <span className="runs__idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="runs__date">{formatDate(iso)}</span>
                  <span className="runs__time">{formatTime(iso)}</span>
                  <span className="runs__rel">{relativeTime(iso, now)}</span>
                </li>
              ))}
              {result && result.next.length === 0 && <li className="runs__empty">This schedule never runs.</li>}
              {!result && <li className="runs__empty">No schedule yet.</li>}
            </ol>
          </section>

          <section className="card" aria-labelledby="examples-title">
            <h2 className="eyebrow" id="examples-title">
              {isCronMode ? 'Try Cron Examples' : 'Try Natural Phrases'}
            </h2>
            <ul className="chips">
              {(isCronMode ? CRON_EXAMPLES : WORDS_EXAMPLES).map((ex, i) => (
                <li key={ex}>
                  <button
                    type="button"
                    id={`example-${i}`}
                    className={`chip${ex === text ? ' is-active' : ''}${isCronMode ? ' chip--mono' : ''}`}
                    onClick={() => setText(ex)}
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="legend">
          <span><b>*</b> any</span>
          <span><b>,</b> list</span>
          <span><b>-</b> range</span>
          <span><b>/</b> step</span>
          <span className="legend__right">Times shown in your local zone</span>
        </footer>
      </main>
    </div>
  )
}

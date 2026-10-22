const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function nameFor(value, kind) {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  if (kind === 'month') return MONTHS[n - 1] ?? value
  if (kind === 'dow') return DAYS[n % 7] ?? value
  if (kind === 'hour') {
    const ampm = n >= 12 ? 'pm' : 'am'
    const h12 = n % 12 === 0 ? 12 : n % 12
    return `${h12}${ampm}`
  }
  if (kind === 'minute') return `:${String(n).padStart(2, '0')}`
  return String(n)
}

/** Short human hint shown under each cron field. */
export function fieldHint(value, kind) {
  if (!value) return ''
  if (value === '*' || value === '?') return 'any'
  if (value.toUpperCase() === 'L') return 'last day'
  const step = /^\*\/(\d+)$/.exec(value)
  if (step) return `every ${step[1]} ${kind === 'hour' ? 'hrs' : kind === 'minute' ? 'mins' : kind === 'month' ? 'mos' : 'days'}`
  const parts = value.split(',')
  if (parts.length > 3) return `${parts.length} values`
  return parts
    .map((p) => {
      const [range, st] = p.split('/')
      const label = range.includes('-')
        ? range.split('-').map((v) => nameFor(v, kind)).join('-')
        : nameFor(range, kind)
      return st ? `${label} /${st}` : label
    })
    .join(', ')
}

export function relativeTime(iso, now) {
  const diff = Math.max(0, new Date(iso).getTime() - now)
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours}h ${mins % 60}m`
  const days = Math.floor(hours / 24)
  if (days < 60) return `in ${days}d ${hours % 24}h`
  return `in ${Math.round(days / 30)}mo`
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatDate = (iso) => dateFmt.format(new Date(iso))
export const formatTime = (iso) => timeFmt.format(new Date(iso))

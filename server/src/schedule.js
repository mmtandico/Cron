// Cron expression validation and next-run calculation (standard 5-field cron).

export const FIELD_KEYS = ['minute', 'hour', 'dom', 'month', 'dow'];

const RANGES = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 7],
};

const LABELS = {
  minute: 'minute',
  hour: 'hour',
  dom: 'day of month',
  month: 'month',
  dow: 'day of week',
};

export const MONTH_ALIASES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export const DOW_ALIASES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export class CronError extends Error {}

function toValue(token, kind) {
  const lower = token.toLowerCase();
  if (kind === 'month' && lower in MONTH_ALIASES) return MONTH_ALIASES[lower];
  if (kind === 'dow' && lower in DOW_ALIASES) return DOW_ALIASES[lower];
  if (!/^\d+$/.test(token)) {
    throw new CronError(`"${token}" is not a valid ${LABELS[kind]} value`);
  }
  return Number(token);
}

export function parseField(expr, kind) {
  const [min, max] = RANGES[kind];
  const values = new Set();
  let last = false;

  for (const part of expr.split(',')) {
    if (!part) throw new CronError(`Empty list item in ${LABELS[kind]} field`);
    if (kind === 'dom' && part.toUpperCase() === 'L') {
      last = true;
      continue;
    }

    const pieces = part.split('/');
    if (pieces.length > 2) throw new CronError(`Invalid step in ${LABELS[kind]} field`);
    const [rangePart, stepPart] = pieces;

    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) {
      throw new CronError(`Invalid step "${stepPart}" in ${LABELS[kind]} field`);
    }

    let lo;
    let hi;
    if (rangePart === '*' || rangePart === '?') {
      lo = min;
      hi = kind === 'dow' ? 6 : max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      lo = toValue(a, kind);
      hi = toValue(b, kind);
    } else {
      lo = toValue(rangePart, kind);
      hi = stepPart === undefined ? lo : max;
    }

    if (lo < min || hi > max || lo > hi) {
      throw new CronError(`${LABELS[kind]} value out of range (${min}-${max})`);
    }

    for (let v = lo; v <= hi; v += step) values.add(kind === 'dow' && v === 7 ? 0 : v);
  }

  return { values, last, wildcard: expr.startsWith('*') || expr === '?' };
}

export function parseCron(cron) {
  const parts = String(cron).trim().split(/\s+/);
  if (parts.length !== 5) throw new CronError('A cron expression needs exactly 5 fields');
  const fields = {};
  FIELD_KEYS.forEach((key, i) => {
    fields[key] = parseField(parts[i], key);
  });
  return fields;
}

export const CRON_ALIASES = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

export function looksLikeCron(text) {
  const cleaned = String(text).trim().replace(/^[\(\[\{"']\s*|\s*[\)\]\}"']$/g, '');
  if (cleaned.toLowerCase() in CRON_ALIASES) return true;
  const parts = cleaned.split(/\s+/);
  if (parts.length !== 5) return false;
  if (!parts.every((p) => /^[\d*?,/\-LlA-Za-z]+$/.test(p))) return false;
  if (!parts.some((p) => /[\d*]/.test(p))) return false;
  try {
    parseCron(cleaned);
    return true;
  } catch {
    return false;
  }
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function dayMatches(fields, date) {
  const { dom, dow } = fields;
  const d = date.getDate();
  const domOk = dom.values.has(d) || (dom.last && d === lastDayOfMonth(date));
  const dowOk = dow.values.has(date.getDay());
  if (dom.wildcard && dow.wildcard) return true;
  if (dom.wildcard) return dowOk;
  if (dow.wildcard) return domOk;
  // Standard cron: when both are restricted, either one may match.
  return domOk || dowOk;
}

export function nextRuns(cron, count = 5, from = new Date()) {
  const fields = parseCron(cron);
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  const runs = [];
  let guard = 0;
  while (runs.length < count && guard++ < 250000) {
    if (!fields.month.values.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(fields, d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.hour.values.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!fields.minute.values.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0);
      continue;
    }
    runs.push(new Date(d));
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }
  return runs;
}

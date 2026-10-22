// Turns a cron expression back into a short English sentence.
import { MONTH_ALIASES, DOW_ALIASES } from './schedule.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UNIT = { minute: 'minute', hour: 'hour', dom: 'day', month: 'month', dow: 'day' };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (h, m) => `${pad(h)}:${pad(m)}`;

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
}

function listJoin(items, conj = 'and') {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conj} ${items[items.length - 1]}`;
}

function normalizeNames(expr, kind) {
  const map = kind === 'month' ? MONTH_ALIASES : kind === 'dow' ? DOW_ALIASES : null;
  if (!map) return expr;
  return expr.replace(/[a-z]{3}/gi, (m) => (m.toLowerCase() in map ? map[m.toLowerCase()] : m));
}

function nameOf(value, kind) {
  const n = Number(value);
  if (kind === 'month') return MONTH_NAMES[n - 1];
  if (kind === 'dow') return DAY_NAMES[n % 7];
  if (kind === 'dom') return ordinal(n);
  return String(n);
}

function describePart(expr, kind) {
  const unit = UNIT[kind];
  const parts = expr.split(',').map((p) => {
    if (p.toUpperCase() === 'L') return 'the last day';
    const [range, step] = p.split('/');
    if (range === '*') return step ? `every ${step} ${unit}s` : `every ${unit}`;
    if (range.includes('-')) {
      const [a, b] = range.split('-');
      const span = `${nameOf(a, kind)} through ${nameOf(b, kind)}`;
      return step ? `every ${step} ${unit}s from ${span}` : span;
    }
    return step ? `every ${step} ${unit}s starting at ${nameOf(range, kind)}` : nameOf(range, kind);
  });
  return listJoin(parts);
}

const isList = (s) => /^\d+(,\d+)*$/.test(s);
const stepOf = (s) => (/^\*\/(\d+)$/.exec(s) || [])[1];

function hourPhrase(ho) {
  if (ho === '*') return 'of every hour';
  const step = stepOf(ho);
  if (step) return `every ${step} hours`;
  const single = /^(\d+)-(\d+)$/.exec(ho);
  if (single) return `between ${fmt(single[1], 0)} and ${fmt(single[2], 59)}`;
  const parts = ho.split(',').map((p) => {
    const [range, st] = p.split('/');
    if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      return st ? `every ${st} hours from ${fmt(a, 0)} to ${fmt(b, 59)}` : `${fmt(a, 0)} to ${fmt(b, 59)}`;
    }
    return `${fmt(range, 0)} to ${fmt(range, 59)}`;
  });
  return `during ${listJoin(parts)}`;
}

function timePhrase(mi, ho) {
  if (isList(mi) && isList(ho)) {
    const mins = mi.split(',').map(Number);
    const hours = ho.split(',').map(Number);
    if (mins.length * hours.length <= 6) {
      const times = hours.flatMap((h) => mins.map((m) => fmt(h, m)));
      return `At ${listJoin(times)}`;
    }
    return `At minute ${listJoin(mins.map(String))} past hour ${listJoin(hours.map(String))}`;
  }

  const minStep = stepOf(mi);
  if (mi === '*' && ho === '*') return 'Every minute';
  if (minStep && ho === '*') return `Every ${minStep} minutes`;
  if (mi === '*') return `Every minute ${hourPhrase(ho)}`;
  if (minStep) return `Every ${minStep} minutes ${hourPhrase(ho)}`;

  if (/^\d+$/.test(mi)) {
    const m = Number(mi);
    if (ho === '*') return m === 0 ? 'Every hour, on the hour' : `At minute ${m} of every hour`;
    const hStep = stepOf(ho);
    if (hStep) return m === 0 ? `Every ${hStep} hours` : `Every ${hStep} hours at minute ${m}`;
    const range = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(ho);
    if (range) {
      const [, a, b, st] = range;
      const lead = st ? `Every ${st} hours` : 'Every hour';
      return `${lead} from ${fmt(a, m)} through ${fmt(b, m)}`;
    }
    return `At minute ${m} ${hourPhrase(ho)}`;
  }

  return `At ${describePart(mi, 'minute')} ${hourPhrase(ho)}`;
}

export function describe(cron) {
  const [mi, ho, dmRaw, moRaw, dwRaw] = cron.trim().split(/\s+/);
  const dm = dmRaw;
  const mo = normalizeNames(moRaw, 'month');
  const dw = normalizeNames(dwRaw, 'dow');

  const segments = [timePhrase(mi, ho)];

  const dayParts = [];
  if (dm !== '*' && dm !== '?') {
    const step = stepOf(dm);
    if (dm.toUpperCase() === 'L') dayParts.push('on the last day of the month');
    else if (step) dayParts.push(`every ${step} days`);
    else dayParts.push(`on the ${describePart(dm, 'dom')} of the month`);
  }
  if (dw !== '*' && dw !== '?') {
    dayParts.push(`on ${describePart(dw.replace(/\b7\b/g, '0'), 'dow')}`);
  }
  if (dayParts.length) segments.push(dayParts.join(' or '));

  if (mo !== '*') {
    const step = stepOf(mo);
    segments.push(step ? `every ${step} months` : `in ${describePart(mo, 'month')}`);
  }

  return segments.join(', ');
}

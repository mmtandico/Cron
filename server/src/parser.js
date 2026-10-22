// Natural language -> standard 5-field cron expression.
// Strategy: normalize the text, then extract time / range / interval / day / month
// tokens independently and compose them into cron fields.

import { parseCron } from './schedule.js';

export class ParseError extends Error {}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const DAY_RE = DAYS.join('|');
const MONTH_RE = MONTHS.join('|');
const UNIT_ORDER = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];

const DAY_ABBR = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday',
  weds: 'wednesday', thu: 'thursday', thur: 'thursday', thurs: 'thursday',
  fri: 'friday', sat: 'saturday',
};
const MONTH_ABBR = {
  jan: 'january', feb: 'february', mar: 'march', apr: 'april', jun: 'june',
  jul: 'july', aug: 'august', sep: 'september', sept: 'september',
  oct: 'october', nov: 'november', dec: 'december',
};
const NUM_WORDS = [
  ['forty five', 45], ['forty-five', 45], ['one', 1], ['two', 2], ['three', 3],
  ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
  ['ten', 10], ['eleven', 11], ['twelve', 12], ['fifteen', 15], ['twenty', 20],
  ['thirty', 30], ['forty', 40], ['sixty', 60],
];
const ORD_WORDS = {
  first: '1st', third: '3rd', fourth: '4th', fifth: '5th', sixth: '6th',
  seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th',
  fifteenth: '15th', twentieth: '20th',
};

const T = '(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)?';

function normalize(input) {
  let s = ` ${String(input).toLowerCase()} `;
  s = s.replace(/\b([ap])\.\s?m\b\.?/g, '$1m');
  s = s.replace(/o['\u2019]?clock/g, 'oclock');
  s = s.replace(/[.,;!?()"\u201c\u201d]/g, ' ').replace(/&/g, ' and ');
  s = s.replace(/\s+/g, ' ');

  for (const [word, n] of NUM_WORDS) s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), String(n));
  for (const [word, ord] of Object.entries(ORD_WORDS)) s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), ord);
  s = s.replace(/\bsecond (day|of)\b/g, '2nd $1');

  s = s.replace(/\b(each|every single)\b/g, 'every');
  s = s.replace(/\bevery other\b/g, 'every 2');
  s = s.replace(/\b(half an hour|half hour|half-hour)\b/g, '30 minutes');
  s = s.replace(/\b(quarter of an hour|quarter hour|quarter-hour)\b/g, '15 minutes');

  s = s.replace(/\b(seconds|second|secs|sec)\b/g, 'second');
  s = s.replace(/\b(minutes|minute|mins|min)\b/g, 'minute');
  s = s.replace(/\b(hours|hour|hrs|hr)\b/g, 'hour');
  s = s.replace(/\bdays\b/g, 'day');
  s = s.replace(/\bweeks\b/g, 'week');
  s = s.replace(/\bmonths\b/g, 'month');
  s = s.replace(/\byears\b/g, 'year');

  s = s.replace(/\b(sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)s?\b/g, (m, a) => DAY_ABBR[a]);
  s = s.replace(/\b(jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/g, (m, a) => MONTH_ABBR[a]);

  s = s.replace(/\b(noon|midday)\b/g, ' 12:00 ');
  s = s.replace(/\bmidnight\b/g, ' 0:00 ');
  s = s.replace(/\b(\d{1,2}) oclock\b/g, '$1:00');
  s = s.replace(/\bhalf past (\d{1,2})\b/g, '$1:30');
  s = s.replace(/\bquarter past (\d{1,2})\b/g, '$1:15');
  s = s.replace(/\bquarter to (\d{1,2})\b/g, (m, h) => `${(Number(h) + 23) % 24}:45`);
  s = s.replace(/\b(business|working|office) hour\b/g, ' between 9:00 and 17:00 weekdays ');

  // "9am-5pm" / "09:00-17:00" -> "from X to Y"
  s = s.replace(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\s?-\s?(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/g, ' from $1 to $2 ');
  s = s.replace(/\b(\d{1,2}:\d{2})\s?-\s?(\d{1,2}:\d{2})\b/g, ' from $1 to $2 ');

  return s.replace(/\s+/g, ' ');
}

function to24(h, m, mer) {
  let hour = Number(h);
  const minute = m === undefined ? 0 : Number(m);
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) throw new ParseError(`"${h}${m ? `:${m}` : ''}${mer || ''}" is not a valid time`);
  return { h: hour, m: minute };
}

function compress(values) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) out.push(`${sorted[i]}-${sorted[j]}`);
    else for (let k = i; k <= j; k++) out.push(String(sorted[k]));
    i = j + 1;
  }
  return out.join(',');
}

function wrapRange(start, end, size) {
  const list = [];
  for (let v = start; ; v = (v + 1) % size) {
    list.push(v);
    if (v === end || list.length > size) break;
  }
  return list;
}

export function parseText(input) {
  const warnings = [];
  let remainingInput = String(input ?? '');
  let embeddedCron = null;
  const intervals = [];

  // 1. Detect embedded 5-field cron pattern, e.g. (*/5 * * * *) or */5 * * * *
  const cronMatch = remainingInput.match(/(?:[\(\[\{])?\s*([\d*?,/\-LlA-Za-z]+)\s+([\d*?,/\-LlA-Za-z]+)\s+([\d*?,/\-LlA-Za-z]+)\s+([\d*?,/\-LlA-Za-z]+)\s+([\d*?,/\-LlA-Za-z]+)\s*(?:[\)\]\}])?/);
  if (cronMatch) {
    const candidate = [cronMatch[1], cronMatch[2], cronMatch[3], cronMatch[4], cronMatch[5]].join(' ');
    try {
      parseCron(candidate);
      embeddedCron = {
        minute: cronMatch[1],
        hour: cronMatch[2],
        dom: cronMatch[3],
        month: cronMatch[4],
        dow: cronMatch[5],
      };
      remainingInput = remainingInput.replace(cronMatch[0], ' ');
    } catch {
      // Not a valid 5-field cron expression, leave for regular parsing
    }
  }

  // 2. Detect standalone slash step syntax like (*/5), */5, /5, or */10 min
  const stepMatch = remainingInput.match(/(?:[\(\[\{])?\s*\*?\/(\d+)(?:\s*(?:minute|min|sec|second|hour|hr|day|month)s?)?\s*(?:[\)\]\}])?/i);
  if (stepMatch && !embeddedCron) {
    const stepVal = Number(stepMatch[1]);
    const matchedText = stepMatch[0].toLowerCase();
    let unit = 'minute';
    if (matchedText.includes('hour') || matchedText.includes('hr')) unit = 'hour';
    else if (matchedText.includes('day')) unit = 'day';
    else if (matchedText.includes('sec')) unit = 'second';
    else if (matchedText.includes('month')) unit = 'month';
    intervals.push({ n: stepVal, unit });
    remainingInput = remainingInput.replace(stepMatch[0], ' ');
  }

  let s = normalize(remainingInput);
  let matched = Boolean(embeddedCron || intervals.length);
  const take = (re, fn) => {
    s = s.replace(re, (...args) => {
      matched = true;
      fn(...args);
      return ' ';
    });
  };

  // ---- Hour window: "between 9am and 5pm", "from 9 to 17"
  let range = null;
  take(new RegExp(`\\b(?:between|from) ${T} (?:and|to|until|till|through|thru) ${T}`, ''), (_, h1, m1, a1, h2, m2, a2) => {
    let mer1 = a1;
    let mer2 = a2;
    if (!mer1 && mer2 === 'pm' && Number(h1) < 12 && Number(h1) + 12 <= to24(h2, m2, mer2).h) mer1 = 'pm';
    const start = to24(h1, m1, mer1);
    let end = to24(h2, m2, mer2);
    if (!mer2 && !m2 && end.h <= start.h && end.h < 12) end = { h: end.h + 12, m: end.m };
    range = { start, end };
  });

  // ---- Fixed minute: "at minute 15", "15 minutes past the hour"
  let fixedMinute = null;
  take(/\bat minute (\d{1,2})\b/, (_, m) => { fixedMinute = Number(m); });
  take(/\b(\d{1,2}) minute (?:past|after) (?:the |every |each )?hour\b/, (_, m) => { fixedMinute = Number(m); });
  if (fixedMinute !== null && fixedMinute > 59) throw new ParseError('Minute must be between 0 and 59');

  // ---- Clock times: "9:30am", "17:00", "6pm", "at 9"
  const times = [];
  take(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b|\b(\d{1,2}):(\d{2})\b/g, (_, h1, m1, mer, h2, m2) => {
    times.push(h1 !== undefined ? to24(h1, m1, mer) : to24(h2, m2));
  });
  take(/\bat (\d{1,2})\b(?!\s?(?:st|nd|rd|th|minute|hour|day|week|month))/g, (_, h) => {
    times.push(to24(h));
  });

  // ---- Intervals: "every 15 minutes", "every 2nd day", "hourly", "15 minute intervals"
  take(/\bevery (?:(\d+)(?:st|nd|rd|th)? ?)?(second|minute|hour|day|week|month|year)\b/g, (_, n, unit) => {
    intervals.push({ n: n ? Number(n) : 1, unit });
  });
  take(/\b(\d+) (minute|hour) intervals?\b/g, (_, n, unit) => intervals.push({ n: Number(n), unit }));
  let quarterly = false;
  take(/\b(hourly|daily|nightly|weekly|monthly|yearly|annually|quarterly|every quarter)\b/g, (_, w) => {
    if (w === 'quarterly' || w === 'every quarter') {
      quarterly = true;
      intervals.push({ n: 1, unit: 'month' });
      return;
    }
    const unit = { hourly: 'hour', daily: 'day', nightly: 'day', weekly: 'week', monthly: 'month' }[w] || 'year';
    intervals.push({ n: 1, unit });
  });

  // Normalize oversized intervals (90 minutes is not expressible, 120 minutes is)
  for (const iv of intervals) {
    if (iv.n < 1) throw new ParseError('Interval must be at least 1');
    if (iv.unit === 'second') {
      warnings.push('Cron cannot schedule below one minute. Using every minute instead.');
      iv.unit = 'minute';
      iv.n = 1;
    }
    if (iv.unit === 'minute' && iv.n >= 60) {
      if (iv.n % 60 !== 0) throw new ParseError(`Every ${iv.n} minutes cannot be expressed in cron`);
      iv.unit = 'hour';
      iv.n /= 60;
    }
    if (iv.unit === 'hour' && iv.n >= 24) {
      if (iv.n % 24 !== 0) throw new ParseError(`Every ${iv.n} hours cannot be expressed in cron`);
      iv.unit = 'day';
      iv.n /= 24;
    }
    if (iv.unit === 'day' && iv.n > 31) throw new ParseError('Day interval must be 31 or less');
    if (iv.unit === 'month' && iv.n > 12) throw new ParseError('Month interval must be 12 or less');
  }

  // ---- Days of week
  const dows = [];
  take(new RegExp(`\\b(${DAY_RE})s? ?(?:to|through|thru|until|till|-) ?(${DAY_RE})s?\\b`, 'g'), (_, a, b) => {
    dows.push(...wrapRange(DAYS.indexOf(a), DAYS.indexOf(b), 7));
  });
  take(/\b(weekdays?|business day|working day|workdays?)\b/g, () => dows.push(1, 2, 3, 4, 5));
  take(/\bweekends?\b/g, () => dows.push(0, 6));
  take(new RegExp(`\\b(${DAY_RE})s?\\b`, 'g'), (_, d) => dows.push(DAYS.indexOf(d)));

  // ---- Months
  const months = [];
  take(new RegExp(`\\b(${MONTH_RE}) ?(?:to|through|thru|until|till|-) ?(${MONTH_RE})\\b`, 'g'), (_, a, b) => {
    months.push(...wrapRange(MONTHS.indexOf(a), MONTHS.indexOf(b), 12).map((m) => m + 1));
  });
  take(new RegExp(`\\b(${MONTH_RE})\\b`, 'g'), (_, m) => months.push(MONTHS.indexOf(m) + 1));

  // ---- Days of month
  const doms = [];
  let lastDay = false;
  take(/\blast day\b/g, () => { lastDay = true; });
  take(/\b(\d{1,2})(?:st|nd|rd|th)? ?(?:to|through|thru|until|till|-) ?(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/g, (_, a, b) => {
    for (let d = Number(a); d <= Number(b); d++) doms.push(d);
  });
  take(/\b(\d{1,2})(?:st|nd|rd|th)\b/g, (_, d) => doms.push(Number(d)));
  take(/\b(?:on )?day (\d{1,2})\b/g, (_, d) => doms.push(Number(d)));
  take(/\bon the (\d{1,2})\b/g, (_, d) => doms.push(Number(d)));
  if (doms.some((d) => d < 1 || d > 31)) throw new ParseError('Day of month must be between 1 and 31');

  if (!matched) {
    throw new ParseError('Could not understand that schedule. Try something like "every weekday at 9am".');
  }

  // ---- Compose
  let minute = '*';
  let hour = '*';
  let dom = '*';
  let month = '*';
  let dow = '*';

  if (dows.length) dow = compress(dows);
  if (months.length) month = compress(months);
  if (lastDay) {
    dom = 'L';
    warnings.push('"L" (last day of month) is non-standard. Supported by Quartz, Jenkins and some cron daemons.');
  } else if (doms.length) dom = compress(doms);

  intervals.sort((a, b) => UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit));
  const primary = intervals[0];

  const timeHours = times.map((t) => t.h);
  const timeMinutes = [...new Set(times.map((t) => t.m))];

  if (primary && primary.unit === 'minute') {
    minute = primary.n === 1 ? '*' : `*/${primary.n}`;
    if (60 % primary.n !== 0) warnings.push(`Steps restart every hour, so every ${primary.n} minutes will have an uneven gap at the top of the hour.`);
    if (range) {
      const endH = range.end.m === 0 && range.end.h !== range.start.h ? (range.end.h + 23) % 24 : range.end.h;
      hour = compress(wrapRange(range.start.h, endH, 24));
    } else if (timeHours.length) {
      hour = compress(timeHours);
    }
  } else if (primary && primary.unit === 'hour') {
    const n = primary.n;
    minute = String(fixedMinute ?? timeMinutes[0] ?? range?.start.m ?? 0);
    if (24 % n !== 0) warnings.push(`Steps restart every day, so every ${n} hours will have an uneven gap at midnight.`);
    if (range) {
      if (range.start.h <= range.end.h) {
        hour = `${range.start.h}-${range.end.h}${n > 1 ? `/${n}` : ''}`;
      } else {
        hour = compress(wrapRange(range.start.h, range.end.h, 24).filter((_, i) => i % n === 0));
      }
    } else if (timeHours.length && n > 1) {
      hour = `${timeHours[0]}/${n}`;
    } else {
      hour = n === 1 ? '*' : `*/${n}`;
    }
  } else {
    if (times.length) {
      if (timeMinutes.length > 1) {
        warnings.push('Times with different minutes are combined, so every listed hour runs at every listed minute.');
      }
      minute = compress(timeMinutes);
      hour = compress(timeHours);
    } else if (range) {
      minute = String(range.start.m);
      hour = compress(wrapRange(range.start.h, range.end.h, 24));
    } else if (fixedMinute !== null) {
      minute = String(fixedMinute);
    } else {
      minute = '0';
      hour = '0';
    }
  }

  if (fixedMinute !== null && primary?.unit !== 'minute') minute = String(fixedMinute);

  for (const iv of intervals) {
    if (iv.unit === 'day' && iv.n > 1) {
      if (dom !== '*') warnings.push('Day interval ignored because specific days of the month were given.');
      else dom = `*/${iv.n}`;
    }
    if (iv.unit === 'week') {
      if (iv.n > 1) warnings.push(`Every ${iv.n} weeks cannot be expressed in standard cron. Using every week.`);
      if (dow === '*' && dom === '*') dow = '0';
    }
    if (iv.unit === 'month') {
      if (dom === '*' && dow === '*') dom = '1';
      if (quarterly) month = '1,4,7,10';
      else if (iv.n > 1) month = `*/${iv.n}`;
    }
    if (iv.unit === 'year') {
      if (dom === '*' && dow === '*') dom = '1';
      if (month === '*') month = '1';
      if (iv.n > 1) warnings.push('Multi-year intervals cannot be expressed in cron. Using every year.');
    }
  }

  // "in January" with no day hint -> run once, on the 1st
  const dayLevel = primary && ['second', 'minute', 'hour', 'day'].includes(primary.unit);
  if (months.length && dom === '*' && dow === '*' && !dayLevel && !times.length && !range) dom = '1';

  // Merge embedded cron if provided
  if (embeddedCron) {
    if (embeddedCron.minute !== '*' && embeddedCron.minute !== '?') {
      minute = embeddedCron.minute;
    }
    if (embeddedCron.hour !== '*' && embeddedCron.hour !== '?') {
      if (!times.length && !range) hour = embeddedCron.hour;
      else if (embeddedCron.hour.includes('/')) hour = embeddedCron.hour;
    }
    if (embeddedCron.dom !== '*' && embeddedCron.dom !== '?') {
      if (!doms.length && !lastDay) dom = embeddedCron.dom;
    }
    if (embeddedCron.month !== '*' && embeddedCron.month !== '?') {
      if (!months.length) month = embeddedCron.month;
    }
    if (embeddedCron.dow !== '*' && embeddedCron.dow !== '?') {
      if (!dows.length) dow = embeddedCron.dow;
    }
  }

  return { cron: [minute, hour, dom, month, dow].join(' '), warnings };
}

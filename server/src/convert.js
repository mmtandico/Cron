import { parseText, ParseError } from './parser.js';
import { describe } from './describe.js';
import { looksLikeCron, nextRuns, parseCron, CronError, CRON_ALIASES } from './schedule.js';

export function convert(rawText) {
  const text = String(rawText ?? '').trim().slice(0, 300);
  if (!text) throw new ParseError('Type a schedule to convert.');

  let mode = 'words';
  let cron;
  let warnings = [];

  const cleaned = text.trim().replace(/^[\(\[\{"']\s*|\s*[\)\]\}"']$/g, '');
  if (cleaned.toLowerCase() in CRON_ALIASES) {
    mode = 'cron';
    cron = CRON_ALIASES[cleaned.toLowerCase()];
  } else if (looksLikeCron(text)) {
    mode = 'cron';
    cron = cleaned.split(/\s+/).join(' ');
  } else {
    ({ cron, warnings } = parseText(text));
  }

  parseCron(cron); // final sanity check
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ');

  return {
    input: text,
    mode,
    cron,
    fields: { minute, hour, dayOfMonth, month, dayOfWeek },
    description: describe(cron),
    next: nextRuns(cron, 5).map((d) => d.toISOString()),
    warnings,
  };
}

export { ParseError, CronError };

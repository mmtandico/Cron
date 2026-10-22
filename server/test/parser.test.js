import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseText } from '../src/parser.js';

const cases = [
  ['every minute', '* * * * *'],
  ['every 15 minutes', '*/15 * * * *'],
  ['every hour', '0 * * * *'],
  ['hourly', '0 * * * *'],
  ['every 2 hours', '0 */2 * * *'],
  ['every day at 5pm', '0 17 * * *'],
  ['daily at 09:30', '30 9 * * *'],
  ['at noon', '0 12 * * *'],
  ['midnight', '0 0 * * *'],
  ['every monday at 9am', '0 9 * * 1'],
  ['every weekday at 8:30 am', '30 8 * * 1-5'],
  ['weekends at noon', '0 12 * * 0,6'],
  ['at 10:15 on mon, wed and fri', '15 10 * * 1,3,5'],
  ['monday to friday at 6pm', '0 18 * * 1-5'],
  ['every 15 minutes between 9am and 5pm on weekdays', '*/15 9-16 * * 1-5'],
  ['every hour from 9 to 5', '0 9-17 * * *'],
  ['every 30 minutes during business hours', '*/30 9-16 * * 1-5'],
  ['on the 1st and 15th of every month at 6am', '0 6 1,15 * *'],
  ['first day of every month', '0 0 1 * *'],
  ['every month on the 15th at midnight', '0 0 15 * *'],
  ['every 3 months', '0 0 1 */3 *'],
  ['quarterly', '0 0 1 1,4,7,10 *'],
  ['every year', '0 0 1 1 *'],
  ['every year on january 1st at 9am', '0 9 1 1 *'],
  ['every sunday', '0 0 * * 0'],
  ['weekly', '0 0 * * 0'],
  ['every 2 days at 4am', '0 4 */2 * *'],
  ['every other hour', '0 */2 * * *'],
  ['half past 6 pm every friday', '30 18 * * 5'],
  ['15 minutes past every hour', '15 * * * *'],
  ['at 9am and 5pm', '0 9,17 * * *'],
  ['every 5 minutes in december', '*/5 * * 12 *'],
  ['every 120 minutes', '0 */2 * * *'],
  ['every Tuesday at 3 PM (*/5 * * * *)', '*/5 15 * * 2'],
  ['every Tuesday at 3 PM (*/5)', '*/5 15 * * 2'],
  ['every Tuesday at 3 PM */5', '*/5 15 * * 2'],
  ['(*/5 * * * *) every Tuesday at 3 PM', '*/5 15 * * 2'],
  ['every weekday (0 */2 * * *)', '0 */2 * * 1-5'],
];

for (const [input, expected] of cases) {
  test(input, () => {
    assert.equal(parseText(input).cron, expected);
  });
}

test('rejects gibberish', () => {
  assert.throws(() => parseText('banana pancake'));
});

test('convert cron code to plain english', async () => {
  const { convert } = await import('../src/index.js');
  const r1 = convert('*/5 15 * * 2');
  assert.equal(r1.mode, 'cron');
  assert.equal(r1.cron, '*/5 15 * * 2');
  assert.equal(r1.description, 'Every 5 minutes during 15:00 to 15:59, on Tuesday');

  const r2 = convert('0 9 * * 1-5');
  assert.equal(r2.description, 'At 09:00, on Monday through Friday');

  const r3 = convert('@daily');
  assert.equal(r3.cron, '0 0 * * *');
  assert.equal(r3.description, 'At 00:00');
});

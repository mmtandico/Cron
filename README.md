# Cron / Words

Type a schedule in plain English, get a standard 5-field cron expression.
Paste a cron expression to get it explained instead.

- `client/` React (Vite) UI
- `server/` Node (Express) API with the parser

## Run

```bash
npm run setup   # installs root, server and client deps
npm run dev     # API on :3001, UI on http://localhost:5173
```

Production: `npm run build && npm start` (Express serves `client/dist` on :3001).

Tests: `npm test`

## API

`POST /api/convert` with `{ "text": "every weekday at 9am" }` returns:

```json
{
  "mode": "words",
  "cron": "0 9 * * 1-5",
  "fields": { "minute": "0", "hour": "9", "dayOfMonth": "*", "month": "*", "dayOfWeek": "1-5" },
  "description": "At 09:00, on Monday through Friday",
  "next": ["2026-10-23T01:00:00.000Z"],
  "warnings": []
}
```

## Fonts

Uses Power Type's BaseNeue and OffBit. Add your licensed `.woff` files to
`client/public/fonts/` (see the README there). Free fallbacks: Inter Tight, Doto.

## Understood phrases

Times (`9am`, `17:30`, `noon`, `half past 6`), windows (`between 9 and 5`,
`9am-5pm`, `business hours`), intervals (`every 15 minutes`, `every other hour`,
`hourly`, `quarterly`), weekdays (`mon, wed and fri`, `monday to friday`,
`weekends`), days of month (`1st and 15th`, `first day`, `last day`), and
months (`in december`, `jan to mar`).

import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { convert, ParseError, CronError } from './convert.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '10kb' }));

export { convert, ParseError, CronError };

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/convert', (req, res) => {
  try {
    res.json(convert(req.body?.text));
  } catch (err) {
    if (err instanceof ParseError || err instanceof CronError) {
      res.status(422).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Serve the built client in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Cron API listening on http://localhost:${PORT}`);
  });
}

export default app;

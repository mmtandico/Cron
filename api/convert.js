import { convert, ParseError, CronError } from '../server/src/convert.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = convert(body?.text);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ParseError || err instanceof CronError) {
      return res.status(422).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

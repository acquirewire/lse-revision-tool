export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(req.body)
      });

      // On rate limit, wait and retry
      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 15000 * (attempt + 1);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Parse response safely
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(502).json({
          error: { message: 'API returned invalid response: ' + text.substring(0, 200) }
        });
      }

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 10000 * (attempt + 1)));
        continue;
      }
      return res.status(500).json({ error: { message: error.message } });
    }
  }
}

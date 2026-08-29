const { getQuotes } = require('../lib/yahoo.js');

module.exports = async function handler(req, res) {
  const raw = req.query?.symbols || '';
  const symbols = String(raw).split(',').map(s => s.trim()).filter(Boolean);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (symbols.length === 0) {
    res.status(400).json({ error: 'Missing symbols param' });
    return;
  }

  try {
    const result = await getQuotes(symbols);
    res.setHeader('Cache-Control', 'public, max-age=8');
    res.status(200).json({ quoteResponse: { result, error: null } });
  } catch (e) {
    res.status(502).json({ quoteResponse: { result: [], error: e.message } });
  }
};

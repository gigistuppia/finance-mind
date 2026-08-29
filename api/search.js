const { search } = require('../lib/yahoo.js');

module.exports = async function handler(req, res) {
  const q = req.query?.q;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!q) {
    res.status(400).json({ error: 'Missing q param' });
    return;
  }

  try {
    const data = await search(String(q));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};

const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^FM-([A-Z0-9]{4})-([A-Z0-9]{4})$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function codeSignature(rand, secret) {
  const h = crypto.createHmac('sha256', secret).update('FMv1:' + rand).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[h[i] % CODE_ALPHABET.length];
  return out;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const secret = process.env.FM_CODE_SECRET;
  if (!secret) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ valid: false }) };
  }

  const raw = (event.queryStringParameters?.code || '').trim().toUpperCase();
  const match = CODE_PATTERN.exec(raw);
  if (!match) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false }) };
  }

  const [, rand, sig] = match;
  const valid = sig === codeSignature(rand, secret);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid }) };
};

const crypto = require('crypto');

const MP_API = 'https://api.mercadopago.com';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codeSignature(rand, secret) {
  const h = crypto.createHmac('sha256', secret).update('FMv1:' + rand).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[h[i] % CODE_ALPHABET.length];
  return out;
}

function generateCode(secret) {
  let rand = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) rand += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `FM-${rand}-${codeSignature(rand, secret)}`;
}

async function fetchPreapproval(id, token) {
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sendCodeEmail(toEmail, code, resendKey, fromEmail) {
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;padding:40px 32px;border-radius:16px;">
    <h1 style="font-size:22px;margin:0 0 8px;">¡Bienvenido a Finance Mind Pro! 🎉</h1>
    <p style="color:#a0a0a0;line-height:1.6;">Tu suscripción está activa. Este es tu código de activación:</p>
    <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.16);border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <span style="font-family:'Courier New',monospace;font-size:26px;font-weight:bold;letter-spacing:3px;color:#1C8AFF;">${code}</span>
    </div>
    <p style="color:#a0a0a0;line-height:1.6;">Para activarlo:</p>
    <ol style="color:#a0a0a0;line-height:1.8;">
      <li>Abrí <a href="https://finance-mind.netlify.app/app-v2/" style="color:#1C8AFF;">Finance Mind</a></li>
      <li>Ingresá el código en la pantalla de activación (o en Ajustes)</li>
      <li>Listo — acceso completo, para siempre mientras tu suscripción esté activa</li>
    </ol>
    <p style="color:#555555;font-size:12px;margin-top:32px;">Si no hiciste esta suscripción, ignorá este mail o escribinos respondiendo a esta dirección.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: `Tu código de activación de Finance Mind Pro: ${code}`,
      html,
    }),
  });
  return res.ok;
}

exports.handler = async function (event) {
  const token = process.env.MP_ACCESS_TOKEN;
  const secret = process.env.FM_CODE_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FM_FROM_EMAIL || 'Finance Mind <onboarding@resend.dev>';

  if (!token || !secret || !resendKey) {
    console.error('mp-webhook: faltan env vars (MP_ACCESS_TOKEN / FM_CODE_SECRET / RESEND_API_KEY)');
    return { statusCode: 200, body: 'config missing' };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const params = event.queryStringParameters || {};

  const type = body.type || body.topic || params.topic || params.type || '';
  const preapprovalId = body?.data?.id || params.id || params['data.id'];

  if (!preapprovalId || !String(type).includes('preapproval')) {
    return { statusCode: 200, body: 'ignored' };
  }

  const preapproval = await fetchPreapproval(preapprovalId, token);
  if (!preapproval) {
    console.error('mp-webhook: no se pudo obtener preapproval', preapprovalId);
    return { statusCode: 200, body: 'not found' };
  }

  if (preapproval.status !== 'authorized') {
    return { statusCode: 200, body: `status ${preapproval.status} — sin acción` };
  }

  const email = preapproval.payer_email;
  if (!email) {
    console.error('mp-webhook: preapproval autorizado sin payer_email', preapprovalId);
    return { statusCode: 200, body: 'no email' };
  }

  const code = generateCode(secret);
  const sent = await sendCodeEmail(email, code, resendKey, fromEmail);
  if (!sent) {
    console.error('mp-webhook: fallo el envío de mail a', email);
    return { statusCode: 200, body: 'email failed' };
  }

  console.log(`mp-webhook: código enviado a ${email} (preapproval ${preapprovalId})`);
  return { statusCode: 200, body: 'ok' };
};

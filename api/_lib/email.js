import { Resend } from 'resend';
import QRCode from 'qrcode';
import { presenceUrl, qrImageUrl } from './site.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function companionsHtml(item) {
  const list = Array.isArray(item.companionsList) ? item.companionsList : [];
  if (!list.length) {
    return item.companions
      ? `<p style="margin:0 0 8px"><strong>مرافقون / Accompagnants :</strong> ${esc(item.companions)}</p>`
      : '<p style="margin:0 0 8px;color:#666">بدون مرافقين / Sans accompagnants</p>';
  }
  const rows = list
    .map((c, i) => {
      let kind = 'بالغ / Adulte';
      if (c.type === 'child') kind = 'طفل / Enfant';
      else if (c.participant) kind = 'مشارك في التكوين / Participant formation';
      else kind = 'مرافق (غير مشارك) / Accompagnant';
      return `<li style="margin:0 0 4px">${i + 1}. ${esc(c.name || '—')} — ${kind}${c.phone ? ` — ${esc(c.phone)}` : ''}</li>`;
    })
    .join('');
  return `<p style="margin:0 0 6px"><strong>المرافقون / Occupants additionnels :</strong></p><ul style="margin:0;padding-inline-start:18px">${rows}</ul>`;
}

export async function buildQrPng(token) {
  return QRCode.toBuffer(presenceUrl(token), {
    type: 'png',
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

export function buildEmailHtml(item) {
  const checkInUrl = presenceUrl(item.presenceToken);
  const qrUrl = qrImageUrl(item.presenceToken);
  const total = Number(item.totalAmount || 0).toLocaleString('fr-TN');
  const sourceLabel = item.source === 'pmdeaf' ? 'PMDEAF' : 'عمومي / Public';

  return `
  <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.6;color:#12263a;max-width:640px;margin:0 auto;padding:16px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0b3d5c">تأكيد التسجيل — Amicale 360</h1>
    <p style="margin:0 0 16px;color:#445">شكراً لكم. هذا ملخص حجزكم. احتفظوا برمز QR لتأكيد الحضور يوم الفعالية.</p>
    <div style="border:1px solid #d7e0ea;border-radius:12px;padding:16px;background:#f7fbff;margin-bottom:16px">
      <p style="margin:0 0 8px"><strong>الاسم / Nom :</strong> ${esc(item.fullName)}</p>
      <p style="margin:0 0 8px"><strong>الهاتف / Tél :</strong> <span dir="ltr">${esc(item.phone)}</span></p>
      <p style="margin:0 0 8px"><strong>البريد / Email :</strong> <span dir="ltr">${esc(item.email)}</span></p>
      <p style="margin:0 0 8px"><strong>الهيكل / Structure :</strong> ${esc(item.organization || '—')}</p>
      <p style="margin:0 0 8px"><strong>الصفة / Qualité :</strong> ${esc(item.role || '—')}</p>
      <p style="margin:0 0 8px"><strong>الإقامة / Chambre :</strong> ${esc(item.roomLabel || item.roomType || '—')}</p>
      <p style="margin:0 0 8px"><strong>عدد الشاغلين / Occupants :</strong> ${esc(item.occupants || 1)}</p>
      ${companionsHtml(item)}
      <p style="margin:12px 0 8px"><strong>التفصيل / Détail :</strong><br>${esc(item.breakdown || '—')}</p>
      <p style="margin:0 0 8px;font-size:18px"><strong>المجموع / Total :</strong> ${esc(total)} د.ت</p>
      <p style="margin:0"><strong>المصدر / Source :</strong> ${esc(sourceLabel)}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#667"><span dir="ltr">Réf. ${esc(item.id)}</span></p>
    </div>
    <div style="text-align:center;padding:12px 0 8px">
      <p style="margin:0 0 10px;font-weight:700">رمز QR لتأكيد الحضور<br><span dir="ltr" style="font-weight:500;font-size:13px;color:#445">QR code de confirmation de présence</span></p>
      <img src="${esc(qrUrl)}" alt="QR présence" width="220" height="220" style="display:block;margin:0 auto;border:0" />
      <p style="margin:12px 0 0;font-size:13px;color:#445">عند المسح يتم تأكيد حضوركم.<br dir="ltr">Scan = confirmation de présence.</p>
      <p style="margin:10px 0 0;font-size:12px"><a href="${esc(checkInUrl)}" dir="ltr">${esc(checkInUrl)}</a></p>
    </div>
    <p style="margin:18px 0 0;font-size:13px;color:#667">سنتواصل معكم عند الحاجة لتأكيد الخلاص. ضريبة الإقامة تُدفع في النزل.</p>
  </div>`;
}

async function sendViaWebhook(item, html) {
  const url = process.env.MAIL_WEBHOOK_URL;
  if (!url) return { sent: false, reason: 'MAIL_WEBHOOK_URL missing' };

  const text =
    `تأكيد التسجيل — ${item.fullName}\n` +
    `Total: ${item.totalAmount} DT\n` +
    `Présence: ${presenceUrl(item.presenceToken)}\n` +
    `QR: ${qrImageUrl(item.presenceToken)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.MAIL_WEBHOOK_TOKEN || '',
      to: item.email,
      subject: `تأكيد التسجيل — ${item.fullName || 'Amicale 360'}`,
      html,
      text,
      name: 'Amicale 360',
      replyTo: process.env.MAIL_REPLY_TO || 'aymenmedini1@yahoo.fr',
      notify: process.env.MAIL_NOTIFY || 'aymenmedini1@yahoo.fr,mouna.tayarifeki@gmail.com',
    }),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!res.ok || (data && data.ok === false)) {
    return {
      sent: false,
      reason: (data && (data.error || data.message)) || `Webhook HTTP ${res.status}`,
    };
  }
  return { sent: true, provider: 'gmail-webhook', id: null };
}

async function sendViaResend(item, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY missing' };

  const png = await buildQrPng(item.presenceToken);
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || 'Amicale 360 <onboarding@resend.dev>';
  const { data, error } = await resend.emails.send({
    from,
    to: [item.email],
    subject: `تأكيد التسجيل — ${item.fullName || 'Amicale 360'}`,
    html,
    attachments: [{ filename: 'presence-qr.png', content: png }],
  });

  if (error) return { sent: false, reason: error.message || 'Resend error' };
  return { sent: true, provider: 'resend', id: data?.id || null };
}

export async function sendReservationEmail(item) {
  if (!item?.email || !item?.presenceToken) {
    return { sent: false, reason: 'missing email or token' };
  }

  const html = buildEmailHtml(item);

  if (process.env.MAIL_WEBHOOK_URL) {
    try {
      const viaHook = await sendViaWebhook(item, html);
      if (viaHook.sent) return viaHook;
      if (process.env.RESEND_API_KEY) {
        const viaResend = await sendViaResend(item, html);
        if (viaResend.sent) return viaResend;
        return { sent: false, reason: viaHook.reason || viaResend.reason, deferClient: true };
      }
      return { ...viaHook, deferClient: true };
    } catch (err) {
      return { sent: false, reason: err.message || 'Webhook failed', deferClient: true };
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const viaResend = await sendViaResend(item, html);
      if (viaResend.sent) return viaResend;
      return { ...viaResend, deferClient: true };
    } catch (err) {
      return { sent: false, reason: err.message || 'Resend failed', deferClient: true };
    }
  }

  return {
    sent: false,
    reason: 'Aucun fournisseur email configuré (MAIL_WEBHOOK_URL ou RESEND_API_KEY)',
    deferClient: true,
  };
}

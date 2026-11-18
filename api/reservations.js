import { requireAdmin } from './_lib/auth.js';
import { sendReservationEmail } from './_lib/email.js';
import { handleOptions, readJson, setCors } from './_lib/http.js';
import { qrImageUrl } from './_lib/site.js';
import { createReservation, listReservations, updateReservation } from './_lib/store.js';

function publicReservation(item) {
  if (!item) return null;
  return {
    id: item.id,
    createdAt: item.createdAt,
    source: item.source,
    email: item.email,
    fullName: item.fullName,
    phone: item.phone,
    organization: item.organization,
    role: item.role,
    roomType: item.roomType,
    roomLabel: item.roomLabel,
    adultsCount: item.adultsCount,
    childrenCount: item.childrenCount,
    occupants: item.occupants,
    companions: item.companions,
    companionsList: item.companionsList,
    totalAmount: item.totalAmount,
    breakdown: item.breakdown,
    paymentStatus: item.paymentStatus,
    presenceToken: item.presenceToken,
    qrUrl: item.presenceToken ? qrImageUrl(item.presenceToken) : null,
    emailSentAt: item.emailSentAt || null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const sourceFilter = String(req.query?.source || '').trim().toLowerCase();
      let items = await listReservations();
      if (sourceFilter === 'pmdeaf') {
        items = items.filter((item) => item.source === 'pmdeaf');
      } else if (sourceFilter === 'public') {
        items = items.filter((item) => item.source !== 'pmdeaf');
      }
      const stats = {
        count: items.length,
        totalAmount: items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0),
        byStatus: {},
        byPayment: {},
        bySource: {},
        present: items.filter((item) => item.presentAt).length,
        source: sourceFilter || 'all',
      };
      for (const item of items) {
        stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
        stats.byPayment[item.paymentStatus] = (stats.byPayment[item.paymentStatus] || 0) + 1;
        stats.bySource[item.source] = (stats.bySource[item.source] || 0) + 1;
      }
      res.status(200).json({ items, stats });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (!body.fullName || !body.phone || !body.email || !body.roomLabel) {
        res.status(400).json({ error: 'Champs obligatoires manquants' });
        return;
      }
      if (body.totalAmount == null || Number.isNaN(Number(body.totalAmount))) {
        res.status(400).json({ error: 'Montant invalide' });
        return;
      }

      const caps = { single: 1, double: 2, triple: 3, quad: 4, none: 1 };
      const roomType = String(body.roomType || '');
      const cap = caps[roomType];
      const occupants = Number(body.occupants) || (1 + (Number(body.adultsCount) || 0) + (Number(body.childrenCount) || 0));
      if (cap && occupants > cap) {
        res.status(400).json({
          error: `طاقة الغرفة ${cap} كحد أقصى. عدد الشاغلين الحالي: ${occupants}.`,
        });
        return;
      }

      let record = await createReservation(body);
      let emailSent = false;
      let emailError = null;
      let deferClientEmail = false;
      try {
        const mail = await sendReservationEmail(record);
        emailSent = Boolean(mail.sent);
        emailError = mail.sent ? null : mail.reason || null;
        deferClientEmail = Boolean(mail.deferClient);
        if (mail.sent) {
          record = (await updateReservation(record.id, { emailSentAt: new Date().toISOString() })) || record;
        }
      } catch (err) {
        emailError = err.message || 'Email failed';
        deferClientEmail = true;
      }

      res.status(201).json({
        item: publicReservation(record),
        emailSent,
        emailError,
        deferClientEmail,
      });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}

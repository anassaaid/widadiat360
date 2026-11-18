import { put, list, del, get } from '@vercel/blob';
import { randomUUID } from 'crypto';

const PREFIX = 'reservations/';

async function readStream(stream) {
  return new Response(stream).text();
}

function normalizeCompanionsList(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export async function createReservation(input) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const companionsList = normalizeCompanionsList(input.companionsList);
  const record = {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    paymentStatus: input.paymentStatus || 'pending',
    source: input.source || 'public',
    email: input.email || '',
    fullName: input.fullName || '',
    phone: input.phone || '',
    organization: input.organization || '',
    role: input.role || '',
    roomType: input.roomType || '',
    roomLabel: input.roomLabel || '',
    roomNumber: input.roomNumber || '',
    adultsCount: Number(input.adultsCount) || 0,
    childrenCount: Number(input.childrenCount) || 0,
    occupants: Number(input.occupants) || 1,
    companions: input.companions || '',
    companionsList,
    totalAmount: Number(input.totalAmount) || 0,
    breakdown: input.breakdown || '',
    notes: input.notes || '',
    presenceToken: randomUUID(),
    presentAt: null,
    emailSentAt: null,
  };

  await put(`${PREFIX}${id}.json`, JSON.stringify(record, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  return record;
}

export async function getReservation(id) {
  const result = await get(`${PREFIX}${id}.json`, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await readStream(result.stream));
}

export async function listReservations() {
  const items = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      try {
        const result = await get(blob.pathname, { access: 'private', useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) continue;
        items.push(JSON.parse(await readStream(result.stream)));
      } catch {
        // skip unreadable blobs
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function updateReservation(id, patch) {
  const current = await getReservation(id);
  if (!current) return null;
  const allowed = [
    'status',
    'paymentStatus',
    'notes',
    'email',
    'fullName',
    'phone',
    'organization',
    'role',
    'roomType',
    'roomLabel',
    'roomNumber',
    'adultsCount',
    'childrenCount',
    'occupants',
    'companions',
    'companionsList',
    'totalAmount',
    'breakdown',
    'presentAt',
    'emailSentAt',
  ];
  const next = { ...current, updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key];
    }
  }
  if (patch.adultsCount != null) next.adultsCount = Number(patch.adultsCount) || 0;
  if (patch.childrenCount != null) next.childrenCount = Number(patch.childrenCount) || 0;
  if (patch.occupants != null) next.occupants = Number(patch.occupants) || 1;
  if (patch.totalAmount != null) next.totalAmount = Number(patch.totalAmount) || 0;
  if (patch.companionsList != null) next.companionsList = normalizeCompanionsList(patch.companionsList);

  await put(`${PREFIX}${id}.json`, JSON.stringify(next, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return next;
}

export async function findByPresenceToken(token) {
  if (!token) return null;
  const items = await listReservations();
  return items.find((item) => item.presenceToken === token) || null;
}

export async function markPresentByToken(token) {
  const current = await findByPresenceToken(token);
  if (!current) return null;
  if (current.presentAt) {
    return { item: current, already: true };
  }
  const item = await updateReservation(current.id, {
    presentAt: new Date().toISOString(),
  });
  return { item, already: false };
}

export async function deleteReservation(id) {
  const current = await getReservation(id);
  if (!current) return false;
  await del(`${PREFIX}${id}.json`);
  return true;
}

export function getSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://amicale360.vercel.app';
}

export function presenceUrl(token) {
  return `${getSiteUrl()}/presence?t=${encodeURIComponent(token)}`;
}

export function qrImageUrl(token) {
  return `${getSiteUrl()}/api/qr?t=${encodeURIComponent(token)}`;
}

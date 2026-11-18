(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildAutoresponse(item) {
    var checkIn = item.presenceToken
      ? 'https://amicale360.vercel.app/presence?t=' + encodeURIComponent(item.presenceToken)
      : '';
    var qr = item.qrUrl || '';
    var total = Number(item.totalAmount || 0).toLocaleString('fr-TN');
    return (
      '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.6;color:#12263a">' +
      '<h2 style="color:#0b3d5c">تأكيد التسجيل — Amicale 360</h2>' +
      '<p>شكراً لكم. هذا ملخص حجزكم. احتفظوا برمز QR لتأكيد الحضور يوم الفعالية.</p>' +
      '<p><strong>الاسم:</strong> ' + esc(item.fullName) + '<br>' +
      '<strong>الهاتف:</strong> ' + esc(item.phone) + '<br>' +
      '<strong>البريد:</strong> ' + esc(item.email) + '<br>' +
      '<strong>الهيكل:</strong> ' + esc(item.organization || '—') + '<br>' +
      '<strong>الصفة:</strong> ' + esc(item.role || '—') + '<br>' +
      '<strong>الإقامة:</strong> ' + esc(item.roomLabel || '—') + '<br>' +
      '<strong>الشاغلون:</strong> ' + esc(item.occupants || 1) + '<br>' +
      '<strong>المرافقون / Occupants:</strong> ' + esc(item.companions || 'بدون') + '<br>' +
      '<strong>التفصيل / Détail:</strong> ' + esc(item.breakdown || '—') + '<br>' +
      '<strong>المجموع / Total:</strong> ' + esc(total) + ' د.ت</p>' +
      (qr
        ? '<p style="text-align:center"><img src="' + esc(qr) + '" alt="QR" width="220" height="220" /></p>'
        : '') +
      (checkIn
        ? '<p style="text-align:center">رابط تأكيد الحضور:<br><a href="' +
          esc(checkIn) +
          '" dir="ltr">' +
          esc(checkIn) +
          '</a></p>'
        : '') +
      '</div>'
    );
  }

  function sendRecapEmail(item) {
    if (!item || !item.email) return Promise.resolve({ sent: false });
    var to = 'aymenmedini1@yahoo.fr';
    var payload = {
      name: item.fullName || '',
      email: item.email,
      _replyto: item.email,
      _subject: 'تأكيد التسجيل — ' + (item.fullName || 'Amicale 360'),
      phone: item.phone || '',
      organization: item.organization || '',
      role: item.role || '',
      room: item.roomLabel || '',
      occupants: item.occupants || 1,
      companions: item.companions || '',
      total: Number(item.totalAmount || 0) + ' DT',
      breakdown: item.breakdown || '',
      source: item.source || '',
      presence_url: item.presenceToken
        ? 'https://amicale360.vercel.app/presence?t=' + encodeURIComponent(item.presenceToken)
        : '',
      qr_url: item.qrUrl || '',
      reference: item.id || '',
      _template: 'table',
      _autoresponse: buildAutoresponse(item),
      _cc: 'mouna.tayarifeki@gmail.com'
    };

    return fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { sent: res.ok && data && data.success !== 'false' && data.success !== false, data: data };
        });
      })
      .catch(function () {
        return { sent: false };
      });
  }

  global.AmicaleMail = { sendRecapEmail: sendRecapEmail };
})(window);

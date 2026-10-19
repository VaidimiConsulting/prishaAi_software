/**
 * emailService.js
 * Two email functions:
 *   1. sendQuoteEmail     — branded HTML email + PDF attachment to customer
 *   2. sendAdminNotification — customer details to noreply@kimbalfurniture.com
 */

const nodemailer = require('nodemailer');
const path       = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@prishainteriors.in';

const mailPort = parseInt(process.env.MAIL_PORT) || 465;
const isSecure = mailPort === 465;

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.hostinger.com',
  port:   mailPort,
  secure: isSecure,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify SMTP connection on load
function verifySmtp() {
  transporter.verify((error, success) => {
    if (error) {
      console.error('⚠️ [SMTP Status] Connection error:', error.message);
    } else {
      console.log('✅ [SMTP Status] Server is ready to send emails via', process.env.MAIL_HOST);
    }
  });
}
verifySmtp();

/* ── Helper: nicely format enum values ──────────────────── */
function fmt(v) {
  if (!v) return '—';
  if (v === 'DECOR_WALL') return 'Decorative Wall';
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── 1. Customer email — PDF quotation ──────────────────── */
async function sendQuoteEmail(toEmail, customerName, pdfPath, order) {
  if (!toEmail || toEmail.trim() === '') {
    console.log('[EmailService] No customer email provided, skipping customer email.');
    return null;
  }

  const price = order
    ? '₹ ' + Number(order.estimatedPrice).toLocaleString('en-IN')
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin:0; padding:0; background:#f6efe6; font-family: Georgia, serif; }
    .wrapper { max-width:600px; margin:30px auto; background:#fffaf3; border:1px solid #e3d5c3; border-radius:8px; overflow:hidden; }
    .header { background:#3d2b1f; padding:30px 36px; text-align:center; }
    .header h1 { color:#e8c07a; margin:0; font-size:26px; letter-spacing:2px; }
    .header p  { color:#c8b89a; margin:6px 0 0; font-size:12px; letter-spacing:1px; }
    .gold-bar  { height:5px; background:linear-gradient(90deg, #c8954a, #e8c07a, #c8954a); }
    .body      { padding:30px 36px; }
    .greeting  { font-size:17px; color:#2a1e16; margin-bottom:12px; }
    .body p    { color:#6f4e37; font-size:14px; line-height:1.7; margin:0 0 14px; }
    .price-box { background:#3d2b1f; border-radius:8px; padding:20px; text-align:center; margin:24px 0; }
    .price-box .label { color:#c8b89a; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
    .price-box .amount { color:#e8c07a; font-size:32px; font-weight:bold; }
    .cta       { background:#6f4e37; color:#fff !important; display:inline-block; padding:12px 28px; border-radius:5px; text-decoration:none; font-size:13px; letter-spacing:1px; text-transform:uppercase; margin-top:10px; }
    .footer    { background:#3d2b1f; padding:16px; text-align:center; }
    .footer p  { color:#9a8068; font-size:10px; margin:0; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>PRISHA INTERIORS</h1>
    <p>Premium Custom Interiors</p>
  </div>
  <div class="gold-bar"></div>
  <div class="body">
    <div class="greeting">Dear ${customerName},</div>
    <p>Thank you for your enquiry with <strong>Prisha Interiors</strong>! We're excited to help you create your dream space.</p>
    <p>Please find your <strong>personalized furniture quotation</strong> attached to this email as a PDF. It includes all your selected requirements and estimated pricing.</p>
    ${price ? `
    <div class="price-box">
      <div class="label">Your Estimated Price</div>
      <div class="amount">${price}</div>
    </div>
    ` : ''}
    <p>Our team will reach out to you shortly to discuss your requirements and schedule a <strong>free site visit</strong>. If you have any questions in the meantime, feel free to reply to this email.</p>
    <p style="color:#8a7565; font-size:13px;">📎 Your quotation PDF is attached to this email.</p>
  </div>
  <div class="gold-bar"></div>
  <div class="footer">
    <p>© Prisha Interiors • info@prishainteriors.in • www.prishainteriors.in</p>
    <p style="margin-top:4px;">This is an automated message. Our team will contact you personally.</p>
  </div>
</div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from:    process.env.MAIL_FROM || `"Prisha Interiors" <${process.env.MAIL_USER}>`,
    to:      toEmail,
    subject: `Your Prisha Interiors Quotation — ${customerName}`,
    html,
    attachments: [{
      filename: `Prisha_Quote_${path.basename(pdfPath)}`,
      path:     pdfPath,
    }],
  });
  console.log(`[EmailService] Customer quote email sent successfully to ${toEmail}. MessageId: ${info.messageId}`);
  return info;
}

/* ── 2. Admin notification — customer lead details ───────── */
async function sendAdminNotification(order) {
  const unit = order.unit === 'FEET' ? 'ft' : 'in';

  let reqRows = `
    <tr><td>Category</td><td>${fmt(order.category)}</td></tr>`;
  if (order.kitchenType)  reqRows += `<tr><td>Kitchen Type</td><td>${fmt(order.kitchenType)}</td></tr>`;
  if (order.islandType)   reqRows += `<tr><td>Island Type</td><td>${fmt(order.islandType)}</td></tr>`;
  if (order.doorType)     reqRows += `<tr><td>Door Type</td><td>${fmt(order.doorType)}</td></tr>`;
  if (order.doorMaterial) reqRows += `<tr><td>Door Material</td><td>${fmt(order.doorMaterial)}</td></tr>`;
  reqRows += `<tr><td>Budget Tier</td><td>${fmt(order.budgetTier)}</td></tr>`;
  reqRows += `<tr><td>Unit</td><td>${order.unit === 'FEET' ? 'Feet' : 'Inches'}</td></tr>`;
  if (order.category === 'KITCHEN') {
    if (order.wallA) reqRows += `<tr><td>Wall A</td><td>${order.wallA} ${unit}</td></tr>`;
    if (order.wallB) reqRows += `<tr><td>Wall B</td><td>${order.wallB} ${unit}</td></tr>`;
    if (order.wallC) reqRows += `<tr><td>Wall C</td><td>${order.wallC} ${unit}</td></tr>`;
    reqRows += `<tr><td>Total Running Feet</td><td>${Number(order.areaSqft).toFixed(2)} ft</td></tr>`;
  } else {
    const isDecor = order.category === 'DECOR_WALL';
    if (order.length) reqRows += `<tr><td>${isDecor ? 'Wall Length' : 'Length'}</td><td>${order.length} ${unit}</td></tr>`;
    if (order.width)  reqRows += `<tr><td>${isDecor ? 'Wall Height' : 'Width'}</td><td>${order.width} ${unit}</td></tr>`;
    reqRows += `<tr><td>Total Area</td><td>${Number(order.areaSqft).toFixed(2)} sqft</td></tr>`;
  }

  const price = '₹ ' + Number(order.estimatedPrice).toLocaleString('en-IN');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; }
    .wrap { max-width:580px; margin:20px auto; background:#fff; border-radius:6px; overflow:hidden; border:1px solid #ddd; }
    .hdr  { background:#3d2b1f; color:#e8c07a; padding:18px 24px; font-size:18px; font-weight:bold; letter-spacing:1px; }
    .subhdr { background:#6f4e37; color:#f6efe6; padding:8px 24px; font-size:12px; letter-spacing:1px; }
    .body { padding:20px 24px; }
    table { width:100%; border-collapse:collapse; margin:12px 0; }
    th { background:#6f4e37; color:#fff; padding:8px 10px; text-align:left; font-size:12px; letter-spacing:1px; text-transform:uppercase; }
    td { padding:8px 10px; font-size:13px; border-bottom:1px solid #f0e8dc; }
    tr:nth-child(even) td { background:#fdf8f2; }
    .price-tag { background:#3d2b1f; color:#e8c07a; padding:12px 20px; text-align:center; font-size:24px; font-weight:bold; border-radius:5px; margin:16px 0; }
    .badge { display:inline-block; background:#c8954a; color:#fff; font-size:11px; padding:3px 10px; border-radius:3px; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px; }
    .footer { background:#f6efe6; padding:12px 24px; font-size:11px; color:#8a7565; border-top:1px solid #e3d5c3; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">🔔 New Enquiry — Prisha Interiors</div>
  <div class="subhdr">Quote #${order.id} • ${new Date().toLocaleString('en-IN')}</div>
  <div class="body">
    <span class="badge">New Lead</span>
    <table>
      <tr><th colspan="2">Customer Details</th></tr>
      <tr><td>Name</td><td><strong>${order.name}</strong></td></tr>
      <tr><td>Phone</td><td><a href="tel:${order.phoneNumber}">${order.phoneNumber}</a></td></tr>
      <tr><td>Email</td><td>${order.email || '—'}</td></tr>
      <tr><td>Address</td><td>${order.address}</td></tr>
      <tr><td>City</td><td>${order.city || '—'}</td></tr>
    </table>
    ${order.designImagePath ? '<p style="margin:0 0 8px;color:#6f4e37;font-size:13px;">🖼️ Customer\'s AI design image is attached to this email.</p>' : ''}
    <table>
      <tr><th colspan="2">Requirements</th></tr>
      ${reqRows}
    </table>
    <div class="price-tag">${price}</div>
    <p style="color:#6f4e37; font-size:13px; margin:0;">
      📞 Please call or WhatsApp <strong>${order.phoneNumber}</strong> to follow up and convert this lead.
    </p>
  </div>
  <div class="footer">Prisha Interiors CRM • info@prishainteriors.in</div>
</div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from:    process.env.MAIL_FROM || `"Prisha Interiors" <${process.env.MAIL_USER}>`,
    to:      ADMIN_EMAIL,
    subject: `🔔 New Enquiry: ${order.name} — ${fmt(order.category)} (${fmt(order.budgetTier)}) — ${price}`,
    html,
    attachments: order.designImagePath
      ? [{ filename: 'customer-ai-design' + path.extname(order.designImagePath), path: order.designImagePath }]
      : [],
  });
  console.log(`[EmailService] Admin notification email sent successfully to ${ADMIN_EMAIL}. MessageId: ${info.messageId}`);
  return info;
}

module.exports = { sendQuoteEmail, sendAdminNotification };


/**
 * pdfGeneratorService.js
 * Generates a branded, colourful Furniture Quotation PDF for Kimbal Furniture.
 * Layout:
 *   1. Header (dark-brown background + logo)
 *   2. Gold accent stripe + "FURNITURE QUOTATION" title bar
 *   3. Customer Details card (alternating row tint)
 *   4. Requirements card
 *   5. Estimated Price highlight box
 *   6. Disclaimer note
 *   7. Footer
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'generated-pdfs');
const LOGO_PATH  = path.join(__dirname, '..', 'assets', 'logo.jpg');

/* ── Brand palette ──────────────────────────────────────── */
const C = {
  darkBrown  : '#3d2b1f',
  midBrown   : '#6f4e37',
  accent     : '#c8954a',
  accentLight: '#e8c07a',
  cream      : '#f6efe6',
  panel      : '#fffaf3',
  ink        : '#2a1e16',
  muted      : '#8a7565',
  line       : '#e3d5c3',
  white      : '#ffffff',
  rowAlt     : '#f0e8dc',
};

/* ── Helpers ────────────────────────────────────────────── */
function fmtLabel(v) {
  if (!v) return '—';
  if (v === 'DECOR_WALL') return 'Decorative Wall';
  return v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function fmtPrice(n) {
  return '₹ ' + Number(n).toLocaleString('en-IN');
}

function sectionHeader(doc, title, y, W, M, bgColor) {
  doc.rect(M, y, W - M * 2, 26).fill(bgColor || C.midBrown);
  doc.fillColor(C.white)
     .fontSize(9)
     .font('Helvetica-Bold')
     .text(title, M + 12, y + 8, { width: W - M * 2 - 24, characterSpacing: 1.2 });
  return y + 26;
}

function drawCard(doc, rows, y, W, M) {
  const ROW_H = 22;
  const cardH = rows.length * ROW_H + 6;
  doc.rect(M, y, W - M * 2, cardH).fillAndStroke(C.panel, C.line);
  rows.forEach(([label, value], i) => {
    const ry = y + 3 + i * ROW_H;
    if (i % 2 === 0) {
      doc.rect(M + 1, ry, W - M * 2 - 2, ROW_H).fill(C.rowAlt);
    }
    doc.fillColor(C.muted)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(label.toUpperCase(), M + 12, ry + 6, { width: 148, characterSpacing: 0.5 });
    doc.fillColor(C.ink)
       .fontSize(9.5)
       .font('Helvetica')
       .text(String(value ?? '—'), M + 168, ry + 6, { width: W - M * 2 - 180 });
  });
  return y + cardH;
}

function buildReqs(order) {
  const unit = order.unit === 'FEET' ? 'ft' : 'in';
  const rows = [];
  rows.push(['Category', fmtLabel(order.category)]);
  if (order.kitchen_type)  rows.push(['Kitchen Type',  fmtLabel(order.kitchen_type)]);
  if (order.island_type)   rows.push(['Island Type',   fmtLabel(order.island_type)]);
  if (order.door_type)     rows.push(['Door Type',     fmtLabel(order.door_type)]);
  if (order.door_material) rows.push(['Door Material', fmtLabel(order.door_material)]);
  rows.push(['Budget Tier', fmtLabel(order.budget_tier)]);
  rows.push(['Unit', order.unit === 'FEET' ? 'Feet (ft)' : 'Inches (in)']);
  if (order.category === 'KITCHEN') {
    if (order.wall_a != null) rows.push(['Wall A', `${order.wall_a} ${unit}`]);
    if (order.wall_b != null) rows.push(['Wall B', `${order.wall_b} ${unit}`]);
    if (order.wall_c != null) rows.push(['Wall C', `${order.wall_c} ${unit}`]);
    rows.push(['Total Running Feet', Number(order.area_sqft).toFixed(2) + ' ft']);
  } else {
    const isDecor = order.category === 'DECOR_WALL';
    if (order.length != null) rows.push([isDecor ? 'Wall Length' : 'Length', `${order.length} ${unit}`]);
    if (order.width  != null) rows.push([isDecor ? 'Wall Height' : 'Width',  `${order.width} ${unit}`]);
    rows.push(['Total Area', Number(order.area_sqft).toFixed(2) + ' sqft']);
  }
  return rows;
}

/* ── Main export ────────────────────────────────────────── */
async function generateQuotePdf(order) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fileName = path.join(OUTPUT_DIR, `quote_${order.id}_${Date.now()}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(fileName);
    doc.pipe(stream);

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const M = 38;

    /* ── 1. HEADER ─────────────────────────────────────── */
    doc.rect(0, 0, W, 156).fill(C.darkBrown);

    // Logo
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, M, 14, { width: 210, height: 96, fit: [210, 96] });
    } else {
      // Fallback text logo
      doc.fillColor(C.white).fontSize(26).font('Helvetica-Bold')
         .text('PRISHA INTERIORS', M, 38, { width: W - M * 2, align: 'center' });
      doc.fillColor(C.accentLight).fontSize(10).font('Helvetica')
         .text('Premium Custom Interiors', M, 72, { width: W - M * 2, align: 'center' });
    }

    // Contact info (right side of header)
    doc.fillColor(C.accentLight).fontSize(7.5).font('Helvetica-Bold')
       .text('prishainteriors12@gmail.com', W - M - 200, 30, { width: 200, align: 'right' });

    // Gold accent stripe
    doc.rect(0, 144, W, 5).fill(C.accent);
    doc.rect(0, 149, W, 3).fill(C.accentLight);

    /* ── 2. TITLE BAR ───────────────────────────────────── */
    doc.rect(0, 152, W, 40).fill(C.cream);
    doc.fillColor(C.darkBrown).fontSize(16).font('Helvetica-Bold')
       .text('FURNITURE QUOTATION', M, 164, { align: 'center', width: W - M * 2, characterSpacing: 2 });

    let y = 202;

    /* ── 3. CUSTOMER DETAILS ────────────────────────────── */
    const custRows = [
      ['Full Name', order.customer_name],
      ['Address',   order.customer_address],
      ...(order.customer_city  ? [['City',  order.customer_city]]  : []),
      ['Phone',     order.customer_phone],
      ...(order.customer_email ? [['Email', order.customer_email]] : []),
    ];
    y = sectionHeader(doc, '  CUSTOMER DETAILS', y, W, M, C.midBrown);
    y = drawCard(doc, custRows, y, W, M);
    y += 12;

    /* ── 4. REQUIREMENTS ────────────────────────────────── */
    const reqRows = buildReqs(order);
    y = sectionHeader(doc, '  YOUR REQUIREMENTS', y, W, M, C.midBrown);
    y = drawCard(doc, reqRows, y, W, M);
    y += 14;

    /* ── 5. PRICE HIGHLIGHT BOX ─────────────────────────── */
    const boxH = 90;
    doc.roundedRect(M, y, W - M * 2, boxH, 8).fill(C.darkBrown);
    doc.roundedRect(M, y, W - M * 2, 28, 8).fill(C.midBrown);
    doc.rect(M, y + 14, W - M * 2, 14).fill(C.midBrown);

    doc.fillColor(C.accentLight).fontSize(9).font('Helvetica-Bold')
       .text('YOUR ESTIMATED PRICE', M, y + 8, { align: 'center', width: W - M * 2, characterSpacing: 2 });

    doc.fillColor(C.accentLight).fontSize(34).font('Helvetica-Bold')
       .text(fmtPrice(order.estimated_price), M, y + 32, { align: 'center', width: W - M * 2 });

    const measLabel = order.category === 'KITCHEN' ? 'Running Feet' : 'Area (sqft)';
    doc.fillColor('#a89070').fontSize(8.5).font('Helvetica')
       .text(`Based on ${Number(order.area_sqft).toFixed(2)} ${measLabel}`, M, y + 72, { align: 'center', width: W - M * 2 });

    y += boxH + 12;

    /* ── 6. DISCLAIMER ──────────────────────────────────── */
    doc.roundedRect(M, y, W - M * 2, 38, 5).fillAndStroke(C.cream, C.line);
    doc.fillColor(C.muted).fontSize(8).font('Helvetica-Oblique')
       .text(
         'This is an estimated quotation based on measurements provided. Final pricing may vary slightly after a site visit by our expert team.',
         M + 12, y + 10,
         { width: W - M * 2 - 24, align: 'center' }
       );
    y += 50;

    /* ── 7. QUOTE META ──────────────────────────────────── */
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.fillColor(C.muted).fontSize(7.5).font('Helvetica')
       .text(`Quote #${order.id}  •  Generated on ${dateStr}`, M, y, { align: 'center', width: W - M * 2 });

    /* ── 8. FOOTER ──────────────────────────────────────── */
    doc.rect(0, H - 52, W, 3).fill(C.accent);
    doc.rect(0, H - 49, W, 49).fill(C.darkBrown);
    doc.fillColor(C.accentLight).fontSize(10).font('Helvetica-Bold')
       .text('PRISHA INTERIORS', 0, H - 38, { align: 'center', width: W, characterSpacing: 1.5 });
    doc.fillColor('#9a8068').fontSize(7.5).font('Helvetica')
       .text('Thank you for your enquiry. Our team will contact you shortly!', 0, H - 22, { align: 'center', width: W });

    /* ── 9. PAGE 2: AI DESIGN IMAGE (only for AI designs) ── */
    if (order.design_image_path && fs.existsSync(order.design_image_path)) {
      try {
        doc.addPage({ margin: 0, size: 'A4' });
        doc.rect(0, 0, W, 90).fill(C.darkBrown);
        doc.rect(0, 80, W, 5).fill(C.accent);
        doc.rect(0, 85, W, 3).fill(C.accentLight);
        doc.fillColor(C.accentLight).fontSize(18).font('Helvetica-Bold')
           .text('YOUR AI DESIGN', M, 34, { align: 'center', width: W - M * 2, characterSpacing: 3 });

        const boxY = 110;
        const boxH = H - boxY - 130;
        doc.roundedRect(M, boxY, W - M * 2, boxH, 6).fillAndStroke(C.panel, C.line);
        doc.image(order.design_image_path, M + 8, boxY + 8, {
          fit: [W - M * 2 - 16, boxH - 16], align: 'center', valign: 'center',
        });

        doc.fillColor(C.muted).fontSize(8).font('Helvetica-Oblique')
           .text(
             'AI-generated design concept, shown for visual reference only. Final look, materials and finishes may vary.',
             M, boxY + boxH + 14, { width: W - M * 2, align: 'center' }
           );
        doc.fillColor(C.muted).fontSize(7.5).font('Helvetica')
           .text(`Quote #${order.id}  •  ${fmtLabel(order.category)}  •  ${fmtLabel(order.budget_tier)}`, M, boxY + boxH + 40, { width: W - M * 2, align: 'center' });

        doc.rect(0, H - 52, W, 3).fill(C.accent);
        doc.rect(0, H - 49, W, 49).fill(C.darkBrown);
        doc.fillColor(C.accentLight).fontSize(10).font('Helvetica-Bold')
           .text('PRISHA INTERIORS', 0, H - 38, { align: 'center', width: W, characterSpacing: 1.5 });
      } catch (e) {
        console.warn('[PDF] Could not add design image page:', e.message);
      }
    }

    doc.end();
    stream.on('finish', () => resolve(fileName));
    stream.on('error', reject);
  });
}

module.exports = { generateQuotePdf };


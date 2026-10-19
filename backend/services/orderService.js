/**
 * orderService.js
 * 1:1 port of OrderService.java
 * Orchestrates: save customer → calculate price → save order → generate PDF → send email
 */

const pool = require('../config/db');
const { calculate } = require('./priceCalculatorService');
const { generateQuotePdf } = require('./pdfGeneratorService');
const { sendQuoteEmail, sendAdminNotification } = require('./emailService');
const { saveDesignImage } = require('./designImageService');

/**
 * processOrder — mirrors OrderService.processOrder()
 * @param {Object} request — same fields as OrderRequestDto
 * @returns {Object} saved order with all fields
 */
async function processOrder(request) {
  // ── Step 1: Save customer ──────────────────────────────────────
  const [custResult] = await pool.execute(
    `INSERT INTO customer (name, email, address, city, phone_number)
     VALUES (?, ?, ?, ?, ?)`,
    [
      request.name,
      request.email || null,
      request.address,
      request.city || null,
      request.phoneNumber,
    ]
  );
  const customerId = custResult.insertId;

  // ── Step 2: Calculate price ────────────────────────────────────
  const result = await calculate(request);

  // ── Step 3: Save order ─────────────────────────────────────────
  const [orderResult] = await pool.execute(
    `INSERT INTO furniture_order
       (customer_id, category, kitchen_type, island_type,
        wall_a, wall_b, wall_c,
        door_type, door_material,
        length, width,
        budget_tier, unit,
        area_sqft, estimated_price, pdf_path, sent_on_whatsapp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    [
      customerId,
      request.category,
      request.kitchenType || null,
      request.islandType || null,
      request.wallA || null,
      request.wallB || null,
      request.wallC || null,
      request.doorType || null,
      request.doorMaterial || null,
      request.length || null,
      request.width || null,
      request.budgetTier,
      request.unit,
      result.measuredValue,
      result.estimatedPrice,
    ]
  );
  const orderId = orderResult.insertId;

  // ── Step 3b: AI design image (optional, never breaks the order) ─
  let designImage = null;
  if (request.designImageUrl) {
    designImage = await saveDesignImage(request.designImageUrl);
    if (designImage) {
      try {
        await pool.execute('UPDATE furniture_order SET design_image = ? WHERE id = ?', [designImage.fileName, orderId]);
      } catch (e) {
        console.warn('[OrderService] design_image column not saved:', e.message);
      }
    }
  }

  // ── Step 4: Generate PDF ───────────────────────────────────────
  const orderForPdf = {
    id: orderId,
    customer_name: request.name,
    customer_address: request.address,
    customer_phone: request.phoneNumber,
    category: request.category,
    kitchen_type: request.kitchenType || null,
    budget_tier: request.budgetTier,
    unit: request.unit,
    length: request.length || null,
    width: request.width || null,
    area_sqft: result.measuredValue,
    estimated_price: result.estimatedPrice,
    design_image_path: designImage ? designImage.filePath : null,
  };

  const pdfPath = await generateQuotePdf(orderForPdf);

  // Update order with pdf path
  await pool.execute(
    `UPDATE furniture_order SET pdf_path = ? WHERE id = ?`,
    [pdfPath, orderId]
  );

  // ── Step 5: Send emails ────────────────────────────────────────
  const orderForEmail = {
    id: orderId,
    name: request.name,
    email: request.email,
    phoneNumber: request.phoneNumber,
    address: request.address,
    city: request.city,
    category: request.category,
    kitchenType: request.kitchenType || null,
    islandType: request.islandType || null,
    doorType: request.doorType || null,
    doorMaterial: request.doorMaterial || null,
    budgetTier: request.budgetTier,
    unit: request.unit,
    wallA: request.wallA || null,
    wallB: request.wallB || null,
    wallC: request.wallC || null,
    length: request.length || null,
    width: request.width || null,
    areaSqft: result.measuredValue,
    estimatedPrice: result.estimatedPrice,
    designImagePath: designImage ? designImage.filePath : null,
  };

  try {
    console.log(`[OrderService] Sending PDF quotation to customer email: ${request.email}`);
    await sendQuoteEmail(request.email, request.name, pdfPath, orderForEmail);
  } catch (e) {
    console.error('❌ Customer email sending failed:', e);
  }

  // ── Delay 2s to respect Namecheap SMTP rate limit ───────────────
  await new Promise(r => setTimeout(r, 2000));

  try {
    console.log(`[OrderService] Sending lead notification to admin email: ${process.env.ADMIN_EMAIL}`);
    await sendAdminNotification(orderForEmail);
  } catch (e) {
    console.error('❌ Admin notification email failed:', e);
  }

  const pdfFilename = require('path').basename(pdfPath);
  const pdfUrl = `/api/orders/pdf/${pdfFilename}`;

  // ── Return full order ──────────────────────────────────────────
  return {
    id: orderId,
    customerId,
    category: request.category,
    kitchenType: request.kitchenType || null,
    islandType: request.islandType || null,
    wallA: request.wallA || null,
    wallB: request.wallB || null,
    wallC: request.wallC || null,
    doorType: request.doorType || null,
    doorMaterial: request.doorMaterial || null,
    length: request.length || null,
    width: request.width || null,
    budgetTier: request.budgetTier,
    unit: request.unit,
    areaSqft: result.measuredValue,
    estimatedPrice: result.estimatedPrice,
    pdfPath: pdfUrl,
    pdfUrl,
    designImageUrl: designImage ? `/design-images/${designImage.fileName}` : null,
  };
}

module.exports = { processOrder };

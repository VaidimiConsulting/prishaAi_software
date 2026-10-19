/**
 * migrate.js
 * Adds the optional `design_image` column to furniture_order automatically
 * (only if it is missing). Runs once on server start. Never crashes the server.
 */
const pool = require('./db');

async function ensureSchema() {
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'furniture_order' AND COLUMN_NAME = 'design_image'`
    );
    if (!cols.length) {
      await pool.execute('ALTER TABLE furniture_order ADD COLUMN design_image VARCHAR(500) NULL');
      console.log('✅ [Migrate] Added column furniture_order.design_image');
    }
  } catch (e) {
    console.warn('⚠️ [Migrate] Could not check/add design_image column:', e.message);
  }
}

module.exports = { ensureSchema };

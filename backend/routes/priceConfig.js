/**
 * priceConfig.js — Router
 * 1:1 port of PriceConfigController.java
 * GET/POST/PUT/DELETE /api/admin/price-config
 * Protected by adminAuth middleware (applied in server.js)
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ── GET all rates ──────────────────────────────────────────────
// Mirrors: @GetMapping — priceConfigRepository.findAll()
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM price_config ORDER BY id');
    // Map snake_case to camelCase to match Java field names frontend expects
    const mapped = rows.map(row => ({
      id: row.id,
      category: row.category,
      kitchenType: row.kitchen_type,
      islandType: row.island_type,
      doorType: row.door_type,
      doorMaterial: row.door_material,
      budgetTier: row.budget_tier,
      ratePerUnit: row.rate_per_unit,
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST add new rate ──────────────────────────────────────────
// Mirrors: @PostMapping — priceConfigRepository.save()
router.post('/', async (req, res) => {
  try {
    const { category, kitchenType, islandType, doorType, doorMaterial, budgetTier, ratePerUnit } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO price_config
         (category, kitchen_type, island_type, door_type, door_material, budget_tier, rate_per_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        category,
        kitchenType || null,
        islandType || null,
        doorType || null,
        doorMaterial || null,
        budgetTier,
        ratePerUnit,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM price_config WHERE id = ?', [result.insertId]);
    const row = rows[0];
    return res.status(201).json({
      id: row.id,
      category: row.category,
      kitchenType: row.kitchen_type,
      islandType: row.island_type,
      doorType: row.door_type,
      doorMaterial: row.door_material,
      budgetTier: row.budget_tier,
      ratePerUnit: row.rate_per_unit,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// ── PUT update rate by id ──────────────────────────────────────
// Mirrors: @PutMapping("/{id}")
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ratePerUnit } = req.body;

    const [existing] = await pool.execute('SELECT * FROM price_config WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ error: `Price config not found: ${id}` });
    }

    await pool.execute('UPDATE price_config SET rate_per_unit = ? WHERE id = ?', [ratePerUnit, id]);

    const [rows] = await pool.execute('SELECT * FROM price_config WHERE id = ?', [id]);
    const row = rows[0];
    return res.json({
      id: row.id,
      category: row.category,
      kitchenType: row.kitchen_type,
      islandType: row.island_type,
      doorType: row.door_type,
      doorMaterial: row.door_material,
      budgetTier: row.budget_tier,
      ratePerUnit: row.rate_per_unit,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// ── DELETE rate by id ──────────────────────────────────────────
// Mirrors: @DeleteMapping("/{id}")
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM price_config WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;

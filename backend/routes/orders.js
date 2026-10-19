/**
 * orders.js — Router
 * 1:1 port of OrderController.java
 * POST /api/orders
 */

const express = require('express');
const router = express.Router();
const { processOrder } = require('../services/orderService');

/**
 * POST /api/orders
 * Receives customer + furniture details, calculates price,
 * generates PDF, sends email. Same as @PostMapping in OrderController.
 */
router.post('/', async (req, res) => {
  try {
    const request = req.body;

    // Basic validation — same as @Valid @NotBlank etc. in OrderRequestDto
    if (!request.name || !request.name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!request.address || !request.address.trim()) {
      return res.status(400).json({ error: 'Address is required.' });
    }
    if (!request.phoneNumber || !/^\+?[0-9]{10,15}$/.test(request.phoneNumber)) {
      return res.status(400).json({ error: 'Enter a valid phone number.' });
    }
    if (!request.category) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    if (!request.budgetTier) {
      return res.status(400).json({ error: 'Budget tier is required.' });
    }
    if (!request.unit) {
      return res.status(400).json({ error: 'Measurement unit is required.' });
    }

    const order = await processOrder(request);
    return res.status(200).json(order);
  } catch (e) {
    console.error('Order error full:', e);
    return res.status(400).json({ error: e.message || String(e) });
  }
});

module.exports = router;

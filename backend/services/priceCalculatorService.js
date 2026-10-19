/**
 * priceCalculatorService.js
 * 1:1 port of PriceCalculatorService.java
 * Calculates estimated price based on category, shape, and budget tier.
 */

const { calculateRunningFeet } = require('./kitchenShapeCalculator');
const pool = require('../config/db');

/**
 * Main entry point — matches PriceCalculatorService.calculate()
 * Returns: { measuredValue, estimatedPrice }
 */
async function calculate(request) {
  switch (request.category) {
    case 'KITCHEN':
      return await calculateKitchen(request);
    case 'WARDROBE':
      return await calculateWardrobe(request);
    case 'WOODEN_DOOR':
      return await calculateAreaBased(request, 'WOODEN_DOOR');
    case 'DECOR_WALL':
      // Decorative wall (AI design): length x height, rate per sqft from admin panel
      return await calculateAreaBased(request, 'DECOR_WALL');
    default:
      throw new Error('Unknown category: ' + request.category);
  }
}

async function calculateKitchen(request) {
  if (!request.kitchenType) {
    throw new Error('Kitchen type is required.');
  }

  const totalRunningFeet = calculateRunningFeet(
    request.kitchenType,
    request.islandType || null,
    request.wallA,
    request.wallB,
    request.wallC || null
  );

  const config = await findRate({
    category: 'KITCHEN',
    kitchenType: request.kitchenType,
    islandType: request.islandType || null,
    doorType: null,
    doorMaterial: null,
    budgetTier: request.budgetTier,
  });

  const price = totalRunningFeet * config.rate_per_unit;
  return { measuredValue: totalRunningFeet, estimatedPrice: price };
}

async function calculateWardrobe(request) {
  if (!request.doorType || !request.doorMaterial) {
    throw new Error('Door type and material are required for wardrobe.');
  }

  const config = await findRate({
    category: 'WARDROBE',
    kitchenType: null,
    islandType: null,
    doorType: request.doorType,
    doorMaterial: request.doorMaterial,
    budgetTier: request.budgetTier,
  });

  return computeAreaPrice(request, config.rate_per_unit);
}

async function calculateAreaBased(request, category) {
  const config = await findRate({
    category,
    kitchenType: null,
    islandType: null,
    doorType: null,
    doorMaterial: null,
    budgetTier: request.budgetTier,
  });

  return computeAreaPrice(request, config.rate_per_unit);
}

function computeAreaPrice(request, rate) {
  if (!request.length || !request.width || request.length <= 0 || request.width <= 0) {
    throw new Error('Length and width must be positive values.');
  }

  const lengthInFeet = toFeet(request.length, request.unit);
  const widthInFeet = toFeet(request.width, request.unit);
  const areaSqft = lengthInFeet * widthInFeet;

  return { measuredValue: areaSqft, estimatedPrice: areaSqft * rate };
}

function toFeet(value, unit) {
  return unit === 'INCH' ? value / 12.0 : value;
}

/**
 * Matches PriceConfigRepository.findRate() JPQL query
 */
async function findRate({ category, kitchenType, islandType, doorType, doorMaterial, budgetTier }) {
  const [rows] = await pool.execute(
    `SELECT * FROM price_config
     WHERE category = ?
       AND (kitchen_type IS NULL AND ? IS NULL OR kitchen_type = ?)
       AND (island_type IS NULL AND ? IS NULL OR island_type = ?)
       AND (door_type IS NULL AND ? IS NULL OR door_type = ?)
       AND (door_material IS NULL AND ? IS NULL OR door_material = ?)
       AND budget_tier = ?
     LIMIT 1`,
    [
      category,
      kitchenType, kitchenType,
      islandType, islandType,
      doorType, doorType,
      doorMaterial, doorMaterial,
      budgetTier,
    ]
  );

  if (!rows.length) {
    throw new Error(
      'Rate not configured for this combination. Please contact admin.'
    );
  }

  return rows[0];
}

module.exports = { calculate };

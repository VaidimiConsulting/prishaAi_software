/**
 * KitchenShapeCalculator.js
 * 1:1 port of KitchenShapeCalculator.java
 * Calculates total running feet for a given kitchen shape.
 */

function calculateRunningFeet(shape, islandType, a, b, c) {
  requirePositive(a, 'Wall A');

  let total;

  switch (shape) {
    case 'L_SHAPE':
      requirePositive(b, 'Wall B');
      total = (a + b) * 2 - 2;
      break;

    case 'U_SHAPE':
      requirePositive(b, 'Wall B');
      requirePositive(c, 'Wall C');
      total = (a + b + c) * 2 - 4;
      break;

    case 'PARALLEL':
      requirePositive(b, 'Wall B');
      total = (a + b) * 2 - 2;
      break;

    case 'ISLAND':
      if (!islandType) {
        throw new Error('Island type must be specified for ISLAND kitchen.');
      }
      if (islandType === 'L_ISLAND') {
        requirePositive(b, 'Wall B');
        requirePositive(c, 'Counter C');
        total = (a + b) * 2 + c;
      } else if (islandType === 'STRAIGHT_ISLAND') {
        requirePositive(b, 'Counter B');
        total = a * 2 + b;
      } else {
        throw new Error('Unsupported island type: ' + islandType);
      }
      break;

    default:
      throw new Error('Unsupported kitchen shape: ' + shape);
  }

  if (total <= 0) {
    throw new Error(
      `Calculated running feet is invalid (${total}). Please check entered measurements.`
    );
  }

  return total;
}

function requirePositive(value, label) {
  if (value == null || isNaN(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
}

module.exports = { calculateRunningFeet };

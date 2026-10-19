/**
 * paths.js — shared folders (AI Studio data + images live here)
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
fs.mkdirSync(IMG_DIR, { recursive: true });

module.exports = { DATA_DIR, IMG_DIR };

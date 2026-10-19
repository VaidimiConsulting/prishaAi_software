const basicAuth = require('express-basic-auth');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * HTTP Basic Auth middleware — same as Spring Security config
 * Username: admin (or ADMIN_USER env)
 * Password: admin@123 (or ADMIN_PASS env)
 * Protects: /admin.html, /api/admin/**
 */
const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASS || 'admin@123',
  },
  challenge: true, // sends WWW-Authenticate header → browser shows login popup
  unauthorizedResponse: 'Unauthorized',
});

module.exports = { adminAuth };

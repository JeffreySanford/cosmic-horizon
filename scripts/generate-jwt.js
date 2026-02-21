#!/usr/bin/env node

// simple helper to manufacture a JWT matching the backend secret
// usage: JWT_SECRET=... node scripts/generate-jwt.js [username] [role]

const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'openapi-dev-jwt-secret-32-chars-minimum';
const username = process.argv[2] || 'astro';
const role = process.argv[3] || 'user';

const payload = {
  sub: username,
  username,
  role,
};

console.log(jwt.sign(payload, secret, { expiresIn: '1h' }));

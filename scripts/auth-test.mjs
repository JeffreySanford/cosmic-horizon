#!/usr/bin/env node
// simple script to exercise the login endpoint for a user and admin account
// usage: node scripts/auth-test.mjs
// set USER_EMAIL, USER_PASS, ADMIN_EMAIL, ADMIN_PASS env vars or defaults will be used

import fetch from 'node:fetch';

const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function login(email, password) {
  const url = `${baseUrl}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const userEmail = process.env.USER_EMAIL || 'demo@cosmic.example';
  const userPass = process.env.USER_PASS || 'demo-password123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cosmic.example';
  const adminPass = process.env.ADMIN_PASS || 'admin-password123';

  console.log('Logging in as regular user...');
  try {
    const user = await login(userEmail, userPass);
    console.log('User token:', user.access_token);
  } catch (err) {
    console.error('User login error:', err.message);
  }

  console.log('Logging in as admin...');
  try {
    const admin = await login(adminEmail, adminPass);
    console.log('Admin token:', admin.access_token);
  } catch (err) {
    console.error('Admin login error:', err.message);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

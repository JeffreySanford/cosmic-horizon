#!/usr/bin/env node
// simple script to exercise the login endpoint for a user and admin account
// usage: node scripts/auth-test.mjs
// environment variables override defaults; .env.local is loaded automatically

import 'dotenv/config';
import axios from 'axios';

const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function login(email, password) {
  const url = `${baseUrl}/api/auth/login`;
  try {
    const res = await axios.post(url, { email, password });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new Error(`login failed (${err.response.status}): ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

async function main() {
  // use seeded credentials from env if available
  const userEmail = process.env.USER_EMAIL || process.env.SEED_TEST_EMAIL || 'test@cosmic.local';
  const userPass = process.env.USER_PASS || process.env.SEED_TEST_PASSWORD || 'Password123!';
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@cosmic.local';
  const adminPass = process.env.ADMIN_PASS || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!';

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

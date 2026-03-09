/**
 * firebase-token-gen.js
 *
 * Generates Firebase ID tokens for API testing.
 *
 * What this script does:
 *   1. Reads your service account key to initialise Firebase Admin SDK
 *   2. Creates each test user in Firebase Auth if they don't already exist (idempotent)
 *   3. Writes persistent custom claims (role, etc.) onto the Auth record
 *   4. Mints a short-lived custom token (server-signed JWT)
 *   5. Exchanges it with the Firebase REST API for a real ID token
 *   6. Prints every token to the console and saves them to scripts/test-tokens.txt
 *
 * Prerequisites:
 *   • firebase-admin-sdk.json   — Service account key in the project root
 *                                 Firebase Console → Project Settings → Service Accounts
 *                                 → Generate New Private Key
 *   • FIREBASE_API_KEY          — Web API Key in .env
 *                                 Firebase Console → Project Settings → General → Web API Key
 *
 * Usage:
 *   node scripts/firebase-token-gen.js
 *
 * Output:
 *   scripts/test-tokens.txt   ← gitignored, contains ready-to-use Bearer tokens
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const PATHS = {
  serviceAccount: resolve(ROOT, 'firebase-admin-sdk.json'),
  env:            resolve(ROOT, '.env'),
  output:         resolve(__dirname, 'test-tokens.txt'),
};

// ─── Test user definitions ────────────────────────────────────────────────────
// Add, remove, or edit entries here as your test suite grows.

const TEST_USERS = [
  {
    uid:         'test-customer-001',
    email:       'test.customer@example.com',
    phoneNumber: '+15550000001',
    displayName: 'Test Customer',
    claims:      { role: 'CUSTOMER' },
  },
  {
    uid:         'test-barber-001',
    email:       'test.barber@example.com',
    phoneNumber: '+15550000002',
    displayName: 'Test Barber',
    claims:      { role: 'BARBER' },
  },
];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function loadServiceAccount() {
  if (!existsSync(PATHS.serviceAccount)) {
    fatal(
      'firebase-admin-sdk.json not found.',
      'Go to Firebase Console → Project Settings → Service Accounts,',
      'click "Generate New Private Key", and save it as firebase-admin-sdk.json in the project root.',
    );
  }
  return JSON.parse(readFileSync(PATHS.serviceAccount, 'utf-8'));
}

function loadApiKey() {
  if (!existsSync(PATHS.env)) return null;
  const match = readFileSync(PATHS.env, 'utf-8').match(/^FIREBASE_API_KEY=(.+)$/m);
  return match ? match[1].trim() : null;
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────

/**
 * Creates a Firebase Auth user if they don't already exist.
 * Safe to call multiple times (idempotent).
 */
async function upsertUser({ uid, email, phoneNumber, displayName }) {
  try {
    const existing = await admin.auth().getUser(uid);
    log(`  ↩  User already exists: ${existing.uid}`);
    return existing;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await admin.auth().createUser({
      uid,
      email,
      phoneNumber,
      displayName,
      emailVerified: true,
      disabled: false,
    });
    log(`  ✚  Created user: ${created.uid}`);
    return created;
  }
}

/**
 * Writes custom claims onto the Firebase Auth record (server-side, persisted).
 * These claims will be embedded in every ID token the user receives going forward.
 *
 * NOTE: Claims set here are automatically included in the ID token. There is no
 * need to pass them again to createCustomToken() — doing so would be redundant.
 */
async function applyClaims(uid, claims) {
  await admin.auth().setCustomUserClaims(uid, claims);
  log(`  ✔  Custom claims applied: ${JSON.stringify(claims)}`);
}

/**
 * Exchanges a custom token for a Firebase ID token via the Identity Toolkit REST API.
 *
 * Custom tokens (created by Admin SDK) are NOT the same as ID tokens.
 * Your backend's verifyIdToken() only accepts ID tokens; this exchange is required.
 * In production this step happens automatically inside the mobile/web Firebase SDK
 * when a user signs in. For testing we do it manually here.
 */
async function exchangeForIdToken(customToken, apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: {} }));
    throw new Error(`Firebase REST error: ${error?.message ?? res.statusText}`);
  }

  const { idToken, refreshToken, expiresIn } = await res.json();
  return { idToken, refreshToken, expiresIn: Number(expiresIn) };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner('Firebase Token Generator');

  const serviceAccount = loadServiceAccount();
  const apiKey         = loadApiKey();

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  log(`✔  Firebase Admin initialised  [project: ${serviceAccount.project_id}]\n`);

  if (!apiKey) {
    warn(
      'FIREBASE_API_KEY not found in .env — ID token exchange will be skipped.',
      'Custom tokens alone cannot be used with your backend.',
      '',
      'To fix: Firebase Console → Project Settings → General → Web API Key',
      'Then add to .env:  FIREBASE_API_KEY=AIza...',
    );
  }

  // ── Process each test user ──
  const results   = {};
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  for (const user of TEST_USERS) {
    section(`${user.displayName ?? user.uid}  [${user.claims.role}]`);

    await upsertUser(user);
    await applyClaims(user.uid, user.claims);

    // createCustomToken() takes only the uid here — claims are already persisted
    // on the Auth record via setCustomUserClaims() above and will be embedded in
    // the resulting ID token automatically. Passing them again is harmless but
    // misleading, so we intentionally omit them.
    const customToken = await admin.auth().createCustomToken(user.uid);
    log(`  ✔  Custom token created`);

    if (apiKey) {
      const { idToken, refreshToken } = await exchangeForIdToken(customToken, apiKey);
      log(`  ✔  ID token obtained (valid ~1 hour)\n`);
      results[user.uid] = { role: user.claims.role, idToken, refreshToken, expiresAt };
    } else {
      log(`  ⚠  Skipping ID token exchange — no API key\n`);
      results[user.uid] = { role: user.claims.role, customToken, idToken: null };
    }
  }

  // ── Print tokens to console ──
  banner('Tokens');
  for (const [uid, data] of Object.entries(results)) {
    console.log(`\n[${data.role}]  ${uid}`);
    if (data.idToken) {
      console.log(`ID Token (paste into Postman's "Token" field):\n${data.idToken}\n`);
    } else {
      console.log(`Custom Token (not usable until exchanged for ID token):\n${data.customToken}\n`);
    }
  }

  // ── Save tokens to file ──
  const lines = [
    'EverCut API — Test Tokens',
    `Generated : ${new Date().toISOString()}`,
    apiKey ? `Expires   : ${expiresAt}` : 'Expires   : N/A (no ID tokens generated)',
    '',
    '⚠  DO NOT COMMIT THIS FILE. Add "test-tokens.txt" to .gitignore.',
    '═'.repeat(60),
    '',
  ];

  for (const [uid, data] of Object.entries(results)) {
    lines.push(`[${data.role}]  ${uid}`);
    if (data.idToken) {
      lines.push(data.idToken);
    } else {
      lines.push(`(no ID token — add FIREBASE_API_KEY to .env and re-run)`);
      lines.push(`Custom token: ${data.customToken}`);
    }
    lines.push('');
  }

  if (apiKey) {
    lines.push(
      '─'.repeat(60),
      'How to use in Postman:',
      '  1. Copy the full "<token>" line for the role you need.',
      '  2. In your Postman collection → Variables → set firebase_token to the copied value.',
      '  3. Tokens expire after 1 hour. Re-run this script to refresh.',
    );
  }

  writeFileSync(PATHS.output, lines.join('\n'));

  // ── Final summary ──
  banner('Done');
  log(`Tokens saved → ${PATHS.output}\n`);

  if (apiKey) {
    log(`Tokens expire at: ${expiresAt}`);
    log(`Re-run this script when they expire.\n`);
  } else {
    log(`Add FIREBASE_API_KEY to .env, then re-run to generate usable ID tokens.\n`);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(...args)    { console.log(...args); }

function warn(...lines)  {
  console.warn('\n⚠   ' + lines.join('\n    ') + '\n');
}

function fatal(...lines) {
  console.error('\n✖   ' + lines.join('\n    '));
  process.exit(1);
}

function banner(title) {
  const bar = '═'.repeat(60);
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n✖  Unexpected error:', err.message);
  process.exit(1);
});

# Firebase Token Generator — Setup & Usage Guide

## What the script does

| Step | Action |
|---|---|
| 1 | Initialises Firebase Admin SDK using your service account key |
| 2 | Creates each test user in Firebase Auth if they don't exist yet *(idempotent — safe to re-run)* |
| 3 | Writes persistent custom claims (`role`, etc.) onto each Auth record |
| 4 | Mints a short-lived **custom token** (Admin SDK, server-only) |
| 5 | Exchanges it with Firebase REST API for a real **ID token** |
| 6 | Prints all tokens to the console and saves them to `scripts/test-tokens.txt` |

> **Why the exchange step?**  
> Your backend calls `admin.auth().verifyIdToken()`, which only accepts **ID tokens**.  
> Custom tokens are a server-to-Firebase handshake; they cannot be verified by your backend directly.  
> In production the Firebase mobile/web SDK does this exchange automatically on sign-in. The script replicates that step for testing.

---

## Prerequisites

### 1. Service account key

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate New Private Key**
3. Save the downloaded file as `firebase-admin-sdk.json` in the **project root** (next to `package.json`)

> ⚠️ This file grants admin access to your Firebase project. Never commit it to git.  
> Add it to `.gitignore`:
> ```
> firebase-admin-sdk.json
> ```

### 2. Web API Key

1. Go to **Firebase Console → Project Settings → General**
2. Copy the **Web API Key** (starts with `AIza…`)
3. Add it to your `.env` file:
   ```
   FIREBASE_API_KEY=AIzaSy...
   ```

---

## Running the script

```bash
node scripts/firebase-token-gen.js
```

On success you will see output like:

```
══════════════════════════════════════════════════════════
  Tokens
══════════════════════════════════════════════════════════

[CUSTOMER]  test-customer-001
ID Token (use as Bearer token):
eyJhbGci...

[BARBER]  test-barber-001
ID Token (use as Bearer token):
eyJhbGci...
```

Tokens are also saved to `scripts/test-tokens.txt` — add this file to `.gitignore`.

---

## Using the token in Postman

### Option A — Collection variable (recommended)

1. Open your **EverCut** collection in Postman
2. Click the collection name → **Variables** tab
3. Set `firebase_token` to the raw token value (no `Bearer ` prefix — Postman adds that automatically)
4. Click **Save**
5. In your requests, set the **Authorization** tab → Type: **Bearer Token** → value: `{{firebase_token}}`

> ⚠️ If instead you set a raw `Authorization` **header** to `{{firebase_token}}`, you would need to include `Bearer ` yourself. The Authorization tab approach is cleaner and handles this for you.

### Option B — Individual request

1. Open the request you want to test
2. Go to **Authorization** tab → set **Type** to `Bearer Token`
3. Paste the raw ID token into the **Token** field (no `Bearer ` prefix needed)

---

## Token expiry

Firebase ID tokens expire after **1 hour**.  
Simply re-run the script to generate fresh tokens:

```bash
node scripts/firebase-token-gen.js
```

---

## Customising test users

Edit the `TEST_USERS` array at the top of the script:

```js
const TEST_USERS = [
  {
    uid:         'test-customer-001',   // Must be unique in Firebase Auth
    email:       'test.customer@example.com',
    phoneNumber: '+15550000001',        // E.164 format
    displayName: 'Test Customer',
    claims:      { role: 'CUSTOMER' },  // These are embedded in every ID token
  },
  // Add more users here...
];
```

---

## Gitignore checklist

Make sure these entries are in your `.gitignore`:

```
firebase-admin-sdk.json
scripts/test-tokens.txt
.env
```
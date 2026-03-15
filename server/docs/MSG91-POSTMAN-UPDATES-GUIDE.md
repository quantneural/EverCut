# Postman Collection Updates - MSG91 OTP + JWT Authentication

> **Parent Document:** [`MSG91-INTEGRATION-GUIDE.md`](./MSG91-INTEGRATION-GUIDE.md)  
> **Scope:** Updating all Postman collections and tooling for MSG91 OTP + JWT authentication  
> **When to use:** After the backend implementation and Firebase removal are complete

---

## Table of Contents

1. [Environment File](#1-environment-file)
2. [Rewrite `01-authentication.json`](#2-rewrite-01-authenticationjson)
3. [Update All Downstream Collections (02-13)](#3-update-all-downstream-collections-02-13)
4. [Update Collection Descriptions](#4-update-collection-descriptions)
5. [Update `README.md`](#5-update-readmemd)
6. [Update Postman Collection Generator](#6-update-postman-collection-generator)
7. [File Matrix](#7-file-matrix)

---

## 1. Environment File

**File:** `postman-collections/EverCut.postman_environment.json`

Replace Firebase token variables with OTP/JWT variables:

```json
{
  "id": "evercut-local-environment",
  "name": "EverCut Local",
  "values": [
    { "key": "base_url", "value": "http://localhost:5000", "enabled": true },
    { "key": "api_prefix", "value": "api/v1", "enabled": true },
    { "key": "test_customer_mobile", "value": "9876543210", "enabled": true },
    { "key": "test_barber_mobile", "value": "9876543211", "enabled": true },
    { "key": "test_otp", "value": "123456", "enabled": true },
    { "key": "customer_access_token", "value": "", "enabled": true },
    { "key": "customer_refresh_token", "value": "", "enabled": true },
    { "key": "customer_onboarding_token", "value": "", "enabled": true },
    { "key": "barber_access_token", "value": "", "enabled": true },
    { "key": "barber_refresh_token", "value": "", "enabled": true },
    { "key": "barber_onboarding_token", "value": "", "enabled": true }
  ],
  "_postman_variable_scope": "environment"
}
```

| Variable | Purpose | Dev Value |
|---|---|---|
| `test_customer_mobile` | Test customer phone (10-digit) | `9876543210` |
| `test_barber_mobile` | Test barber phone (10-digit) | `9876543211` |
| `test_otp` | Hardcoded OTP (only when `MSG91_TEST_MODE=true`) | `123456` |
| `customer_access_token` | Auto-set by auth or onboarding collections | *(set by test script)* |
| `customer_refresh_token` | Auto-set by auth or onboarding collections | *(set by test script)* |
| `barber_access_token` | Auto-set by auth or onboarding collections | *(set by test script)* |
| `barber_refresh_token` | Auto-set by auth or onboarding collections | *(set by test script)* |
| `customer_onboarding_token` | Auto-set by auth collection | *(set by test script)* |
| `barber_onboarding_token` | Auto-set by auth collection | *(set by test script)* |

---

## 2. Rewrite `01-authentication.json`

The authentication collection uses the full OTP flow with 9 requests:

| # | Method | Endpoint | Description | Auth |
|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/otp/send` | Send OTP to customer test number | None |
| 2 | POST | `/api/v1/auth/otp/verify` | Verify customer OTP → captures onboarding or session tokens | None |
| 3 | POST | `/api/v1/auth/otp/send` | Send OTP to barber test number | None |
| 4 | POST | `/api/v1/auth/otp/verify` | Verify barber OTP → captures onboarding or session tokens | None |
| 5 | POST | `/api/v1/auth/token/refresh` | Refresh customer access token | None |
| 6 | POST | `/api/v1/auth/token/refresh` | Refresh barber access token | None |
| 7 | POST | `/api/v1/auth/logout` | Logout customer | Bearer `{{customer_access_token}}` |
| 8 | POST | `/api/v1/auth/otp/resend` | Resend OTP (text channel) | None |
| 9 | GET | `/api/v1/health` | Health check | None |

### 2.1 Collection Variables

```json
"variable": [
  { "key": "base_url", "value": "http://localhost:5000", "type": "string" },
  { "key": "api_prefix", "value": "api/v1", "type": "string" },
  { "key": "test_customer_mobile", "value": "9876543210", "type": "string" },
  { "key": "test_barber_mobile", "value": "9876543211", "type": "string" },
  { "key": "test_otp", "value": "123456", "type": "string" },
  { "key": "customer_access_token", "value": "", "type": "string" },
  { "key": "customer_refresh_token", "value": "", "type": "string" },
  { "key": "customer_onboarding_token", "value": "", "type": "string" },
  { "key": "barber_access_token", "value": "", "type": "string" },
  { "key": "barber_refresh_token", "value": "", "type": "string" },
  { "key": "barber_onboarding_token", "value": "", "type": "string" }
]
```

### 2.2 Pre-Request Script

```javascript
const readScopedValue = (...keys) => {
  for (const key of keys) {
    const environmentValue = pm.environment.get(key);
    if (environmentValue) return environmentValue;
    const globalValue = pm.globals.get(key);
    if (globalValue) return globalValue;
  }
  return '';
};
const baseUrl = readScopedValue('base_url');
if (baseUrl) { pm.collectionVariables.set('base_url', baseUrl); }
const apiPrefix = readScopedValue('api_prefix');
if (apiPrefix) { pm.collectionVariables.set('api_prefix', apiPrefix); }

// Sync OTP test variables
const customerMobile = readScopedValue('test_customer_mobile');
if (customerMobile) { pm.collectionVariables.set('test_customer_mobile', customerMobile); }
const barberMobile = readScopedValue('test_barber_mobile');
if (barberMobile) { pm.collectionVariables.set('test_barber_mobile', barberMobile); }
const testOtp = readScopedValue('test_otp');
if (testOtp) { pm.collectionVariables.set('test_otp', testOtp); }
```

### 2.3 Send OTP Request (Example - Customer)

```json
{
  "name": "1. Send Customer OTP",
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "url": "{{base_url}}/{{api_prefix}}/auth/otp/send",
    "body": {
      "mode": "raw",
      "raw": "{\n  \"mobile\": \"{{test_customer_mobile}}\"\n}",
      "options": { "raw": { "language": "json" } }
    },
    "auth": { "type": "noauth" }
  },
  "event": [{
    "listen": "test",
    "script": {
      "type": "text/javascript",
      "exec": ["pm.test('status is 200', function () { pm.response.to.have.status(200); });"]
    }
  }]
}
```

### 2.4 Verify OTP Request (Example - Customer, with Auto-Capture)

```json
{
  "name": "2. Verify Customer OTP",
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "url": "{{base_url}}/{{api_prefix}}/auth/otp/verify",
    "body": {
      "mode": "raw",
      "raw": "{\n  \"mobile\": \"{{test_customer_mobile}}\",\n  \"otp\": \"{{test_otp}}\"\n}",
      "options": { "raw": { "language": "json" } }
    },
    "auth": { "type": "noauth" }
  },
  "event": [{
    "listen": "test",
    "script": {
      "type": "text/javascript",
      "exec": [
        "pm.test('status is 200', function () { pm.response.to.have.status(200); });",
        "const response = pm.response.json();",
        "const data = response.data || {};",
        "",
        "// Capture tokens for use by all other collections",
        "if (data.isNewUser && data.onboardingToken) {",
        "  pm.collectionVariables.set('customer_onboarding_token', data.onboardingToken);",
        "  pm.environment.set('customer_onboarding_token', data.onboardingToken);",
        "} else {",
        "  if (data.accessToken) {",
        "    pm.collectionVariables.set('customer_access_token', data.accessToken);",
        "    pm.environment.set('customer_access_token', data.accessToken);",
        "  }",
        "  if (data.refreshToken) {",
        "    pm.collectionVariables.set('customer_refresh_token', data.refreshToken);",
        "    pm.environment.set('customer_refresh_token', data.refreshToken);",
        "  }",
        "}",
        "",
        "pm.collectionVariables.set('last_session_role', 'CUSTOMER');",
        "pm.collectionVariables.set('last_session_is_new_user', String(Boolean(data.isNewUser)));"
      ]
    }
  }]
}
```

> **Critical:** The test script uses `pm.environment.set()` so the returned token is immediately available to the next collection in the flow. Brand-new users receive onboarding tokens first; returning users receive access and refresh tokens directly. Requests 3-4 follow the same pattern for the barber user.

### 2.5 Refresh Token Request (Example - Customer)

```json
{
  "name": "5. Refresh Customer Token",
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "url": "{{base_url}}/{{api_prefix}}/auth/token/refresh",
    "body": {
      "mode": "raw",
      "raw": "{\n  \"refreshToken\": \"{{customer_refresh_token}}\"\n}",
      "options": { "raw": { "language": "json" } }
    },
    "auth": { "type": "noauth" }
  },
  "event": [{
    "listen": "test",
    "script": {
      "type": "text/javascript",
      "exec": [
        "pm.test('status is 200', function () { pm.response.to.have.status(200); });",
        "const response = pm.response.json();",
        "const data = response.data || {};",
        "if (data.accessToken) {",
        "  pm.collectionVariables.set('customer_access_token', data.accessToken);",
        "  pm.environment.set('customer_access_token', data.accessToken);",
        "}",
        "if (data.refreshToken) {",
        "  pm.collectionVariables.set('customer_refresh_token', data.refreshToken);",
        "  pm.environment.set('customer_refresh_token', data.refreshToken);",
        "}"
      ]
    }
  }]
}
```

### 2.6 Logout Request (Example - Customer)

```json
{
  "name": "7. Logout Customer (Terminal)",
  "request": {
    "method": "POST",
    "header": [],
    "url": "{{base_url}}/{{api_prefix}}/auth/logout",
    "auth": {
      "type": "bearer",
      "bearer": [{ "key": "token", "value": "{{customer_access_token}}", "type": "string" }]
    }
  },
  "event": [{
    "listen": "test",
    "script": {
      "type": "text/javascript",
      "exec": [
        "pm.test('status is 200', function () { pm.response.to.have.status(200); });",
        "pm.environment.set('customer_access_token', '');",
        "pm.environment.set('customer_refresh_token', '');"
      ]
    }
  }]
}
```

---

## 3. Update All Downstream Collections (02-13)

Every collection needs **three changes**:

### 3.1 Collection-Level `auth` - Use JWT Access Tokens

**Customer Onboarding collection** (`02-onboarding.json` Customer request):
```json
"auth": {
  "type": "bearer",
  "bearer": [{ "key": "token", "value": "{{customer_onboarding_token}}", "type": "string" }]
}
```

**Barber Onboarding collection** (`02-onboarding.json` Barber request):
```json
"auth": {
  "type": "bearer",
  "bearer": [{ "key": "token", "value": "{{barber_onboarding_token}}", "type": "string" }]
}
```

**Customer collections** (03, 04, 05, 06):

```json
"auth": {
  "type": "bearer",
  "bearer": [{ "key": "token", "value": "{{customer_access_token}}", "type": "string" }]
}
```

**Barber collections** (07, 08, 09, 10, 11, 12, 13):

```json
"auth": {
  "type": "bearer",
  "bearer": [{ "key": "token", "value": "{{barber_access_token}}", "type": "string" }]
}
```

### 3.2 Collection Variables

```json
{ "key": "customer_access_token", "value": "", "description": "JWT access token - auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup" }
{ "key": "barber_access_token", "value": "", "description": "JWT access token - auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup" }
```

### 3.3 Pre-Request Script - Sync JWT Tokens

```javascript
const customerToken = readScopedValue('customer_access_token');
if (customerToken) { pm.collectionVariables.set('customer_access_token', customerToken); }

const barberToken = readScopedValue('barber_access_token');
if (barberToken) { pm.collectionVariables.set('barber_access_token', barberToken); }
```

### 3.4 Per-File Summary

| File | Token Variable |
|---|---|
| `02-onboarding.json` | Both `customer_onboarding_token` + `barber_onboarding_token` |
| `03-customer-profile.json` | `customer_access_token` |
| `04-customer-bookings.json` | `customer_access_token` |
| `05-customer-shop-discovery.json` | `customer_access_token` |
| `06-customer-ratings.json` | `customer_access_token` |
| `07-barber-profile-shop.json` | `barber_access_token` |
| `08-barber-employees.json` | `barber_access_token` |
| `09-barber-services.json` | `barber_access_token` |
| `10-barber-bookings.json` | `barber_access_token` |
| `11-barber-photos.json` | `barber_access_token` |
| `12-barber-earnings.json` | `barber_access_token` |
| `13-barber-ratings.json` | `barber_access_token` |

---

## 4. Update Collection Descriptions

| Collection | New Description |
|---|---|
| `01-authentication.json` | `"OTP authentication endpoints for customer and barber test users. Sends OTP, verifies it, and captures onboarding tokens for brand-new users or JWT access/refresh tokens for returning users. Requires MSG91_TEST_MODE=true for local development."` |
| `02-onboarding.json` | `"Customer and barber onboarding requests wired for the OTP test users and the local sample upload asset. Run 01-authentication.json first to populate onboarding tokens. Upon successful onboarding, access and refresh tokens are captured for the other collections."` |
| `07-barber-profile-shop.json` | `"Barber profile and shop management collection. Uses the barber JWT access token captured by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup."` |

Request **9A** in `07-barber-profile-shop.json`:

```
"Revokes the JWT refresh token, invalidating all sessions. Run this only when you are finished testing."
```

Request **9B** in `07-barber-profile-shop.json`:

```
"Soft-deletes the barber account and revokes the JWT refresh token. Run this instead of the sign-out request when you want the account deleted."
```

---

## 5. Update `README.md`

**File:** `postman-collections/README.md`

### 5.1 Setup

```markdown
### Prerequisites

1. Ensure `MSG91_TEST_MODE=true` in your `.env` file
2. Ensure `MSG91_TEST_OTP=123456` in your `.env` file
3. Start the server: `npm run dev`

No manual token generation needed - the authentication and onboarding collections handle token capture automatically.
```

### 5.2 Import Steps

```markdown
### Import into Postman

1. Import every `.json` collection from this folder.
2. Import `EverCut.postman_environment.json` as the active environment.
3. Verify `test_customer_mobile`, `test_barber_mobile`, and `test_otp` are set in the environment.
4. Run `01-authentication.json` requests 1-4 to send+verify OTP for both test users.
5. Returning users get access tokens immediately; brand-new users get onboarding tokens first and then receive access tokens from `02-onboarding.json`.
6. Run other collections in order.

> Access tokens expire after 15 minutes once onboarding is complete. Run the **Refresh Token** requests (5-6)
> or re-run requests 1-4 to get fresh tokens. Tokens are auto-captured - no manual copy-paste.
```

### 5.3 Test Users

| Role | UID | Email | Phone |
|---|---|---|---|
| Customer | *(created during first successful onboarding)* | `test.customer@example.com` | `9876543210` |
| Barber | *(created during first successful onboarding)* | `test.barber@example.com` | `9876543211` |

### 5.4 Environment Variables

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:5000` |
| `api_prefix` | `api/v1` |
| `test_customer_mobile` | `9876543210` |
| `test_barber_mobile` | `9876543211` |
| `test_otp` | `123456` |
| `customer_access_token` | *(auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup)* |
| `customer_refresh_token` | *(auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup)* |
| `barber_access_token` | *(auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup)* |
| `barber_refresh_token` | *(auto-set by 01-authentication.json for returning users or by 02-onboarding.json after first-time signup)* |
| `customer_onboarding_token` | *(auto-set by 01-authentication.json)* |
| `barber_onboarding_token` | *(auto-set by 01-authentication.json)* |

### 5.5 Auth Collection Requests

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | POST | `/api/v1/auth/otp/send` | Send OTP to customer |
| 2 | POST | `/api/v1/auth/otp/verify` | Verify customer OTP - captures onboarding or session tokens |
| 3 | POST | `/api/v1/auth/otp/send` | Send OTP to barber |
| 4 | POST | `/api/v1/auth/otp/verify` | Verify barber OTP - captures onboarding or session tokens |
| 5 | POST | `/api/v1/auth/token/refresh` | Refresh customer access token |
| 6 | POST | `/api/v1/auth/token/refresh` | Refresh barber access token |
| 7 | POST | `/api/v1/auth/logout` | Logout customer *(Terminal)* |
| 8 | POST | `/api/v1/auth/otp/resend` | Resend OTP (text channel) |
| 9 | GET | `/api/v1/health` | Health check |

### 5.6 Recommended Run Order

**Barber side** (must run first to create bookable data):

1. `01-authentication.json` → **3. Send Barber OTP** → **4. Verify Barber OTP**
2. `02-onboarding.json` → **2. Complete Barber Profile** *(first run only)*
3. Continue with barber collections in order...

**Customer side:**

1. `01-authentication.json` → **1. Send Customer OTP** → **2. Verify Customer OTP**
2. `02-onboarding.json` → **1. Complete Customer Profile** *(first run only)*
3. Continue with customer collections in order...

---

## 6. Update Postman Collection Generator

**File:** `scripts/regenerate-postman-collections.mjs`

This script is the **source of truth** that generates all Postman JSON files. Apply these changes:

| Find | Replace |
|---|---|
| `customer_firebase_token` | `customer_access_token` |
| `barber_firebase_token` | `barber_access_token` |
| `bearerAuth('customer_firebase_token')` | `bearerAuth('customer_access_token')` |
| `bearerAuth('barber_firebase_token')` | `bearerAuth('barber_access_token')` |

Also update:
- Collection descriptions - remove Firebase references, use OTP/JWT descriptions from [Section 4](#4-update-collection-descriptions)
- Pre-request scripts - replace `readScopedValue('customer_firebase_token')` / `readScopedValue('barber_firebase_token')` with access token equivalents
- Environment variable definitions - replace Firebase token entries with OTP/JWT variables from [Section 1](#1-environment-file)
- **Onboarding Auth Token:** The `02-onboarding.json` collection needs to inject the `onboardingToken` into the Bearer token instead of the standard `accessToken`.
- **Onboarding Response Capture:** Add a post-request script to `02-onboarding.json` requests to capture the newly returned `accessToken` and `refreshToken` and set them into the postman environment, overwriting any previous values and fully logging in the user after successful onboarding.

After updating, regenerate and verify:

```bash
node scripts/regenerate-postman-collections.mjs
rg -n "firebase" postman-collections/    # must return zero matches
```

---

## 7. File Matrix

```text
postman-collections/
├── 01-authentication.json           ← REWRITE: OTP flow (9 requests)
├── 02-onboarding.json               ← UPDATE: auth vars + descriptions
├── 03-customer-profile.json         ← UPDATE: use customer_access_token
├── 04-customer-bookings.json        ← UPDATE: use customer_access_token
├── 05-customer-shop-discovery.json  ← UPDATE: use customer_access_token
├── 06-customer-ratings.json         ← UPDATE: use customer_access_token
├── 07-barber-profile-shop.json      ← UPDATE: use barber_access_token + descriptions
├── 08-barber-employees.json         ← UPDATE: use barber_access_token
├── 09-barber-services.json          ← UPDATE: use barber_access_token
├── 10-barber-bookings.json          ← UPDATE: use barber_access_token
├── 11-barber-photos.json            ← UPDATE: use barber_access_token
├── 12-barber-earnings.json          ← UPDATE: use barber_access_token
├── 13-barber-ratings.json           ← UPDATE: use barber_access_token
├── EverCut.postman_environment.json ← REWRITE: OTP + JWT variables only
└── README.md                        ← REWRITE: setup, run order, variables
```

# MSG91 OTP Integration Guide — EverCut Backend

> **Created:** March 14, 2026  
> **Scope:** Complete implementation guide for integrating MSG91 OTP authentication into the EverCut backend  
> **Prerequisite:** Read `OTP-AUTH-RESEARCH.md` for the full cost/feature comparison that led to this decision  
> **Target Codebase:** `server/src/` (Express 5 · ES Modules · Mongoose 9 · Joi validation)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [MSG91 Account & DLT Setup](#2-msg91-account--dlt-setup)
3. [Test / Sandbox Environment](#3-test--sandbox-environment)
4. [Environment Variables & Configuration](#4-environment-variables--configuration)
5. [New Dependencies](#5-new-dependencies)
6. [Implementation — Layer by Layer](#6-implementation--layer-by-layer)
   - [6.1 Constants](#61-constants)
   - [6.2 MSG91 Provider Service](#62-msg91-provider-service-sms-providerservicej)
   - [6.3 OTP Service](#63-otp-service)
   - [6.4 Auth Service Refactor](#64-auth-service-refactor)
   - [6.5 Validators](#65-validators)
   - [6.6 OTP Rate Limiter Middleware](#66-otp-rate-limiter-middleware)
   - [6.7 Controller](#67-controller)
   - [6.8 Routes](#68-routes)
   - [6.9 Authenticate Middleware Refactor](#69-authenticate-middleware-refactor)
   - [6.10 Route Index Update](#610-route-index-update)
7. [JWT Token Strategy](#7-jwt-token-strategy)
8. [User Model Changes](#8-user-model-changes)
9. [Migration Strategy — Firebase → MSG91](#9-migration-strategy--firebase--msg91)
10. [Security Best Practices](#10-security-best-practices)
11. [Error Handling](#11-error-handling)
12. [Future SMS Use Cases](#12-future-sms-use-cases)
13. [Pre-Launch Checklist](#13-pre-launch-checklist)
14. [File Map — All Changes at a Glance](#14-file-map--all-changes-at-a-glance)
15. [Legacy Firebase Cleanup — Post-Migration Removal](#15-legacy-firebase-cleanup--post-migration-removal)

---

## 1. Architecture Overview

### Current Flow (Firebase Phone Auth)

```
App → Firebase SDK (sends OTP) → User enters code → Firebase verifies
→ App gets Firebase ID Token → App sends token to Backend
→ authenticate.middleware.js verifies Firebase token via Admin SDK
→ req.user populated → session/onboarding proceeds
```

### Target Flow (MSG91 OTP + Custom JWT)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MSG91 OTP AUTH FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. App → POST /api/v1/auth/otp/send  { mobile: "9876543210" }      │
│       ↓                                                             │
│  2. Backend validates + rate-limits → calls MSG91 Send OTP API      │
│       ↓                                                             │
│  3. MSG91 delivers OTP via SMS (fallback: WhatsApp → Voice)         │
│       ↓                                                             │
│  4. User enters OTP in app                                          │
│       ↓                                                             │
│  5. App → POST /api/v1/auth/otp/verify  { mobile, otp }             │
│       ↓                                                             │
│  6. Backend calls MSG91 Verify OTP API                              │
│       ↓                                                             │
│  7. OTP valid → find or flag user in MongoDB                        │
│       ↓                                                             │
│  8. Backend issues { accessToken, refreshToken } via jsonwebtoken   │
│       ↓                                                             │
│  9. All subsequent requests use Bearer <accessToken>                │
│       ↓                                                             │
│  10. POST /api/v1/auth/token/refresh for new access token           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Mapping (follows existing project structure)

| Layer | Existing Pattern | New File(s) |
|---|---|---|
| **Config** | `config/index.js` | Add `msg91` + `jwt` sections |
| **Provider** | `config/firebase.config.js` | `services/sms-provider.service.js` |
| **Service** | `services/auth.service.js` | `services/otp.service.js` + refactored `auth.service.js` |
| **Validator** | `validators/auth.validator.js` | Expand with OTP schemas |
| **Controller** | `controllers/auth.controller.js` | Expand with OTP + token endpoints |
| **Route** | `routes/auth.routes.js` | Add OTP + token routes |
| **Middleware** | `middleware/authenticate.middleware.js` | Refactor for JWT; add `otp-rate-limiter.middleware.js` |
| **Model** | `models/user.model.js` | Add `refreshTokenHash` field |
| **Constants** | `utils/constants.js` | Add OTP-related constants |

---

## 2. MSG91 Account & DLT Setup

### 2.1 Create MSG91 Account

1. Sign up at [msg91.com](https://msg91.com)
2. Navigate to **Dashboard → OTP** → Create a new OTP configuration
3. Note your **Auth Key** from **Dashboard → API Keys**
4. Create an **OTP Template**:
   - Go to **OTP → Templates → Create Template**
   - Template text: `Your OTP for EverCut is {otp}. Valid for {expiry} minutes. Do not share this code.`
   - Set OTP length: **6 digits**
   - Set OTP expiry: **10 minutes**
   - Note the generated **Template ID**

### 2.2 DLT Registration (Mandatory for India Production)

> ⚠️ **Without DLT registration, MSG91 cannot deliver SMS in India.** Complete this before going live.

| Step | Action | Timeline | Cost |
|---|---|---|---|
| 1 | Register as **Principal Entity** on a DLT portal (Jio TrueConnect / Airtel DLT / Vi) | 1–3 working days | ~₹5,900/year (incl. GST) |
| 2 | Register **Sender ID** (Header): `EVRCUT` (6 chars, representing your brand) | 1–2 working days | ₹0 (included) |
| 3 | Register **OTP Template**: `Your OTP for EverCut is {#var#}. Valid for {#var#} minutes. Do not share this code.` | 1–2 working days | ₹0 (included) |
| 4 | **PE–TM Chain Binding**: Add MSG91 (Walkover Web Solutions) as your Telemarketer in the DLT portal | Immediate | ₹0 |
| 5 | In MSG91 Dashboard → **Settings → DLT**: Enter your DLT Entity ID, Sender ID, and approved Template ID | Immediate | ₹0 |

**Required Documents:**
- Company PAN Card
- GST Certificate (or Certificate of Incorporation)
- Authorized signatory ID proof (Aadhaar / PAN / Passport)
- Authorization Letter on company letterhead

---

## 3. Test / Sandbox Environment

Since DLT registration takes 1–2 weeks, use these strategies for development:

### 3.1 MSG91 Test Mode

MSG91 supports test OTP verification without sending real SMS:

```javascript
// In development, MSG91 allows using a test authkey or test mode
// where OTP is always a fixed value (e.g., "123456")

// Strategy: Use environment flag to bypass MSG91 API in development
if (config.env === 'development' && config.msg91.testMode) {
    // Accept any 6-digit OTP as valid
    // No actual API call to MSG91
}
```

### 3.2 Development Bypass (Recommended)

Create a test mode in `sms-provider.service.js` that:
- **Does NOT call MSG91 API** in development
- Accepts a hardcoded OTP (e.g., `123456`) for all numbers
- Logs the "sent" OTP to console for debugging
- Uses a configurable allowlist of test phone numbers

### 3.3 Staging with Real SMS

Once DLT is approved:
- Use a separate MSG91 project/auth key for staging
- Top up with minimal credits (~₹500) for testing
- Restrict to a whitelist of team phone numbers initially

---

## 4. Environment Variables & Configuration

### 4.1 Add to `.env.example`

```env
# ── MSG91 (OTP / SMS) ───────────────────────────────────────────────
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_OTP_TEMPLATE_ID=your_otp_template_id
MSG91_OTP_LENGTH=6
MSG91_OTP_EXPIRY=10
# Set to "true" in development to skip real SMS and accept test OTP
MSG91_TEST_MODE=false
MSG91_TEST_OTP=123456

# ── JWT (Custom Token Auth — replaces Firebase token verification) ──
JWT_ACCESS_SECRET=your_access_token_secret_min_64_chars_random
JWT_REFRESH_SECRET=your_refresh_token_secret_min_64_chars_different
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
```

### 4.2 Update `config/index.js`

Add two new frozen sections to the config object:

```javascript
/** MSG91 OTP */
msg91: Object.freeze({
    authKey: requireEnv('MSG91_AUTH_KEY'),
    otpTemplateId: requireEnv('MSG91_OTP_TEMPLATE_ID'),
    otpLength: parseInt(optionalEnv('MSG91_OTP_LENGTH', '6'), 10),
    otpExpiry: parseInt(optionalEnv('MSG91_OTP_EXPIRY', '10'), 10),
    testMode: optionalEnv('MSG91_TEST_MODE', 'false') === 'true',
    testOtp: optionalEnv('MSG91_TEST_OTP', '123456'),
    baseUrl: 'https://control.msg91.com/api/v5',
}),

/** JWT */
jwt: Object.freeze({
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiry: optionalEnv('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optionalEnv('JWT_REFRESH_EXPIRY', '30d'),
}),
```

> **Note:** During the migration period, keep the existing `firebase` config section intact. Remove it only after full migration is complete and the `firebaseUid`-based lookup is no longer needed.

---

## 5. New Dependencies

```bash
npm install jsonwebtoken
```

| Package | Purpose | Why Not Already Present |
|---|---|---|
| `jsonwebtoken` | Sign/verify access & refresh tokens | Firebase handled JWT previously |

> **MSG91 API calls use native `fetch`** (available in Node 18+). No additional HTTP client needed. If running Node < 18, install `node-fetch`.

---

## 6. Implementation — Layer by Layer

### 6.1 Constants

**File:** `src/utils/constants.js` — Add at the bottom:

```javascript
// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;          // max verify attempts per OTP session
export const OTP_RESEND_COOLDOWN_SEC = 30;  // seconds before allowing resend
export const OTP_RATE_LIMIT = Object.freeze({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxSendPerPhone: 5,          // max OTP sends per phone per window
    maxSendPerIp: 10,            // max OTP sends per IP per window
    maxVerifyPerPhone: 10,       // max verify attempts per phone per window
});

// ---------------------------------------------------------------------------
// Token Types
// ---------------------------------------------------------------------------

export const TOKEN_TYPE = Object.freeze({
    ACCESS: 'access',
    REFRESH: 'refresh',
});
```

---

### 6.2 MSG91 Provider Service (`sms-provider.service.js`)

**File:** `src/services/sms-provider.service.js`

This is an **abstracted SMS provider layer** — easily swappable to Twilio, AWS SNS, etc.

```javascript
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/api-error.js';

/**
 * SMS Provider Service — abstracts MSG91 OTP API.
 *
 * All MSG91 API communication is isolated here. To switch providers
 * (Twilio, 2Factor, etc.), only this file needs to change.
 */

const MSG91_ENDPOINTS = {
    sendOtp: `${config.msg91.baseUrl}/otp`,
    verifyOtp: `${config.msg91.baseUrl}/otp/verify`,
    resendOtp: `${config.msg91.baseUrl}/otp/retry`,
};

const msg91Headers = {
    authkey: config.msg91.authKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

/**
 * Send OTP to a mobile number via MSG91.
 *
 * @param {string} mobile — 10-digit Indian mobile number (without country code)
 * @returns {Promise<{ success: boolean, requestId: string|null }>}
 */
export const sendOtp = async (mobile) => {
    // ── Test mode bypass ────────────────────────────────────────────
    if (config.msg91.testMode) {
        logger.info('MSG91 test mode — OTP send bypassed', {
            mobile: mobile.slice(-4).padStart(mobile.length, '*'),
            testOtp: config.msg91.testOtp,
        });
        return { success: true, requestId: 'test-mode' };
    }

    // ── Production — call MSG91 API ─────────────────────────────────
    try {
        const response = await fetch(MSG91_ENDPOINTS.sendOtp, {
            method: 'POST',
            headers: msg91Headers,
            body: JSON.stringify({
                template_id: config.msg91.otpTemplateId,
                mobile: `91${mobile}`,
                otp_length: config.msg91.otpLength,
                otp_expiry: config.msg91.otpExpiry,
            }),
        });

        const data = await response.json();

        if (data.type === 'success') {
            logger.info('OTP sent successfully', {
                mobile: mobile.slice(-4).padStart(mobile.length, '*'),
                requestId: data.request_id,
            });
            return { success: true, requestId: data.request_id };
        }

        logger.warn('MSG91 OTP send failed', {
            mobile: mobile.slice(-4).padStart(mobile.length, '*'),
            response: data,
        });
        return { success: false, requestId: null };
    } catch (err) {
        logger.error('MSG91 API error (sendOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};

/**
 * Verify OTP for a mobile number via MSG91.
 *
 * @param {string} mobile — 10-digit Indian mobile number
 * @param {string} otp    — user-entered OTP
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const verifyOtp = async (mobile, otp) => {
    // ── Test mode bypass ────────────────────────────────────────────
    if (config.msg91.testMode) {
        const isValid = otp === config.msg91.testOtp;
        logger.info('MSG91 test mode — OTP verify bypassed', {
            mobile: mobile.slice(-4).padStart(mobile.length, '*'),
            valid: isValid,
        });
        return {
            success: isValid,
            message: isValid ? 'OTP verified (test mode)' : 'Invalid OTP (test mode)',
        };
    }

    // ── Production — call MSG91 API ─────────────────────────────────
    try {
        const url = `${MSG91_ENDPOINTS.verifyOtp}?mobile=91${mobile}&otp=${otp}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { authkey: config.msg91.authKey },
        });

        const data = await response.json();

        return {
            success: data.type === 'success',
            message: data.message || (data.type === 'success' ? 'OTP verified' : 'Invalid or expired OTP'),
        };
    } catch (err) {
        logger.error('MSG91 API error (verifyOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};

/**
 * Resend OTP via a different channel.
 *
 * @param {string} mobile      — 10-digit Indian mobile number
 * @param {'text'|'voice'} retryType — channel to retry on
 * @returns {Promise<{ success: boolean }>}
 */
export const resendOtp = async (mobile, retryType = 'text') => {
    if (config.msg91.testMode) {
        logger.info('MSG91 test mode — OTP resend bypassed', {
            mobile: mobile.slice(-4).padStart(mobile.length, '*'),
        });
        return { success: true };
    }

    try {
        const response = await fetch(MSG91_ENDPOINTS.resendOtp, {
            method: 'POST',
            headers: msg91Headers,
            body: JSON.stringify({
                mobile: `91${mobile}`,
                retrytype: retryType,
            }),
        });

        const data = await response.json();
        return { success: data.type === 'success' };
    } catch (err) {
        logger.error('MSG91 API error (resendOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};
```

---

### 6.3 OTP Service

**File:** `src/services/otp.service.js`

Orchestrates the OTP flow — coordinates between the SMS provider and auth logic.

```javascript
import * as smsProvider from './sms-provider.service.js';
import { BadRequestError, TooManyRequestsError } from '../utils/api-error.js';
import { OTP_RATE_LIMIT } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * In-memory rate limit store.
 *
 * For production at scale, replace with Redis (e.g., ioredis).
 * Structure: Map<key, { count, resetAt }>
 */
const rateLimitStore = new Map();

const checkRateLimit = (key, maxAttempts) => {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + OTP_RATE_LIMIT.windowMs });
        return;
    }

    if (entry.count >= maxAttempts) {
        const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
        throw new TooManyRequestsError(
            `Too many attempts. Please try again after ${retryAfterSec} seconds.`,
        );
    }

    entry.count += 1;
};

// Periodically clean up expired entries (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}, 5 * 60 * 1000).unref();

/**
 * Request OTP for a mobile number.
 */
export const requestOtp = async (mobile, clientIp) => {
    // Rate limit by phone number
    checkRateLimit(`send:phone:${mobile}`, OTP_RATE_LIMIT.maxSendPerPhone);
    // Rate limit by IP
    checkRateLimit(`send:ip:${clientIp}`, OTP_RATE_LIMIT.maxSendPerIp);

    const result = await smsProvider.sendOtp(mobile);

    if (!result.success) {
        throw new BadRequestError('Failed to send OTP. Please try again.');
    }

    return { message: 'OTP sent successfully' };
};

/**
 * Verify OTP for a mobile number.
 */
export const verifyOtp = async (mobile, otp, clientIp) => {
    // Rate limit verification attempts
    checkRateLimit(`verify:phone:${mobile}`, OTP_RATE_LIMIT.maxVerifyPerPhone);

    const result = await smsProvider.verifyOtp(mobile, otp);

    if (!result.success) {
        throw new BadRequestError(result.message || 'Invalid or expired OTP');
    }

    return { verified: true };
};

/**
 * Resend OTP via alternative channel.
 */
export const resendOtp = async (mobile, retryType, clientIp) => {
    checkRateLimit(`send:phone:${mobile}`, OTP_RATE_LIMIT.maxSendPerPhone);
    checkRateLimit(`send:ip:${clientIp}`, OTP_RATE_LIMIT.maxSendPerIp);

    const result = await smsProvider.resendOtp(mobile, retryType);

    if (!result.success) {
        throw new BadRequestError('Failed to resend OTP. Please try again.');
    }

    return { message: `OTP resent via ${retryType}` };
};
```

---

### 6.4 Auth Service Refactor

**File:** `src/services/auth.service.js` — Refactor to support JWT-based auth alongside the existing Firebase session logic during migration.

```javascript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import userRepository from '../repositories/user.repository.js';
import customerProfileRepo from '../repositories/customer-profile.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import { serializeBarberProfile } from '../utils/barber-profile.utils.js';
import { ROLES, TOKEN_TYPE } from '../utils/constants.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

// ── Token generation ──────────────────────────────────────────────────────

/**
 * Generate a pair of access + refresh tokens.
 */
export const generateTokenPair = (userId, roleType) => {
    const accessToken = jwt.sign(
        { sub: userId.toString(), role: roleType, type: TOKEN_TYPE.ACCESS },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiry },
    );

    const refreshToken = jwt.sign(
        { sub: userId.toString(), type: TOKEN_TYPE.REFRESH },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiry },
    );

    return { accessToken, refreshToken };
};

/**
 * Verify an access token and return decoded payload.
 */
export const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        if (decoded.type !== TOKEN_TYPE.ACCESS) {
            throw new UnauthorizedError('Invalid token type');
        }
        return decoded;
    } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError('Invalid or expired access token');
    }
};

/**
 * Verify a refresh token and return decoded payload.
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.refreshSecret);
        if (decoded.type !== TOKEN_TYPE.REFRESH) {
            throw new UnauthorizedError('Invalid token type');
        }
        return decoded;
    } catch {
        throw new UnauthorizedError('Invalid or expired refresh token');
    }
};

/**
 * Hash a refresh token for secure storage (never store raw tokens in DB).
 */
export const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// ── Session resolution ────────────────────────────────────────────────────

/**
 * Resolve user session after OTP verification.
 * Called after OTP is successfully verified — finds or flags as new user.
 *
 * @param {string} phoneNumber — verified phone number (10-digit)
 * @returns {{ isNewUser, user?, profile?, tokens?, phoneNumber? }}
 */
export const resolveOtpSession = async (phoneNumber) => {
    const formattedPhone = phoneNumber.startsWith('+91')
        ? phoneNumber
        : `+91${phoneNumber}`;

    const existingUser = await userRepository.findByPhone(formattedPhone);

    if (existingUser) {
        await userRepository.updateLastLogin(existingUser._id);

        const tokens = generateTokenPair(existingUser._id, existingUser.roleType);

        // Store hashed refresh token
        const refreshHash = hashToken(tokens.refreshToken);
        await userRepository.updateById(existingUser._id, { refreshTokenHash: refreshHash });

        let profile = null;
        if (existingUser.roleType === ROLES.CUSTOMER) {
            profile = await customerProfileRepo.findByUserId(existingUser._id);
        } else if (existingUser.roleType === ROLES.BARBER) {
            const shop = await shopRepository.findByOwnerId(existingUser._id);
            if (shop) {
                const photos = await photoRepository.findByShopId(shop._id, {});
                profile = serializeBarberProfile(shop, { photos });
            }
        }

        return {
            isNewUser: false,
            user: existingUser,
            profile,
            tokens,
        };
    }

    // New user — needs onboarding. No tokens issued yet.
    return {
        isNewUser: true,
        phoneNumber: formattedPhone,
    };
};

/**
 * Refresh an access token using a valid refresh token.
 */
export const refreshAccessToken = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.sub;

    const user = await userRepository.findById(userId);
    if (!user || !user.isActive || user.deletedAt) {
        throw new UnauthorizedError('Account is inactive or deleted');
    }

    // Verify the refresh token matches what's stored (rotation check)
    const incomingHash = hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingHash) {
        // Possible token theft — invalidate all sessions
        logger.warn('Refresh token mismatch — possible token theft', { userId });
        await userRepository.updateById(userId, { refreshTokenHash: null });
        throw new UnauthorizedError('Session invalidated. Please sign in again.');
    }

    // Issue new token pair (token rotation)
    const tokens = generateTokenPair(user._id, user.roleType);
    const newRefreshHash = hashToken(tokens.refreshToken);
    await userRepository.updateById(userId, { refreshTokenHash: newRefreshHash });

    return tokens;
};

/**
 * Invalidate refresh token (logout).
 */
export const revokeRefreshToken = async (userId) => {
    await userRepository.updateById(userId, { refreshTokenHash: null });
};

// ── Legacy Firebase session (keep during migration) ────────────────────

/**
 * @deprecated — Will be removed after full MSG91 migration.
 */
export const createSession = async (firebaseUid, authContext = {}) => {
    const existingUser = await userRepository.findByFirebaseUid(firebaseUid);

    if (existingUser) {
        await userRepository.updateLastLogin(existingUser._id);

        let profile = null;
        if (existingUser.roleType === ROLES.CUSTOMER) {
            profile = await customerProfileRepo.findByUserId(existingUser._id);
        } else if (existingUser.roleType === ROLES.BARBER) {
            const shop = await shopRepository.findByOwnerId(existingUser._id);
            if (shop) {
                const photos = await photoRepository.findByShopId(shop._id, {});
                profile = serializeBarberProfile(shop, { photos });
            }
        }

        return { isNewUser: false, user: existingUser, profile };
    }

    return {
        isNewUser: true,
        firebaseUid,
        phoneNumber: authContext.phoneNumber,
        email: authContext.email || null,
    };
};
```

---

### 6.5 Validators

**File:** `src/validators/auth.validator.js` — Replace the empty schema with comprehensive OTP validation:

```javascript
import Joi from 'joi';

/**
 * Indian mobile number: exactly 10 digits, starting with 6-9.
 */
const indianMobile = Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
        'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number',
        'any.required': 'Mobile number is required',
    });

/**
 * POST /auth/otp/send
 */
export const sendOtpSchema = Joi.object({
    mobile: indianMobile,
});

/**
 * POST /auth/otp/verify
 */
export const verifyOtpSchema = Joi.object({
    mobile: indianMobile,
    otp: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.pattern.base': 'OTP must be exactly 6 digits',
            'any.required': 'OTP is required',
        }),
});

/**
 * POST /auth/otp/resend
 */
export const resendOtpSchema = Joi.object({
    mobile: indianMobile,
    retryType: Joi.string()
        .valid('text', 'voice')
        .default('text')
        .messages({
            'any.only': 'retryType must be "text" or "voice"',
        }),
});

/**
 * POST /auth/token/refresh
 */
export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required',
    }),
});

/**
 * @deprecated — Legacy Firebase session schema (keep during migration).
 */
export const sessionSchema = Joi.object({});
```

---

### 6.6 OTP Rate Limiter Middleware

**File:** `src/middleware/otp-rate-limiter.middleware.js`

> The OTP service has in-memory rate limiting, but this middleware adds an **additional express-level guard** using the existing `TooManyRequestsError`:

```javascript
import { TooManyRequestsError } from '../utils/api-error.js';

/**
 * Simple sliding-window rate limiter for OTP endpoints.
 *
 * For production at scale, replace the in-memory Map with Redis
 * or use a dedicated rate-limiting library (e.g., rate-limiter-flexible).
 */

const store = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
    }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * @param {Object} options
 * @param {number} options.windowMs   — time window in ms
 * @param {number} options.max        — max requests per window
 * @param {string} options.keyPrefix  — prefix for the rate limit key
 * @param {'ip'|'body.mobile'} options.keySource — what to rate-limit by
 */
export const otpRateLimiter = ({ windowMs, max, keyPrefix, keySource = 'ip' }) => {
    return (req, _res, next) => {
        const keyValue = keySource === 'ip'
            ? req.ip
            : req.body?.mobile || req.ip;

        const key = `${keyPrefix}:${keyValue}`;
        const now = Date.now();
        const entry = store.get(key);

        if (!entry || now > entry.resetAt) {
            store.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (entry.count >= max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            return next(
                new TooManyRequestsError(
                    `Too many requests. Please try again after ${retryAfter} seconds.`,
                ),
            );
        }

        entry.count += 1;
        next();
    };
};
```

---

### 6.7 Controller

**File:** `src/controllers/auth.controller.js` — Expand to handle OTP + token endpoints:

```javascript
import * as otpService from '../services/otp.service.js';
import * as authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.js';

/**
 * POST /auth/otp/send — Request OTP
 */
export const sendOtp = async (req, res, next) => {
    try {
        const { mobile } = req.body;
        const result = await otpService.requestOtp(mobile, req.ip);
        return res.status(200).json(ApiResponse.success(result, 'OTP sent successfully'));
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/otp/verify — Verify OTP and authenticate
 */
export const verifyOtp = async (req, res, next) => {
    try {
        const { mobile, otp } = req.body;

        // Step 1: Verify OTP with MSG91
        await otpService.verifyOtp(mobile, otp, req.ip);

        // Step 2: Resolve session (find existing user or flag as new)
        const session = await authService.resolveOtpSession(mobile);

        if (session.isNewUser) {
            return res.status(200).json(
                ApiResponse.success(
                    { isNewUser: true, phoneNumber: session.phoneNumber },
                    'OTP verified. Please complete your profile.',
                ),
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                {
                    isNewUser: false,
                    user: session.user,
                    profile: session.profile,
                    accessToken: session.tokens.accessToken,
                    refreshToken: session.tokens.refreshToken,
                },
                'Login successful',
            ),
        );
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/otp/resend — Resend OTP via alternative channel
 */
export const resendOtp = async (req, res, next) => {
    try {
        const { mobile, retryType } = req.body;
        const result = await otpService.resendOtp(mobile, retryType, req.ip);
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/token/refresh — Refresh access token
 */
export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken: token } = req.body;
        const tokens = await authService.refreshAccessToken(token);
        return res.status(200).json(
            ApiResponse.success(tokens, 'Token refreshed successfully'),
        );
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/logout — Revoke refresh token
 */
export const logout = async (req, res, next) => {
    try {
        await authService.revokeRefreshToken(req.user._id);
        return res.status(200).json(ApiResponse.success(null, 'Logged out successfully'));
    } catch (err) {
        next(err);
    }
};

/**
 * @deprecated — Legacy Firebase session (keep during migration)
 * POST /auth/session
 */
export const createSession = async (req, res, next) => {
    try {
        const { firebaseUid, phoneNumber, email } = req.user;
        const result = await authService.createSession(firebaseUid, { phoneNumber, email });

        if (result.isNewUser) {
            return res.status(200).json(
                ApiResponse.success(
                    {
                        isNewUser: true,
                        firebaseUid: result.firebaseUid,
                        phoneNumber: result.phoneNumber,
                        email: result.email,
                    },
                    'New user. Please complete your profile.',
                ),
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                { isNewUser: false, user: result.user, profile: result.profile },
                'Login successful',
            ),
        );
    } catch (err) {
        next(err);
    }
};
```

---

### 6.8 Routes

**File:** `src/routes/auth.routes.js` — Expand with OTP + token routes:

```javascript
import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { otpRateLimiter } from '../middleware/otp-rate-limiter.middleware.js';
import {
    sendOtpSchema,
    verifyOtpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    sessionSchema,
} from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';
import { OTP_RATE_LIMIT } from '../utils/constants.js';

const router = Router();

// ── OTP Endpoints (Public — no auth required) ──────────────────────────

/**
 * POST /api/v1/auth/otp/send
 * Request OTP for phone number authentication.
 */
router.post(
    '/otp/send',
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxSendPerIp,
        keyPrefix: 'otp-send-ip',
        keySource: 'ip',
    }),
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxSendPerPhone,
        keyPrefix: 'otp-send-phone',
        keySource: 'body.mobile',
    }),
    validate(sendOtpSchema, 'body'),
    authController.sendOtp,
);

/**
 * POST /api/v1/auth/otp/verify
 * Verify OTP and authenticate user.
 */
router.post(
    '/otp/verify',
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxVerifyPerPhone,
        keyPrefix: 'otp-verify',
        keySource: 'body.mobile',
    }),
    validate(verifyOtpSchema, 'body'),
    authController.verifyOtp,
);

/**
 * POST /api/v1/auth/otp/resend
 * Resend OTP via text or voice channel.
 */
router.post(
    '/otp/resend',
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxSendPerPhone,
        keyPrefix: 'otp-resend',
        keySource: 'body.mobile',
    }),
    validate(resendOtpSchema, 'body'),
    authController.resendOtp,
);

// ── Token Endpoints ─────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/token/refresh
 * Refresh access token using a valid refresh token.
 */
router.post(
    '/token/refresh',
    validate(refreshTokenSchema, 'body'),
    authController.refreshToken,
);

/**
 * POST /api/v1/auth/logout
 * Revoke refresh token (requires authentication).
 */
router.post('/logout', authenticate, authController.logout);

// ── Legacy Firebase Session (keep during migration) ─────────────────────

/**
 * @deprecated — Will be removed after full MSG91 migration.
 * POST /api/v1/auth/session
 */
router.post('/session', authenticate, validate(sessionSchema, 'body'), authController.createSession);

export default router;
```

---

### 6.9 Authenticate Middleware Refactor

**File:** `src/middleware/authenticate.middleware.js` — Support **both** JWT (new) and Firebase tokens (legacy) during migration:

```javascript
import admin from '../config/firebase.config.js';
import * as authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * Authenticate middleware — supports both JWT (MSG91 flow) and Firebase tokens.
 *
 * Detection strategy:
 *   - JWT tokens from jsonwebtoken start with "eyJ" (base64 JSON header)
 *     and contain exactly 2 dots (header.payload.signature)
 *   - Firebase ID tokens also start with "eyJ" and have 2 dots,
 *     but we attempt JWT verification first (faster, no network call)
 *   - If JWT verification fails, fall back to Firebase verification
 *
 * After full migration, remove the Firebase fallback entirely.
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) throw new UnauthorizedError('No token provided');

        // ── Try JWT verification first (MSG91 flow) ──────────────────
        try {
            const decoded = authService.verifyAccessToken(token);
            const user = await userRepository.findById(decoded.sub);

            if (!user || user.deletedAt || user.isActive === false) {
                throw new UnauthorizedError('Account is inactive or deleted');
            }

            req.user = {
                _id: user._id,
                firebaseUid: user.firebaseUid,
                roleType: user.roleType,
                phoneNumber: user.phoneNumber,
                email: user.email,
            };

            return next();
        } catch (jwtErr) {
            // If the token was clearly a JWT but invalid, don't try Firebase
            if (jwtErr instanceof UnauthorizedError && jwtErr.message !== 'Invalid or expired access token') {
                return next(jwtErr);
            }
            // Otherwise, fall through to Firebase verification
        }

        // ── Fallback: Firebase token verification (legacy) ───────────
        const decoded = await admin.auth().verifyIdToken(token, true);
        const user = await userRepository.findByFirebaseUid(decoded.uid, { includeDeleted: true });

        if (user?.deletedAt || user?.isActive === false) {
            return next(new UnauthorizedError('This account has been deleted.'));
        }

        if (user) {
            req.user = {
                _id: user._id,
                firebaseUid: user.firebaseUid,
                roleType: user.roleType,
                phoneNumber: user.phoneNumber,
                email: user.email,
            };
        } else {
            req.user = {
                firebaseUid: decoded.uid,
                phoneNumber: decoded.phone_number,
                email: decoded.email || null,
                isNewUser: true,
            };
        }

        next();
    } catch (err) {
        if (err instanceof UnauthorizedError) return next(err);
        if (['auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(err.code)) {
            return next(new UnauthorizedError('Session is no longer valid. Please sign in again.'));
        }
        logger.warn('Token verification failed', { error: err.message });
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

export default authenticate;
```

---

### 6.10 Route Index Update

**File:** `src/routes/index.js` — No changes needed. The auth routes are already mounted at `/auth`, and the new OTP endpoints are sub-routes under that prefix (e.g., `/api/v1/auth/otp/send`).

---

## 7. JWT Token Strategy

| Aspect | Value | Rationale |
|---|---|---|
| **Access Token Expiry** | 15 minutes | Short-lived to minimize attack window |
| **Refresh Token Expiry** | 30 days | Avoids frequent re-authentication for mobile users |
| **Signing Algorithm** | HS256 (HMAC-SHA256) | Sufficient for single-backend apps; switch to RS256 for multi-service |
| **Storage (Client)** | Secure storage (Keychain/Keystore) | Never in plain localStorage on web |
| **Storage (Server)** | SHA-256 hash of refresh token in User model | Never store raw refresh tokens |
| **Rotation** | Every refresh issues new pair | Detects token theft via hash mismatch |
| **Revocation** | Set `refreshTokenHash` to null | Immediate logout / sign-out-everywhere |

---

## 8. User Model Changes

**File:** `src/models/user.model.js` — Add `refreshTokenHash` field:

```javascript
// Add inside the schema definition, after `deletedAt`:
refreshTokenHash: {
    type: String,
    default: null,
    select: false,  // Don't include in default queries
},
```

> **Note:** The `firebaseUid` field stays during migration. After full migration, it can be made optional (`required: false`) and eventually removed. The `phoneNumber` field becomes the primary identity key — ensure its unique index is enforced.

When querying for refresh token validation, use `.select('+refreshTokenHash')`:

```javascript
// In user.repository.js — add a new method:
async findByIdWithRefreshHash(id) {
    return User.findById(id).select('+refreshTokenHash');
}
```

Update `authService.refreshAccessToken()` to use this method instead of `findById()`.

---

## 9. Migration Strategy — Firebase → MSG91

### Phase 1: Parallel Support (Weeks 1–2)

- Deploy MSG91 OTP endpoints alongside existing Firebase auth
- `authenticate.middleware.js` accepts **both** JWT and Firebase tokens
- New app versions use MSG91 flow; old versions continue using Firebase
- Both `firebaseUid` and `phoneNumber` lookups coexist

### Phase 2: Client Migration (Weeks 3–4)

- Update mobile app to use MSG91 OTP flow exclusively
- Force-update old app versions (or show upgrade prompt)
- Monitor Firebase Auth usage — should drop to zero

### Phase 3: Firebase Cleanup (Week 5+)

- Remove Firebase token verification from `authenticate.middleware.js`
- Remove `firebase-admin` dependency from `package.json`
- Remove `config/firebase.config.js`
- Delete `firebase-admin-sdk.json`
- Remove Firebase env vars from `.env` and `.env.example`
- Make `firebaseUid` optional in User model (keep for historical data)
- Remove `POST /auth/session` route

---

## 10. Security Best Practices

| Practice | Implementation |
|---|---|
| **Never expose MSG91 auth key** | Only in `.env`, never in client code. All API calls are server-side only. |
| **Rate limiting (OTP send)** | 5 per phone / 10 per IP per 15-minute window |
| **Rate limiting (OTP verify)** | 10 per phone per 15-minute window |
| **Input validation** | Joi schemas for all endpoints; 10-digit Indian mobile regex |
| **Phone number normalization** | Always store with `+91` prefix; validate before MSG91 API call |
| **JWT secrets** | Minimum 64 characters of cryptographic randomness; different for access vs refresh |
| **Refresh token rotation** | New pair on every refresh; hash mismatch = possible theft → revoke all |
| **Token storage (DB)** | SHA-256 hash only; never store raw refresh tokens |
| **HTTPS only** | Enforce in production (CORS, secure cookies, HSTS) |
| **Sensitive data logging** | Phone numbers are masked to last 4 digits in all logs |
| **OTP timing attack** | MSG91 handles timing-safe comparison server-side |
| **DLT template lock** | OTP message text is fixed at the DLT level — cannot be injected |
| **Test mode isolation** | `MSG91_TEST_MODE=true` only works when `NODE_ENV=development` (add guard) |

### Production Test Mode Guard

Add this safety check in `sms-provider.service.js`:

```javascript
if (config.msg91.testMode && config.env === 'production') {
    logger.error('CRITICAL: MSG91 test mode is enabled in production!');
    throw new AppError('Configuration error', 500);
}
```

---

## 11. Error Handling

All errors follow the existing `AppError` hierarchy and are caught by `error-handler.middleware.js`:

| Scenario | Error Class | HTTP Status | Message |
|---|---|---|---|
| Invalid mobile format | `BadRequestError` | 400 | Joi validation message |
| Invalid OTP format | `BadRequestError` | 400 | "OTP must be exactly 6 digits" |
| Wrong/expired OTP | `BadRequestError` | 400 | "Invalid or expired OTP" |
| OTP send failure | `BadRequestError` | 400 | "Failed to send OTP" |
| MSG91 API unavailable | `AppError` | 503 | "SMS service unavailable" |
| Rate limit exceeded | `TooManyRequestsError` | 429 | "Too many requests…" |
| Invalid/expired access token | `UnauthorizedError` | 401 | "Invalid or expired access token" |
| Invalid refresh token | `UnauthorizedError` | 401 | "Invalid or expired refresh token" |
| Refresh token mismatch (theft) | `UnauthorizedError` | 401 | "Session invalidated" |
| Deleted/inactive account | `UnauthorizedError` | 401 | "Account is inactive or deleted" |

---

## 12. Future SMS Use Cases

The `sms-provider.service.js` abstraction layer is designed to support future SMS needs beyond OTP:

| Use Case | How to Extend |
|---|---|
| **Booking confirmation SMS** | Add `sendTransactionalSms(mobile, templateId, variables)` to `sms-provider.service.js`. Register a new DLT template for booking confirmations. |
| **Appointment reminders** | Same as above with a scheduled job (e.g., `node-cron` or Bull queue). |
| **Promotional SMS** | Use MSG91's Campaign API. Register a promotional DLT template. Different sender ID category (promotional vs transactional). |
| **WhatsApp notifications** | MSG91 supports WhatsApp Business API. Add `sendWhatsAppMessage()` to the provider service. |
| **Multi-country OTP** | Update `sendOtp()` to accept a country code parameter. Remove the hardcoded `91` prefix. |
| **Switching providers** | Create a new provider file (e.g., `twilio-provider.service.js`) with the same exported function signatures. Swap the import in `otp.service.js`. |

### Provider Interface Contract

Any future SMS provider must export these functions:

```javascript
export const sendOtp = async (mobile) => { /* returns { success, requestId } */ };
export const verifyOtp = async (mobile, otp) => { /* returns { success, message } */ };
export const resendOtp = async (mobile, retryType) => { /* returns { success } */ };
```

---

## 13. Pre-Launch Checklist

### MSG91 & DLT

- [ ] MSG91 account created and Auth Key obtained
- [ ] OTP template created in MSG91 dashboard (note Template ID)
- [ ] DLT Entity Registration submitted (Jio/Airtel/Vi) — ~1–2 weeks
- [ ] DLT Sender ID registered: `EVRCUT`
- [ ] DLT OTP template text approved
- [ ] PE–TM chain binding: MSG91 (Walkover) added as Telemarketer
- [ ] DLT Entity ID + Sender ID + Template ID configured in MSG91 dashboard
- [ ] Calendar reminder set for annual DLT renewal (~₹5,900/year)

### Backend

- [ ] `jsonwebtoken` installed (`npm install jsonwebtoken`)
- [ ] All env vars added to `.env` and `.env.example`
- [ ] `config/index.js` updated with `msg91` and `jwt` sections
- [ ] `sms-provider.service.js` created and tested
- [ ] `otp.service.js` created and tested
- [ ] `auth.service.js` refactored with JWT + OTP session logic
- [ ] `auth.validator.js` updated with all OTP/token schemas
- [ ] `otp-rate-limiter.middleware.js` created
- [ ] `auth.controller.js` expanded with OTP/token/logout handlers
- [ ] `auth.routes.js` expanded with all new routes
- [ ] `authenticate.middleware.js` refactored for dual-mode (JWT + Firebase)
- [ ] `user.model.js` updated with `refreshTokenHash` field
- [ ] `user.repository.js` updated with `findByIdWithRefreshHash()`
- [ ] `constants.js` updated with OTP constants and TOKEN_TYPE
- [ ] Test mode guard added for production safety
- [ ] All OTP endpoints tested with Postman (test mode)
- [ ] Refresh token rotation tested (happy path + theft detection)
- [ ] Rate limiting tested (send + verify)

### Security

- [ ] JWT secrets generated (64+ chars, cryptographically random)
- [ ] Different secrets for access vs refresh tokens
- [ ] MSG91 Auth Key in `.env` only, never in client code
- [ ] Phone numbers masked in all log output
- [ ] Rate limits configured and tested
- [ ] CORS origins restricted in production
- [ ] HTTPS enforced in production

### Client (Mobile App)

- [ ] App updated to use `/auth/otp/send` and `/auth/otp/verify`
- [ ] Token storage uses device secure storage (Keychain/Keystore)
- [ ] Auto-refresh logic implemented using `/auth/token/refresh`
- [ ] Logout calls `/auth/logout`
- [ ] Error handling for 401 (auto-redirect to login)
- [ ] Error handling for 429 (show retry timer to user)

---

## 14. File Map — All Changes at a Glance

```
server/
├── .env.example                          ← ADD: MSG91 + JWT env vars
├── package.json                          ← ADD: jsonwebtoken dependency
└── src/
    ├── config/
    │   └── index.js                      ← ADD: msg91 + jwt config sections
    ├── controllers/
    │   └── auth.controller.js            ← EXPAND: sendOtp, verifyOtp, resendOtp,
    │                                        refreshToken, logout (keep createSession)
    ├── middleware/
    │   ├── authenticate.middleware.js     ← REFACTOR: JWT-first with Firebase fallback
    │   └── otp-rate-limiter.middleware.js ← NEW: rate limiter for OTP endpoints
    ├── models/
    │   └── user.model.js                 ← ADD: refreshTokenHash field
    ├── repositories/
    │   └── user.repository.js            ← ADD: findByIdWithRefreshHash()
    ├── routes/
    │   └── auth.routes.js                ← EXPAND: OTP + token + logout routes
    ├── services/
    │   ├── auth.service.js               ← REFACTOR: JWT tokens, OTP session,
    │   │                                    refresh rotation (keep createSession)
    │   ├── otp.service.js                ← NEW: OTP orchestration + rate limiting
    │   └── sms-provider.service.js       ← NEW: MSG91 API abstraction layer
    ├── utils/
    │   └── constants.js                  ← ADD: OTP constants, TOKEN_TYPE
    └── validators/
        └── auth.validator.js             ← EXPAND: sendOtp, verifyOtp, resendOtp,
                                             refreshToken schemas
```

### New Files (3)

| File | Purpose |
|---|---|
| `services/sms-provider.service.js` | Abstracted MSG91 API layer (send, verify, resend) |
| `services/otp.service.js` | OTP orchestration with rate limiting |
| `middleware/otp-rate-limiter.middleware.js` | Express middleware for OTP endpoint rate limiting |

### Modified Files (8)

| File | Change |
|---|---|
| `.env.example` | Add MSG91 + JWT environment variables |
| `package.json` | Add `jsonwebtoken` dependency |
| `config/index.js` | Add `msg91` and `jwt` config sections |
| `models/user.model.js` | Add `refreshTokenHash` field |
| `repositories/user.repository.js` | Add `findByIdWithRefreshHash()` method |
| `validators/auth.validator.js` | Replace with comprehensive OTP/token schemas |
| `controllers/auth.controller.js` | Add OTP + token + logout handlers |
| `routes/auth.routes.js` | Add OTP + token + logout routes with rate limiting |
| `middleware/authenticate.middleware.js` | Dual-mode JWT + Firebase support |
| `utils/constants.js` | Add OTP and token type constants |

---

## API Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/otp/send` | ❌ Public | Send OTP to phone number |
| `POST` | `/api/v1/auth/otp/verify` | ❌ Public | Verify OTP + authenticate |
| `POST` | `/api/v1/auth/otp/resend` | ❌ Public | Resend OTP (text/voice) |
| `POST` | `/api/v1/auth/token/refresh` | ❌ Public | Refresh access token |
| `POST` | `/api/v1/auth/logout` | ✅ Required | Revoke refresh token |
| `POST` | `/api/v1/auth/session` | ✅ Firebase | *(Legacy — remove post-migration)* |

---

## 15. Legacy Firebase Cleanup — Post-Migration Removal

> ⚠️ **Do NOT execute this section until ALL of the following conditions are met.** Premature removal will break authentication for users still on older app versions.

### 15.1 Pre-Cleanup Verification Checklist

Before removing any Firebase code, confirm **every** item below:

- [ ] **All client apps** (iOS, Android, Web) have been updated to use the MSG91 OTP flow exclusively
- [ ] **No active users** are authenticating via Firebase Phone Auth (check server logs for `verifyIdToken` calls — should be zero over a 2-week observation window)
- [ ] **All existing users** in the `users` collection have a valid `phoneNumber` field (the new primary identity key)
- [ ] **JWT-based authentication** is fully operational — all protected endpoints work with the new access tokens
- [ ] **Token refresh** flow is verified — users can refresh access tokens without re-authenticating
- [ ] **Onboarding flow** works end-to-end using phone number identity (not `firebaseUid`)
- [ ] **Account deletion** works without Firebase (see Step 15.5 below)
- [ ] **Sign-out-everywhere** works using JWT revocation (see Step 15.5 below)
- [ ] **Old app versions** are either force-updated or have been sunset with an upgrade prompt
- [ ] **A database backup** has been taken before making any schema changes

---

### 15.2 Step 1 — Remove Firebase Config

#### 15.2.1 Delete `src/config/firebase.config.js`

```bash
rm src/config/firebase.config.js
```

This file initializes the Firebase Admin SDK singleton. It is no longer needed.

#### 15.2.2 Delete `firebase-admin-sdk.json`

```bash
rm firebase-admin-sdk.json
```

This is the Firebase service account credentials file at the project root.

#### 15.2.3 Remove Firebase section from `src/config/index.js`

Remove the entire `firebase` block:

```diff
  const config = Object.freeze({
    /** Application */
    env: optionalEnv('NODE_ENV', 'development'),
    port: parseInt(optionalEnv('PORT', '5001'), 10),
    apiPrefix: '/api/v1',

    /** MongoDB */
    mongo: Object.freeze({
      uri: requireEnv('MONGODB_URI'),
    }),

-   /** Firebase */
-   firebase: Object.freeze({
-     projectId: requireEnv('FIREBASE_PROJECT_ID'),
-     clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
-     privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
-   }),
-
    /** MSG91 OTP */
    msg91: Object.freeze({
```

#### 15.2.4 Remove Firebase environment variables

**From `.env`:**

```diff
- FIREBASE_PROJECT_ID=your_firebase_project_id
- FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
- FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
- FIREBASE_API_KEY=your_web_api_key
```

**From `.env.example`:** Remove the same 4 variables and the `# ── Firebase` section header.

---

### 15.3 Step 2 — Remove Firebase from Authenticate Middleware

**File:** `src/middleware/authenticate.middleware.js`

During migration, this file was refactored for dual-mode (JWT-first + Firebase fallback). Now remove the Firebase fallback entirely:

```javascript
import * as authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * Authenticate middleware — verifies JWT access token.
 *
 * On success, attaches to `req.user`:
 *   - _id            (MongoDB ObjectId)
 *   - roleType       ('CUSTOMER' | 'BARBER' | 'ADMIN')
 *   - phoneNumber
 *   - email
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) throw new UnauthorizedError('No token provided');

        const decoded = authService.verifyAccessToken(token);
        const user = await userRepository.findById(decoded.sub);

        if (!user || user.deletedAt || user.isActive === false) {
            throw new UnauthorizedError('Account is inactive or deleted');
        }

        req.user = {
            _id: user._id,
            roleType: user.roleType,
            phoneNumber: user.phoneNumber,
            email: user.email,
        };

        next();
    } catch (err) {
        if (err instanceof UnauthorizedError) return next(err);
        logger.warn('Token verification failed', { error: err.message });
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

export default authenticate;
```

**Key changes:**
- Removed `import admin from '../config/firebase.config.js'`
- Removed the entire Firebase `verifyIdToken` fallback block
- Removed `firebaseUid` from the `req.user` object
- Removed Firebase-specific error code handling (`auth/id-token-revoked`, etc.)

---

### 15.4 Step 3 — Remove Legacy Auth Route & Controller Logic

#### 15.4.1 Remove `POST /auth/session` route

**File:** `src/routes/auth.routes.js`

Remove the legacy session route:

```diff
- // ── Legacy Firebase Session (keep during migration) ─────────────────────
- 
- /**
-  * @deprecated — Will be removed after full MSG91 migration.
-  * POST /api/v1/auth/session
-  */
- router.post('/session', authenticate, validate(sessionSchema, 'body'), authController.createSession);
```

Also remove the `sessionSchema` import from the validators import line.

#### 15.4.2 Remove `createSession` from controller

**File:** `src/controllers/auth.controller.js`

Delete the entire `createSession` export function (the `@deprecated` one).

#### 15.4.3 Remove `createSession` from auth service

**File:** `src/services/auth.service.js`

Delete the entire legacy `createSession` function at the bottom of the file (the one marked `@deprecated`).

#### 15.4.4 Remove `sessionSchema` from validators

**File:** `src/validators/auth.validator.js`

Delete:

```diff
- /**
-  * @deprecated — Legacy Firebase session schema (keep during migration).
-  */
- export const sessionSchema = Joi.object({});
```

---

### 15.5 Step 4 — Refactor Account Service (Remove Firebase Admin SDK Calls)

**File:** `src/services/account.service.js`

This file currently uses `firebase-admin` for three operations:
1. `cleanupFirebaseAccess()` — revokes Firebase refresh tokens and disables the user during account deletion
2. `signOutEverywhere()` — revokes Firebase refresh tokens
3. `deleteBarberAccount()` — calls `cleanupFirebaseAccess()`

#### Replace with JWT-based equivalents:

```diff
- import admin from '../config/firebase.config.js';
  import cloudinary from '../config/cloudinary.config.js';
  import logger from '../utils/logger.js';
  import { BadRequestError, NotFoundError } from '../utils/api-error.js';
  import { verifyPin } from './pin.service.js';
+ import { revokeRefreshToken } from './auth.service.js';
  import shopRepository from '../repositories/shop.repository.js';
  import userRepository from '../repositories/user.repository.js';
```

**Replace `cleanupFirebaseAccess`:**

```diff
- const cleanupFirebaseAccess = async (firebaseUid) => {
-     let authCleanup = 'none';
-     try {
-         await admin.auth().revokeRefreshTokens(firebaseUid);
-         authCleanup = 'revoked';
-     } catch (revokeError) {
-         logger.warn('Firebase revokeRefreshTokens failed...', { ... });
-     }
-     try {
-         await admin.auth().updateUser(firebaseUid, { disabled: true });
-         return { authCleanup: 'disabled' };
-     } catch (disableError) {
-         ...
-     }
- };
```

This function is no longer needed — JWT revocation is handled by setting `refreshTokenHash = null` in the user document, which `revokeRefreshToken()` already does.

**Replace `signOutEverywhere`:**

```diff
- export const signOutEverywhere = async (firebaseUid) => {
-     await admin.auth().revokeRefreshTokens(firebaseUid);
-     return { revokedAt: new Date().toISOString() };
- };
+ export const signOutEverywhere = async (userId) => {
+     await revokeRefreshToken(userId);
+     return { revokedAt: new Date().toISOString() };
+ };
```

> **Note:** The function signature changes from `firebaseUid` to `userId`. Update the caller in the barber profile controller accordingly.

**Update `deleteBarberAccount`:**

```diff
  export const deleteBarberAccount = async (authUser, currentPin) => {
      // ... existing shop/pin/soft-delete logic stays the same ...

-     const firebaseResult = await cleanupFirebaseAccess(authUser.firebaseUid);
+     // Revoke JWT refresh token (invalidates all sessions)
+     await revokeRefreshToken(authUser._id);

      return {
          deleted: true,
-         authCleanup: firebaseResult.authCleanup,
+         authCleanup: 'revoked',
      };
  };
```

#### Update the controller caller

**File:** `src/controllers/barber/barber-profile.controller.js`

Update the `signOutEverywhere` call to pass `userId` instead of `firebaseUid`:

```diff
- const result = await accountService.signOutEverywhere(req.user.firebaseUid);
+ const result = await accountService.signOutEverywhere(req.user._id);
```

---

### 15.6 Step 5 — Refactor Onboarding to Use Phone Number Identity

The onboarding flow currently uses `firebaseUid` as the identity key passed from the controller. After migration, use the verified `phoneNumber` instead.

#### 15.6.1 Update Onboarding Controller

**File:** `src/controllers/onboarding.controller.js`

```diff
  export const createCustomerOnboarding = async (req, res, next) => {
      try {
-         const { firebaseUid } = req.user;
-         const result = await onboardingService.createCustomerOnboarding(firebaseUid, req.body, req.file);
+         const result = await onboardingService.createCustomerOnboarding(req.user.phoneNumber, req.body, req.file);
          return res.status(201).json(ApiResponse.success(result, 'Customer profile created'));
      } catch (err) {
          next(err);
      }
  };

  export const createBarberOnboarding = async (req, res, next) => {
      try {
-         const { firebaseUid } = req.user;
-         const result = await onboardingService.createBarberOnboarding(firebaseUid, req.user, req.body, req.files);
+         const result = await onboardingService.createBarberOnboarding(req.user.phoneNumber, req.user, req.body, req.files);
          return res.status(201).json(ApiResponse.success(result, 'Barber profile created'));
      } catch (err) {
          next(err);
      }
  };
```

#### 15.6.2 Update Onboarding Service

**File:** `src/services/onboarding.service.js`

Change the function signatures and internal logic to use `phoneNumber` instead of `firebaseUid`:

```diff
- const ensureUniqueUserIdentity = async ({ firebaseUid, email, phoneNumber }) => {
+ const ensureUniqueUserIdentity = async ({ phoneNumber, email }) => {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      const normalizedPhoneNumber = phoneNumber ? String(phoneNumber).trim() : null;

      const [emailOwner, phoneOwner] = await Promise.all([
          normalizedEmail ? userRepository.findByEmail(normalizedEmail) : null,
          normalizedPhoneNumber ? userRepository.findByPhone(normalizedPhoneNumber) : null,
      ]);

-     if (emailOwner && emailOwner.firebaseUid !== firebaseUid) {
+     if (emailOwner && emailOwner.phoneNumber !== normalizedPhoneNumber) {
          throw new ConflictError('Email already registered');
      }

-     if (phoneOwner && phoneOwner.firebaseUid !== firebaseUid) {
+     if (phoneOwner) {
          throw new ConflictError('Phone number already registered');
      }
  };
```

```diff
- export const createCustomerOnboarding = async (firebaseUid, profileData, file) => {
-     const existing = await userRepository.findByFirebaseUid(firebaseUid);
+ export const createCustomerOnboarding = async (phoneNumber, profileData, file) => {
+     const existing = await userRepository.findByPhone(phoneNumber);
      if (existing) throw new ConflictError('User already exists');

      // ... file validation, location parsing ...

      await ensureUniqueUserIdentity({
-         firebaseUid,
+         phoneNumber,
          email: profileData.email,
-         phoneNumber: profileData.phoneNumber,
      });

      const user = await userRepository.create({
-         firebaseUid,
-         phoneNumber: profileData.phoneNumber,
+         phoneNumber,
          email: profileData.email,
          roleType: ROLES.CUSTOMER,
      });
      // ... rest stays the same
  };
```

Apply the same pattern to `createBarberOnboarding` — replace `firebaseUid` parameter and lookups with `phoneNumber`.

---

### 15.7 Step 6 — Update User Model

**File:** `src/models/user.model.js`

Make `firebaseUid` optional (don't delete the field — existing records still have it for historical reference):

```diff
  firebaseUid: {
      type: String,
-     required: true,
-     unique: true,
+     required: false,
+     sparse: true,    // allows multiple null values with unique index
      index: true,
  },
```

> **Why not delete the field?** Existing user documents in MongoDB still contain `firebaseUid` values. Removing the schema field would not remove data from the database and could cause unexpected behavior. Keeping it as optional preserves backward compatibility. You can run a migration script later to `$unset` the field from all documents if desired.

Optionally, add a migration script (`scripts/remove-firebase-uid.js`) to clean the field:

```javascript
// Run with: node scripts/remove-firebase-uid.js
import mongoose from 'mongoose';
import config from '../src/config/index.js';

await mongoose.connect(config.mongo.uri);
const result = await mongoose.connection.db
    .collection('users')
    .updateMany({}, { $unset: { firebaseUid: '' } });
console.log(`Updated ${result.modifiedCount} documents`);
await mongoose.disconnect();
```

---

### 15.8 Step 7 — Update User Repository

**File:** `src/repositories/user.repository.js`

Remove the `findByFirebaseUid` method:

```diff
- async findByFirebaseUid(firebaseUid, options = {}) {
-     return User.findOne({ firebaseUid }, null, options);
- }
```

This method is no longer called by any service or middleware after cleanup.

---

### 15.9 Step 8 — Update Upload Middleware

**File:** `src/middleware/upload.middleware.js`

Remove the `firebaseUid` fallback in the actor key resolver:

```diff
- const resolveActorKey = (req) => req.user?._id?.toString() || req.user?.firebaseUid || 'anonymous';
+ const resolveActorKey = (req) => req.user?._id?.toString() || 'anonymous';
```

---

### 15.10 Step 9 — Remove Firebase Admin SDK Dependency

```bash
npm uninstall firebase-admin
```

This removes `firebase-admin` from `package.json` and `node_modules`.

**Verify** it's gone:

```bash
npm ls firebase-admin
```

Should show `(empty)` — no package found.

---

### 15.11 Step 10 — Clean Up Miscellaneous References

#### Model comments

Several model files contain historical comments referencing `firebaseUid`. These are informational — optionally clean them up:

| File | Line(s) | Action |
|---|---|---|
| `models/shop.model.js` | Comment: *"ownerId replaces firebaseUid"* | Update or remove comment |
| `models/service.model.js` | Comment: *"Replaces old model that used firebaseUid"* | Update or remove comment |
| `models/photo.model.js` | Comment: *"firebaseUid → shopId"* | Update or remove comment |
| `models/employee.model.js` | Comment: *"shopId replaces old firebaseUid"* | Update or remove comment |
| `utils/logger.js` | Comment: *"Firebase private keys"* | Keep — the redaction pattern is still useful for general private key safety |

#### Scripts directory

Check `server/scripts/` for any Firebase-specific scripts (e.g., token generation scripts that use `FIREBASE_API_KEY`). Remove or archive them.

---

### 15.12 Post-Cleanup Verification

After completing all removal steps, run through this final verification:

- [ ] **Server starts cleanly** — `npm run dev` shows no import errors or missing module warnings
- [ ] **No Firebase references in production code** — run: `grep -ri "firebase" src/` — should return only model comments (if kept) and the logger redaction pattern
- [ ] **OTP send works** — `POST /api/v1/auth/otp/send` returns success
- [ ] **OTP verify works** — `POST /api/v1/auth/otp/verify` returns tokens for existing users, `isNewUser: true` for new users
- [ ] **Token refresh works** — `POST /api/v1/auth/token/refresh` issues new token pair
- [ ] **Logout works** — `POST /api/v1/auth/logout` revokes refresh token
- [ ] **Customer onboarding works** — `POST /api/v1/onboarding/customers` creates user + profile
- [ ] **Barber onboarding works** — `POST /api/v1/onboarding/barbers` creates user + shop
- [ ] **All protected routes work** — Bearer token authentication succeeds on all barber/customer endpoints
- [ ] **Sign-out-everywhere works** — revokes JWT, subsequent requests fail with 401
- [ ] **Account deletion works** — soft-deletes user, revokes JWT
- [ ] **`POST /api/v1/auth/session` returns 404** — legacy route is gone
- [ ] **`firebase-admin` not in `node_modules`** — `npm ls firebase-admin` returns empty
- [ ] **`.env` has no Firebase variables** — no `FIREBASE_*` keys present
- [ ] **No `firebase-admin-sdk.json` file** in the project root

---

### 15.13 Cleanup Summary — Files Removed / Modified

```
server/
├── firebase-admin-sdk.json                  ← DELETE
├── .env                                     ← REMOVE: FIREBASE_* variables
├── .env.example                             ← REMOVE: FIREBASE_* variables + section header
├── package.json                             ← REMOVE: firebase-admin dependency (npm uninstall)
└── src/
    ├── config/
    │   ├── firebase.config.js               ← DELETE (entire file)
    │   └── index.js                         ← REMOVE: firebase config section
    ├── controllers/
    │   ├── auth.controller.js               ← REMOVE: createSession (deprecated)
    │   ├── onboarding.controller.js         ← REFACTOR: firebaseUid → phoneNumber
    │   └── barber/
    │       └── barber-profile.controller.js  ← UPDATE: signOutEverywhere(req.user._id)
    ├── middleware/
    │   ├── authenticate.middleware.js        ← REWRITE: JWT-only (remove Firebase fallback)
    │   └── upload.middleware.js              ← REMOVE: firebaseUid fallback in resolveActorKey
    ├── models/
    │   └── user.model.js                    ← MAKE firebaseUid optional + sparse
    ├── repositories/
    │   └── user.repository.js               ← REMOVE: findByFirebaseUid()
    ├── routes/
    │   └── auth.routes.js                   ← REMOVE: POST /session route
    ├── services/
    │   ├── auth.service.js                  ← REMOVE: createSession (deprecated)
    │   ├── account.service.js               ← REFACTOR: remove firebase-admin import,
    │   │                                       replace cleanupFirebaseAccess + signOutEverywhere
    │   └── onboarding.service.js            ← REFACTOR: firebaseUid → phoneNumber throughout
    └── validators/
        └── auth.validator.js                ← REMOVE: sessionSchema
```

> **Total:** 2 files deleted, 13 files modified, 1 dependency removed.

---

*This guide is designed for direct implementation within the EverCut `server/` codebase. Every code sample follows the existing project conventions: ES Modules, Express 5 router patterns, Joi validation, the AppError/ApiResponse pattern, and the repository → service → controller → route layered architecture.*

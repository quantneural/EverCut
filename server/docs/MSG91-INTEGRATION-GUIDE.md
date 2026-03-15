# MSG91 OTP Integration Guide — EverCut Backend

> **Created:** March 16, 2026  
> **Scope:** Complete implementation guide — replace Firebase Phone Auth with MSG91 OTP + JWT  
> **Prerequisite:** Read `OTP-AUTH-RESEARCH.md` for the cost/feature comparison that led to this decision  
> **Target Codebase:** `server/src/` (Express 5 · ES Modules · Mongoose 9 · Joi validation)  
> **Context:** The project is in the development phase with no users and no existing data — this is a clean replacement, not a gradual migration.

### Related Documents

| Document | Scope |
|---|---|
| [`MSG91-EXTERNAL-SETUP-GUIDE.md`](./MSG91-EXTERNAL-SETUP-GUIDE.md) | MSG91 account creation, DLT registration, test/sandbox environment |
| [`MSG91-POSTMAN-UPDATES-GUIDE.md`](./MSG91-POSTMAN-UPDATES-GUIDE.md) | Postman collection updates for OTP/JWT authentication |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables & Configuration](#2-environment-variables--configuration)
3. [Dependencies](#3-dependencies)
4. [Implementation — Layer by Layer](#4-implementation--layer-by-layer)
   - [4.1 Constants](#41-constants)
   - [4.2 MSG91 Provider Service](#42-msg91-provider-service)
   - [4.3 OTP Service](#43-otp-service)
   - [4.4 Auth Service](#44-auth-service)
   - [4.5 Validators](#45-validators)
   - [4.6 OTP Rate Limiter Middleware](#46-otp-rate-limiter-middleware)
   - [4.7 Controller](#47-controller)
   - [4.8 Routes](#48-routes)
   - [4.9 Authenticate Middleware](#49-authenticate-middleware)
5. [JWT Token Strategy](#5-jwt-token-strategy)
6. [User Model Changes](#6-user-model-changes)
   - [6.1 Remove `firebaseUid`](#61-remove-firebaseuid)
   - [6.2 Add `refreshTokenHash`](#62-add-refreshtokenhash)
   - [6.3 Make `email` Optional + Add `emailVerified`](#63-make-email-optional--add-emailverified)
   - [6.4 Change `roleType` Default to `PENDING`](#64-change-roletype-default-to-pending)
   - [6.5 Updated Indexes](#65-updated-indexes)
   - [6.6 Full Updated Schema Reference](#66-full-updated-schema-reference)
   - [6.7 User Repository Updates](#67-user-repository-updates)
7. [Firebase Removal — Existing File Changes](#7-firebase-removal--existing-file-changes)
   - [7.1 Remove Firebase Config](#71-remove-firebase-config)
   - [7.2 Refactor Account Service](#72-refactor-account-service)
   - [7.3 Refactor Onboarding Controller](#73-refactor-onboarding-controller)
   - [7.4 Refactor Onboarding Service](#74-refactor-onboarding-service)
   - [7.5 Update User Repository](#75-update-user-repository)
   - [7.6 Update Upload Middleware](#76-update-upload-middleware)
   - [7.7 Clean Up Model Comments](#77-clean-up-model-comments)
   - [7.7a Update Authorize Middleware](#77a-update-authorize-middleware)
   - [7.8 Clean Up Scripts](#78-clean-up-scripts)
   - [7.9 Clean Up Environment & Config](#79-clean-up-environment--config)
   - [7.10 Remove Firebase Dependency](#710-remove-firebase-dependency)
8. [Security Best Practices](#8-security-best-practices)
9. [Error Handling](#9-error-handling)
10. [Future SMS Use Cases](#10-future-sms-use-cases)
11. [API Endpoint Matrix](#11-api-endpoint-matrix)
12. [File Map — All Changes at a Glance](#12-file-map--all-changes-at-a-glance)
13. [Pre-Launch Checklist](#13-pre-launch-checklist)

---

## 1. Architecture Overview

### 1.1 New Auth Flow (MSG91 OTP + Custom JWT)

> **Key design decision:** Secure token issuance. Database integrity is strictly maintained. We **never** create a User record in the database until they complete onboarding with all required fields (email, name, etc.). Instead, we issue a temporary, short-lived `onboardingToken` upon OTP verification for brand-new users.

```text
─── Returning User ───────────────────────────────────────────────────
1. App → POST /api/v1/auth/otp/send  { mobile: "9876543210" }
2. Backend validates + rate-limits → calls MSG91 Send OTP API
3. MSG91 delivers OTP via SMS (fallback: WhatsApp → Voice)
4. User enters OTP in app
5. App → POST /api/v1/auth/otp/verify  { mobile, otp }
6. Backend calls MSG91 Verify OTP API
7. OTP valid → find existing User by phoneNumber
8. Update lastLoginAt → issue { accessToken, refreshToken }
9. Response: { isNewUser: false, user, profile, accessToken, refreshToken }
10. All subsequent requests use Bearer <accessToken>
11. POST /api/v1/auth/token/refresh for new access token

─── New User ─────────────────────────────────────────────────────────
1–6. Same as above
7. OTP valid → no User found by phoneNumber
8. **DO NOT create a User record**. Issue an internal short-lived `onboardingToken` (valid for 30m) containing only the `phoneNumber`.
9. Response: { isNewUser: true, onboardingToken }
10. App navigates to onboarding screen
11. App → POST /api/v1/onboarding/customers  (or /barbers)
        with header `Authorization: Bearer <onboardingToken>`
12. Backend validates onboarding token, extracts `phoneNumber`, creates the User and Profile records simultaneously.
13. Response returns the standard { user, profile, accessToken, refreshToken }.
14. All subsequent requests use Bearer <accessToken>
```

> **Why an Onboarding Token?** Previously, the flow created `PENDING` users with optional emails, leading to a database full of abandoned, incomplete accounts ("zombie users") if they dropped off at the onboarding screen. By using a secure JWT `onboardingToken`, we pass the verified phone number state safely to the onboarding endpoint without muddying the database. Weakening constraints like making `email` optional is poor practice.

### 1.2 Layer Mapping

| Layer | New File(s) / Changes |
|---|---|
| **Config** | `config/index.js` — replace `firebase` section with `msg91` + `jwt` sections |
| **Provider** | `services/sms-provider.service.js` — **NEW** (replaces `config/firebase.config.js`) |
| **Service** | `services/otp.service.js` — **NEW**; `services/auth.service.js` — **REWRITE** |
| **Validator** | `validators/auth.validator.js` — **REWRITE** with OTP schemas |
| **Controller** | `controllers/auth.controller.js` — **REWRITE** with OTP + token handlers |
| **Route** | `routes/auth.routes.js` — **REWRITE** with OTP + token routes |
| **Middleware** | `middleware/authenticate.middleware.js` — **REWRITE** for JWT-only; `middleware/otp-rate-limiter.middleware.js` — **NEW** |
| **Model** | `models/user.model.js` — remove `firebaseUid`; add `refreshTokenHash`, `emailVerified`; make `email` optional; change `roleType` default to `PENDING` |
| **Constants** | `utils/constants.js` — add `PENDING` role, OTP + token type constants |

---

## 2. Environment Variables & Configuration

> **Prerequisite:** Complete the [MSG91 External Setup](./MSG91-EXTERNAL-SETUP-GUIDE.md) to obtain your Auth Key and Template ID.

### 2.1 Update `.env.example`

Remove all `FIREBASE_*` variables and add:

```env
# ── MSG91 (OTP / SMS) ───────────────────────────────────────────────
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_OTP_TEMPLATE_ID=your_otp_template_id
MSG91_OTP_LENGTH=6
MSG91_OTP_EXPIRY=10
# Set to "true" in development to skip real SMS and accept test OTP
MSG91_TEST_MODE=false
MSG91_TEST_OTP=123456

# ── JWT (Custom Token Auth) ─────────────────────────────────────────
JWT_ACCESS_SECRET=your_access_token_secret_min_64_chars_random
JWT_REFRESH_SECRET=your_refresh_token_secret_min_64_chars_different
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
```

### 2.2 Update `config/index.js`

Remove the entire `firebase` config block and add:

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

---

## 3. Dependencies

```bash
npm install jsonwebtoken
npm uninstall firebase-admin
```

| Action | Package | Purpose |
|---|---|---|
| **Install** | `jsonwebtoken` | Sign/verify access & refresh tokens |
| **Remove** | `firebase-admin` | No longer needed — replaced by MSG91 + JWT |

> **MSG91 API calls use native `fetch`** (Node 18+). No additional HTTP client needed.

---

## 4. Implementation — Layer by Layer

### 4.1 Constants

**File:** `src/utils/constants.js` — Add:

```javascript
// ── Roles (update existing) ─────────────────────────────────────────
// Add PENDING to the existing ROLES object:
export const ROLES = Object.freeze({
    CUSTOMER: 'CUSTOMER',
    BARBER: 'BARBER',
    ADMIN: 'ADMIN',
});

export const ALL_ROLES = Object.values(ROLES);

// ── OTP ─────────────────────────────────────────────────────────────
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SEC = 30;
export const OTP_RATE_LIMIT = Object.freeze({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxSendPerPhone: 5,
    maxSendPerIp: 10,
    maxVerifyPerPhone: 10,
});

// ── Token Types ─────────────────────────────────────────────────────
export const TOKEN_TYPE = Object.freeze({
    ONBOARDING: 'onboarding', // ← NEW — given after OTP, required for profile creation
    ACCESS: 'access',
    REFRESH: 'refresh',
});
```

> **Note:** The existing `ROLES` constant in the codebase currently has `{ CUSTOMER, BARBER, ADMIN }` with a default of `CUSTOMER`. No changes to `ROLES` are needed anymore since we are adopting the `onboardingToken` flow.

---

### 4.2 MSG91 Provider Service

**File:** `src/services/sms-provider.service.js` — **NEW**

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
 * @param {string} mobile — 10-digit Indian mobile number (without country code)
 * @returns {Promise<{ success: boolean, requestId: string|null }>}
 */
export const sendOtp = async (mobile) => {
    if (config.msg91.testMode) {
        if (config.env === 'production') {
            logger.error('CRITICAL: MSG91 test mode is enabled in production!');
            throw new AppError('Configuration error', 500);
        }

        logger.info('MSG91 test mode — OTP send bypassed', {
            mobile: mobile.slice(-4).padStart(mobile.length, '*'),
            testOtp: config.msg91.testOtp,
        });
        return { success: true, requestId: 'test-mode' };
    }

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
 * @param {string} mobile — 10-digit Indian mobile number
 * @param {string} otp    — user-entered OTP
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const verifyOtp = async (mobile, otp) => {
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
 * @param {string} mobile — 10-digit Indian mobile number
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

### 4.3 OTP Service

**File:** `src/services/otp.service.js` — **NEW**

```javascript
import * as smsProvider from './sms-provider.service.js';
import { BadRequestError, TooManyRequestsError } from '../utils/api-error.js';
import { OTP_RATE_LIMIT } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * In-memory rate limit store. For production at scale, replace with Redis.
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

// Periodic cleanup (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}, 5 * 60 * 1000).unref();

/** Request OTP for a mobile number. */
export const requestOtp = async (mobile, clientIp) => {
    checkRateLimit(`send:phone:${mobile}`, OTP_RATE_LIMIT.maxSendPerPhone);
    checkRateLimit(`send:ip:${clientIp}`, OTP_RATE_LIMIT.maxSendPerIp);

    const result = await smsProvider.sendOtp(mobile);
    if (!result.success) {
        throw new BadRequestError('Failed to send OTP. Please try again.');
    }
    return { message: 'OTP sent successfully' };
};

/** Verify OTP for a mobile number. */
export const verifyOtp = async (mobile, otp, clientIp) => {
    checkRateLimit(`verify:phone:${mobile}`, OTP_RATE_LIMIT.maxVerifyPerPhone);

    const result = await smsProvider.verifyOtp(mobile, otp);
    if (!result.success) {
        throw new BadRequestError(result.message || 'Invalid or expired OTP');
    }
    return { verified: true };
};

/** Resend OTP via alternative channel. */
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

### 4.4 Auth Service

**File:** `src/services/auth.service.js` — **REWRITE** (replaces the existing Firebase-based `createSession` service entirely)

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

// ── Token generation ──────────────────────────────────────────────────

/** Generate a pair of access + refresh tokens. */
export const generateOnboardingToken = (phoneNumber) => {
    return jwt.sign(
        { sub: phoneNumber, type: TOKEN_TYPE.ONBOARDING },
        config.jwt.accessSecret,
        { expiresIn: '30m' }
    );
};

export const verifyOnboardingToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        if (decoded.type !== TOKEN_TYPE.ONBOARDING) {
            throw new UnauthorizedError('Invalid token type for onboarding');
        }
        return decoded;
    } catch {
        throw new UnauthorizedError('Invalid or expired onboarding token');
    }
};

/** Generate a pair of access + refresh tokens. */
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

/** Verify an access token and return decoded payload. */
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

/** Verify a refresh token and return decoded payload. */
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

/** Hash a refresh token for secure storage (never store raw tokens in DB). */
export const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// ── Session resolution ────────────────────────────────────────────────

/**
 * Resolve user session after OTP verification.
 *
 * - **Existing user:** update lastLoginAt, issue tokens, load profile.
 * - **New user:** issues an `onboardingToken` (valid 30 mins, contains only the phone number).
 *   The client proceeds to onboarding and passes this token to authenticate.
 *
 * We DO NOT create a database record for incomplete user profiles.
 *
 * @param {string} phoneNumber — verified phone number (10-digit)
 * @returns {{ isNewUser: boolean, user: object, profile?: object, tokens: object }}
 */
export const resolveOtpSession = async (phoneNumber) => {
    const formattedPhone = phoneNumber.startsWith('+91')
        ? phoneNumber
        : `+91${phoneNumber}`;

    const existingUser = await userRepository.findByPhone(formattedPhone);

    if (existingUser) {
        // ── Returning user ────────────────────────────────────────────
        await userRepository.updateLastLogin(existingUser._id);

        const tokens = generateTokenPair(existingUser._id, existingUser.roleType);
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
        return { isNewUser: false, user: existingUser, profile, tokens };
    }

    // ── New user — issue onboarding token ──────────────────────────────
    const onboardingToken = generateOnboardingToken(formattedPhone);

    logger.info('OTP verified for new user — issued onboarding token', {
        phone: formattedPhone.slice(-4).padStart(formattedPhone.length, '*'),
    });

    return { isNewUser: true, onboardingToken };
};

/** Refresh an access token using a valid refresh token. */
export const refreshAccessToken = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.sub;

    const user = await userRepository.findById(userId);
    if (!user || !user.isActive || user.deletedAt) {
        throw new UnauthorizedError('Account is inactive or deleted');
    }

    // Verify the refresh token matches stored hash (rotation check)
    const incomingHash = hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingHash) {
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

/** Invalidate refresh token (logout). */
export const revokeRefreshToken = async (userId) => {
    await userRepository.updateById(userId, { refreshTokenHash: null });
};
```

---

### 4.5 Validators

**File:** `src/validators/auth.validator.js` — **REWRITE** (replaces the empty `sessionSchema`):

```javascript
import Joi from 'joi';

/** Indian mobile number: exactly 10 digits, starting with 6-9. */
const indianMobile = Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
        'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number',
        'any.required': 'Mobile number is required',
    });

/** POST /auth/otp/send */
export const sendOtpSchema = Joi.object({
    mobile: indianMobile,
});

/** POST /auth/otp/verify */
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

/** POST /auth/otp/resend */
export const resendOtpSchema = Joi.object({
    mobile: indianMobile,
    retryType: Joi.string()
        .valid('text', 'voice')
        .default('text')
        .messages({
            'any.only': 'retryType must be "text" or "voice"',
        }),
});

/** POST /auth/token/refresh */
export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required',
    }),
});
```

---

### 4.6 OTP Rate Limiter Middleware

**File:** `src/middleware/otp-rate-limiter.middleware.js` — **NEW**

```javascript
import { TooManyRequestsError } from '../utils/api-error.js';

const store = new Map();

// Periodic cleanup (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
    }
}, 10 * 60 * 1000).unref();

/**
 * @param {{ windowMs: number, max: number, keyPrefix: string, keySource: 'ip'|'body.mobile' }} options
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

### 4.7 Controller

**File:** `src/controllers/auth.controller.js` — **REWRITE**:

```javascript
import * as otpService from '../services/otp.service.js';
import * as authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.js';

/** POST /auth/otp/send */
export const sendOtp = async (req, res, next) => {
    try {
        const { mobile } = req.body;
        const result = await otpService.requestOtp(mobile, req.ip);
        return res.status(200).json(ApiResponse.success(result, 'OTP sent successfully'));
    } catch (err) { next(err); }
};

/** POST /auth/otp/verify */
export const verifyOtp = async (req, res, next) => {
    try {
        const { mobile, otp } = req.body;
        await otpService.verifyOtp(mobile, otp, req.ip);
        const session = await authService.resolveOtpSession(mobile);

        let responseData;
        if (session.isNewUser) {
            responseData = {
                isNewUser: true,
                onboardingToken: session.onboardingToken,
            };
        } else {
            responseData = {
                isNewUser: false,
                user: session.user,
                profile: session.profile,
                accessToken: session.tokens.accessToken,
                refreshToken: session.tokens.refreshToken,
            };
        }


        const message = session.isNewUser
            ? 'OTP verified. Please complete your profile.'
            : 'Login successful';

        return res.status(200).json(ApiResponse.success(responseData, message));
    } catch (err) { next(err); }
};

/** POST /auth/otp/resend */
export const resendOtp = async (req, res, next) => {
    try {
        const { mobile, retryType } = req.body;
        const result = await otpService.resendOtp(mobile, retryType, req.ip);
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) { next(err); }
};

/** POST /auth/token/refresh */
export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken: token } = req.body;
        const tokens = await authService.refreshAccessToken(token);
        return res.status(200).json(
            ApiResponse.success(tokens, 'Token refreshed successfully'),
        );
    } catch (err) { next(err); }
};

/** POST /auth/logout */
export const logout = async (req, res, next) => {
    try {
        await authService.revokeRefreshToken(req.user._id);
        return res.status(200).json(ApiResponse.success(null, 'Logged out successfully'));
    } catch (err) { next(err); }
};
```

---

### 4.8 Routes

**File:** `src/routes/auth.routes.js` — **REWRITE**:

```javascript
import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { otpRateLimiter } from '../middleware/otp-rate-limiter.middleware.js';
import {
    sendOtpSchema, verifyOtpSchema, resendOtpSchema, refreshTokenSchema,
} from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';
import { OTP_RATE_LIMIT } from '../utils/constants.js';

const router = Router();

// ── OTP Endpoints (Public) ──────────────────────────────────────────

router.post('/otp/send',
    otpRateLimiter({ windowMs: OTP_RATE_LIMIT.windowMs, max: OTP_RATE_LIMIT.maxSendPerIp, keyPrefix: 'otp-send-ip', keySource: 'ip' }),
    otpRateLimiter({ windowMs: OTP_RATE_LIMIT.windowMs, max: OTP_RATE_LIMIT.maxSendPerPhone, keyPrefix: 'otp-send-phone', keySource: 'body.mobile' }),
    validate(sendOtpSchema, 'body'),
    authController.sendOtp,
);

router.post('/otp/verify',
    otpRateLimiter({ windowMs: OTP_RATE_LIMIT.windowMs, max: OTP_RATE_LIMIT.maxVerifyPerPhone, keyPrefix: 'otp-verify', keySource: 'body.mobile' }),
    validate(verifyOtpSchema, 'body'),
    authController.verifyOtp,
);

router.post('/otp/resend',
    otpRateLimiter({ windowMs: OTP_RATE_LIMIT.windowMs, max: OTP_RATE_LIMIT.maxSendPerPhone, keyPrefix: 'otp-resend', keySource: 'body.mobile' }),
    validate(resendOtpSchema, 'body'),
    authController.resendOtp,
);

// ── Token Endpoints ─────────────────────────────────────────────────

router.post('/token/refresh', validate(refreshTokenSchema, 'body'), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

export default router;
```

> **Route index:** No changes needed to `src/routes/index.js` — auth routes are already mounted at `/auth`.

---

### 4.9 Authenticate Middleware

**File:** `src/middleware/authenticate.middleware.js` — **REWRITE** (JWT-only, fully replaces the Firebase `verifyIdToken` implementation):

```javascript
import * as authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * Authenticate middleware — verifies JWT access token.
 *
 * The onboarding Token is explicitly rejected by this middleware.
 *
 * On success, attaches to `req.user`:
 *   - _id            (MongoDB ObjectId)
 *   - roleType       ('PENDING' | 'CUSTOMER' | 'BARBER' | 'ADMIN')
 *   - phoneNumber
 *   - email          (may be null for PENDING users)
 *   - emailVerified  (boolean)
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

        if (decoded.type === TOKEN_TYPE.ONBOARDING) {
             throw new UnauthorizedError('Onboarding token cannot be used for standard API access');
        }

        const user = await userRepository.findById(decoded.sub);

        if (!user || user.deletedAt || user.isActive === false) {
            throw new UnauthorizedError('Account is inactive or deleted');
        }

        req.user = {
            _id: user._id,
            roleType: user.roleType,
            phoneNumber: user.phoneNumber,
            email: user.email || null,
            emailVerified: user.emailVerified || false,
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

**File:** `src/middleware/authenticate-onboarding.middleware.js` — **NEW**

```javascript
import * as authService from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * Middleware for onboarding endpoints.
 * Validates the temporary onboarding token and extracts the verified phone number.
 */
export const authenticateOnboarding = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No onboarding token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) throw new UnauthorizedError('No onboarding token provided');

        const decoded = authService.verifyOnboardingToken(token);
        
        req.onboardingContext = {
            phoneNumber: decoded.sub,
        };

        next();
    } catch (err) {
        logger.warn('Onboarding token verification failed', { error: err.message });
        next(new UnauthorizedError('Invalid or expired onboarding token. Please verify OTP again.'));
    }
};
```

---

## 5. JWT Token Strategy

| Aspect | Value | Rationale |
|---|---|---|
| **Access Token Expiry** | 15 minutes | Short-lived to minimize attack window |
| **Refresh Token Expiry** | 30 days | Avoids frequent re-authentication for mobile users |
| **Signing Algorithm** | HS256 (HMAC-SHA256) | Sufficient for single-backend apps |
| **Storage (Client)** | Secure storage (Keychain/Keystore) | Never in plain localStorage on web |
| **Storage (Server)** | SHA-256 hash in User model | Never store raw refresh tokens |
| **Rotation** | Every refresh issues new pair | Detects token theft via hash mismatch |
| **Revocation** | Set `refreshTokenHash` to null | Immediate logout / sign-out-everywhere |
| **PENDING Users** | Receive same token pair | Required to access onboarding endpoints |

> **Token Payload — `role` field:** The JWT `role` field reflects the user's current `roleType` at issuance time. For new users, this will be `'PENDING'`. After onboarding completes and the user's `roleType` is updated to `CUSTOMER`/`BARBER`, the **next token refresh** will reflect the updated role. The `authenticate` middleware always reads the role from the DB (not from the token), so the authorization layer is always current.

---

## 6. User Model Changes

**File:** `src/models/user.model.js`

### 6.1 Remove `firebaseUid`

**Remove** the `firebaseUid` field entirely:

```diff
- firebaseUid: {
-     type: String,
-     required: true,
-     unique: true,
-     index: true,
- },
```

### 6.2 Add `refreshTokenHash`

```javascript
refreshTokenHash: {
    type: String,
    default: null,
    select: false,  // Don't include in default queries
},
```

### 6.3 Maintain `email` as Required + Add `emailVerified`

> **Why required?** The User model is strictly created ONLY during the final stage of onboarding. By the time a user is inserted into the DB, the `email` field is collected from the onboarding form. Loosening schema constraints would allow corrupt incomplete user traces, which we explicitly avoid with the `onboardingToken` pattern. Therefore, `email` remains `required: true` and `unique: true`.

**Keep** the existing `email` field as it is in the database.

**Add** the `emailVerified` field (after `email`):

```javascript
emailVerified: {
    type: Boolean,
    default: false,
},
```

> **Note on `emailVerified`:** We do not currently have an email sending service, so email verification is not implemented. This field is added now to preserve the design intent. When an email service is introduced in the future, the flow will be:
> 1. User provides email during onboarding → stored with `emailVerified: false`
> 2. Backend sends verification email with a link/OTP
> 3. User clicks link / enters OTP → backend sets `emailVerified: true`
> 4. Certain features (e.g., email-based notifications, password reset) can require `emailVerified: true`

### 6.4 Remove `firebaseUid` logic, Keep `roleType` exact

```javascript
  roleType: {
      type: String,
      required: true,
      enum: ALL_ROLES,
      default: ROLES.CUSTOMER,
  },
```

> **No PENDING role:** With the adoption of the `onboardingToken`, users are explicitly created directly as `CUSTOMER` or `BARBER` during the onboarding process. The enum `{ CUSTOMER, BARBER, ADMIN }` remains untouched.

### 6.5 Updated Indexes

Remove the old `firebaseUid` unique index. Both `email` and `phoneNumber` retain their standard unique indices since we guarantee data presence at creation block.

### 6.6 Full Updated Schema Reference

```javascript
const userSchema = new mongoose.Schema(
    {
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        roleType: {
            type: String,
            required: true,
            enum: ALL_ROLES,
            default: ROLES.CUSTOMER,
        },
        refreshTokenHash: {
            type: String,
            default: null,
            select: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roleType: 1, isActive: 1 });
```

### 6.7 User Repository Updates

**File:** `src/repositories/user.repository.js`

Remove `findByFirebaseUid`:

```diff
- async findByFirebaseUid(firebaseUid, options = {}) {
-     return User.findOne({ firebaseUid }, null, options);
- }
```

**Add** `findByIdWithRefreshHash`:

```javascript
async findByIdWithRefreshHash(id) {
    return User.findById(id).select('+refreshTokenHash');
}
```

Update `authService.refreshAccessToken()` to use `findByIdWithRefreshHash()` instead of `findById()`.

> **Important — `email` in the OTP flow summary:**
> - `resolveOtpSession()` securely passes the `phoneNumber` via `onboardingToken`.
> - The client strictly provides the email upon onboarding.
> - Onboarding service explicitly **creates** the user document populating all required fields.
> - `req.user.email` is available on all requests after standard successful JWT authentication.

---

## 7. Firebase Removal — Existing File Changes

Since there are no users or existing data, all Firebase references are removed directly. This section covers every existing file that currently references Firebase.

### 7.1 Remove Firebase Config

```bash
# Delete these files
rm src/config/firebase.config.js
rm firebase-admin-sdk.json
```

### 7.2 Refactor Account Service

**File:** `src/services/account.service.js`

```diff
- import admin from '../config/firebase.config.js';
+ import { revokeRefreshToken } from './auth.service.js';
```

**Remove** the `cleanupFirebaseAccess` function entirely.

**Replace `signOutEverywhere`** — signature changes from `firebaseUid` to `userId`:

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

**Update `deleteBarberAccount`:**

```diff
- const firebaseResult = await cleanupFirebaseAccess(authUser.firebaseUid);
+ await revokeRefreshToken(authUser._id);
  return {
      deleted: true,
-     authCleanup: firebaseResult.authCleanup,
+     authCleanup: 'revoked',
  };
```

### 7.3 Refactor Onboarding Controller

**File:** `src/controllers/onboarding.controller.js`

> **Key change:** Replace `firebaseUid` logic with the validated `phoneNumber` obtained from the `req.onboardingContext`. The `authenticateOnboarding` middleware verifies the onboarding token and decodes the phone number. Furthermore, the newly created `accessToken` and `refreshToken` generated by the Auth Service are attached to the response.

```diff
  export const createCustomerOnboarding = async (req, res, next) => {
      try {
-         const { firebaseUid } = req.user;
-         const result = await onboardingService.createCustomerOnboarding(firebaseUid, req.body, req.file);
+         const { phoneNumber } = req.onboardingContext;
+         const result = await onboardingService.createCustomerOnboarding(phoneNumber, req.body, req.file);
+         return res.status(201).json(ApiResponse.success(result, 'Customer profile created'));

  export const createBarberOnboarding = async (req, res, next) => {
      try {
-         const { firebaseUid } = req.user;
-         const result = await onboardingService.createBarberOnboarding(firebaseUid, req.user, req.body, req.files);
+         const { phoneNumber } = req.onboardingContext;
+         const result = await onboardingService.createBarberOnboarding(phoneNumber, req.body, req.files);
+         return res.status(201).json(ApiResponse.success(result, 'Barber profile created'));
```

### 7.4 Refactor Onboarding Service

**File:** `src/services/onboarding.service.js`

#### 7.4.1 Update `ensureUniqueUserIdentity`

A user shouldn't exist because we only trigger this endpoint if the user didn't exist at the time of OTP verification. However, to be perfectly robust against race conditions, we assert uniqueness across `phoneNumber` AND `email`.

```diff
- const ensureUniqueUserIdentity = async ({ firebaseUid, email, phoneNumber }) => {
+ const ensureUniqueUserIdentity = async ({ email, phoneNumber }) => {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      const normalizedPhoneNumber = phoneNumber ? String(phoneNumber).trim() : null;

      const [emailOwner, phoneOwner] = await Promise.all([
          normalizedEmail ? userRepository.findByEmail(normalizedEmail) : null,
          normalizedPhoneNumber ? userRepository.findByPhone(normalizedPhoneNumber) : null,
      ]);

-     if (emailOwner && emailOwner.firebaseUid !== firebaseUid) {
+     if (emailOwner) {
          throw new ConflictError('Email already registered');
      }

-     if (phoneOwner && phoneOwner.firebaseUid !== firebaseUid) {
+     if (phoneOwner) {
          throw new ConflictError('Phone number already registered');
      }
  };
```

#### 7.4.2 Update `createCustomerOnboarding`

The function now receives the `phoneNumber` directly from the valid `onboardingToken`. Instead of searching by `firebaseUid`, we enforce unique checks and then freshly create the user. Finally we generate the authentication tokens using the `authService` layer.

```javascript
import * as authService from './auth.service.js';

export const createCustomerOnboarding = async (phoneNumber, profileData, file) => {
    if (!file) throw new BadRequestError('Profile photo is required');

    await ensureUniqueUserIdentity({
        email: profileData.email,
        phoneNumber: phoneNumber,
    });

    // ... location parsing ...

    const user = await userRepository.create({
        phoneNumber: phoneNumber,
        email: profileData.email,
        roleType: ROLES.CUSTOMER,
    });

    const profile = await customerProfileRepo.create({
        userId: user._id,
        // ... mapped profileData fields ...
    });

    const tokens = authService.generateTokenPair(user._id, user.roleType);
    const refreshHash = authService.hashToken(tokens.refreshToken);
    await userRepository.updateById(user._id, { refreshTokenHash: refreshHash });

    return { user, profile, tokens };
};
```

#### 7.4.3 Update `createBarberOnboarding`

Identical logic wrapper mapping the `phoneNumber` verification and returning full session tokens.

```javascript
export const createBarberOnboarding = async (phoneNumber, shopData, files) => {
    // We pass phoneNumber explicitly, so we override the normalizeBarberOnboardingInput requirement of authUser.
    const normalized = normalizeBarberOnboardingInput({ phoneNumber }, shopData);
    
    await ensureUniqueUserIdentity({
        email: normalized.email,
        phoneNumber: normalized.phoneNumber,
    });

    // ... Validation and Image Handlers ...

    const user = await userRepository.create({
        phoneNumber: normalized.phoneNumber,
        email: normalized.email,
        roleType: ROLES.BARBER,
    });

    const createdShop = await shopRepository.create({
         ownerId: user._id,
         // ... rest stays the same ...
    });

    const tokens = authService.generateTokenPair(user._id, user.roleType);
    const refreshHash = authService.hashToken(tokens.refreshToken);
    await userRepository.updateById(user._id, { refreshTokenHash: refreshHash });

    return { user, shop: serializeBarberProfile(createdShop, { photos }), photos, tokens };
};
```

#### 7.4.4 Update Onboarding Validators

**File:** `src/validators/onboarding.validator.js`

Remove `phoneNumber` from onboarding schemas — it's already verified and stored on the user from OTP:

```diff
  export const customerOnboardingSchema = Joi.object({
-     phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      firstName: Joi.string().trim().min(1).max(50).required(),
      // ... rest unchanged ...
  });

  export const barberOnboardingSchema = Joi.object({
-     phoneNumber: Joi.string(),
      email: Joi.string().email(),
      // ... rest unchanged ...
  });
```

> **Rationale:** The phone number is already verified during OTP and securely passed as part of the `onboardingToken`. Accepting it again from the form body is redundant and introduces a trust gap (the client could submit a different number). The service accesses the verified number from `req.onboardingContext.phoneNumber` exclusively.

### 7.5 Update User Repository

**File:** `src/repositories/user.repository.js`

Remove `findByFirebaseUid` (already documented in [§6.7](#67-user-repository-updates)):

```diff
- async findByFirebaseUid(firebaseUid, options = {}) {
-     return User.findOne({ firebaseUid }, null, options);
- }
```

### 7.6 Update Upload Middleware

**File:** `src/middleware/upload.middleware.js`

```diff
- const resolveActorKey = (req) => req.user?._id?.toString() || req.user?.firebaseUid || 'anonymous';
+ const resolveActorKey = (req) => req.user?._id?.toString() || 'anonymous';
```

### 7.7 Clean Up Model Comments

Remove historical `firebaseUid` comments from these files:

| File | Comment to remove |
|---|---|
| `models/shop.model.js` | *"ownerId replaces firebaseUid"* |
| `models/service.model.js` | *"Replaces old model that used firebaseUid"* |
| `models/photo.model.js` | *"firebaseUid → shopId"* |
| `models/employee.model.js` | *"shopId replaces old firebaseUid"* |
| `utils/logger.js` | Rename *"Firebase private keys"* → *"private keys"* |

### 7.7a Update Authorize Middleware

**File:** `src/middleware/authorize.middleware.js`

The authorize middleware currently checks `req.user.isNewUser` — a flag that was set by the old Firebase authenticate middleware for users not yet in the DB. Since we now use the `onboardingToken` for un-profiled users, any request reaching here with an access token is guaranteed to have a valid role in DB. Simply remove the obsolete `isNewUser` check:

```diff
  export const authorize = (...allowedRoles) => {
      return (req, _res, next) => {
          if (!req.user) {
              return next(new UnauthorizedError('Authentication required'));
          }

-         if (req.user.isNewUser) {
-             // PENDING users can only access onboarding endpoints
-             return next(new ForbiddenError('Please complete your profile first'));
-         }

          if (!allowedRoles.includes(req.user.roleType)) {
              return next(
                  new ForbiddenError(
                      `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
                  ),
              );
          }

          next();
      };
  };
```

> **Onboarding routes** use `authenticateOnboarding`. All other route groups (customer, barber) use standard token authentication + `authorize(ROLES.CUSTOMER)` or `authorize(ROLES.BARBER)`.

### 7.8 Clean Up Scripts

**File:** `src/controllers/barber/barber-profile.controller.js`

```diff
- const result = await accountService.signOutEverywhere(req.user.firebaseUid);
+ const result = await accountService.signOutEverywhere(req.user._id);
```

**Files to delete:**

| File | Reason |
|---|---|
| `scripts/firebase-token-gen.js` | Firebase test token generator — no longer needed |
| `scripts/verify-token.js` | Firebase token verifier — replace with JWT helper if desired |
| `scripts/test-tokens.txt` | Generated Firebase tokens (delete if present locally) |
| `scripts/test-tokens.json` | Generated Firebase tokens (delete if present locally) |

**File:** `scripts/seed-barber-rating-mock-data.js` — Remove `firebaseUid` from all fixtures and refactor `upsertUser()`:

```diff
- const upsertUser = async ({ firebaseUid, phoneNumber, email, roleType }) => {
-     let user = await withDeleted(User.findOne({ firebaseUid }));
+ const upsertUser = async ({ phoneNumber, email, roleType }) => {
+     let user = await withDeleted(User.findOne({ phoneNumber }));
      if (!user) {
-         user = await User.create({ firebaseUid, phoneNumber, email, roleType });
+         user = await User.create({ phoneNumber, email, roleType });
      }
      return user;
  };
```

**File:** `scripts/regenerate-postman-collections.mjs` — Replace all `customer_firebase_token` → `customer_access_token` and `barber_firebase_token` → `barber_access_token`. Update descriptions and pre-request scripts. See [`MSG91-POSTMAN-UPDATES-GUIDE.md`](./MSG91-POSTMAN-UPDATES-GUIDE.md) for full details.

**File:** `scripts/README.md` — Remove all Firebase token generation and verification instructions.

### 7.9 Clean Up Environment & Config

**Remove from `.env` and `.env.example`:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_API_KEY`
- The `# ── Firebase` section header

**Remove from `.gitignore`** (Firebase-specific entries only):

```diff
- # Firebase service account keys or any secrets
- firebase-admin-sdk.json
- *-firebase-adminsdk-*.json
- # Firebase test tokens (in any location)
- firebase-tokens.txt
```

### 7.10 Remove Firebase Dependency

```bash
npm uninstall firebase-admin
```

**Verify:** `npm ls firebase-admin` should show `(empty)`.

**Final check — zero Firebase references in source code:**

```bash
rg -n "firebase|firebaseUid|Firebase" src/
rg -n "firebase|firebaseUid|Firebase" scripts/
rg -n "FIREBASE" .env .env.example
```

> Searches in `docs/` will match historical files (`IMPLEMENTATION-PLAN.md`, `SECURITY_AUDIT.md`, etc.) — this is expected and acceptable. Those serve as historical records.

---

## 8. Security Best Practices

| Practice | Implementation |
|---|---|
| **Never expose MSG91 auth key** | Only in `.env`, all API calls server-side only |
| **Rate limiting (send)** | 5/phone + 10/IP per 15-min window |
| **Rate limiting (verify)** | 10/phone per 15-min window |
| **Input validation** | Joi schemas; 10-digit Indian mobile regex |
| **Phone number normalization** | Always store with `+91` prefix |
| **JWT secrets** | Min 64 chars, cryptographically random, different for access vs refresh |
| **Refresh token rotation** | New pair on every refresh; hash mismatch = revoke all |
| **Token storage (DB)** | SHA-256 hash only |
| **HTTPS only** | Enforce in production |
| **Sensitive data logging** | Phone numbers masked to last 4 digits |
| **Test mode isolation** | Production guard built into `sms-provider.service.js` |

---

## 9. Error Handling

All errors follow the existing `AppError` hierarchy:

| Scenario | Error Class | Status | Message |
|---|---|---|---|
| Invalid mobile format | `BadRequestError` | 400 | Joi validation message |
| Invalid OTP format | `BadRequestError` | 400 | "OTP must be exactly 6 digits" |
| Wrong/expired OTP | `BadRequestError` | 400 | "Invalid or expired OTP" |
| OTP send failure | `BadRequestError` | 400 | "Failed to send OTP" |
| MSG91 API unavailable | `AppError` | 503 | "SMS service unavailable" |
| Rate limit exceeded | `TooManyRequestsError` | 429 | "Too many requests…" |
| Invalid access token | `UnauthorizedError` | 401 | "Invalid or expired access token" |
| Invalid refresh token | `UnauthorizedError` | 401 | "Invalid or expired refresh token" |
| Refresh token mismatch | `UnauthorizedError` | 401 | "Session invalidated" |
| Inactive/deleted account | `UnauthorizedError` | 401 | "Account is inactive or deleted" |
| PENDING user accessing non-onboarding route | `ForbiddenError` | 403 | "Please complete your profile first" |
| Already-onboarded user attempting onboarding | `ConflictError` | 409 | "User is already onboarded" |

---

## 10. Future SMS Use Cases

The `sms-provider.service.js` abstraction supports future SMS needs:

| Use Case | Extension |
|---|---|
| **Booking confirmation** | Add `sendTransactionalSms()` with new DLT template |
| **Appointment reminders** | Same + scheduled job (e.g., `node-cron`) |
| **Promotional SMS** | MSG91 Campaign API + promotional DLT template |
| **WhatsApp notifications** | MSG91 WhatsApp Business API |
| **Multi-country OTP** | Accept country code parameter, remove hardcoded `91` |
| **Provider switch** | New provider file with same function signatures; swap import |

**Provider interface contract** — any future SMS provider must export:

```javascript
export const sendOtp = async (mobile) => { /* { success, requestId } */ };
export const verifyOtp = async (mobile, otp) => { /* { success, message } */ };
export const resendOtp = async (mobile, retryType) => { /* { success } */ };
```

---

## 11. API Endpoint Matrix

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/otp/send` | ❌ Public | Send OTP to phone number |
| `POST` | `/api/v1/auth/otp/verify` | ❌ Public | Verify OTP + authenticate |
| `POST` | `/api/v1/auth/otp/resend` | ❌ Public | Resend OTP (text/voice) |
| `POST` | `/api/v1/auth/token/refresh` | ❌ Public | Refresh access token |
| `POST` | `/api/v1/auth/logout` | ✅ Required | Revoke refresh token |

---

## 12. File Map — All Changes at a Glance

```text
server/
├── firebase-admin-sdk.json                  ← DELETE
├── .env.example                             ← UPDATE: remove FIREBASE_*, add MSG91 + JWT vars
├── .env                                     ← UPDATE: remove FIREBASE_*, add MSG91 + JWT vars
├── .gitignore                               ← REMOVE: Firebase-specific ignore entries
├── package.json                             ← ADD: jsonwebtoken; REMOVE: firebase-admin
└── src/
    ├── config/
    │   ├── firebase.config.js               ← DELETE
    │   └── index.js                         ← REPLACE: firebase → msg91 + jwt config
    ├── controllers/
    │   ├── auth.controller.js               ← REWRITE: OTP + token + logout handlers
    │   ├── onboarding.controller.js         ← REFACTOR: pass req.user (not firebaseUid/phoneNumber)
    │   └── barber/
    │       └── barber-profile.controller.js  ← UPDATE: signOutEverywhere(req.user._id)
    ├── middleware/
    │   ├── authenticate.middleware.js        ← REWRITE: JWT-only; includes emailVerified in req.user
    │   ├── authorize.middleware.js           ← UPDATE: Remove obsolete isNewUser check
    │   ├── otp-rate-limiter.middleware.js    ← NEW
    │   └── upload.middleware.js              ← REMOVE: firebaseUid fallback
    ├── models/
    │   ├── user.model.js                    ← REMOVE: firebaseUid; ADD: refreshTokenHash, emailVerified;
    │   ├── shop.model.js                    ← REMOVE: Firebase comments
    │   ├── service.model.js                 ← REMOVE: Firebase comments
    │   ├── photo.model.js                   ← REMOVE: Firebase comments
    │   └── employee.model.js                ← REMOVE: Firebase comments
    ├── repositories/
    │   └── user.repository.js               ← REMOVE: findByFirebaseUid(); ADD: findByIdWithRefreshHash()
    ├── routes/
    │   └── auth.routes.js                   ← REWRITE: OTP + token + logout routes
    ├── services/
    │   ├── auth.service.js                  ← REWRITE: JWT tokens, OTP session (creates onboardingToken),
    │   │                                       refresh rotation
    │   ├── account.service.js               ← REFACTOR: remove firebase-admin, use JWT revocation
    │   ├── onboarding.service.js            ← REFACTOR: receives phoneNumber, CREATES fully verified user
    │   │                                       (instead of updating); ensureUniqueUserIdentity uses email/phone combo
    │   ├── shop.service.js                  ← UPDATE: align business profile updates with final ownership boundaries
    │   ├── otp.service.js                   ← NEW
    │   └── sms-provider.service.js          ← NEW
    ├── utils/
    │   ├── constants.js                     ← ADD: ONBOARDING token type, OTP + TOKEN_TYPE constants
    │   └── logger.js                        ← UPDATE: rename "Firebase private keys" comment
    └── validators/
        ├── auth.validator.js                ← REWRITE: OTP + token schemas
        └── onboarding.validator.js          ← UPDATE: align onboarding payload validation
                                                with the final request contracts
```

---

## 13. Pre-Launch Checklist

### Backend Implementation

- [ ] `jsonwebtoken` installed, `firebase-admin` uninstalled
- [ ] `firebase.config.js` and `firebase-admin-sdk.json` deleted
- [ ] All `FIREBASE_*` env vars removed from `.env` and `.env.example`
- [ ] `config/index.js` updated — `firebase` section removed, `msg91` + `jwt` sections added
- [ ] `sms-provider.service.js` created and tested
- [ ] `otp.service.js` created and tested
- [ ] `auth.service.js` fully rewritten — issues `onboardingToken` for new users, `accessToken` for returning
- [ ] `auth.validator.js` rewritten with OTP/token schemas
- [ ] `otp-rate-limiter.middleware.js` created
- [ ] `auth.controller.js` rewritten — always returns tokens (new + returning users)
- [ ] `auth.routes.js` rewritten with all new routes
- [ ] `authenticate.middleware.js` rewritten for JWT-only — explicit rejection of onboarding tokens
- [ ] `authenticate-onboarding.middleware.js` added — valid onboarding tokens allowed
- [ ] `authorize.middleware.js` updated — obsolete `isNewUser` check removed entirely
- [ ] `user.model.js` changes applied:
  - [ ] `firebaseUid` removed
  - [ ] `refreshTokenHash` added (select: false)
  - [ ] `emailVerified` added (Boolean, default: false)
  - [ ] Keeps `email` strictly required and strictly unique
- [ ] `user.repository.js` — `findByFirebaseUid()` removed, `findByIdWithRefreshHash()` added
- [ ] `constants.js` updated — `ONBOARDING` token type added, OTP + TOKEN_TYPE constants
- [ ] `account.service.js` refactored to use JWT revocation
- [ ] `onboarding.controller.js` refactored — relies on `req.onboardingContext.phoneNumber`
- [ ] `onboarding.service.js` refactored — explicitly CREATES user upon completion of the profile
- [ ] `onboarding.validator.js` — onboarding payload validation aligned with the final contracts
- [ ] `shop.model.js` — schema aligned with the final entity boundaries
- [ ] `shop.service.js` — business profile update handling aligned with the final ownership boundaries
- [ ] `shop.validator.js` and `onboarding.validator.js` — validators aligned with the supported request fields
- [ ] `barber-profile.utils.js` — serialization functions updated to join identity from `User` instead of `Shop`
- [ ] `barber-profile.controller.js` updated to pass `req.user._id` to `signOutEverywhere`
- [ ] `upload.middleware.js` — `firebaseUid` fallback removed
- [ ] Firebase-related model comments removed
- [ ] Seed script updated to use `phoneNumber` identity
- [ ] All OTP endpoints tested (test mode)
- [ ] Refresh token rotation tested (happy path + theft detection)
- [ ] New user → OTP → onboardingToken → CUSTOMER onboarding flow tested end-to-end
- [ ] New user → OTP → onboardingToken → BARBER onboarding flow tested end-to-end
- [ ] Onboarding tokens blocked from standard API routes (401 test)
- [ ] Already-onboarded user bypassing OTP to reuse old onboarding token is blocked (409 test)
- [ ] Rate limiting tested (send + verify)
- [ ] `rg "firebase" src/` returns zero matches

### Security

- [ ] JWT secrets generated (64+ chars, cryptographically random)
- [ ] Different secrets for access vs refresh tokens
- [ ] MSG91 Auth Key in `.env` only
- [ ] Phone numbers masked in all log output
- [ ] Rate limits configured and tested
- [ ] CORS origins restricted in production
- [ ] HTTPS enforced in production

### External Setup

See **[`MSG91-EXTERNAL-SETUP-GUIDE.md`](./MSG91-EXTERNAL-SETUP-GUIDE.md)** for MSG91 account and DLT checklist.

### Postman & Tooling

See **[`MSG91-POSTMAN-UPDATES-GUIDE.md`](./MSG91-POSTMAN-UPDATES-GUIDE.md)** for collection updates.

### Client (Mobile App)

- [ ] App updated to use `/auth/otp/send` and `/auth/otp/verify`
- [ ] App handles `isNewUser: true` response → navigates to onboarding with token stored
- [ ] App sends `Bearer <onboardingToken>` in onboarding requests
- [ ] Token storage uses device secure storage (Keychain/Keystore)
- [ ] Auto-refresh logic implemented using `/auth/token/refresh`
- [ ] Logout calls `/auth/logout`
- [ ] Error handling for 401 (redirect to login), and 429 (show retry timer)

---

*This guide is designed for direct implementation within the EverCut `server/` codebase. Every code sample follows existing project conventions: ES Modules, Express 5 router patterns, Joi validation, the AppError/ApiResponse pattern, and the repository → service → controller → route layered architecture.*

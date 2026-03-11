# Security & Backend Code Audit Document

**Project:** EverCut — Salon & Barber Booking Platform API  
**Audit Date:** March 11, 2026  
**Scope:** `server/src/` — routes, middleware, controllers, services, repositories, models, utils, validators  
**Auditor:** Automated Backend Security Audit  
**Version:** 2.1.0 (Express 5 + Mongoose 9 + Firebase Admin)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Backend Architecture Overview](#2-backend-architecture-overview)
3. [Authentication & Authorization Audit](#3-authentication--authorization-audit)
4. [Identity Handling Violations (Critical Section)](#4-identity-handling-violations-critical-section)
5. [Security Vulnerabilities](#5-security-vulnerabilities)
6. [Layer Architecture Review](#6-layer-architecture-review)
7. [Code Quality & Maintainability](#7-code-quality--maintainability)
8. [Prioritized Recommendations & Refactoring Plan](#8-prioritized-recommendations--refactoring-plan)
9. [Issue Summary Table](#9-issue-summary-table)

---

## 1. Executive Summary

This audit covers the full backend codebase of the EverCut platform, evaluating authentication, authorization, identity handling, input validation, database access patterns, error handling, and architectural design across all layers.

### Overall Assessment: **GOOD with notable issues remaining**

The codebase demonstrates a well-structured, layered architecture with several security best-practices already implemented:

- ✅ Authentication via Firebase ID token verification with `req.user` propagation
- ✅ Role-based authorization middleware
- ✅ Joi input validation on all routes with `stripUnknown: true`
- ✅ Ownership verification in most service-layer operations
- ✅ `escapeRegex()` used to prevent ReDoS in user-supplied regex patterns
- ✅ Bcrypt hashing for PINs with plaintext rejection
- ✅ Sensitive field stripping (pinHash, cloudinaryIds) from API responses
- ✅ Structured logger with automatic secret redaction
- ✅ Soft-delete with query middleware for Users, Employees, Services, and Shops

However, the audit identified **3 Critical**, **5 High**, **8 Medium**, and **7 Low** severity issues that require attention.

---

## 2. Backend Architecture Overview

### 2.1 Layer Structure

```
┌──────────────────────────────────────────────────────┐
│                     app.js                           │
│  ┌─ requestLogger ─ CORS ─ bodyParser ─ routes ─ 404 ─ errorHandler ─┐
│  └───────────────────────────────────────────────────────────────────┘
├──────────────────────────────────────────────────────┤
│  Routes Layer (routes/*.routes.js)                   │
│  ├─ authenticate (Firebase token → req.user)         │
│  ├─ authorize (role check)                           │
│  ├─ upload (Multer/Cloudinary)                       │
│  ├─ validate (Joi schema)                            │
│  └─ Controller handler                               │
├──────────────────────────────────────────────────────┤
│  Controllers Layer (controllers/**/*.controller.js)  │
│  └─ Extracts req.user._id, req.body, req.params      │
│     Delegates to service functions                   │
├──────────────────────────────────────────────────────┤
│  Services Layer (services/*.service.js)              │
│  └─ Business logic, ownership checks, validation    │
│     Calls repositories                               │
├──────────────────────────────────────────────────────┤
│  Repositories Layer (repositories/*.repository.js)   │
│  └─ Mongoose queries — data access abstraction       │
├──────────────────────────────────────────────────────┤
│  Models Layer (models/*.model.js)                    │
│  └─ Mongoose schemas, indexes, soft-delete pre-hooks │
└──────────────────────────────────────────────────────┘
```

### 2.2 Authentication Flow

```
Client Request
    │
    ▼
[authenticate.middleware.js]
    ├─ Extract Bearer token from Authorization header
    ├─ Verify via Firebase Admin SDK (verifyIdToken with checkRevoked=true)
    ├─ Look up user in MongoDB by firebaseUid
    ├─ If existing user → attach { _id, firebaseUid, roleType, phoneNumber, email }
    ├─ If deleted/inactive → return 401
    └─ If new user → attach { firebaseUid, phoneNumber, email, isNewUser: true }
    │
    ▼
[authorize.middleware.js]
    ├─ Check req.user exists
    ├─ Block isNewUser from protected routes
    └─ Verify roleType matches allowed roles
    │
    ▼
[Controller → Service → Repository]
    └─ Uses req.user._id for all identity-scoped operations
```

### 2.3 Middleware Design

| Middleware | Purpose | Applied At |
|---|---|---|
| `requestLogger` | Logs method, URL, status, duration, IP | Global (app.js) |
| `cors` | Origin/method/header restrictions | Global (app.js) |
| `express.json/urlencoded` | Body parsing with 10MB limit | Global (app.js) |
| `authenticate` | Firebase token verification → `req.user` | Per-route / router-level |
| `authorize` | Role-based access control | Per-route / router-level |
| `upload*` | Multer + Cloudinary file upload | Per-route |
| `validate` | Joi schema validation (body/query/params) | Per-route |
| `errorHandler` | Global error catch-all | Global (app.js, last) |

---

## 3. Authentication & Authorization Audit

### 3.1 Route-Level Auth Coverage

#### Auth Routes (`/api/v1/auth/*`)
| Route | Auth | Authorize | Status |
|---|---|---|---|
| `POST /session` | ✅ `authenticate` | — | ✅ Correct — session bootstrap for both new and existing users |

#### Onboarding Routes (`/api/v1/onboarding/*`)
| Route | Auth | Authorize | Status |
|---|---|---|---|
| `POST /customers` | ✅ `authenticate` | — | ✅ Correct — no role check needed (new users) |
| `POST /barbers` | ✅ `authenticate` | — | ✅ Correct — no role check needed (new users) |

#### Barber Routes (`/api/v1/barber/*`)
| Route | Auth | Authorize | Status |
|---|---|---|---|
| All routes | ✅ `authenticate` | ✅ `authorize(BARBER)` | ✅ Correct — router-level middleware |

#### Customer Routes (`/api/v1/customer/*`)
| Route | Auth | Authorize | Status |
|---|---|---|---|
| All routes | ✅ `authenticate` | ✅ `authorize(CUSTOMER)` | ✅ Correct — router-level middleware |

**Verdict:** All user-specific routes are protected with authentication and appropriate role authorization. ✅

### 3.2 Identity Derivation Audit

The strict rule: **User identity MUST always come from `req.user` (set by auth middleware), NEVER from client input.**

#### Controllers Passing `req.user._id` to Services — Verified ✅

| Controller | Function | Identity Source | Status |
|---|---|---|---|
| `barber-booking.controller` | `getBookings` | `req.user._id` | ✅ |
| `barber-booking.controller` | `getBookingStats` | `req.user._id` | ✅ |
| `barber-booking.controller` | `updateBookingStatus` | `req.user._id` | ✅ |
| `barber-booking.controller` | `deleteBooking` | `req.user._id` | ✅ |
| `barber-booking.controller` | `getBookingsByStatus` | `req.user._id` | ✅ |
| `barber-earnings.controller` | `getEarnings` | `req.user._id` | ✅ |
| `barber-employee.controller` | `addEmployee` | `req.user._id` | ✅ |
| `barber-employee.controller` | `getEmployees` | `req.user._id` | ✅ |
| `barber-employee.controller` | `updateEmployee` | `req.user._id` | ✅ |
| `barber-employee.controller` | `deleteEmployee` | `req.user._id` | ✅ |
| `barber-photo.controller` | `uploadPhotos` | `req.user._id` | ✅ |
| `barber-photo.controller` | `getPhotos` | `req.user._id` | ✅ |
| `barber-photo.controller` | `getPhotoById` | `req.user._id` | ✅ |
| `barber-photo.controller` | `deletePhoto` | `req.user._id` | ✅ |
| `barber-photo.controller` | `getPhotoStats` | `req.user._id` | ✅ |
| `barber-profile.controller` | `getProfile` | `req.user._id` | ✅ |
| `barber-profile.controller` | `updatePin` | `req.user._id` | ✅ |
| `barber-profile.controller` | `updateCover` | `req.user._id` | ✅ |
| `barber-profile.controller` | `updatePicture` | `req.user._id` | ✅ |
| `barber-profile.controller` | `signOutEverywhere` | `req.user.firebaseUid` | ✅ |
| `barber-profile.controller` | `deleteAccount` | `req.user` (full object) | ✅ |
| `barber-rating.controller` | `getRatings` | `req.user._id` | ✅ |
| `barber-rating.controller` | `addReply` | `req.user._id` | ✅ |
| `barber-rating.controller` | `updateReply` | `req.user._id` | ✅ |
| `barber-rating.controller` | `deleteReply` | `req.user._id` | ✅ |
| `barber-rating.controller` | `removeRating` | `req.user._id` | ✅ |
| `barber-service.controller` | `addService` | `req.user._id` | ✅ |
| `barber-service.controller` | `getServices` | `req.user._id` | ✅ |
| `barber-service.controller` | `updateService` | `req.user._id` | ✅ |
| `barber-service.controller` | `deleteService` | `req.user._id` | ✅ |
| `barber-shop.controller` | `getShopProfile` | `req.user._id` | ✅ |
| `barber-shop.controller` | `updateBusinessInfo` | `req.user._id` | ✅ |
| `barber-shop.controller` | `getUpiDetails` | `req.user._id` | ✅ |
| `barber-shop.controller` | `updateUpiDetails` | `req.user._id` | ✅ |
| `barber-shop.controller` | `toggleShopStatus` | `req.user._id` | ✅ |
| `customer-booking.controller` | `bookSalon` | `req.user._id` | ✅ |
| `customer-booking.controller` | `getBookings` | `req.user._id` | ✅ |
| `customer-booking.controller` | `getBookingDetails` | `req.user._id` | ✅ |
| `customer-booking.controller` | `cancelBooking` | `req.user._id` | ✅ |
| `customer-booking.controller` | `rescheduleBooking` | `req.user._id` | ✅ |
| `customer-booking.controller` | `reorderBooking` | `req.user._id` | ✅ |
| `customer-booking.controller` | `toggleFavorite` | `req.user._id` | ✅ |
| `customer-booking.controller` | `getBookingConfirmation` | `req.user._id` | ✅ |
| `customer-booking.controller` | `updateBooking` | `req.user._id` | ✅ |
| `customer-booking.controller` | `deleteServiceFromBooking` | `req.user._id` | ✅ |
| `customer-profile.controller` | `getProfile` | `req.user._id` | ✅ |
| `customer-profile.controller` | `getHomeProfile` | `req.user._id` | ✅ |
| `customer-profile.controller` | `updateProfile` | `req.user._id` | ✅ |
| `customer-rating.controller` | `addRating` | `req.user._id` | ✅ |
| `auth.controller` | `createSession` | `req.user.firebaseUid` | ✅ |
| `onboarding.controller` | `createCustomerOnboarding` | `req.user.firebaseUid` | ✅ |
| `onboarding.controller` | `createBarberOnboarding` | `req.user.firebaseUid` | ✅ |

### 3.3 Service-Level Ownership Enforcement

| Service Function | Ownership Check | Status |
|---|---|---|
| `booking.getBookingDetails` | `booking.customerId === customerId` | ✅ |
| `booking.cancelBooking` | `booking.customerId === customerId` | ✅ |
| `booking.rescheduleBooking` | `booking.customerId === customerId` | ✅ |
| `booking.getBookingConfirmation` | `booking.customerId === customerId` | ✅ |
| `booking.updateBooking` | `booking.customerId === customerId` | ✅ |
| `booking.deleteServiceFromBooking` | `booking.customerId === customerId` | ✅ |
| `booking.updateBookingStatus` | `booking.shopId === shop._id` (via ownerId) | ✅ |
| `booking.deleteBookingAfterPayment` | `booking.shopId === shop._id` (via ownerId) | ✅ |
| `employee.updateEmployee` | `employee.shopId === shop._id` | ✅ |
| `employee.deleteEmployee` | softDelete scoped by `shopId` | ✅ |
| `photo.getPhotoById` | scoped by `shopId` via ownerId | ✅ |
| `photo.deletePhoto` | scoped by `shopId` via ownerId | ✅ |
| `rating.removeRating` | `rating.shopId === shop._id` | ✅ |
| `rating.addReplyToRating` | `rating.shopId === shop._id` | ✅ |
| `rating.updateReplyToRating` | `rating.shopId === shop._id` | ✅ |
| `rating.deleteReplyFromRating` | `rating.shopId === shop._id` | ✅ |
| `serviceCatalog.updateService` | scoped by `shopId` | ✅ |
| `serviceCatalog.deleteService` | scoped by `shopId` | ✅ |

---

## 4. Identity Handling Violations (Critical Section)

### VIOLATION-01 — Customer Onboarding Trusts Client-Supplied `phoneNumber` and `email`

| | |
|---|---|
| **Severity** | 🔴 **Critical** |
| **File** | `services/onboarding.service.js` — `createCustomerOnboarding()` (L254–295) |
| **Controller** | `controllers/onboarding.controller.js` — `createCustomerOnboarding()` (L7–14) |

**Code:**
```javascript
// controllers/onboarding.controller.js L9-10
const { firebaseUid } = req.user;
const result = await onboardingService.createCustomerOnboarding(firebaseUid, req.body, req.file);

// services/onboarding.service.js L275-280
const user = await userRepository.create({
    firebaseUid,
    phoneNumber: profileData.phoneNumber,   // ← FROM req.body
    email: profileData.email,                // ← FROM req.body
    roleType: ROLES.CUSTOMER,
});
```

**Issue:** The `phoneNumber` and `email` used to create the `User` record come directly from `req.body` (client input), not from the verified Firebase token. The authentication middleware already has `req.user.phoneNumber` (from `decoded.phone_number`) and `req.user.email` (from `decoded.email`), which are cryptographically verified by Firebase.

**Risk:** An attacker could register with someone else's phone number or email, creating a poisoned identity record. The `ensureUniqueUserIdentity` check only prevents duplicates with *different* firebase UIDs — it does not verify the phone/email actually belongs to the authenticating user.

**Recommended Fix:**
```javascript
// controllers/onboarding.controller.js
const { firebaseUid, phoneNumber, email } = req.user;
const result = await onboardingService.createCustomerOnboarding(
    firebaseUid,
    { ...req.body, phoneNumber, email },  // Override body with verified values
    req.file,
);

// services/onboarding.service.js — createCustomerOnboarding
// Use the firebaseUid-derived phone/email as the authoritative source
const user = await userRepository.create({
    firebaseUid,
    phoneNumber: profileData.phoneNumber, // Now guaranteed from req.user
    email: profileData.email,             // Now guaranteed from req.user
    roleType: ROLES.CUSTOMER,
});
```

---

### VIOLATION-02 — Barber Onboarding Trusts Client-Supplied `phoneNumber` and `emailId`

| | |
|---|---|
| **Severity** | 🔴 **Critical** |
| **File** | `services/onboarding.service.js` — `createBarberOnboarding()` (L297–379) |
| **Normalizer** | `normalizeBarberOnboardingInput()` (L108–234) |

**Code:**
```javascript
// onboarding.service.js L115 (normalizeBarberOnboardingInput)
const phoneNumber = String(shopData.phoneNumber || authUser?.phoneNumber || '').trim();
// Note: shopData.phoneNumber (from req.body) takes PRECEDENCE over authUser.phoneNumber

// onboarding.service.js L322-327
const user = await userRepository.create({
    firebaseUid,
    phoneNumber: normalized.phoneNumber,  // ← Could be from req.body
    email: normalized.emailId,            // ← From req.body
    roleType: ROLES.BARBER,
});
```

**Issue:** The normalization function prioritizes `shopData.phoneNumber` (client input) over `authUser.phoneNumber` (from `req.user`). The `emailId` has no verified source at all — it comes entirely from the request body. This means a barber can register with any phone number or email.

**Risk:** Identity spoofing — a barber could register a shop with someone else's contact information, undermining the trust model for the entire platform.

**Recommended Fix:**
```javascript
// Enforce: phoneNumber and email MUST come from Firebase-verified token
const phoneNumber = String(authUser?.phoneNumber || '').trim();
const emailId = String(authUser?.email || shopData.emailId || shopData.email || '').trim().toLowerCase();
// The shop form can provide emailId only as a FALLBACK if Firebase didn't supply one
```

---

### VIOLATION-03 — Customer Profile Update Accepts `email` from Request Body

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `services/user.service.js` — `updateProfile()` (L27–63) |
| **Validator** | `validators/customer.validator.js` — `updateCustomerProfileSchema` |

**Code:**
```javascript
// services/user.service.js L55-59
const updated = await customerProfileRepo.updateByUserId(userId, data);

// Also update email on User model if changed
if (data.email) {
    await userRepository.updateById(userId, { email: data.email });
}
```

**Issue:** The `email` field from `req.body` is used to update the User model's email without any verification (e.g., email confirmation link, Firebase re-verify). The validator allows any valid email string.

**Risk:** A customer can change their registered email to any arbitrary address, potentially hijacking someone else's email identity, or losing access recovery capability.

**Recommended Fix:**
Either:
1. Remove `email` from `updateCustomerProfileSchema` and the update flow entirely — email changes should go through Firebase's email verification flow.
2. Or add a verification step where the new email must be confirmed (e.g., Firebase `updateEmail` + email verification link).

---

### VIOLATION-04 — Business Info Update Accepts `phoneNumber` and `emailId` from Body

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `services/shop.service.js` — `updateBusinessInfo()` (L275–331) |

**Code:**
```javascript
// shop.service.js L302-313
if (updateData.emailId) {
    const existingEmailUser = await userRepository.findByEmail(updateData.emailId);
    if (existingEmailUser && String(existingEmailUser._id) !== String(ownerId)) {
        throw new ConflictError('Email already registered');
    }
}

if (updateData.phoneNumber) {
    const existingPhoneUser = await userRepository.findByPhone(updateData.phoneNumber);
    if (existingPhoneUser && String(existingPhoneUser._id) !== String(ownerId)) {
        throw new ConflictError('Phone number already registered');
    }
}

// shop.service.js L316-323
const updated = await shopRepository.updateByOwnerId(ownerId, updateData);
const userUpdates = {};
if (updateData.emailId) userUpdates.email = updateData.emailId;
if (updateData.phoneNumber) userUpdates.phoneNumber = updateData.phoneNumber;
if (Object.keys(userUpdates).length > 0) {
    await userRepository.updateById(ownerId, userUpdates);
}
```

**Issue:** The barber can update their phone number and email on both the Shop model *and* the User (identity) model using unverified client-supplied values. The only check is for uniqueness (no other user has the same email/phone), not for ownership.

**Risk:** A barber could set their contact info to any arbitrary phone number or email they don't own, potentially receiving someone else's communications or impersonating another business.

**Recommended Fix:**
- Phone number changes should require SMS re-verification via Firebase.
- Email changes should require email verification.
- At minimum, remove `phoneNumber` and `emailId` from `ALLOWED_UPDATE_FIELDS` for the User model sync — only allow updating these on the Shop model as display/contact fields, keeping the User identity fields locked to Firebase-verified values.

---

## 5. Security Vulnerabilities

### SEC-01 — No Rate Limiting Applied

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `app.js`, `config/index.js` |

**Issue:** The config defines `security.rateLimitWindowMs` and `security.rateLimitMax`, but **no rate limiting middleware** is actually applied in `app.js`. There is no `express-rate-limit` or `helmet` in `package.json`.

**Risk:** The API is vulnerable to brute-force attacks (e.g., PIN guessing on `PUT /barber/profile/pin`), credential stuffing, and denial-of-service. The PIN is only 4 digits, meaning 10,000 possible combinations — trivially brutable without rate limiting.

**Recommended Fix:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Stricter limit on sensitive endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
router.put('/profile/pin', authLimiter, validate(...), profileCtrl.updatePin);
router.delete('/profile', authLimiter, validate(...), profileCtrl.deleteAccount);
```

---

### SEC-02 — No `helmet` Security Headers

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `app.js`, `package.json` |

**Issue:** The application does not set any security HTTP headers. There is no `helmet` middleware for `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, etc.

**Risk:** Missing headers expose the API to clickjacking, MIME-sniffing, and other well-known HTTP security issues.

**Recommended Fix:**
```bash
npm install helmet
```
```javascript
import helmet from 'helmet';
app.use(helmet());
```

---

### SEC-03 — Transaction Not Used in `reorderBooking` Session Properly

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `services/booking.service.js` — `reorderBooking()` (L184–229) |

**Code:**
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
    const existing = await bookingRepository.findById(bookingId);  // ← NOT using session
    // ...
    const employee = await employeeRepository.claimSlot(...);       // ← NOT using session
    const newBooking = await bookingRepository.create({...});       // ← NOT using session

    await session.commitTransaction();
```

**Issue:** A MongoDB session is started and a transaction is opened, but **none of the individual operations pass the session** to their queries. This means the operations are not actually transactional — they execute outside the transaction context. The commit/abort is a no-op.

**Risk:** Concurrent requests could result in double-booked slots, orphaned bookings, or inconsistent state. The transaction provides no atomicity as written.

**Recommended Fix:** Pass `{ session }` to all Mongoose operations within the transaction, or restructure to not use sessions at all (and use compensating transactions instead, which is what the current code functionally does).

---

### SEC-04 — Reorder Booking Missing Ownership Check

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `services/booking.service.js` — `reorderBooking()` (L184–229) |

**Code:**
```javascript
export const reorderBooking = async (customerId, bookingId, newDate, newTime) => {
    const existing = await bookingRepository.findById(bookingId);
    if (!existing) { /* ... */ throw new NotFoundError('Original booking'); }

    // ❌ NO OWNERSHIP CHECK — any customer can reorder any booking
    // Missing: if (existing.customerId.toString() !== customerId.toString()) { throw ... }
```

**Issue:** Unlike `cancelBooking`, `rescheduleBooking`, `getBookingDetails`, etc., the `reorderBooking` function does **not** verify that the `customerId` matches `existing.customerId`. Any authenticated customer can re-order any other customer's booking.

**Risk:** IDOR (Insecure Direct Object Reference) — cross-user data access. An attacker knowing or guessing a booking ID can create a duplicate booking using another customer's service/employee/shop selections.

**Recommended Fix:**
```javascript
if ((existing.customerId._id || existing.customerId).toString() !== customerId.toString()) {
    throw new ForbiddenError('You can only reorder your own bookings');
}
```

---

### SEC-05 — Favorite Toggle is `$addToSet` Only — No True Toggle

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `services/booking.service.js` — `addToFavorites()` (L249–251) |
| **Repository** | `repositories/customer-profile.repository.js` — `addFavoriteBooking()` |

**Code:**
```javascript
// booking.service.js
export const addToFavorites = async (customerId, bookingId) => {
    return customerProfileRepo.addFavoriteBooking(customerId, bookingId);
};

// customer-profile.repository.js
async addFavoriteBooking(userId, bookingId) {
    return CustomerProfile.findOneAndUpdate(
        { userId },
        { $addToSet: { favoriteBookings: bookingId } },
        { new: true },
    );
}
```

**Issue:** The route is `PUT /bookings/:id/favorite` and the controller calls `addToFavorites`, but this only adds — never removes. The `removeFavoriteBooking` method exists in the repository but is never called. The endpoint name implies toggling behavior.

**Risk:** Functional bug rather than security vulnerability, but the `favoriteBookings` array will only grow, and there's no way for customers to unfavorite a booking via the API.

**Recommended Fix:**
```javascript
export const toggleFavorite = async (customerId, bookingId) => {
    const profile = await customerProfileRepo.findByUserId(customerId);
    if (!profile) throw new NotFoundError('Customer profile');

    const isFavorited = profile.favoriteBookings.some(
        (id) => id.toString() === bookingId.toString(),
    );

    if (isFavorited) {
        return customerProfileRepo.removeFavoriteBooking(customerId, bookingId);
    }
    return customerProfileRepo.addFavoriteBooking(customerId, bookingId);
};
```

---

### SEC-06 — Earnings Aggregation Uses `createdAt` Instead of `date`

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `repositories/booking.repository.js` — `getEarningsAggregation()` (L124–153) |

**Code:**
```javascript
$group: {
    _id: '$employeeId',
    totalEarning: { $sum: '$totalAmount' },
    lastMonthEarning: {
        $sum: {
            $cond: [
                { $and: [
                    { $gte: ['$createdAt', startOfLastMonth] },
                    { $lte: ['$createdAt', endOfLastMonth] }
                ]},
                '$totalAmount', 0,
            ],
        },
    },
    todayEarning: {
        $sum: {
            $cond: [
                { $and: [
                    { $gte: ['$createdAt', startOfToday] },
                    { $lt: ['$createdAt', endOfToday] }
                ]},
                '$totalAmount', 0,
            ],
        },
    },
},
```

**Issue:** The aggregation filters by `createdAt` (when the booking document was created) rather than `date` (the actual appointment date). This means a booking created today for an appointment next week would count as "today's earning" — which is semantically incorrect.

**Risk:** Inaccurate financial reporting for barbers. Could lead to business decisions based on wrong data.

**Recommended Fix:** Use `$date` field instead of `$createdAt` for time-based earnings calculations.

---

### SEC-07 — `searchShops` Bypasses Repository Layer

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `services/service-catalog.service.js` — `searchShops()` (L84–88) |

**Code:**
```javascript
export const searchShops = async (query) => {
    const Shop = (await import('../models/shop.model.js')).default;
    return Shop.find({ shopName: { $regex: new RegExp(escapeRegex(query), 'i') } })
        .select('shopName address location phoneNumber category coverUrl');
};
```

**Issue:** This function directly imports and queries the `Shop` model, bypassing the `ShopRepository`. This violates the layered architecture and means any changes to query behavior (e.g., soft-delete filtering) must be maintained in two places.

**Risk:** Architectural violation. While soft-delete middleware on the model's `pre(/^find/)` hook still applies, bypassing the repository means future repository-level changes (pagination, audit logging, etc.) won't be applied here.

**Recommended Fix:** Add a `searchByName(query, selectFields)` method to `ShopRepository` and call it from the service.

---

### SEC-08 — `getServicesByGender` Bypasses Repository Layer

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `services/service-catalog.service.js` — `getServicesByGender()` (L90–94) |

**Code:**
```javascript
export const getServicesByGender = async (gender) => {
    const Service = (await import('../models/service.model.js')).default;
    return Service.find({ serviceFor: gender, isActive: true })
        .select('serviceName shopId serviceFor serviceType');
};
```

**Issue:** Same as SEC-07 — direct model access instead of going through the repository.

**Recommended Fix:** Use `serviceRepository.findByShopIds()` or add a new `findByGender()` method to `ServiceRepository`.

---

### SEC-09 — `barber-profile.controller.js` Directly Uses Repository

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `controllers/barber/barber-profile.controller.js` (L5, L25–32) |

**Code:**
```javascript
import shopRepository from '../../repositories/shop.repository.js';

// In updatePin:
const shop = await shopRepository.findByOwnerId(req.user._id);
if (!shop) throw new NotFoundError('Shop profile');
// ...
await shopRepository.updateByOwnerId(req.user._id, { pinHash: newHash });
```

**Issue:** The controller directly imports and calls `shopRepository`, bypassing the service layer. PIN update logic should be in a service function.

**Risk:** Architectural violation — business logic (PIN verification + hashing + update) lives in the controller instead of the service layer. This makes unit testing harder and creates inconsistency.

**Recommended Fix:** Create a `pinService.updateShopPin(ownerId, currentPin, newPin, confirmNewPin)` function and call it from the controller.

---

### SEC-10 — CORS Allows All Origins in Non-Production

| | |
|---|---|
| **Severity** | 🟠 **Medium** |
| **File** | `app.js` (L28–35) |

**Code:**
```javascript
cors({
    origin: config.env === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : '*',
})
```

**Issue:** In development/staging environments, CORS is set to `*` (any origin). While this is common for development, it should at minimum be restricted in staging to prevent unintended access.

**Risk:** If a staging server is internet-accessible, any website can make API calls to it.

**Recommended Fix:** Use explicit allowed origins for staging, or restrict `*` only in true local development.

---

### SEC-11 — Body Parser Limit of 10MB Is Excessive for a JSON API

| | |
|---|---|
| **Severity** | 🟢 **Low** |
| **File** | `app.js` (L38–39) |

**Code:**
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**Issue:** A 10MB body limit is unusually large for a JSON-only API. File uploads go through Multer (multipart), not the JSON body parser. The largest JSON payloads in this API are onboarding requests with a few KB of data.

**Risk:** Memory exhaustion — a malicious client could send many 10MB JSON payloads to overwhelm server memory.

**Recommended Fix:** Reduce to `256kb` or `1mb` for the JSON parser. The file upload limits are already correctly managed by Multer.

---

### SEC-12 — `firebase-admin-sdk.json` Exists in Server Root

| | |
|---|---|
| **Severity** | 🟢 **Low** |
| **File** | `server/firebase-admin-sdk.json` |

**Issue:** The Firebase Admin SDK service account JSON file is stored in the project directory. While it's likely `.gitignore`d, its presence as a file (rather than environment variables) increases the risk of accidental exposure.

**Risk:** If this file is accidentally committed or the server filesystem is compromised, the Firebase project's admin credentials are exposed.

**Recommended Fix:** The project already loads Firebase config from environment variables in `config/index.js`. Remove the JSON file and ensure all deployment environments use environment variables exclusively.

---

### SEC-13 — `Booking.customerId` Populated to `User` But Model References `CustomerProfile`

| | |
|---|---|
| **Severity** | 🟢 **Low** |
| **File** | `repositories/booking.repository.js` (L16, L40, L88) |

**Code:**
```javascript
// findByIdPopulated
.populate('customerId', 'firstName lastName email')

// findByCustomer
.populate('customerId')    // implied full populate
```

**Issue:** `Booking.customerId` references the `User` model, but `firstName`/`lastName` are on `CustomerProfile`, not `User`. The populate selects `firstName lastName email` from `User`, but `User` doesn't have `firstName` or `lastName` — those are on `CustomerProfile.firstName/.lastName`.

**Risk:** The populated `customerId` will have `undefined` for `firstName` and `lastName`. The `email` field will work correctly since it's on `User`.

**Recommended Fix:** Either:
1. Populate through the `CustomerProfile` model (add a virtual or change the reference), or
2. Do a separate `customerProfileRepo.findByUserId()` call to get name data.

---

### SEC-14 — Ratings `findByShop` Populates Customer Fields from Wrong Model

| | |
|---|---|
| **Severity** | 🟢 **Low** |
| **File** | `repositories/rating.repository.js` — `findByShop()` (L12–16) |

**Code:**
```javascript
async findByShop(shopId) {
    return Rating.find({ shopId })
        .populate('customerId', 'firstName lastName email')
        .sort({ createdAt: -1 });
}
```

**Issue:** Same as SEC-13. `Rating.customerId` references `User`, but `firstName`/`lastName` are on `CustomerProfile`. The populate will return `undefined` for name fields.

**Risk:** Rating displays will show `'Unknown'` for all customer names (the services have a fallback `r.customerId?.firstName || 'Unknown'`).

**Recommended Fix:** Same approach as SEC-13.

---

### SEC-15 — No Input Sanitization on `data` Object in `user.service.updateProfile`

| | |
|---|---|
| **Severity** | 🟢 **Low** |
| **File** | `services/user.service.js` — `updateProfile()` (L27–63) |

**Code:**
```javascript
export const updateProfile = async (userId, data, file) => {
    // ...
    if (file) {
        data.photoUrl = file.path;
        data.cloudinaryId = file.filename || file.public_id;
    }
    // ...
    const updated = await customerProfileRepo.updateByUserId(userId, data);
```

**Issue:** The `data` object is `req.body` and is passed directly to `updateByUserId` with `$set`. While Joi validation with `stripUnknown: true` removes unexpected fields at the route level, mutating `req.body` directly is a code smell. If the Joi schema were misconfigured to `allowUnknown: true`, arbitrary fields could be set.

**Risk:** Low because `stripUnknown: true` is enforced, but defense-in-depth suggests whitelisting fields explicitly in the service.

**Recommended Fix:**
```javascript
const allowedFields = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'address', 'location'];
const updateData = {};
for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
}
if (file) {
    updateData.photoUrl = file.path;
    updateData.cloudinaryId = file.filename || file.public_id;
}
```

---

### SEC-16 — `bookSalon` Accepts `amount` from Client Input

| | |
|---|---|
| **Severity** | 🟡 **High** |
| **File** | `services/booking.service.js` — `bookSalon()` (L17–78) |
| **Validator** | `validators/booking.validator.js` — `bookSalonSchema` (L13) |

**Code:**
```javascript
// Validator allows optional 'amount'
amount: Joi.number().min(0).optional(),

// Service uses it as fallback
const totalAmount = amount || services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);
```

**Issue:** The client can supply a custom `amount` field that overrides the server-calculated total from service prices. Because of the `||` operator, if `amount` is provided and is any truthy value, it will be used instead of the server-computed sum.

**Risk:** A malicious client can set `amount: 0` or `amount: 1` to book services at any price. This is a price manipulation vulnerability.

**Recommended Fix:** Always compute the amount server-side. Remove `amount` from the Joi schema and the service:
```javascript
const totalAmount = services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);
```

---

## 6. Layer Architecture Review

### 6.1 Separation of Concerns

| Concern | Assessment | Notes |
|---|---|---|
| Routes define endpoints | ✅ Good | Clean route definitions with clear middleware chains |
| Controllers are thin | ✅ Good | Controllers only extract params and delegate to services |
| Business logic in services | ✅ Mostly good | Exception: PIN update logic in controller (SEC-09) |
| Data access in repositories | ✅ Mostly good | Exceptions: SEC-07, SEC-08 (direct model access in service) |
| Models define schema | ✅ Good | Clean schemas with proper indexes and soft-delete hooks |
| Validation in validators | ✅ Good | Comprehensive Joi schemas with custom validators |

### 6.2 Data Flow Assessment

```
Request → [Middleware] → Controller → Service → Repository → Model/DB
                                         ↑
                              Ownership checks happen HERE (correct!)
```

**Positive observations:**
- All ownership/authorization checks happen at the service layer, which is the correct location
- Controllers consistently pass `req.user._id` as the first argument to service functions
- Repository methods enforce `shopId` scoping in their queries (e.g., `{ _id: id, shopId }`)
- The validate middleware uses `stripUnknown: true` to remove unexpected fields

### 6.3 Consistency Issues

1. **Mixed service function naming:** Some services use `get*` (e.g., `getProfile`), others don't have a `get` prefix for similar operations
2. **Repository class vs. modular export:** Repositories use class-based singletons (`new BookingRepository()`), while services use named exports. Both patterns work, but consistency would improve maintainability.
3. **Error types:** Services use `BadRequestError` for authorization failures in some places (ratings) instead of `ForbiddenError`. The error type should match the security semantics.

---

## 7. Code Quality & Maintainability

### 7.1 Positive Observations

| Area | Assessment |
|---|---|
| **Error hierarchy** | Well-designed custom error classes with proper HTTP status codes |
| **API response format** | Consistent `ApiResponse.success()`/`.error()` envelope |
| **Validation** | Comprehensive Joi schemas covering all routes |
| **Input escaping** | `escapeRegex()` properly prevents ReDoS |
| **PIN security** | bcrypt hashing with plaintext rejection |
| **Logging** | Structured JSON logs with automatic secret redaction |
| **Soft delete** | Consistent pattern with query middleware across User, Shop, Employee, Service |
| **File upload** | Centralized Multer configuration with proper MIME type filtering |
| **Constants** | All magic strings centralized in `constants.js` with `Object.freeze()` |

### 7.2 Areas for Improvement

| Issue | Severity | Description |
|---|---|---|
| No unit tests | 🟠 Medium | No test files found — critical business logic is untested |
| No API documentation | 🟢 Low | No OpenAPI/Swagger spec for the API |
| Duplicate normalization | 🟢 Low | `normalizeBarberOnboardingInput` in `onboarding.service.js` and `normalizeUpdateBody` in `shop.service.js` have similar but not identical parsing logic |
| Duplicate `parseJsonIfString` | 🟢 Low | This helper exists in 3 different files — should be in `utils/` |
| No request ID tracking | 🟢 Low | The request logger doesn't generate/propagate a request ID for log correlation |
| `async` controller wrapper | 🟢 Low | All controllers follow the same try/catch/next(err) pattern — could use an `asyncHandler` wrapper to reduce boilerplate |

---

## 8. Prioritized Recommendations & Refactoring Plan

### Phase 1 — Critical Security Fixes (Immediate)

| # | Issue | Severity | Effort | Action |
|---|---|---|---|---|
| 1 | VIOLATION-01 | 🔴 Critical | Low | Override `req.body.phoneNumber`/`email` with `req.user` values in customer onboarding |
| 2 | VIOLATION-02 | 🔴 Critical | Low | Enforce `authUser.phoneNumber`/`email` as authoritative in barber onboarding |
| 3 | SEC-16 | 🟡 High | Low | Remove `amount` from `bookSalonSchema` and always compute server-side |
| 4 | SEC-04 | 🟡 High | Low | Add ownership check in `reorderBooking` |

### Phase 2 — High-Priority Security Hardening (Week 1)

| # | Issue | Severity | Effort | Action |
|---|---|---|---|---|
| 5 | SEC-01 | 🟡 High | Medium | Install and configure `express-rate-limit` with stricter limits on auth/PIN endpoints |
| 6 | SEC-02 | 🟡 High | Low | Install and configure `helmet` |
| 7 | VIOLATION-03 | 🟡 High | Medium | Add email verification flow or remove email update from profile |
| 8 | VIOLATION-04 | 🟡 High | Medium | Add phone/email verification for business info updates on User model |

### Phase 3 — Medium-Priority Fixes (Week 2)

| # | Issue | Severity | Effort | Action |
|---|---|---|---|---|
| 9 | SEC-03 | 🟠 Medium | Medium | Either pass session to all operations in `reorderBooking` or remove the session |
| 10 | SEC-05 | 🟠 Medium | Low | Implement true toggle logic for favorites |
| 11 | SEC-06 | 🟠 Medium | Low | Change earnings aggregation to use `date` field instead of `createdAt` |
| 12 | SEC-07/08 | 🟠 Medium | Low | Move `searchShops`/`getServicesByGender` to use repositories |
| 13 | SEC-09 | 🟠 Medium | Medium | Extract PIN update logic from controller to service |
| 14 | SEC-10 | 🟠 Medium | Low | Restrict CORS in staging environments |

### Phase 4 — Low-Priority Improvements (Week 3+)

| # | Issue | Severity | Effort | Action |
|---|---|---|---|---|
| 15 | SEC-11 | 🟢 Low | Low | Reduce JSON body limit to 1MB |
| 16 | SEC-12 | 🟢 Low | Low | Remove `firebase-admin-sdk.json` file from server root |
| 17 | SEC-13/14 | 🟢 Low | Medium | Fix customer name population in bookings/ratings |
| 18 | SEC-15 | 🟢 Low | Low | Add field whitelisting in `updateProfile` service |
| 19 | — | 🟢 Low | Low | Consolidate duplicate `parseJsonIfString` helpers into utils |
| 20 | — | 🟢 Low | Medium | Implement `asyncHandler` wrapper for controllers |
| 21 | — | 🟢 Low | High | Add comprehensive unit and integration tests |

---

## 9. Issue Summary Table

| ID | Title | Severity | Category | File(s) | Status |
|---|---|---|---|---|---|
| VIOLATION-01 | Customer onboarding trusts client phone/email | 🔴 Critical | Identity Handling | onboarding.service.js | Open |
| VIOLATION-02 | Barber onboarding trusts client phone/email | 🔴 Critical | Identity Handling | onboarding.service.js | Open |
| VIOLATION-03 | Profile update accepts unverified email | 🟡 High | Identity Handling | user.service.js | Open |
| VIOLATION-04 | Business update changes identity fields | 🟡 High | Identity Handling | shop.service.js | Open |
| SEC-01 | No rate limiting applied | 🟡 High | Security Config | app.js | Open |
| SEC-02 | No helmet security headers | 🟡 High | Security Config | app.js | Open |
| SEC-03 | Transaction not using session parameter | 🟠 Medium | Data Integrity | booking.service.js | Open |
| SEC-04 | Reorder booking missing ownership check | 🟡 High | Authorization | booking.service.js | Open |
| SEC-05 | Favorite toggle only adds, never removes | 🟠 Medium | Functional Bug | booking.service.js | Open |
| SEC-06 | Earnings uses createdAt instead of date | 🟠 Medium | Data Integrity | booking.repository.js | Open |
| SEC-07 | searchShops bypasses repository | 🟠 Medium | Architecture | service-catalog.service.js | Open |
| SEC-08 | getServicesByGender bypasses repository | 🟠 Medium | Architecture | service-catalog.service.js | Open |
| SEC-09 | Controller directly uses repository | 🟠 Medium | Architecture | barber-profile.controller.js | Open |
| SEC-10 | CORS allows all origins non-prod | 🟠 Medium | Security Config | app.js | Open |
| SEC-11 | 10MB body limit excessive | 🟢 Low | Security Config | app.js | Open |
| SEC-12 | Firebase SDK JSON in server root | 🟢 Low | Secret Management | server/ | Open |
| SEC-13 | Booking populates wrong model for names | 🟢 Low | Data Integrity | booking.repository.js | Open |
| SEC-14 | Rating populates wrong model for names | 🟢 Low | Data Integrity | rating.repository.js | Open |
| SEC-15 | No field whitelist in updateProfile | 🟢 Low | Defense-in-Depth | user.service.js | Open |
| SEC-16 | Client can override booking amount | 🟡 High | Price Manipulation | booking.service.js | Open |

---

**Total Issues Found: 20**
- 🔴 Critical: **3** (2 identity violations + 1 price manipulation reclassified below)
- 🟡 High: **5** (authorization bypass, missing security middleware, unverified identity updates)
- 🟠 Medium: **8** (functional bugs, architecture violations, data integrity)
- 🟢 Low: **7** (defense-in-depth, data display, cleanup)

> **Note:** SEC-16 (client-supplied `amount`) is classified as **High** due to direct financial impact, but could be elevated to **Critical** depending on whether payments are enforced server-side or client-side.

---

*End of Security & Backend Code Audit Document*

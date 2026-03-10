# EverCut Backend — Security & Code Audit Report

> **Audit Date:** March 10, 2026  
> **Scope:** `server/src/` — routes, middleware, controllers, services, repositories, models, utils, validators, config  
> **Application:** EverCut — Salon & Barber Booking Platform API  
> **Stack:** Node.js · Express 5 · MongoDB/Mongoose 9 · Firebase Auth · Cloudinary · Joi Validation  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Executive Summary](#2-executive-summary)
3. [Critical Issues](#3-critical-issues)
4. [High-Severity Issues](#4-high-severity-issues)
5. [Medium-Severity Issues](#5-medium-severity-issues)
6. [Low-Severity Issues](#6-low-severity-issues)
7. [Architectural Review](#7-architectural-review)
8. [Remediation Roadmap](#8-remediation-roadmap)
9. [Appendix — File Reference Index](#9-appendix--file-reference-index)

---

## 1. Architecture Overview

The EverCut backend follows a clean **layered architecture** pattern:

```
Routes → Middleware → Controllers → Services → Repositories → Models (Mongoose/MongoDB)
```

| Layer | Description |
|---|---|
| **Routes** | Define endpoints, attach middleware (auth, validation, upload) |
| **Middleware** | Authentication (Firebase), Authorization (RBAC), Validation (Joi), Upload (Multer + Cloudinary), Error Handling, Request Logging |
| **Controllers** | Thin request/response handlers — delegate to services |
| **Services** | Core business logic — booking, onboarding, shop management, ratings, etc. |
| **Repositories** | Data-access layer wrapping Mongoose queries |
| **Models** | Mongoose schemas with indexes, soft-delete middleware, enums |
| **Utils** | Shared helpers — custom errors, API response wrapper, logger, constants, time utilities |
| **Validators** | Joi schemas for request validation |
| **Config** | Centralized configuration from environment variables |

**Roles:** `CUSTOMER`, `BARBER`, `ADMIN` (ADMIN routes not yet implemented)

---

## 2. Executive Summary

The codebase demonstrates **good foundational architecture**. The layered separation of concerns, centralized error handling, structured logging with sensitive data redaction, Joi validation, and Firebase authentication are all well-implemented patterns.

However, the audit uncovered **several security vulnerabilities and bugs** that must be addressed before production use, ranging from critical authorization bypasses to medium-severity code quality issues.

| Severity | Count |
|---|---|
| 🔴 **Critical** | 4 |
| 🟠 **High** | 3 |
| 🟡 **Medium** | 6 |
| 🔵 **Low** | 8 |

---

## 3. Critical Issues

### 3.1 🔴 CRITICAL — ReDoS Vulnerability via Unsanitized User Input in Regex

**Files:**
- `src/services/shop.service.js` — Line 382
- `src/services/service-catalog.service.js` — Lines 79, 85
- `src/repositories/service.repository.js` — Lines 31–32, 44

**Description:**  
User-supplied strings (`gender`, `searchTerm`, `query`, `serviceName`) are interpolated directly into `RegExp` constructors without escaping special regex characters.

```javascript
// shop.service.js:382
const serviceFilter = { serviceFor: { $regex: new RegExp(`^${gender}$`, 'i') } };

// shop.service.js:383
if (searchTerm) serviceFilter.serviceName = { $regex: searchTerm, $options: 'i' };

// service-catalog.service.js:79
if (gender) filters.serviceFor = { $regex: new RegExp(`^${gender}$`, 'i') };

// service-catalog.service.js:85
Shop.find({ shopName: { $regex: query, $options: 'i' } })

// service.repository.js:32
serviceName: { $regex: new RegExp(`^${serviceName}$`, 'i') },
```

**Risk:** An attacker can craft input like `(a+)+$` causing catastrophic backtracking (ReDoS), hanging the Node.js event loop and effectively causing a **Denial of Service**. Additionally, special regex characters could subtly alter query logic.

**Remediation:**
```javascript
// Create a utility function:
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Usage:
const serviceFilter = { serviceFor: new RegExp(`^${escapeRegex(gender)}$`, 'i') };
```

---

### 3.2 🔴 CRITICAL — Missing Ownership Verification on Customer Booking Operations (IDOR)

**Files:**
- `src/controllers/customer/customer-booking.controller.js` — Lines 23–29, 32–38, 41–48, 70–76, 79–85, 88–94
- `src/services/booking.service.js` — Lines 82, 106, 131, 243, 262, 284

**Description:**  
Multiple customer booking operations (`getBookingDetails`, `cancelBooking`, `rescheduleBooking`, `getBookingConfirmation`, `updateBooking`, `deleteServiceFromBooking`) accept a booking ID from the URL parameter but **never verify that the booking belongs to the authenticated customer**.

```javascript
// customer-booking.controller.js:23-29
export const getBookingDetails = async (req, res, next) => {
    try {
        const result = await bookingService.getBookingDetails(req.params.id);
        // ❌ No check: req.user._id === booking.customerId
```

**Risk:** Any authenticated customer can view, cancel, reschedule, or modify **any other customer's bookings** by guessing or enumerating booking IDs — a classic **Insecure Direct Object Reference (IDOR)** vulnerability.

**Remediation:**
```javascript
// In booking.service.js, add ownership verification:
export const getBookingDetails = async (bookingId, customerId) => {
    const booking = await bookingRepository.findByIdPopulated(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.customerId._id.toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only access your own bookings');
    }
    // ... rest of logic
};
```
Apply this pattern to: `cancelBooking`, `rescheduleBooking`, `getBookingConfirmation`, `updateBooking`, `deleteServiceFromBooking`.

---

### 3.3 🔴 CRITICAL — Missing Ownership Verification on Barber Booking Operations (IDOR)

**Files:**
- `src/controllers/barber/barber-booking.controller.js` — Lines 22–29, 32–38
- `src/services/booking.service.js` — Lines 348, 356–364

**Description:**  
The barber-side endpoints `updateBookingStatus` and `deleteBooking` accept a booking ID from the URL parameter but **never verify the booking belongs to the barber's shop**.

```javascript
// barber-booking.controller.js:22-29
export const updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const booking = await bookingService.updateBookingStatus(req.params.id, status);
        // ❌ No ownership check — any barber can modify any booking's status
```

**Risk:** A barber can manipulate any other barber's bookings — marking them as completed, cancelled, or deleting them.

**Remediation:**
```javascript
export const updateBookingStatus = async (bookingId, status, ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');
    const booking = await bookingRepository.findById(bookingId);
    if (!booking || booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only manage bookings for your own shop');
    }
    // ... proceed with update
};
```

---

### 3.4 🔴 CRITICAL — Transaction Not Used for DB Operations in `reorderBooking`

**File:** `src/services/booking.service.js` — Lines 172–217

**Description:**  
The `reorderBooking` function starts a Mongoose session and transaction, but **none of the database operations actually use the session**. The `session` is created, started, committed, and aborted — but never passed to any query.

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
    const existing = await bookingRepository.findById(bookingId); // ❌ No { session }
    // ...
    const employee = await employeeRepository.claimSlot(...);     // ❌ No { session }
    const newBooking = await bookingRepository.create({...});     // ❌ No { session }
    await session.commitTransaction(); // Transaction is empty
```

**Risk:** If `bookingRepository.create` fails after `employeeRepository.claimSlot` succeeds, the system will be in an inconsistent state where an employee slot is claimed but no booking exists. The entire transaction machinery is **effectively a no-op**.

**Remediation:**
Pass the `session` option to all database operations within the transaction. Repository methods need to accept an optional `session` parameter:

```javascript
async create(data, options = {}) {
    return Booking.create([data], options).then(docs => docs[0]);
}
```

---

## 4. High-Severity Issues

### 4.1 🟠 HIGH — `updateBooking` Doesn't Release Old Slot When Same Employee Changes Time

**File:** `src/services/booking.service.js` — Lines 262–280

**Description:**  
When `updateBooking` is called and the employee stays the same but the date/time changes, the old slot is **not released**.

```javascript
// Only releases if employee changed:
if (booking.employeeId.toString() !== employeeId) {
    await employeeRepository.releaseSlot(booking.employeeId, ...);
}
// ❌ If same employee, different time — old slot is still "booked"
```

**Risk:** Employee scheduling becomes corrupted — ghost slots accumulate, preventing real bookings from being made for time slots that are actually free.

**Remediation:**
Always release the old slot before claiming the new one (whether or not the employee changed):

```javascript
// Release old slot
await employeeRepository.releaseSlot(
    booking.employeeId, booking.date.toISOString().split('T')[0], booking.time
);
// Claim new slot
const employee = await employeeRepository.claimSlot(employeeId, date, time);
```

---

### 4.2 🟠 HIGH — Booking Deletion Doesn't Verify Shop Ownership

**File:** `src/services/booking.service.js` — Lines 356–364

**Description:**  
`deleteBookingAfterPayment` only checks `paymentStatus === 'success'`, but doesn't verify the requesting user (barber) owns the shop the booking belongs to. This is used in the barber delete booking route.

**Risk:** Combined with the IDOR issue (3.3), any barber could delete any paid booking.

---

### 4.3 🟠 HIGH — `addToFavorites` Always Adds, Never Toggles

**File:** `src/services/booking.service.js` — Lines 237–239

**Description:**  
The route is `PUT /bookings/:id/favorite` (implying toggle behavior) and the controller calls `bookingService.addToFavorites`, but:
1. It only uses `$addToSet` — it can never remove a favorite.
2. The function name says "add" but the route/controller name says "toggle."
3. The booking existence and ownership are not validated.

**Remediation:**
Implement actual toggle logic:
```javascript
export const toggleFavorite = async (customerId, bookingId) => {
    const profile = await customerProfileRepo.findByUserId(customerId);
    const isFavorited = profile.favoriteBookings.some(id => id.toString() === bookingId);
    if (isFavorited) {
        return customerProfileRepo.removeFavoriteBooking(customerId, bookingId);
    }
    return customerProfileRepo.addFavoriteBooking(customerId, bookingId);
};
```

---

## 5. Medium-Severity Issues

### 5.1 🟡 MEDIUM — `searchShops` Bypasses Repository Layer

**File:** `src/services/service-catalog.service.js` — Lines 83–87

**Description:**  
The `searchShops` function directly imports the `Shop` model via dynamic import and runs a query, completely bypassing the repository pattern used everywhere else.

```javascript
export const searchShops = async (query) => {
    const Shop = (await import('../models/shop.model.js')).default;
    return Shop.find({ shopName: { $regex: query, $options: 'i' } })
        .select('shopName address location phoneNumber category coverUrl');
};
```

Similarly, `getServicesByGender` at line 89–93 bypasses the `ServiceRepository`.

**Risk:** Inconsistency in architecture — these queries bypass soft-delete filters, caching, and any future repository-level concerns. Also subject to ReDoS (see 3.1).

**Remediation:** Move these queries into their respective repositories.

---

### 5.2 🟡 MEDIUM — Earnings Aggregation Uses `createdAt` Instead of Booking `date`

**File:** `src/repositories/booking.repository.js` — Lines 124–153

**Description:**  
The earnings aggregation calculates `todayEarning` and `lastMonthEarning` based on `createdAt` (when the booking document was created) rather than the actual booking `date` field. A booking created today for next month would count toward "today's earnings."

**Remediation:** Use the `date` field instead of `createdAt` in the aggregation pipeline.

---

### 5.3 🟡 MEDIUM — No Pagination on List Endpoints

**Files:**
- `src/services/booking.service.js` — `getBookingsByShop`, `getCustomerBookings`, `getBookingsByStatusDetailed`
- `src/services/rating.service.js` — `getRatingsByShop`, `getRatingsByShopForBarber`
- `src/services/photo.service.js` — `getPhotos`
- `src/services/employee.service.js` — `getEmployees`
- `src/services/service-catalog.service.js` — `getServices`

**Description:**  
A `buildPagination` utility exists in `src/utils/pagination.utils.js` but is **never used anywhere**. All list endpoints return unbounded result sets.

**Risk:** Performance degradation and potential DoS — a shop with thousands of bookings or ratings would return all records in a single response, consuming memory and bandwidth.

**Remediation:** Add pagination support to all list endpoints using the existing utility.

---

### 5.4 🟡 MEDIUM — `Booking.customerId` References `User` but `populate` Uses `CustomerProfile` Fields

**Files:**
- `src/models/booking.model.js` — Line 23: `ref: 'User'`
- `src/repositories/booking.repository.js` — Lines 16, 40: `.populate('customerId', 'firstName lastName email')`

**Description:**  
The `Booking` model's `customerId` references the `User` model, but the `User` model does **not** have `firstName`, `lastName` fields — those are on the `CustomerProfile` model. The populate calls will return `firstName: undefined, lastName: undefined`.

**Risk:** Booking details shown to barbers will have missing customer names, breaking the UI.

**Remediation:** Either:
1. Change `customerId` to reference `CustomerProfile`, or
2. Use a two-step population: first populate the user, then look up their `CustomerProfile`, or
3. Add a virtual populate path.

---

### 5.5 🟡 MEDIUM — `Rating.customerId` References `User` but Populates Customer-Specific Fields

**File:**
- `src/models/rating.model.js` — Line 14: `ref: 'User'`
- `src/repositories/rating.repository.js` — Lines 14, 52, 63, 71: `.populate('customerId', 'firstName lastName email')`

**Description:**  
Same issue as 5.4 — the `Rating` model's `customerId` references `User`, but populates try to select `firstName lastName email`. `User` has `email` but **not** `firstName`/`lastName`.

**Risk:** Rating displays will show "Unknown" for customer names (the service has a fallback), but it masks a broken data relationship.

---

### 5.6 🟡 MEDIUM — Inconsistent `isActive` Filtering in Soft-Delete

**Files:**
- `src/models/employee.model.js` — Lines 82–86
- `src/repositories/employee.repository.js` — Line 16: `findByShopIdAndPhone` (no `isActive` filter)

**Description:**  
Employee soft-delete middleware filters by `deletedAt: null`, and `findByShopId` adds `isActive: true`. However, `findByShopIdAndPhone` does **not** add `isActive: true` — so when checking for duplicate employees, it will find soft-deleted employees and prevent re-adding them.

**Risk:** If an employee is fired and later rehired, the system may reject the addition due to a "ghost" duplicate.

**Remediation:** Add `isActive: true` to the `findByShopIdAndPhone` query, or rely solely on the `deletedAt` middleware (remove redundant `isActive` filters).

---

## 6. Low-Severity Issues

### 6.1 🔵 LOW — `imageFilter` Allows `image/gif` but `allowedImageFormats` Doesn't Include `gif`

**Files:**
- `src/config/index.js` — Lines 63, 64–69
- `src/middleware/upload.middleware.js` — Line 16

**Description:**  
`config.upload.allowedMimeTypes` includes `image/gif`, but `config.upload.allowedImageFormats` (sent to Cloudinary) only includes `['jpg', 'jpeg', 'png', 'webp']`. A GIF upload will pass Multer's file filter but may be rejected or auto-converted by Cloudinary.

**Remediation:** Either add `'gif'` to `allowedImageFormats` or remove `'image/gif'` from `allowedMimeTypes` for consistency.

---

### 6.2 🔵 LOW — Duplicated Normalization Logic Between Service & Validator Layers

**Files:**
- `src/validators/onboarding.validator.js` — Lines 95–158 (custom validator logic)
- `src/services/onboarding.service.js` — Lines 107–227 (`normalizeBarberOnboardingInput`)
- `src/validators/shop.validator.js` — Lines 123–158
- `src/services/shop.service.js` — Lines 96–132 (`normalizeUpdateBody`)

**Description:**  
The same field-aliasing and normalization logic (e.g., `emailId || email`, `upiId || upiAddress`, `openTime || opensAt`) is duplicated in both the Joi validators and the service layer.

**Risk:** Maintenance burden — if aliases change, two places must be updated in sync. Violation of DRY principle.

**Remediation:** Centralize normalization in either the validator layer or the service layer, not both.

---

### 6.3 🔵 LOW — `getBookings` Route Ordering Issue in Barber Routes

**File:** `src/routes/barber.routes.js` — Lines 66–70

```javascript
router.get('/bookings', bookingCtrl.getBookings);
router.get('/bookings/stats', bookingCtrl.getBookingStats);
router.get('/bookings/status', validate(...), bookingCtrl.getBookingsByStatus);
router.put('/bookings/:id/status', validate(...), bookingCtrl.updateBookingStatus);
router.delete('/bookings/:id', validate(...), bookingCtrl.deleteBooking);
```

**Description:**  
With Express 5, route ordering should not be an issue for these patterns, but `/bookings/stats` and `/bookings/status` must come **before** any potential `/bookings/:id` GET route (which doesn't exist currently, but could be added). The current ordering is correct but fragile.

---

### 6.4 🔵 LOW — `image/jpg` is Not a Standard MIME Type

**File:** `src/config/index.js` — Line 65

```javascript
allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
```

**Description:**  
`image/jpg` is not an official IANA MIME type. The standard is `image/jpeg`. Some browsers/clients may send `image/jpg`, so including it as a fallback is acceptable, but be aware it's non-standard.

---

### 6.5 🔵 LOW — `customer-booking.controller.js` Exposes Internal `employee` Object in Response

**File:** `src/services/booking.service.js` — Lines 67–78

```javascript
return {
    bookingId: booking._id,
    shopId,
    customerId,
    employee,  // Full employee document from claimSlot
    services,
    // ...
};
```

**Description:**  
The `employee` object returned from `claimSlot` may contain internal fields. The `select` in `claimSlot` limits this to `firstName lastName photoUrl`, so the exposure is controlled — but it's fragile and should be explicitly mapped.

---

### 6.6 🔵 LOW — No Request ID / Correlation ID

**File:** `src/middleware/request-logger.middleware.js`

**Description:**  
The request logger does not generate or propagate a unique request/correlation ID. This makes it difficult to trace a single request through logs when multiple requests are interleaved.

**Remediation:**
```javascript
import { randomUUID } from 'crypto';
const requestLogger = (req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    // ... existing logic, include req.id in logData
};
```

---

### 6.7 🔵 LOW — `TooManyRequestsError` Class Defined But Never Used

**File:** `src/utils/api-error.js` — Lines 86–90

**Description:**  
The `TooManyRequestsError` class exists but is never imported or thrown anywhere, since rate limiting is not implemented.

---

### 6.8 🔵 LOW — `buildPagination` Utility Never Used

**File:** `src/utils/pagination.utils.js`

**Description:**  
The pagination utility function exists but is never imported or called. This represents dead code.

---

## 7. Architectural Review

### 7.1 Positive Patterns ✅

| Pattern | Details |
|---|---|
| **Clean Layer Separation** | Routes → Controllers → Services → Repositories → Models is consistently followed |
| **Centralized Error Handling** | Custom `AppError` hierarchy with a global error handler catches all error types gracefully |
| **Structured Logging** | JSON-formatted logs with automatic sensitive data redaction (MongoDB URIs, tokens, keys) |
| **Firebase Auth Middleware** | Token verification with graceful new-user handling |
| **RBAC Authorization** | Role-based access with `authorize()` middleware on all protected route groups |
| **Joi Validation** | Comprehensive input validation with `stripUnknown: true` (prevents mass-assignment) |
| **Atomic Slot Claiming** | `claimSlot` uses atomic `findOneAndUpdate` with a `$not/$elemMatch` guard |
| **Soft Delete** | Models use `deletedAt` fields with query middleware auto-filtering |
| **Config Centralization** | All env vars validated at startup with `requireEnv()` — fail-fast on misconfiguration |
| **Mongoose `sanitizeFilter`** | Enabled globally to prevent NoSQL operator injection |
| **Consistent API Response Envelope** | `ApiResponse.success()` / `.error()` used everywhere |

### 7.2 Architectural Concerns ⚠️

| Concern | Details |
|---|---|
| **No Dependency Injection** | Services import repositories directly. Makes unit testing harder — mocking requires module interception. Consider passing repositories via constructor or factory parameters. |
| **Singleton Repositories** | All repositories export `new XRepository()`. While simple, this prevents easy testing and doesn't support multiple databases. |
| **Mixed Responsibility in Controllers** | `barber-profile.controller.js` contains PIN update logic that directly calls `shopRepository` (bypassing the service layer). This is the only controller that imports a repository directly. |
| **No Admin Role Implementation** | `ADMIN` role is defined in constants but no admin routes, controllers, or services exist. |
| **No Webhook/Event System** | Booking status changes don't trigger notifications. Consider an event emitter pattern for future push notifications. |
| **No API Versioning Flexibility** | While routes use `/api/v1`, there's no mechanism for running v1 and v2 concurrently. |

---

## 8. Remediation Roadmap

### Phase 1 — Critical Fixes (Immediate, before any production deployment)

| # | Issue | Effort |
|---|---|---|
| 3.1 | Sanitize regex inputs across all services/repositories | 2 hours |
| 3.2 | Add ownership checks to all customer booking operations | 3 hours |
| 3.3 | Add ownership checks to barber booking operations | 2 hours |
| 3.4 | Fix Mongoose transaction — pass `session` to all operations | 2 hours |

### Phase 2 — High-Priority Fixes (Within 1 week)

| # | Issue | Effort |
|---|---|---|
| 4.1 | Fix `updateBooking` slot release logic | 1 hour |
| 4.2 | Add ownership verification to `deleteBookingAfterPayment` | 1 hour |
| 4.3 | Implement proper favorite toggle logic | 1 hour |

### Phase 3 — Medium-Priority Improvements (Within 2–4 weeks)

| # | Issue | Effort |
|---|---|---|
| 5.1 | Move direct model queries into repositories | 1 hour |
| 5.2 | Fix earnings aggregation to use booking `date` | 1 hour |
| 5.3 | Implement pagination across all list endpoints | 4 hours |
| 5.4, 5.5 | Fix booking/rating `customerId` population | 3 hours |
| 5.6 | Fix soft-delete inconsistency in employee duplicate check | 30 minutes |

### Phase 4 — Low-Priority Cleanup (Ongoing)

| # | Issue | Effort |
|---|---|---|
| 6.1 | Fix GIF MIME type inconsistency | 15 minutes |
| 6.2 | DRY up normalization logic | 2 hours |
| 6.6 | Add request correlation IDs | 1 hour |
| 6.7, 6.8 | Clean up unused code | 15 minutes |

---

## 9. Appendix — File Reference Index

| File | Lines | Layer | Key Issues |
|---|---|---|---|
| `src/routes/index.js` | 24 | Routes | — |
| `src/routes/auth.routes.js` | 16 | Routes | — |
| `src/routes/barber.routes.js` | 90 | Routes | — |
| `src/routes/customer.routes.js` | 77 | Routes | — |
| `src/routes/onboarding.routes.js` | 41 | Routes | — |
| `src/middleware/authenticate.middleware.js` | 63 | Middleware | ✅ Well-implemented |
| `src/middleware/authorize.middleware.js` | 32 | Middleware | ✅ Well-implemented |
| `src/middleware/error-handler.middleware.js` | 85 | Middleware | ✅ Well-implemented |
| `src/middleware/request-logger.middleware.js` | 31 | Middleware | Missing correlation ID (6.6) |
| `src/middleware/upload.middleware.js` | 91 | Middleware | ✅ Clean design |
| `src/middleware/validate.middleware.js` | 30 | Middleware | ✅ Well-implemented |
| `src/controllers/auth.controller.js` | 31 | Controller | — |
| `src/controllers/onboarding.controller.js` | 26 | Controller | — |
| `src/controllers/barber/barber-booking.controller.js` | 50 | Controller | IDOR (3.3) |
| `src/controllers/barber/barber-profile.controller.js` | 47 | Controller | Direct repo import |
| `src/controllers/customer/customer-booking.controller.js` | 105 | Controller | IDOR (3.2) |
| `src/services/auth.service.js` | 37 | Service | — |
| `src/services/booking.service.js` | 387 | Service | **Most issues** (3.2–3.4, 4.1–4.3) |
| `src/services/onboarding.service.js` | 342 | Service | Duplicated normalization (6.2) |
| `src/services/shop.service.js` | 393 | Service | ReDoS (3.1), duplicated normalization |
| `src/services/service-catalog.service.js` | 94 | Service | ReDoS (3.1), bypasses repo (5.1) |
| `src/services/rating.service.js` | 175 | Service | — |
| `src/services/photo.service.js` | 98 | Service | — |
| `src/services/employee.service.js` | 66 | Service | — |
| `src/services/earnings.service.js` | 46 | Service | Aggregation logic (5.2) |
| `src/services/pin.service.js` | 72 | Service | ✅ Well-implemented |
| `src/services/user.service.js` | 64 | Service | — |
| `src/repositories/booking.repository.js` | 157 | Repository | Bad populate refs (5.4) |
| `src/repositories/employee.repository.js` | 76 | Repository | Soft-delete inconsistency (5.6) |
| `src/repositories/rating.repository.js` | 76 | Repository | Bad populate refs (5.5) |
| `src/repositories/service.repository.js` | 71 | Repository | ReDoS (3.1) |
| `src/models/booking.model.js` | 89 | Model | ✅ Well-indexed |
| `src/models/user.model.js` | 70 | Model | ✅ Well-implemented |
| `src/models/shop.model.js` | 194 | Model | ✅ Well-implemented |
| `src/models/employee.model.js` | 90 | Model | ✅ Well-implemented |
| `src/utils/api-error.js` | 91 | Utils | ✅ Well-designed |
| `src/utils/api-response.js` | 59 | Utils | ✅ Consistent |
| `src/utils/constants.js` | 151 | Utils | ✅ Centralized |
| `src/utils/logger.js` | 142 | Utils | ✅ Good redaction |
| `src/utils/time.utils.js` | 115 | Utils | ✅ Clean implementation |
| `src/utils/pagination.utils.js` | 32 | Utils | Never used (6.8) |
| `src/config/index.js` | 89 | Config | — |
| `src/config/database.config.js` | 64 | Config | ✅ Good security |
| `src/config/firebase.config.js` | 31 | Config | ✅ Singleton pattern |
| `src/config/cloudinary.config.js` | 11 | Config | — |
| `src/validators/auth.validator.js` | 4 | Validator | — |
| `src/validators/booking.validator.js` | 56 | Validator | ✅ Comprehensive |
| `src/validators/onboarding.validator.js` | 163 | Validator | Duplicated logic (6.2) |
| `src/validators/shop.validator.js` | 205 | Validator | ✅ Thorough |

---

*End of Audit Report*

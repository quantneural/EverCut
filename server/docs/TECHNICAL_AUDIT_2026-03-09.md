# EverCut Backend Technical Audit

Date: 2026-03-09

## Table of Contents

- [Scope](#scope)
- [Methodology](#methodology)
- [Architecture Snapshot](#architecture-snapshot)
- [Severity Summary](#severity-summary)
- [Photo Gallery Focus Summary](#photo-gallery-focus-summary)
- [Detailed Findings](#detailed-findings)
  - [Security Vulnerabilities](#security-vulnerabilities)
  - [Logical and Functional Errors](#logical-and-functional-errors)
  - [Incomplete or Incorrect Implementations](#incomplete-or-incorrect-implementations)
  - [Architecture and Design Issues](#architecture-and-design-issues)
  - [Performance Problems](#performance-problems)
  - [Configuration and Environment Issues](#configuration-and-environment-issues)
  - [Code Quality and Maintainability](#code-quality-and-maintainability)
  - [Testing and Reliability](#testing-and-reliability)
  - [API and Data Integrity](#api-and-data-integrity)
- [Prioritized Remediation Roadmap](#prioritized-remediation-roadmap)
- [Overall System Health Summary](#overall-system-health-summary)

## Scope

This audit reviews the current first-party backend code under:

- `server/src`
- `server/scripts`
- `server/package.json`

Special attention was given to the Photo Gallery flow:

- `server/src/routes/barber.routes.js`
- `server/src/controllers/barber/barber-photo.controller.js`
- `server/src/services/photo.service.js`
- `server/src/repositories/photo.repository.js`
- `server/src/models/photo.model.js`
- `server/src/validators/photo.validator.js`
- `server/src/middleware/upload.middleware.js`

## Methodology

- Static line-by-line review of the first-party source files
- Cross-check of route/controller/service/repository/model interactions
- Focused review of auth, RBAC, uploads, file lifecycle, validation, and multi-tenant isolation
- Review of helper scripts and configuration handling
- No dynamic penetration test, dependency CVE scan, or live Firebase/Cloudinary/MongoDB environment testing was performed

## Architecture Snapshot

The system is a Node.js/Express API with a layered structure:

- Routing: `server/src/routes/*.js`
- Controllers: `server/src/controllers/**/*.js`
- Business logic: `server/src/services/*.js`
- Persistence: `server/src/repositories/*.js`
- Data model: `server/src/models/*.js`
- Validation: `server/src/validators/*.js`
- Integrations: Firebase, Cloudinary, MongoDB

Photo Gallery request path:

1. `POST /api/v1/barber/photos` enters through `server/src/routes/barber.routes.js:73-77`
2. Authentication and barber authorization happen at `server/src/routes/barber.routes.js:43-44`
3. Files are uploaded by `uploadShopPhotos` in `server/src/middleware/upload.middleware.js:67-75`
4. Request metadata is validated by `photoUploadSchema` in `server/src/validators/photo.validator.js:4-7`
5. Controller delegates to `photoService.uploadPhotos` in `server/src/controllers/barber/barber-photo.controller.js:4-11`
6. Metadata is persisted via `photoRepository.create` in `server/src/services/photo.service.js:22-35`

This split is generally understandable, but several important integrity and lifecycle controls are missing.

## Severity Summary

| Severity | Count | Primary themes |
| --- | --- | --- |
| Critical | 2 | Multi-tenant authorization failures on booking resources |
| High | 8 | Financial tampering, broken photo lifecycle, non-atomic writes, invalid booking integrity |
| Medium | 13 | Regex abuse risk, upload error handling, missing hardening, tooling issues, broken data shaping |
| Low | 7 | API consistency, contract drift, missing test/lint automation |

## Photo Gallery Focus Summary

| ID | Severity | Issue | Primary locations |
| --- | --- | --- | --- |
| PG-01 | High | Gallery uploads are validated after Cloudinary upload and are not rolled back on failure | `server/src/routes/barber.routes.js:73-74`, `server/src/middleware/upload.middleware.js:67-75`, `server/src/services/photo.service.js:17-35` |
| PG-02 | High | Photo limit enforcement is not atomic and can be bypassed under concurrency; failed requests can still leave orphaned Cloudinary assets | `server/src/services/photo.service.js:17-19`, `server/src/services/photo.service.js:22-35` |
| PG-03 | High | Photo deletion removes the database record before Cloudinary deletion and suppresses Cloudinary errors | `server/src/services/photo.service.js:61-72`, `server/src/repositories/photo.repository.js:17-18` |
| PG-04 | Medium | Invalid file types produce 500-class behavior instead of a clean 4xx validation error | `server/src/middleware/upload.middleware.js:15-20`, `server/src/middleware/error-handler.middleware.js:18-25`, `server/src/middleware/error-handler.middleware.js:66-81` |
| PG-05 | Low | Photo model uses hard deletion despite carrying `isActive`, which is inconsistent with the rest of the repository's soft-delete pattern | `server/src/models/photo.model.js:44-47`, `server/src/repositories/photo.repository.js:17-18` |

## Detailed Findings

## Security Vulnerabilities

### F-01 [Critical] Customer booking endpoints are vulnerable to broken object-level authorization

- Location:
  - `server/src/routes/customer.routes.js:50-57`
  - `server/src/services/booking.service.js:82-167`
  - `server/src/services/booking.service.js:243-298`
- Root cause:
  - The route layer validates only the booking ID format.
  - The service layer loads bookings by `_id` only and never verifies `booking.customerId === req.user._id`.
- Affected operations:
  - `GET /customer/bookings/:id`
  - `DELETE /customer/bookings/:id`
  - `PUT /customer/bookings/:id/reschedule`
  - `POST /customer/bookings/:id/reorder`
  - `GET /customer/bookings/:id/confirmation`
  - `PUT /customer/bookings/:id`
  - `DELETE /customer/bookings/:id/services/:serviceId`
- Business/security impact:
  - Any authenticated customer who learns or guesses another booking ID can read, modify, cancel, reschedule, or partially edit another user's booking.
  - This is a direct multi-tenant isolation failure.
- Recommended fix:
  - Introduce repository methods that scope booking lookups by both booking ID and customer ID.
  - Pass `req.user._id` into every booking mutation/read method and fail closed when ownership does not match.

```js
// repository
async findOwnedBookingForCustomer(bookingId, customerId) {
  return Booking.findOne({ _id: bookingId, customerId });
}

// service
const booking = await bookingRepository.findOwnedBookingForCustomer(bookingId, customerId);
if (!booking) throw new NotFoundError('Booking');
```

### F-02 [Critical] Barber booking mutation endpoints allow cross-shop tampering

- Location:
  - `server/src/routes/barber.routes.js:66-70`
  - `server/src/services/booking.service.js:348-363`
- Root cause:
  - Barber-only routes check role, but `updateBookingStatus` and `deleteBookingAfterPayment` do not verify that the booking belongs to the barber's shop.
- Affected operations:
  - `PUT /barber/bookings/:id/status`
  - `DELETE /barber/bookings/:id`
- Business/security impact:
  - One barber account can mutate or delete another barber's bookings if the ID is known.
  - This can cause revenue loss, service disruption, and audit integrity failures.
- Recommended fix:
  - Resolve the barber's shop first, then fetch the booking by both booking ID and shop-scoped employee/shop ownership before mutating it.

### F-03 [High] Booking creation trusts the client-supplied `amount`, enabling price tampering

- Location:
  - `server/src/validators/booking.validator.js:4-13`
  - `server/src/services/booking.service.js:18`
  - `server/src/services/booking.service.js:52-65`
- Root cause:
  - The API accepts `amount` from the client and uses it whenever it is provided, instead of computing the total from the service catalog.
- Business/security impact:
  - Customers can underpay by sending an arbitrary lower amount.
  - Financial reports and downstream reconciliation will be corrupted.
- Recommended fix:
  - Remove `amount` from the public request schema.
  - Always compute `totalAmount` server-side from the authoritative service records.

```js
// validator
export const bookSalonSchema = Joi.object({
  shopId: objectId.required(),
  employeeId: objectId.required(),
  serviceId: Joi.alternatives().try(objectId, Joi.array().items(objectId).min(1)).required(),
  date: dateString.required(),
  time: timeString.required(),
});

// service
const totalAmount = services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);
```

### F-04 [High] Booking integrity checks do not enforce shop, employee, and service consistency

- Location:
  - `server/src/services/booking.service.js:26-50`
  - `server/src/services/booking.service.js:262-277`
  - `server/src/services/booking.service.js:131-167`
  - `server/src/repositories/service.repository.js:12-16`
  - `server/src/repositories/employee.repository.js:32-45`
- Root cause:
  - `bookSalon` verifies that the shop exists, but does not verify that:
    - every `serviceId` belongs to that `shopId`
    - `employeeId` belongs to that `shopId`
  - `updateBooking` and `rescheduleBooking` skip shop-hours and available-day checks.
- Business/security impact:
  - The system can create cross-shop bookings with unrelated employees and services.
  - Bookings can be moved outside allowed days/hours.
- Recommended fix:
  - Add shop-scoped repository methods:
    - `findServicesByIdsForShop(serviceIds, shopId)`
    - `findEmployeeByIdForShop(employeeId, shopId)`
  - Re-run day/hour validation in every booking mutation path.

### F-05 [High] Photo Gallery uploads are validated too late and are not rolled back on failure

- Location:
  - `server/src/routes/barber.routes.js:73-74`
  - `server/src/middleware/upload.middleware.js:67-75`
  - `server/src/services/photo.service.js:17-35`
  - `server/src/validators/photo.validator.js:4-7`
- Root cause:
  - `uploadShopPhotos` sends files to Cloudinary before `photoUploadSchema` validates `photoType` and `description`.
  - After upload, `photoService.uploadPhotos` writes database rows one by one without cleanup if a later insert fails.
- Business/security impact:
  - Invalid `photoType`, overly long descriptions, quota rejections, or mid-loop DB failures can still leave Cloudinary assets stored without database records.
  - The gallery can accumulate orphaned assets and storage costs.
- Recommended fix:
  - Validate metadata before upload where possible.
  - Add cleanup logic for `req.files` when later middleware or persistence fails.
  - Persist photo records transactionally or use an outbox/compensation pattern.

```js
try {
  const photos = await photoService.uploadPhotos(req.user._id, req.files, photoType, description);
  return res.status(201).json(ApiResponse.success(photos, `${photos.length} photo(s) uploaded`, 201));
} catch (err) {
  await cleanupUploadedCloudinaryFiles(req.files);
  next(err);
}
```

### F-06 [High] Photo deletion is non-atomic and suppresses Cloudinary failures

- Location:
  - `server/src/services/photo.service.js:61-72`
  - `server/src/repositories/photo.repository.js:17-18`
- Root cause:
  - The database row is deleted first.
  - Cloudinary deletion happens afterward inside a swallowed `catch`.
- Business/security impact:
  - If Cloudinary deletion fails, the endpoint still returns success and the system permanently loses the metadata needed to retry cleanup.
  - This creates orphaned assets, cost leakage, and privacy retention issues.
- Recommended fix:
  - Reverse the order or mark the photo as `pendingDeletion` until external deletion succeeds.
  - At minimum, log the failure and preserve retryable metadata.

### F-07 [Medium] Search paths accept raw regex input, creating ReDoS and query-abuse risk

- Location:
  - `server/src/services/service-catalog.service.js:77-86`
  - `server/src/repositories/service.repository.js:29-50`
  - `server/src/services/shop.service.js:173-176`
- Root cause:
  - User-controlled search terms are injected directly into MongoDB regular expressions without escaping.
  - `mongoose.set('sanitizeFilter', true)` does not neutralize regex abuse.
- Business/security impact:
  - Crafted patterns can trigger catastrophic backtracking or expensive collection scans.
  - Search endpoints may degrade under abuse.
- Recommended fix:
  - Escape regex metacharacters before constructing a pattern, or use indexed exact/prefix search strategies.

```js
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(escaped, 'i');
```

### F-08 [Medium] Missing rate limiting and security headers leave the API unnecessarily exposed

- Location:
  - `server/src/config/index.js:74-79`
  - `server/src/app.js:27-39`
- Root cause:
  - Rate-limit settings exist in configuration but are never wired into Express.
  - No hardening middleware such as `helmet` is applied.
- Business/security impact:
  - Upload, search, auth bootstrap, and booking endpoints are more vulnerable to brute-force abuse, scraping, and noisy automation.
- Recommended fix:
  - Add `helmet`.
  - Add route-specific rate limits for `auth`, `photos`, and search endpoints.

### F-09 [Medium] Token tooling stores plain bearer tokens on disk

- Location:
  - `server/scripts/firebase-token-gen.js:38-41`
  - `server/scripts/firebase-token-gen.js:195-238`
  - `server/.gitignore:118-124`
- Root cause:
  - The helper script intentionally writes usable tokens to `server/scripts/test-tokens.txt`.
- Business/security impact:
  - Although the file is ignored by Git, local disk exposure still matters on shared or compromised machines.
  - Tokens are also printed to the terminal.
- Recommended fix:
  - Prefer short-lived ephemeral output only, or encrypt/cache locally with explicit opt-in.
  - Never print refresh tokens unless strictly required.

## Logical and Functional Errors

### F-10 [High] Onboarding writes are not transactional and can leave orphaned users behind

- Location:
  - `server/src/services/onboarding.service.js:11-45`
  - `server/src/services/onboarding.service.js:48-95`
- Root cause:
  - `User` is created first.
  - `CustomerProfile` or `Shop` is created second.
  - There is no MongoDB session tying them together.
- Business impact:
  - If the second write fails, the `User` row remains.
  - Retrying onboarding will then fail with `"User already exists"` or `"Barber already exists"`, even though the profile/shop was never completed.
- Recommended fix:
  - Wrap onboarding in a Mongoose session and pass the session into every repository call.

### F-11 [High] `reorderBooking` starts a transaction that does not actually protect any write

- Location:
  - `server/src/services/booking.service.js:172-215`
  - `server/src/repositories/booking.repository.js:4-5`
  - `server/src/repositories/employee.repository.js:32-45`
- Root cause:
  - A Mongoose session is started, but none of the repository methods receive the session.
  - `claimSlot` and `create` are executed outside the transaction.
- Business impact:
  - `abortTransaction()` does not roll back the employee slot claim or booking create.
  - The code gives a false sense of atomicity.
- Recommended fix:
  - Thread `session` through the repository layer and pass it into all reads/writes participating in the transaction.

### F-12 [Medium] Invalid file type errors are surfaced as server errors instead of validation errors

- Location:
  - `server/src/middleware/upload.middleware.js:15-20`
  - `server/src/middleware/error-handler.middleware.js:18-25`
  - `server/src/middleware/error-handler.middleware.js:66-81`
- Root cause:
  - `imageFilter` calls `cb(new Error(...), false)`.
  - The global error handler only special-cases `MulterError` and `AppError`, so generic `Error` falls through as a 500.
- Business impact:
  - Client mistakes or malicious uploads create noisy 500s instead of deterministic 4xx responses.
  - Monitoring and API consumers receive misleading error signals.
- Recommended fix:
  - Raise a `BadRequestError`, or map generic upload filter errors to 400 in the error handler.

### F-13 [Medium] Customer onboarding photo uploads use `req.user._id` before the user exists

- Location:
  - `server/src/middleware/authenticate.middleware.js:45-51`
  - `server/src/routes/onboarding.routes.js:17-21`
  - `server/src/middleware/upload.middleware.js:47-51`
- Root cause:
  - New users are attached to `req.user` without `_id`.
  - `uploadCustomerPhoto` still builds the Cloudinary folder from `req.user._id`.
- Business impact:
  - First-time customer uploads are stored under `evercut/customers/undefined`.
  - This complicates lifecycle cleanup and can mix assets from multiple first-time onboarding attempts.
- Recommended fix:
  - Use `firebaseUid` for pre-onboarding storage paths, or create the user first and upload after an identifier exists.

### F-14 [Low] Customer profile photo-only updates are blocked by the validator

- Location:
  - `server/src/routes/customer.routes.js:40-41`
  - `server/src/validators/customer.validator.js:5-13`
- Root cause:
  - `updateCustomerProfileSchema` requires at least one body field via `.min(1)`.
  - The uploaded file is not represented in the body schema.
- Business impact:
  - A client cannot change only the profile photo without also sending another text field.
- Recommended fix:
  - Relax validation when `req.file` is present, or include a file-aware special case before invoking the schema.

## Incomplete or Incorrect Implementations

### F-15 [Medium] Customer and rating identity data is populated from the wrong model

- Location:
  - `server/src/models/user.model.js:12-52`
  - `server/src/models/customer-profile.model.js:20-50`
  - `server/src/repositories/booking.repository.js:12-17`
  - `server/src/repositories/booking.repository.js:86-90`
  - `server/src/repositories/rating.repository.js:12-15`
  - `server/src/repositories/rating.repository.js:41-52`
  - `server/src/services/shop.service.js:121-129`
- Root cause:
  - `User` stores auth-level data only.
  - First name, last name, and profile photo live in `CustomerProfile`.
  - Several populate/select paths incorrectly expect those fields on `User`.
- Business impact:
  - Booking and rating responses return `"Unknown"` or `null` for customer identity data even when profile data exists.
  - The public shop page and barber dashboards will present incomplete or incorrect customer details.
- Recommended fix:
  - Join through `CustomerProfile`, or denormalize a safe display shape where needed.

### F-16 [Low] Employee `workingHours` is accepted by the API contract but ignored in the service layer

- Location:
  - `server/src/validators/employee.validator.js:11-17`
  - `server/src/services/employee.service.js:18-27`
- Root cause:
  - `addEmployeeSchema` accepts `workingHours`.
  - `addEmployee` discards it and always sets hours from `shop.openTime` and `shop.closeTime`.
- Business impact:
  - API consumers believe they can create employee-specific schedules, but the value is silently ignored.
- Recommended fix:
  - Either remove `workingHours` from the schema or honor it in the service layer.

### F-17 [Low] The API response body reports `statusCode: 200` even when the HTTP response is `201`

- Location:
  - `server/src/utils/api-response.js:16-23`
  - `server/src/controllers/barber/barber-photo.controller.js:8`
  - `server/src/controllers/barber/barber-employee.controller.js:7`
  - `server/src/controllers/barber/barber-service.controller.js:7`
  - `server/src/controllers/customer/customer-booking.controller.js:7`
  - `server/src/controllers/customer/customer-booking.controller.js:55`
  - `server/src/controllers/customer/customer-rating.controller.js:8`
  - `server/src/controllers/onboarding.controller.js:11`
  - `server/src/controllers/onboarding.controller.js:21`
- Root cause:
  - `ApiResponse.success()` defaults `statusCode` to 200.
  - Controllers returning HTTP 201 do not pass `201` into the response envelope.
- Business impact:
  - API clients relying on the JSON `statusCode` field receive inconsistent state.
- Recommended fix:
  - Pass the actual HTTP status into `ApiResponse.success(..., ..., 201)` or remove the duplicated `statusCode` field entirely.

### F-18 [Low] No TODO/FIXME markers were found, but several incomplete behaviors are encoded as silent fallbacks

- Location:
  - `server/src/services/photo.service.js:68-69`
  - `server/src/services/photo.service.js:91-92`
  - `server/src/services/employee.service.js:60-61`
  - `server/src/services/user.service.js:35-39`
- Root cause:
  - Multiple external-deletion failures are swallowed as non-fatal without logging or compensating actions.
- Business impact:
  - Operators lose visibility into cleanup failures.
  - Incomplete side effects accumulate silently.
- Recommended fix:
  - Log every suppressed cleanup failure with enough metadata to retry asynchronously.

## Architecture and Design Issues

### F-19 [High] Photo lifecycle and onboarding lifecycle both cross database and external systems without a durable workflow

- Location:
  - `server/src/services/photo.service.js:11-37`
  - `server/src/services/photo.service.js:61-96`
  - `server/src/services/onboarding.service.js:11-45`
  - `server/src/services/onboarding.service.js:48-95`
- Root cause:
  - The design assumes a synchronous happy path across MongoDB and Cloudinary with no transaction, outbox, compensating job, or retry queue.
- Business impact:
  - Partial failure produces inconsistent state that is difficult to repair.
  - Asset cleanup and onboarding repair become manual operational work.
- Recommended fix:
  - Adopt one of:
    - Mongoose transactions for multi-document DB writes
    - soft-delete plus async cleanup jobs for external assets
    - idempotent retry keys and compensating cleanup handlers

### F-20 [Medium] Soft-delete strategy is inconsistent across models

- Location:
  - `server/src/models/shop.model.js:130-133`
  - `server/src/models/employee.model.js:59-67`
  - `server/src/models/user.model.js:49-52`
  - `server/src/models/service.model.js:41-48`
  - `server/src/models/photo.model.js:44-47`
  - `server/src/repositories/photo.repository.js:17-18`
- Root cause:
  - Most domain entities use `deletedAt` or `isActive`.
  - Photos carry `isActive`, but the repository physically deletes them.
- Business impact:
  - Auditability and recovery behavior differ by resource type.
  - Maintenance burden increases because cleanup semantics are inconsistent.
- Recommended fix:
  - Pick one deletion strategy per domain and enforce it consistently across model and repository code.

## Performance Problems

### F-21 [Medium] Search endpoints rely on unindexed regex scans and can degrade under scale

- Location:
  - `server/src/services/service-catalog.service.js:77-86`
  - `server/src/repositories/service.repository.js:43-50`
  - `server/src/services/shop.service.js:173-176`
- Root cause:
  - Prefixless regex search on `shopName` and `serviceName` is not index-friendly.
- Business impact:
  - Search latency will worsen as catalog size grows.
- Recommended fix:
  - Escape queries first.
  - For larger data sets, move to text indexes or a search engine.

### F-22 [Low] Rating summary is aggregated in application memory instead of the database

- Location:
  - `server/src/repositories/rating.repository.js:26-38`
- Root cause:
  - `getShopSummary()` loads all ratings and reduces them in Node.js.
- Business impact:
  - This is acceptable for small shops, but it will scale poorly for heavily reviewed shops.
- Recommended fix:
  - Replace the in-memory reduction with a MongoDB aggregation pipeline.

## Configuration and Environment Issues

### F-23 [Medium] The system depends on plaintext local secret files and file-based Firebase bootstrap

- Location:
  - `server/src/config/index.js:45-58`
  - `server/src/config/firebase.config.js:17-26`
- Root cause:
  - Firebase Admin is initialized from a local JSON key path.
  - Cloudinary and MongoDB secrets are expected via plaintext environment variables.
- Business impact:
  - This is workable for development, but it raises operational risk in shared workstations or ad hoc deployments.
- Recommended fix:
  - Use a secret manager in production.
  - Prefer environment-injected JSON or workload identity over local credential files.

### F-24 [Medium] `verify-token.js` is broken against the generator output

- Location:
  - `server/scripts/firebase-token-gen.js:41`
  - `server/scripts/firebase-token-gen.js:238`
  - `server/scripts/verify-token.js:41-49`
- Root cause:
  - The generator writes `test-tokens.txt`.
  - The verifier reads `test-tokens.json`.
- Business impact:
  - The verification script cannot validate the tokens produced by the generator.
  - This erodes trust in the test tooling.
- Recommended fix:
  - Standardize on one output format and reuse a shared parser.

## Code Quality and Maintainability

### F-25 [Medium] Validation responsibilities are split between Joi and manual service-layer parsing

- Location:
  - `server/src/validators/shop.validator.js:39-63`
  - `server/src/services/shop.service.js:36-73`
- Root cause:
  - The route already validates update payloads.
  - The service layer then re-validates selected fields manually, using different rules and messages.
- Business impact:
  - Behavior is harder to reason about.
  - Contract drift is more likely over time.
- Recommended fix:
  - Let Joi own request-shape validation.
  - Keep service-layer checks for business invariants only.

### F-26 [Low] The codebase is entirely JavaScript, so domain contracts rely on runtime discipline only

- Location:
  - Entire `server/src/**/*.js` tree
- Root cause:
  - There is no TypeScript or equivalent compile-time contract enforcement.
- Business impact:
  - Model/service/response drift is easier to introduce, as seen in the `User` vs `CustomerProfile` mismatch.
- Recommended fix:
  - Consider TypeScript or generated schema types for request/response contracts.

## Testing and Reliability

### F-27 [Low] No automated test or lint script is configured

- Location:
  - `server/package.json:7-10`
- Root cause:
  - The project only defines `start` and `dev`.
- Business impact:
  - Regressions in authorization, booking logic, and file lifecycle behavior are unlikely to be caught early.
- Recommended fix:
  - Add:
    - unit tests for service-layer logic
    - integration tests for auth, bookings, and photo routes
    - lint and formatting scripts in CI

## API and Data Integrity

### F-28 [High] Booking update/reschedule flows are not idempotent and can corrupt slot allocation under failure

- Location:
  - `server/src/services/booking.service.js:151-165`
  - `server/src/services/booking.service.js:266-277`
  - `server/src/repositories/employee.repository.js:32-54`
- Root cause:
  - Old slots are released before the full booking mutation is durably committed.
  - Slot claim/release and booking save are not wrapped in one transaction.
- Business impact:
  - A failed booking update can free or consume slots incorrectly.
  - Appointment availability becomes unreliable.
- Recommended fix:
  - Transactionally update both the booking record and the employee slot state, or move slot ownership into the booking collection with a unique compound constraint.

### F-29 [Medium] Time validation is inconsistent across the system

- Location:
  - `server/src/validators/booking.validator.js:11-13`
  - `server/src/validators/common.validator.js:25-26`
  - `server/src/validators/onboarding.validator.js:29-34`
  - `server/src/validators/shop.validator.js:51-55`
  - `server/src/utils/time.utils.js:59-79`
- Root cause:
  - Booking times require `hh:mm AM/PM`.
  - Shop hours and break times are accepted as arbitrary strings, while `isWithinShopHours()` expects 24-hour `HH:MM`.
- Business impact:
  - Invalid or inconsistent time formats can be stored.
  - Later business logic can misbehave or silently reject valid bookings.
- Recommended fix:
  - Define explicit reusable validators for:
    - shop hours `HH:MM`
    - break ranges `HH:MM`
    - booking times in the client-facing format you actually support

### F-30 [Medium] Ratings can be submitted without proving the customer actually completed a booking

- Location:
  - `server/src/services/rating.service.js:9-18`
- Root cause:
  - `addRating()` checks only shop existence and one-rating-per-customer-per-shop uniqueness.
- Business impact:
  - Customers can rate shops they never visited.
  - Review integrity is weakened.
- Recommended fix:
  - Require at least one completed booking for that customer/shop pair before allowing a rating.

## Prioritized Remediation Roadmap

### 0 to 48 hours

1. Fix customer booking IDOR by scoping every booking read/mutation to `customerId`.
2. Fix barber booking mutations by scoping them to the barber's shop.
3. Remove client-controlled `amount` from booking creation.
4. Stop returning success from photo deletion when Cloudinary deletion fails.
5. Add emergency cleanup handling for failed photo uploads and quota rejections.

### 3 to 7 days

1. Enforce shop/employee/service consistency in booking creation and updates.
2. Make onboarding and booking-reorder flows transactional end to end.
3. Normalize upload error handling so invalid files produce 400-class errors.
4. Escape all user-supplied regex input and add targeted rate limits.
5. Fix the `User` vs `CustomerProfile` response shaping bugs.

### 1 to 2 weeks

1. Standardize time formats and validators across onboarding, shop profile, and booking flows.
2. Unify deletion strategy and external cleanup strategy for photos and other assets.
3. Fix local token tooling and reduce plaintext token handling.
4. Add tests for:
   - booking ownership
   - booking price calculation
   - photo upload cleanup
   - photo delete failure handling
   - onboarding rollback behavior

### Longer-term

1. Add security headers and broader API hardening.
2. Introduce typed contracts or TypeScript for service/repository boundaries.
3. Rework search for scalability with indexed or dedicated search infrastructure.

## Overall System Health Summary

The codebase has a reasonable layered structure and the Photo Gallery module is easy to trace, but the system is not safe to treat as production-ready in its current form. The most serious problems are not superficial code-style issues; they are multi-tenant authorization failures, financial trust in client input, and non-atomic interactions between MongoDB and Cloudinary.

Photo Gallery in particular is functionally implemented, but its file lifecycle is fragile:

- uploads happen before validation is complete
- quota failures can still leave uploaded assets behind
- deletes can report success while external files remain live

Overall health assessment:

- Architecture: fair
- Maintainability: fair
- Data integrity: poor
- Multi-tenant security: poor
- Photo Gallery robustness: poor
- Testability and reliability: weak

The highest-value next step is to fix authorization and transactionality before adding any new feature work.

# 🔒 Evercut Backend — Comprehensive Security & Architecture Audit

**Audit Date:** 2026-02-23  
**Auditor:** Senior Security Engineer & System Architect  
**Scope:** Full codebase analysis of `evercut_backend-master`  
**Stack:** Node.js, Express, MongoDB/Mongoose, Firebase Auth, Cloudinary, Multer

---

## Executive Summary

The Evercut backend is a salon/barber booking platform with **critical security vulnerabilities** that make it **unsafe for production deployment**. The most severe issues include hardcoded secrets committed to version control, a backdoor authentication bypass token, leaked Firebase private keys, absence of role-based access control, and widespread NoSQL/ReDoS injection surfaces. Immediate remediation is required before any public-facing deployment.

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 8 | Immediate exploitation risk, full system compromise possible |
| 🟠 High | 10 | Significant security risk, data breach or privilege escalation |
| 🟡 Medium | 12 | Notable weakness, defense-in-depth failure |
| 🟢 Low | 8 | Code quality, best practice violations |

---

## 1. 🔴 CRITICAL — Secrets & Credentials Exposure

### 1.1 Firebase Private Key Committed to Repository

**File:** `firebase-admin-sdk.json`  
**Severity:** 🔴 Critical

**Problem:** The Firebase Admin SDK service account JSON file — containing the **full private key**, project ID, client email, and client ID — is committed directly to the repository. Although `.gitignore` has `*.json`, the file was already committed before the rule was added, so it exists in git history.

**Attack Scenario:** Any person with repository access (current, former team members, or if the repo is ever made public) can:
- Impersonate any Firebase user by minting custom tokens
- Access Firebase services (Firestore, Storage, etc.) with admin privileges
- Read/modify/delete all user authentication data
- Send push notifications to all users

**Fix:**
1. **Immediately rotate** the Firebase service account key in Firebase Console
2. Remove the file from git history: `git filter-branch` or `git filter-repo`
3. Use environment variables or a secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault)
4. Never commit credential files — add `firebase-admin-sdk.json` to `.gitignore` **before** first commit

---

### 1.2 Hardcoded API Secrets in `.env` (Committed via Git History)

**File:** `.env`  
**Severity:** 🔴 Critical

**Problem:** The `.env` file contains plaintext Cloudinary credentials (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) and MongoDB connection strings with credentials. While `.env` is in `.gitignore`, the file currently exists on disk and its credentials are visible.

```
CLOUDINARY_CLOUD_NAME=dztj4flvg
CLOUDINARY_API_KEY=583827186733722
CLOUDINARY_API_SECRET=aTH3NNuf3_HNipqU6lqk8Vb92s4
```

Additionally, commented-out MongoDB Atlas credentials with passwords are exposed:
```
# mongodb+srv://mongotestdev:ZeZSIS42mtSawzIH@cluster0...
# mongodb+srv://evercutdatabase:passqweT@learning.buura...
```

**Fix:**
1. Rotate ALL exposed credentials immediately
2. Use a `.env.example` with placeholder values only
3. Use a secrets management solution for production

---

### 1.3 Hardcoded MongoDB Credentials in `test.js`

**File:** `test.js`  
**Severity:** 🔴 Critical

**Problem:** Production/test MongoDB Atlas credentials are hardcoded directly in source code:
```js
const uri = "mongodb+srv://UjjwalSharma:1234@cluster0.gliwh6s.mongodb.net/..."
```

**Attack Scenario:** Username `UjjwalSharma` with password `1234` grants direct database access to anyone reading the code.

**Fix:** Delete `test.js` from the repository and git history. Never hardcode connection strings.

---

### 1.4 Authentication Backdoor — Hardcoded Dev Token

**File:** `middleware/verifyToken.js` (Lines 10-17)  
**Severity:** 🔴 Critical

**Problem:** A hardcoded bypass token `test-barber-token` allows **anyone** to authenticate as a specific barber without Firebase verification:
```js
if (token === 'test-barber-token') {
  req.firebaseUser = {
    firebaseUid: 'zvJuyX4ax0Y6db6FDYYanGIGkFg1',
    phone_number: '+911234567899'
  };
  return next();
}
```

**Attack Scenario:** Any attacker who discovers this token (via code review, decompilation, or network sniffing) can:
- Access ALL barber-side endpoints as the hardcoded user
- Modify shop data, bookings, employee records, services, and photos
- Delete ratings and manipulate earnings data

**Fix:**
```js
// REMOVE the entire test-barber-token block. Use environment-based flags:
if (process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_TOKENS === 'true') {
  // Only in development with explicit opt-in
}
```

---

## 2. 🔴 CRITICAL — Authentication & Authorization

### 2.1 No Role-Based Access Control (RBAC)

**Files:** All controllers and routes  
**Severity:** 🔴 Critical

**Problem:** The `verifyToken` middleware only validates that a Firebase token is valid — it does **not** distinguish between "User" and "Barber" roles. Both user types share the same middleware. A regular user can access barber-only endpoints and vice versa.

**Attack Scenario:**
- A **user** can call `POST /api/barber/services/add` to create services for any shop
- A **user** can call `DELETE /api/barber/ratingRemove/:ratingId` to delete unfavorable ratings
- A **barber** can call `POST /api/user/booking/book` to create fake bookings

**Fix:**
```js
// Create role-checking middleware
const requireRole = (role) => async (req, res, next) => {
  const { firebaseUid } = req.firebaseUser;
  if (role === 'barber') {
    const barber = await BarberSetup.findOne({ firebaseUid });
    if (!barber) return res.status(403).json({ message: 'Barber access required' });
    req.barber = barber;
  } else if (role === 'user') {
    const user = await User.findOne({ firebaseUid });
    if (!user) return res.status(403).json({ message: 'User access required' });
    req.user = user;
  }
  next();
};

// Usage: router.post('/add', verifyToken, requireRole('barber'), addService);
```

---

### 2.2 Unprotected Route — Booking Confirmation

**File:** `routes/user/booking/userBooking.routes.js` (Line 12)  
**Severity:** 🔴 Critical

```js
router.get('/confirm-booking/:bookingId', userBookingContoller.getBookingConfirmation);
// ^^^ No verifyToken middleware!
```

**Problem:** This endpoint exposes booking details (shop, services, amounts, dates) to **anyone** who guesses or enumerates MongoDB ObjectIds.

**Attack Scenario:** Attacker can iterate over booking IDs to extract all booking data, including customer information, shop details, and financial amounts.

**Fix:** Add `verifyToken` middleware and ownership verification.

---

### 2.3 No Ownership Verification on Sensitive Operations

**Files:** Multiple controllers  
**Severity:** 🔴 Critical

**Problem:** Many endpoints accept resource IDs (bookingId, userId, shopId) from request parameters but never verify that the authenticated user actually **owns** that resource.

**Examples:**
- `cancelBooking` (Line 8): Any authenticated user can cancel ANY booking by ID
- `BookingStatus` / `allowBooking`: Any user can change status of ANY booking
- `getUserBookingDetails`: Any barber can view ANY user's booking history
- `deleteBookedSlotAfterPayment`: Any user can delete ANY booking
- `updateBooking`: Any user can modify ANY booking's employee/date/time
- `deleteServiceFromBooking`: Any user can remove services from ANY booking
- `rescheduleBooking`: Any user can reschedule ANY booking

**Attack Scenario:** User A discovers User B's booking ID and cancels it, reschedules it, or views private booking details.

**Fix:** Every endpoint must verify: `booking.userId.toString() === req.user._id.toString()`

---

## 3. 🟠 HIGH — Injection Vulnerabilities

### 3.1 NoSQL Injection via Unsanitized User Input

**Files:** Multiple controllers  
**Severity:** 🟠 High

**Problem:** User-supplied values from `req.body`, `req.params`, and `req.query` are passed directly into MongoDB queries without sanitization. Mongoose provides *some* protection, but `$regex` queries with user input are particularly dangerous.

**Vulnerable patterns:**
```js
// searchPage.Controller.js
serviceName: { $regex: query, $options: "i" }  // User-controlled regex
shopName: { $regex: query, $options: "i" }

// homepage.controller.js  
serviceFor: { $regex: `^${gender}$`, $options: "i" }  // User-controlled
serviceName: { $regex: SearhedServiceName, $options: "i" }
```

**Attack Scenario (ReDoS):** An attacker sends a crafted regex pattern like `(a+)+$` as the `query` parameter, causing catastrophic backtracking that freezes the server (Denial of Service).

**Fix:**
```js
import escapeStringRegexp from 'escape-string-regexp';
const safeQuery = escapeStringRegexp(query);
serviceName: { $regex: safeQuery, $options: "i" }
```

---

### 3.2 Regex Injection in Service Duplicate Check

**File:** `barberService.controller.js` (Line 38)  
**Severity:** 🟠 High

```js
serviceName: { $regex: new RegExp(`^${serviceName}$`, "i") }
```

**Problem:** `serviceName` comes from user input. If it contains regex metacharacters (e.g., `.*`, `(`, `)`), it corrupts the query or enables ReDoS.

**Fix:** Escape the input or use exact match: `serviceName: { $eq: serviceName }` with case-insensitive collation.

---

## 4. 🟠 HIGH — Data Exposure & Leakage

### 4.1 Sensitive Data in API Responses

**Severity:** 🟠 High

**Problem:** Several endpoints return full Mongoose documents including sensitive fields:

| Endpoint | Leaked Data |
|----------|-------------|
| `checkBarberAfterOTP` | Returns full `barber` object including `pin` (hashed) |
| `createBarberOnboarding` | Returns full barber object with `pin` |
| `checkUserAfterOTP` | Returns full `user` object |
| `getUserProfile` | Returns full user document |
| `updateUserProfile` | Returns full user document |
| `BookSalon` | Returns full user and employee objects |

**Fix:** Always use `.select('-pin -__v')` or DTO pattern to filter outgoing data.

---

### 4.2 Error Messages Expose Internal Details

**Severity:** 🟠 High

**Problem:** Multiple controllers return `error.message` in responses:
```js
res.status(500).json({ message: error.message }); // ratingController, pop.controllers
res.status(500).json({ error: error.message });    // barberService, earnings
```

**Attack Scenario:** Stack traces and internal error messages reveal database schema names, file paths, library versions, and query structures to attackers.

**Fix:** Log full errors server-side, return generic messages to clients.

---

### 4.3 MongoDB Connection URI Logged to Console

**File:** `config/dbConnect.js` (Line 40)  
**Severity:** 🟠 High

```js
console.log('Connecting to MongoDB with URI:', mongoUri);
```

**Problem:** In production, this logs the full MongoDB URI (potentially with credentials) to stdout/logging systems.

**Fix:** Remove or redact: `console.log('Connecting to MongoDB...')`

---

## 5. 🟠 HIGH — Hardcoded Test/Fallback UIDs

### 5.1 Hardcoded Fallback `firebaseUid` in Controllers

**Files:** `barberEmployee.controller.js`, `barberService.controller.js`  
**Severity:** 🟠 High

**Problem:** Multiple controllers fall back to a hardcoded test UID:
```js
const firebaseUid = req.firebaseUser?.firebaseUid || req.body.firebaseUid || "test_firebase_uid";
```

**Attack Scenarios:**
1. Attacker sends `{ "firebaseUid": "victim_uid" }` in the request body → accesses victim's data
2. If `req.firebaseUser` is somehow undefined, all requests map to `"test_firebase_uid"`
3. The `firebaseUid` from `req.body` completely bypasses token-based auth

**Fix:** Always use ONLY the token-derived UID: `const { firebaseUid } = req.firebaseUser;`

---

## 6. ✅ RESOLVED — Barber Rating Management with Proper Ownership Check

**Files:** `src/services/rating.service.js`, `src/controllers/barber/barber-rating.controller.js`  
**Status:** ✅ Resolved in current implementation

**Previous Issue:** The `removeRating` endpoint verified the caller was a barber, but did NOT verify the rating belonged to the caller's shop. Any barber could delete ANY rating from ANY shop.

**Current Implementation:** All rating management operations (delete, reply, update reply, delete reply) now include proper ownership verification:

```js
// Verify the barber owns the shop this rating belongs to
const shop = await shopRepository.findByOwnerId(ownerId);
if (!shop || rating.shopId.toString() !== shop._id.toString()) {
    throw new BadRequestError('You can only manage ratings on your own shop');
}
```

**New Features Added:**
- Barbers can reply to customer ratings (max 500 characters)
- Barbers can update their replies
- Barbers can delete their replies
- All operations enforce shop ownership verification
- Replies include timestamp and are linked to the barber user

---

## 7. 🟡 MEDIUM — Database & Schema Issues

### 7.1 Missing Database Indexes

**Severity:** 🟡 Medium

| Collection | Missing Index | Impact |
|-----------|---------------|--------|
| Booking | `{ userId: 1, date: 1 }` | Slow booking queries by user and date |
| Booking | `{ salonist: 1, date: 1, time: 1 }` | Slow availability checks |
| Booking | `{ shopId: 1, status: 1 }` | Slow shop booking queries |
| Service | `{ shopId: 1, serviceType: 1 }` | Slow service lookups |
| Employee | `{ firebaseUid: 1 }` | Full collection scan for employee queries |
| Rating | `{ userId: 1, shopId: 1 }` unique | Allows duplicate ratings (unique index commented out!) |

### 7.2 Unique Rating Constraint Disabled

**File:** `models/Rating.js` (Line 14)  
**Severity:** 🟡 Medium

```js
// ratingSchema.index({ userId: 1, shopId: 1 }, { unique: true }); // COMMENTED OUT!
```

**Problem:** Although the `addRating` controller checks for duplicates in code, this is a race condition. Two concurrent requests can both pass the check and create duplicate ratings.

**Fix:** Uncomment and apply the unique compound index.

### 7.3 Schema Design Flaws

**Severity:** 🟡 Medium

- **`User.favorateBookings`** has `default: false` on an ObjectId array — should be `default: []`
- **`Booking`** has both manual `createdAt` field AND `{ timestamps: true }` — creates duplicate `createdAt`
- **`Employee.bookingSlots`** stores slots as `[{ date: String, time: String }]` — unbounded growth, should be a separate collection
- **PIN stored as String** in Barber model — no length/format constraint at schema level
- **No `updatedAt` timestamps** on User, Service models

---

## 8. 🟡 MEDIUM — Input Validation Gaps

### 8.1 No Input Validation on Critical Endpoints

**Severity:** 🟡 Medium

**Problem:** No input validation library (Joi, Zod, express-validator) is used. User input is trusted directly.

**Missing validations:**
- `BookSalon`: No validation of `serviceId`, `employeeId`, `shopId` format (MongoDB ObjectId)
- `createBarberOnboarding`: No email format validation, no phone format validation
- `completeProfile` (user): No validation of required fields before DB insert
- `updateService`: Accepts `req.body` directly into `findOneAndUpdate` — any field can be overwritten
- `addEmployee`: No phone number format validation, no gender enum check

**Fix:** Use `express-validator` or `zod` for schema validation on all endpoints.

### 8.2 Mass Assignment / Prototype Pollution Risk

**File:** `barberService.controller.js` (Line 154-160)  
**Severity:** 🟡 Medium

```js
const updateData = req.body;
Services.findOneAndUpdate({ _id: id, firebaseUid }, updateData, { new: true });
```

**Problem:** The entire `req.body` is passed as update data. An attacker can inject fields like `firebaseUid`, `shopId`, or `_id` to overwrite critical data.

**Fix:** Whitelist allowed fields explicitly.

---

## 9. 🟡 MEDIUM — Security Configuration Issues

### 9.1 CORS Fully Open

**File:** `server.js` (Line 46)  
**Severity:** 🟡 Medium

```js
app.use(cors());  // Allows ALL origins
```

**Fix:**
```js
app.use(cors({
  origin: ['https://evercut.com', 'https://app.evercut.com'],
  credentials: true
}));
```

### 9.2 No Rate Limiting

**Severity:** 🟡 Medium

**Problem:** No rate limiting on any endpoint. Vulnerable to brute-force attacks, credential stuffing, and DoS.

**Fix:** Use `express-rate-limit` on auth and booking endpoints.

### 9.3 No Helmet Security Headers

**Severity:** 🟡 Medium

**Problem:** No security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.).

**Fix:** `app.use(helmet());`

### 9.4 Custom `.env` Parser Instead of `dotenv`

**File:** `config/dbConnect.js` (Lines 13-29)  
**Severity:** 🟡 Medium

**Problem:** A custom manual `.env` parser reads the file synchronously with `fs.readFileSync` and manually splits lines. It doesn't handle comments properly (passes `MONGODB_URI=...  # comment` including the comment). This is why the proper `dotenv.config()` was bypassed.

**Fix:** Remove the custom parser. Use `dotenv.config()` consistently.

---

## 10. 🟡 MEDIUM — Logic & Business Rule Flaws

### 10.1 Booking Created with `status: "completed"` Immediately

**File:** `userBooking.controller.js` (Line 123)  
**Severity:** 🟡 Medium

```js
const newBooking = new Booking({ ...data, status: "completed" });
```

**Problem:** New bookings are immediately marked as "completed" instead of "pending" or "confirmed". This breaks the entire booking lifecycle (pending → confirmed → completed).

### 10.2 `getUpcommingBookings` Data Leak

**File:** `utils/getUpcommingBoookings.js` (Line 21-22)  
**Severity:** 🟡 Medium

```js
const todayBookings = await Booking.find({ date: todayStr }).lean();
// ❌ Missing: userId filter — returns ALL users' bookings for today
```

### 10.3 `filterBookings` Calls Async Without Await

**File:** `userBooking.controller.js` (Line 358)  
**Severity:** 🟡 Medium

```js
const bookings = getUpcommingBookings(date, userid);  // Missing `await`!
```

Returns a Promise object instead of actual data.

### 10.4 Undefined Variable `uid` in `checkBarberAfterOTP`

**File:** `barberAuth.controller.js` (Line 20)  
**Severity:** 🟡 Medium

```js
firebaseUid: uid,  // `uid` is undefined — should be `firebaseUid`
```

This will crash at runtime for new barbers.

---

## 11. 🟡 MEDIUM — Race Conditions

### 11.1 Booking Double-Booking Race Condition

**File:** `userBooking.controller.js`  
**Severity:** 🟡 Medium

**Problem:** Although `BookSalon` uses atomic `findOneAndUpdate` for the employee slot, `rescheduleBooking` checks availability with a separate `findOne` then `save`, creating a TOCTOU (time-of-check-time-of-use) race condition.

**Fix:** Use MongoDB transactions or atomic operations for all booking state changes.

---

## 12. 🟢 LOW — Code Quality & Architecture

### 12.1 Massive Commented-Out Code

**Files:** `shopinfo.controller.js` (330+ lines of comments), `dbConnect.js`, `barberAuth.controller.js`, `ratingRemove.Controller.js`, `barberValidation.service.js`

**Problem:** Makes code unreadable, increases maintenance burden, and can hide security issues.

### 12.2 Inconsistent Naming Conventions

| Issue | Examples |
|-------|----------|
| Typos in names | `favorateBookings` (→ favorite), `getBorberShop` (→ getBarberShop), `getUpcommingBoookings` (→ getUpcomingBookings), `SearhedServiceName` |
| Inconsistent casing | `ratingRemove.Controller.js` vs `searchPage.Controller.js` vs `booking.controller.js` |
| Inconsistent route naming | `photoGellary.routes.js` (→ gallery) |
| Duplicate imports | `searchPageRoutes` and `searchByserviceName` import the same file in `server.js` |

### 12.3 No Centralized Error Handling

**Severity:** 🟢 Low

Each controller has its own try-catch with inconsistent error responses. No global error handler for unhandled errors.

### 12.4 No Logging Framework

**Severity:** 🟢 Low

All logging uses `console.log`/`console.error` — no structured logging, log levels, or log rotation. No audit trail for security events.

**Fix:** Use `winston` or `pino` with structured JSON logging.

### 12.5 No Test Suite

**Severity:** 🟢 Low

No unit tests, integration tests, or API tests exist. The only `test.js` file is a hardcoded connection test with exposed credentials.

### 12.6 Missing `package.json` in Repository

**Severity:** 🟢 Low

The `.gitignore` rule `*.json` excludes `package.json` and `package-lock.json` from version control, making the project unreproducible.

**Fix:** Change `.gitignore` to specifically exclude only secrets: `firebase-admin-sdk.json` instead of `*.json`.

### 12.7 Duplicate Route Mount

**File:** `server.js` (Lines 14-15, 55-56)  
**Severity:** 🟢 Low

```js
import searchPageRoutes from "./routes/user/SearchPage/searchPage.routes.js";
import searchByserviceName from "./routes/user/SearchPage/searchPage.routes.js"; // Same file!

app.use('/api/user/searchpage', searchPageRoutes);
app.use('/api/user/searchByserviceName', searchByserviceName); // Duplicate mount
```

### 12.8 No Graceful Shutdown

**Severity:** 🟢 Low

No handling of `SIGTERM`/`SIGINT` signals. No cleanup of database connections on shutdown.

---

## 13. Priority Remediation Roadmap

### 🚨 Immediate (Week 1) — Block Deployment

| # | Action | Issue |
|---|--------|-------|
| 1 | **Rotate ALL credentials** — Firebase, Cloudinary, MongoDB | §1.1, §1.2, §1.3 |
| 2 | **Remove hardcoded bypass token** | §1.4 |
| 3 | **Remove hardcoded fallback UIDs** from controllers | §5.1 |
| 4 | **Scrub git history** of secrets using `git filter-repo` | §1.1, §1.2, §1.3 |
| 5 | **Add `verifyToken` to unprotected route** | §2.2 |
| 6 | **Fix `.gitignore`** — exclude specific files, not `*.json` | §12.6 |

### ⚠️ Short-Term (Week 2-3) — Pre-Production

| # | Action | Issue |
|---|--------|-------|
| 7 | **Implement RBAC middleware** (user vs barber) | §2.1 |
| 8 | **Add ownership verification** to all mutation endpoints | §2.3 |
| 9 | **Sanitize regex inputs** — install `escape-string-regexp` | §3.1, §3.2 |
| 10 | **Add rate limiting** — `express-rate-limit` | §9.2 |
| 11 | **Add Helmet** security headers | §9.3 |
| 12 | **Restrict CORS** origins | §9.1 |
| 13 | **Fix rating ownership check** in `removeRating` | §6 |
| 14 | **Strip sensitive fields** from all responses | §4.1 |

### 📋 Medium-Term (Month 1-2) — Hardening

| # | Action | Issue |
|---|--------|-------|
| 15 | **Add input validation** (Zod/Joi) on all endpoints | §8.1 |
| 16 | **Fix mass assignment** — whitelist update fields | §8.2 |
| 17 | **Add database indexes** | §7.1 |
| 18 | **Enable unique rating index** | §7.2 |
| 19 | **Fix business logic bugs** (status, async/await, undefined var) | §10 |
| 20 | **Implement structured logging** (winston/pino) | §12.4 |
| 21 | **Add centralized error handler** | §12.3 |
| 22 | **Remove commented-out code** | §12.1 |
| 23 | **Fix naming conventions** | §12.2 |
| 24 | **Add test suite** | §12.5 |
| 25 | **Add graceful shutdown** | §12.8 |

---

## 14. Recommended Architecture Improvements

### 14.1 Adopt Layered Architecture
```
routes/ → controllers/ → services/ → repositories/ → models/
```
Move business logic out of controllers into a `services/` layer. Controllers should only handle HTTP concerns.

### 14.2 Environment Configuration
```
config/
├── index.js          # Central config with validation
├── database.js       # DB connection
├── cloudinary.js     # Cloudinary
└── firebase.js       # Firebase
```
Use `envalid` or `joi` to validate all env vars at startup.

### 14.3 Security Middleware Stack
```js
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(mongoSanitize());    // Prevents NoSQL injection
app.use(hpp());              // Prevents HTTP parameter pollution
```

### 14.4 API Response Standardization
Use a consistent response envelope:
```js
// Success: { success: true, data: {...}, message: "..." }
// Error:   { success: false, error: { code: "VALIDATION_ERROR", message: "..." } }
```

### 14.5 Add Health Monitoring
- Use `@godaddy/terminus` for health checks with DB readiness
- Add request logging with correlation IDs
- Implement circuit breakers for external services (Cloudinary, Firebase)

---

## 15. Dependency Security Notes

Based on `node_modules` analysis, the following packages are in use:

| Package | Purpose | Note |
|---------|---------|------|
| `bcryptjs` | PIN hashing | ✅ Acceptable, consider `argon2` for new projects |
| `multer` | File uploads | ⚠️ Ensure `limits` are set on all instances |
| `cloudinary` | Image hosting | ✅ Good delegated storage |
| `firebase-admin` | Auth | ✅ Official SDK |
| `mongoose` | MongoDB ODM | ⚠️ Enable `sanitizeFilter` option globally |

**Missing recommended packages:**
- `helmet` — Security headers
- `express-rate-limit` — Rate limiting
- `express-mongo-sanitize` — NoSQL injection prevention
- `hpp` — HTTP parameter pollution
- `winston` or `pino` — Structured logging
- `joi` or `zod` — Input validation
- `cors` (configured) — Already installed but needs restriction

---

*End of Audit Report*

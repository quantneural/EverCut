# EverCut Backend — Complete Refactoring Implementation Plan

> **Generated: 2026-02-23 · Status: Ready for Review**  
> **Last Updated: 2026-02-24 · Rating Reply Feature Added**  
> **Architecture:** Layered (N-Tier) · **Auth Pattern:** Type 4 — Persona-Based · **Database:** MongoDB/Mongoose

---

## 🆕 Recent Updates (2026-02-24)

### Rating Reply Feature Implementation

A new feature has been added to allow barbers/shop owners to reply to customer ratings and reviews. This implementation follows the established architectural patterns and best practices:

**New Capabilities:**
- Barbers can view all ratings for their shop
- Barbers can add replies to customer ratings (max 500 characters)
- Barbers can update their existing replies
- Barbers can delete their replies
- All operations enforce proper shop ownership verification
- Replies include timestamp and are linked to the barber user

**Files Modified/Created:**
- `src/models/rating.model.js` - Added reply subdocument with text, repliedAt, repliedBy
- `src/repositories/rating.repository.js` - Added reply CRUD methods
- `src/services/rating.service.js` - Added business logic for reply management with ownership checks
- `src/controllers/barber/barber-rating.controller.js` - New controller for barber rating operations
- `src/validators/rating.validator.js` - Added reply validation schema
- `src/routes/barber.routes.js` - Added 4 new endpoints for rating management
- `postman-collections/12-barber-earnings.json` - Updated with new endpoints
- `postman-collections/06-customer-ratings.json` - Updated to show replies in responses
- `postman-collections/README.md` - Updated endpoint counts and business rules
- `postman-collections/QUICK_REFERENCE.md` - Updated with new endpoints
- `docs/SECURITY_AUDIT.md` - Marked rating ownership issue as resolved

**API Endpoints Added:**
- `GET /api/v1/barber/ratings` - Get all ratings for barber's shop
- `POST /api/v1/barber/ratings/:id/reply` - Add reply to a rating
- `PUT /api/v1/barber/ratings/:id/reply` - Update existing reply
- `DELETE /api/v1/barber/ratings/:id/reply` - Delete reply

**Security & Best Practices:**
- ✅ Proper role-based access control (BARBER role required)
- ✅ Shop ownership verification for all operations
- ✅ Input validation using Joi schemas
- ✅ Consistent error handling with custom error classes
- ✅ Follows layered architecture (Controller → Service → Repository → Model)
- ✅ Production-ready with proper validation and authorization

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Identified Issues](#2-identified-issues)
3. [Target Architecture](#3-target-architecture)
4. [New Folder Structure](#4-new-folder-structure)
5. [Database Schema Redesign](#5-database-schema-redesign)
6. [Phase 1 — Foundation & Infrastructure](#phase-1--foundation--infrastructure)
7. [Phase 2 — Models & Database Layer](#phase-2--models--database-layer)
8. [Phase 3 — Repositories (Data Access Layer)](#phase-3--repositories-data-access-layer)
9. [Phase 4 — Services (Business Logic Layer)](#phase-4--services-business-logic-layer)
10. [Phase 5 — Controllers (Presentation Layer)](#phase-5--controllers-presentation-layer)
11. [Phase 6 — Routes & Middleware](#phase-6--routes--middleware)
12. [Phase 7 — Validators](#phase-7--validators)
13. [Phase 8 — Entry Point & Wiring](#phase-8--entry-point--wiring)
14. [Phase 9 — Testing & QA](#phase-9--testing--qa)
15. [File-by-File Migration Map](#file-by-file-migration-map)
16. [Naming Conventions](#naming-conventions)

---

# 1. Current State Analysis

## What is EverCut?

EverCut is a **salon/barber booking platform** with two primary user types:
- **Customer (User):** Browses salons, books appointments, rates shops, manages bookings
- **Barber (Shop Owner):** Manages shop profile, employees, services, bookings, earnings, photos

This maps to **Case Study 6.3 — Salon–Customer Booking Platform** in the ROLE_BASED_AUTHENTICATION_ARCHITECTURE guide.

## Current Tech Stack
| Component | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express 5.1.0 |
| Database | MongoDB via Mongoose 8.13.2 |
| Auth | Firebase Admin SDK (phone OTP → Firebase ID token) |
| File Storage | Cloudinary (via multer-storage-cloudinary) |
| Password/PIN | bcryptjs |
| Other | dotenv, cors, body-parser, multer |

## Current File Count
- **63 JavaScript files** total
- **25 controller files** (across `controllers/barber/` and `controllers/user/`)
- **23 route files** (across `routes/barber/` and `routes/user/`)
- **7 model files** + 1 sub-schema
- **1 middleware file** (verifyToken.js)
- **1 utility file** (getUpcommingBoookings.js — misspelled)
- **2 config files** (dbConnect.js, cloudinary.js)
- **1 firebase service** (firebaseService.js — at root)
- **1 test file** (test.js — hardcoded credentials)

---

# 2. Identified Issues

## 2.1 Architectural Issues

| # | Issue | Severity | Detail |
|---|---|---|---|
| A1 | **No service layer** | 🔴 Critical | Controllers contain ALL business logic + data access directly. No separation of concerns. |
| A2 | **No repository layer** | 🔴 Critical | Mongoose queries scattered throughout controllers. Zero abstraction. |
| A3 | **No centralized error handling** | 🔴 Critical | Every controller has its own try-catch with inconsistent error responses. No global error handler middleware. |
| A4 | **No input validation layer** | 🔴 Critical | No Joi/Zod/express-validator schemas. Request body is trusted blindly in most controllers. |
| A5 | **No response formatting** | 🟡 Medium | Response shapes vary wildly: `{ message }`, `{ success, message }`, `{ error }`, `{ data }` etc. |
| A6 | **No API versioning** | 🟡 Medium | Routes use `/api/user/...` and `/api/barber/...` without version prefix. |
| A7 | **No environment config abstraction** | 🟡 Medium | `dotenv.config()` called in multiple files. `.env` parsed manually in dbConnect.js instead of using `process.env`. |

## 2.2 Security Issues

| # | Issue | Severity | Detail |
|---|---|---|---|
| S1 | **Hardcoded test tokens** | 🔴 Critical | `verifyToken.js` has `'test-barber-token'` that bypasses all auth in production. |
| S2 | **Exposed credentials** | 🔴 Critical | `test.js` has hardcoded MongoDB Atlas credentials. `.env` has Cloudinary secrets in plaintext. `firebase-admin-sdk.json` committed to repo. |
| S3 | **No JWT** | 🟡 Medium | Uses Firebase ID tokens only. No own JWT with role/permissions. Relies entirely on Firebase. |
| S4 | **No rate limiting** | 🟡 Medium | Zero rate limiting on any endpoint. |
| S5 | **No CORS config** | 🟡 Medium | `app.use(cors())` allows ALL origins. |
| S6 | **No security headers** | 🟡 Medium | No helmet, no CSP, no HSTS. |
| S7 | **Fallback UID patterns** | 🟡 Medium | Multiple controllers use `|| req.body.firebaseUid || "test_firebase_uid"` allowing auth bypass. |

## 2.3 Code Quality Issues

| # | Issue | Severity | Detail |
|---|---|---|---|
| C1 | **Massive commented-out code** | 🟡 Medium | `shopinfo.controller.js` is 452 lines — ~65% is commented-out old versions. Same pattern in many files. |
| C2 | **Duplicate logic** | 🟡 Medium | Time parsing (AM/PM → 24h) copy-pasted in 4+ places. Upcoming booking logic duplicated. |
| C3 | **Typos in names** | 🟢 Low | `favorateBookings`, `getUpcommingBoookings`, `photoGellary`, `SearhedServiceName`, `getBorberShop` |
| C4 | **Inconsistent naming** | 🟡 Medium | `EmployeeModel.js` vs `Barber.model.js` vs `Rating.js` vs `Service.js`. No convention. |
| C5 | **Mixed concerns in controllers** | 🔴 Critical | Multer upload config defined INSIDE controllers alongside business logic (e.g., `userAuth.controller.js`, `barberEmployee.controller.js`). |
| C6 | **Cloudinary config duplicated** | 🟢 Low | Cloudinary is configured in both `config/cloudinary.js` AND inline in `barberService.controller.js`. |
| C7 | **No logging framework** | 🟡 Medium | Only `console.log`/`console.error` with emoji-laden messages like `"Internal Server Error wtf"`. |
| C8 | **Dead code files** | 🟢 Low | `test.js` with hardcoded credentials. `REFACTORING_PLAN.txt` with a partial/outdated plan. |

## 2.4 Database / Schema Issues

| # | Issue | Severity | Detail |
|---|---|---|---|
| D1 | **No `updatedAt` on most models** | 🟡 Medium | Only `Barber.model.js` has manual `updatedAt`. Others lack it or rely on `timestamps: true` inconsistently. |
| D2 | **Inconsistent timestamps** | 🟡 Medium | `Booking` has both manual `createdAt` AND `{ timestamps: true }`. |
| D3 | **No soft delete** | 🟡 Medium | No `deletedAt` field on any model. Hard deletes everywhere. |
| D4 | **Employee not linked to Shop** | 🔴 Critical | `Employee.firebaseUid` links to barber's Firebase UID — not to the `BarberSetup._id`. If a barber account is deleted/changed, the relationship breaks. |
| D5 | **`favorateBookings` typo & wrong type** | 🟡 Medium | Field has `default: false` on an ObjectId array — semantically wrong. |
| D6 | **No index on critical query fields** | 🟡 Medium | Missing indexes on `Booking.userId`, `Service.shopId`, `Employee.firebaseUid` query patterns. |
| D7 | **PIN stored on Barber model** | 🟡 Medium | The barber access PIN is stored in the same document. Should be separated. |

---

# 3. Target Architecture

Based on the **BACKEND_ARCHITECTURE_BLUEPRINT** (Layered Structure for smaller teams) and **ROLE_BASED_AUTHENTICATION_ARCHITECTURE** (Type 4 — Persona-Based), the target architecture is:

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT (Mobile App)                   │
└───────────────────────────┬─────────────────────────────┘
                            │  HTTP REST API
┌───────────────────────────▼─────────────────────────────┐
│               PRESENTATION LAYER                        │
│   Routes → Middleware → Validators → Controllers        │
│   (thin controllers — extract params, call services,    │
│    return HTTP response)                                │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│               BUSINESS LOGIC LAYER                      │
│   Services (auth, booking, shop, user, employee,        │
│   service-catalog, rating, earnings, photo)             │
│   No HTTP context. Domain errors only.                  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│               DATA ACCESS LAYER                         │
│   Repositories (UserRepository, ShopRepository,         │
│   BookingRepository, EmployeeRepository, etc.)          │
│   Pure Mongoose operations. No business logic.          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    DATABASE / EXTERNAL                  │
│         MongoDB · Cloudinary · Firebase Auth            │
└─────────────────────────────────────────────────────────┘
```

### Role Architecture

```
Auth Middleware (applies to all /api/v1/* except /auth/*)
    │
    ├── /api/v1/customer/*  ──► requireRole('CUSTOMER') ──► Customer Controllers
    ├── /api/v1/barber/*    ──► requireRole('BARBER')   ──► Barber Controllers
    └── /api/v1/shared/*    ──► any authenticated       ──► Shared Controllers
```

---

# 4. New Folder Structure

```
src/
├── config/                          # Configuration & environment
│   ├── index.js                     # Central config exporter (reads .env once)
│   ├── database.config.js           # MongoDB connection setup
│   ├── cloudinary.config.js         # Cloudinary setup
│   └── firebase.config.js           # Firebase Admin SDK setup
│
├── middleware/                      # Express middleware
│   ├── authenticate.middleware.js   # Verify Firebase token → attach req.user
│   ├── authorize.middleware.js      # requireRole(), requirePermission()
│   ├── validate.middleware.js       # Schema validation runner (Joi/Zod)
│   ├── upload.middleware.js         # Multer configurations (all uploads)
│   ├── rate-limiter.middleware.js   # Rate limiting
│   ├── request-logger.middleware.js # Structured request logging
│   └── error-handler.middleware.js  # Global error handler (catch-all)
│
├── routes/                          # Route definitions only
│   ├── index.js                     # Route aggregator → /api/v1/*
│   ├── auth.routes.js               # /api/v1/auth/*
│   ├── customer.routes.js           # /api/v1/customer/*
│   ├── barber.routes.js             # /api/v1/barber/*
│   └── shared.routes.js             # /api/v1/shared/*
│
├── controllers/                     # Thin request handlers
│   ├── auth.controller.js           # Login/register for both roles
│   ├── customer/
│   │   ├── customer-profile.controller.js
│   │   ├── customer-booking.controller.js
│   │   ├── customer-shop.controller.js
│   │   └── customer-rating.controller.js
│   └── barber/
│       ├── barber-profile.controller.js
│       ├── barber-shop.controller.js
│       ├── barber-employee.controller.js
│       ├── barber-service.controller.js
│       ├── barber-booking.controller.js
│       ├── barber-photo.controller.js
│       └── barber-earnings.controller.js
│
├── services/                        # Business logic layer
│   ├── auth.service.js
│   ├── user.service.js
│   ├── shop.service.js
│   ├── employee.service.js
│   ├── service-catalog.service.js
│   ├── booking.service.js
│   ├── rating.service.js
│   ├── photo.service.js
│   ├── earnings.service.js
│   └── pin.service.js
│
├── repositories/                    # Data access layer
│   ├── user.repository.js
│   ├── shop.repository.js
│   ├── employee.repository.js
│   ├── service.repository.js
│   ├── booking.repository.js
│   ├── rating.repository.js
│   └── photo.repository.js
│
├── models/                          # Mongoose schema definitions
│   ├── user.model.js                # Core identity (both roles)
│   ├── customer-profile.model.js    # Customer-specific profile data
│   ├── shop.model.js                # Shop/Salon (replaces BarberSetup)
│   ├── employee.model.js
│   ├── service.model.js
│   ├── booking.model.js
│   ├── rating.model.js
│   └── photo.model.js
│
├── validators/                      # Joi/Zod validation schemas
│   ├── auth.validator.js
│   ├── booking.validator.js
│   ├── shop.validator.js
│   ├── employee.validator.js
│   ├── service.validator.js
│   ├── rating.validator.js
│   └── common.validator.js          # Shared rules (objectId, pagination, etc.)
│
├── utils/                           # Pure utility functions
│   ├── logger.js                    # Winston/Pino structured logger
│   ├── api-error.js                 # Custom AppError class hierarchy
│   ├── api-response.js              # Standardized response formatter
│   ├── time.utils.js                # Time parsing (AM/PM → 24h, slot checks)
│   ├── pagination.utils.js          # Pagination helper
│   └── constants.js                 # Enums, allowed values, config constants
│
├── app.js                           # Express app setup (middleware, routes)
└── server.js                        # HTTP server startup only
```

---

# 5. Database Schema Redesign

Following **Type 4 — Persona-Based** from the RBAC guide (shared identity, separate profiles):

## 5.1 `User` (Core Identity Table — Both Roles)

```javascript
const userSchema = new mongoose.Schema({
  firebaseUid:  { type: String, required: true, unique: true },
  phoneNumber:  { type: String, required: true, unique: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  roleType:     { type: String, required: true, enum: ['CUSTOMER', 'BARBER', 'ADMIN'] },
  isActive:     { type: Boolean, default: true },
  lastLoginAt:  { type: Date },
  deletedAt:    { type: Date, default: null },  // soft delete
}, { timestamps: true });
```

## 5.2 `CustomerProfile` (only for roleType = 'CUSTOMER')

```javascript
const customerProfileSchema = new mongoose.Schema({
  userId:       { type: ObjectId, ref: 'User', required: true, unique: true },
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, required: true, trim: true },
  gender:       { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  dateOfBirth:  { type: Date, required: true },
  address:      { type: String, required: true },
  photoUrl:     { type: String, default: null },
  cloudinaryId: { type: String, default: null },
  location: {
    type:        { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }  // [lng, lat]
  },
  favoriteBookings: [{ type: ObjectId, ref: 'Booking' }],
}, { timestamps: true });
```

## 5.3 `Shop` (replaces BarberSetup — one per barber)

```javascript
const shopSchema = new mongoose.Schema({
  ownerId:            { type: ObjectId, ref: 'User', required: true, unique: true },
  shopName:           { type: String, required: true, trim: true },
  ownerName:          { type: String, required: true, trim: true },
  category:           { type: String, enum: ['Salon', 'Beauty Parlour', 'Barber', 'Door-Step'], required: true },
  upiId:              { type: String, required: true },
  bio:                { type: String, default: '' },
  address:            { type: String, required: true },
  location: {
    type:        { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  numberOfEmployees:  { type: Number, required: true, min: 1 },
  yearsOfExperience:  { type: Number, required: true, min: 0 },
  facilities:         [{ type: String, trim: true }],
  availableDays:      [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }],
  openTime:           { type: String, required: true },
  closeTime:          { type: String, required: true },
  breakTimes:         [{ start: { type: String, required: true }, end: { type: String, required: true }, _id: false }],
  coverUrl:           { type: String, default: null },
  coverCloudinaryId:  { type: String, default: null },
  pinHash:            { type: String, required: true },
  isOpen:             { type: Boolean, default: true },
  deletedAt:          { type: Date, default: null },
}, { timestamps: true });

shopSchema.index({ location: '2dsphere' });
shopSchema.index({ ownerId: 1 });
shopSchema.index({ category: 1 });
```

## 5.4 `Employee` (linked to Shop by shopId)

```javascript
const employeeSchema = new mongoose.Schema({
  shopId:       { type: ObjectId, ref: 'Shop', required: true, index: true },
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, required: true, trim: true },
  phoneNumber:  { type: String, required: true },
  gender:       { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  dateOfBirth:  { type: Date, required: true },
  photoUrl:     { type: String, default: null },
  cloudinaryId: { type: String, default: null },
  workingHours: {
    start: { type: String },
    end:   { type: String }
  },
  bookedSlots:  [{ date: String, time: String }],
  blockedDates: [{ type: Date }],
  isActive:     { type: Boolean, default: true },
  deletedAt:    { type: Date, default: null },
}, { timestamps: true });

employeeSchema.index({ shopId: 1, isActive: 1 });
employeeSchema.index({ shopId: 1, phoneNumber: 1 }, { unique: true });
```

## 5.5 `Service` (linked to Shop)

```javascript
const serviceSchema = new mongoose.Schema({
  shopId:      { type: ObjectId, ref: 'Shop', required: true, index: true },
  serviceName: { type: String, required: true, trim: true },
  serviceType: { type: String, enum: ['single', 'bundled'], required: true },
  serviceFor:  { type: String, enum: ['male', 'female', 'unisex'], default: 'unisex' },
  imageUrl:    { type: String, required: true },
  // Single service fields
  duration:    { type: Number },
  actualPrice: { type: Number },
  offerPrice:  { type: Number, default: 0 },
  finalPrice:  { type: Number },
  // Bundled service fields
  bundledServices: [{ type: String }],
  totalDuration:   { type: Number },
  totalPrice:      { type: Number },
  isActive:    { type: Boolean, default: true },
  deletedAt:   { type: Date, default: null },
}, { timestamps: true });

serviceSchema.index({ shopId: 1, isActive: 1 });
serviceSchema.index({ shopId: 1, serviceName: 1 }, { unique: true });
```

## 5.6 `Booking`

```javascript
const bookingSchema = new mongoose.Schema({
  customerId:    { type: ObjectId, ref: 'User', required: true, index: true },
  shopId:        { type: ObjectId, ref: 'Shop', required: true, index: true },
  employeeId:    { type: ObjectId, ref: 'Employee', required: true },
  serviceIds:    [{ type: ObjectId, ref: 'Service', required: true }],
  date:          { type: Date, required: true },
  time:          { type: String, required: true },
  totalAmount:   { type: Number, default: 0 },
  status:        { type: String, enum: ['pending','confirmed','completed','cancelled','no-show'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending','success','failed'], default: 'pending' },
  rescheduleCount: { type: Number, default: 0 },
  cancelledAt:   { type: Date, default: null },
}, { timestamps: true });

bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ shopId: 1, date: 1 });
bookingSchema.index({ employeeId: 1, date: 1, time: 1 });
```

## 5.7 `Rating`

```javascript
const ratingSchema = new mongoose.Schema({
  customerId:  { type: ObjectId, ref: 'User', required: true },
  shopId:      { type: ObjectId, ref: 'Shop', required: true },
  rating:      { type: Number, min: 1, max: 5, required: true },
  review:      { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

ratingSchema.index({ shopId: 1, customerId: 1 }, { unique: true }); // one rating per customer per shop
```

## 5.8 `Photo`

```javascript
const photoSchema = new mongoose.Schema({
  shopId:       { type: ObjectId, ref: 'Shop', required: true, index: true },
  photoUrl:     { type: String, required: true },
  cloudinaryId: { type: String, required: true },
  photoName:    { type: String, required: true },
  photoType:    { type: String, enum: ['shop_interior','shop_exterior','work_sample','team_photo','certificate','other'], default: 'other' },
  description:  { type: String, maxlength: 500 },
  fileSize:     { type: Number },
  mimeType:     { type: String },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

photoSchema.index({ shopId: 1, isActive: 1 });
```

### Key Schema Changes Summary

| Before | After | Why |
|---|---|---|
| `BarberSetup.firebaseUid` | `Shop.ownerId` (ObjectId ref) | Proper FK relationship to User |
| `Employee.firebaseUid` | `Employee.shopId` (ObjectId ref) | Link employees to shop, not to Firebase UID |
| `Service.firebaseUid` | `Service.shopId` (ObjectId ref) | Same — proper relational design |
| `Photo.firebaseUid` | `Photo.shopId` (ObjectId ref) | Same |
| `Booking.userId` | `Booking.customerId` | Clearer naming |
| `Booking.salonist` | `Booking.employeeId` | Clearer naming |
| `User` (has all profile fields) | `User` (auth only) + `CustomerProfile` | Persona-based: separate identity from profile |
| `User.favorateBookings` (typo) | `CustomerProfile.favoriteBookings` | Fixed typo, moved to profile |
| `Rating.advice` | `Rating.review` | Clearer naming |

---

# Phase 1 — Foundation & Infrastructure

### Step 1.1: Create `src/` directory and core config

**Files to create:**
- `src/config/index.js` — Single point for all env vars (validated on startup)
- `src/config/database.config.js` — Clean MongoDB connection (no manual .env parsing)
- `src/config/cloudinary.config.js` — Cloudinary setup
- `src/config/firebase.config.js` — Firebase Admin SDK setup

### Step 1.2: Error handling infrastructure

**Files to create:**
- `src/utils/api-error.js` — Custom error class hierarchy:
  - `AppError` (base) → `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`
- `src/utils/api-response.js` — Consistent response format:
  - `ApiResponse.success(data, message, statusCode)`
  - `ApiResponse.error(message, statusCode, errors)`
- `src/middleware/error-handler.middleware.js` — Express global error handler

### Step 1.3: Logger setup

**Files to create:**
- `src/utils/logger.js` — Winston or Pino structured JSON logger
  - Request ID tracking
  - Log levels: debug, info, warn, error
  - No sensitive data in logs

### Step 1.4: Constants and utilities

**Files to create:**
- `src/utils/constants.js` — All enums: roles, booking statuses, shop categories, days of week, etc.
- `src/utils/time.utils.js` — Centralized time parsing (extract the duplicated AM/PM logic)
- `src/utils/pagination.utils.js` — Pagination helper for list endpoints

---

# Phase 2 — Models & Database Layer

### Step 2.1: Create all Mongoose models

**Files to create (8 models):**
- `src/models/user.model.js`
- `src/models/customer-profile.model.js`
- `src/models/shop.model.js`
- `src/models/employee.model.js`
- `src/models/service.model.js`
- `src/models/booking.model.js`
- `src/models/rating.model.js`
- `src/models/photo.model.js`

All models must have:
- `{ timestamps: true }` (auto `createdAt` + `updatedAt`)
- Proper indexes on query fields
- Soft-delete support via `deletedAt: Date`
- Consistent naming (camelCase fields)

---

# Phase 3 — Repositories (Data Access Layer)

Each repository encapsulates ALL Mongoose operations for one model. Services never call Mongoose directly.

**Files to create (7 repositories):**
- `src/repositories/user.repository.js`
- `src/repositories/shop.repository.js`
- `src/repositories/employee.repository.js`
- `src/repositories/service.repository.js`
- `src/repositories/booking.repository.js`
- `src/repositories/rating.repository.js`
- `src/repositories/photo.repository.js`

### Repository pattern example:
```javascript
// src/repositories/booking.repository.js
class BookingRepository {
  async create(data) { return Booking.create(data); }
  async findById(id) { return Booking.findById(id); }
  async findByCustomer(customerId, filters) { /* ... */ }
  async findByShop(shopId, filters) { /* ... */ }
  async findByEmployee(employeeId, date) { /* ... */ }
  async updateStatus(bookingId, status) { /* ... */ }
  async getCountsByStatus(shopId) { /* ... */ }
  // ... all data operations
}
```

---

# Phase 4 — Services (Business Logic Layer)

Services contain ALL business rules. No HTTP context, no req/res. They throw domain errors (AppError subclasses), not HTTP status codes.

**Files to create (10 services):**
- `src/services/auth.service.js` — Check after OTP, complete profile (both roles)
- `src/services/user.service.js` — Get/update user profile
- `src/services/shop.service.js` — CRUD shop profile, toggle open/closed, business updates
- `src/services/employee.service.js` — CRUD employees
- `src/services/service-catalog.service.js` — CRUD services (the salon services, not JS services)
- `src/services/booking.service.js` — Book, cancel, reschedule, reorder, filter, calendar
- `src/services/rating.service.js` — Add/get/delete ratings, summaries
- `src/services/photo.service.js` — Upload/get/delete photos, stats
- `src/services/earnings.service.js` — Calculate barber earnings
- `src/services/pin.service.js` — PIN validation, update, hashing

### Service layer rules:
1. Never import `req`, `res`, or `next`
2. Accept plain data objects as parameters
3. Return domain objects or throw domain errors
4. Call repositories for data access
5. Coordinate across multiple repositories when needed

---

# Phase 5 — Controllers (Presentation Layer)

Thin controllers that:
1. Extract parameters from `req` 
2. Call the appropriate service method
3. Format the HTTP response
4. Handle service errors → HTTP status codes

**Files to create (10 controllers):**
- `src/controllers/auth.controller.js`
- `src/controllers/customer/customer-profile.controller.js`
- `src/controllers/customer/customer-booking.controller.js`
- `src/controllers/customer/customer-shop.controller.js`
- `src/controllers/customer/customer-rating.controller.js`
- `src/controllers/barber/barber-profile.controller.js`
- `src/controllers/barber/barber-shop.controller.js`
- `src/controllers/barber/barber-employee.controller.js`
- `src/controllers/barber/barber-service.controller.js`
- `src/controllers/barber/barber-booking.controller.js`
- `src/controllers/barber/barber-photo.controller.js`
- `src/controllers/barber/barber-earnings.controller.js`

---

# Phase 6 — Routes & Middleware

### Step 6.1: Middleware

**Files to create:**
- `src/middleware/authenticate.middleware.js` — Firebase token verification → sets `req.user`
  - REMOVES the hardcoded test token bypass
  - Looks up User in database to attach `roleType` and MongoDB `_id`
- `src/middleware/authorize.middleware.js` — `requireRole('CUSTOMER')`, `requireRole('BARBER')`
- `src/middleware/validate.middleware.js` — Generic Joi schema runner
- `src/middleware/upload.middleware.js` — ALL multer configs in one file
- `src/middleware/rate-limiter.middleware.js` — express-rate-limit
- `src/middleware/error-handler.middleware.js` — Global catch-all

### Step 6.2: Routes

```
/api/v1/auth/session                 POST  (public)
/api/v1/onboarding/customers         POST  (public, with file upload)
/api/v1/onboarding/barbers           POST  (public)

/api/v1/customer/profile             GET, PUT
/api/v1/customer/bookings            GET (filter: upcoming/past/favorites)
/api/v1/customer/bookings            POST (book salon)
/api/v1/customer/bookings/:id        GET, DELETE (cancel)
/api/v1/customer/bookings/:id/reschedule    PUT
/api/v1/customer/bookings/:id/reorder       POST
/api/v1/customer/bookings/:id/favorite      PUT
/api/v1/customer/bookings/:id/confirmation  GET
/api/v1/customer/bookings/:id/services/:serviceId  DELETE
/api/v1/customer/shops/nearby        GET
/api/v1/customer/shops/doorstep      GET
/api/v1/customer/shops/:id           GET (shop info page)
/api/v1/customer/shops/:id/services  GET
/api/v1/customer/shops/:id/ratings   GET
/api/v1/customer/shops/:id/ratings/summary  GET
/api/v1/customer/ratings             POST
/api/v1/customer/search/services     GET
/api/v1/customer/search/shops        GET
/api/v1/customer/employees/:id/calendar GET
/api/v1/customer/homepage            GET (user home profile)
/api/v1/customer/homepage/services   GET (services by gender)

/api/v1/barber/profile               GET, PUT (shop profile)
/api/v1/barber/profile/pin           PUT
/api/v1/barber/profile/cover         PUT (upload cover)
/api/v1/barber/profile/toggle-status PUT  
/api/v1/barber/employees             GET, POST
/api/v1/barber/employees/:id         PUT, DELETE
/api/v1/barber/services              GET, POST
/api/v1/barber/services/:id          PUT, DELETE
/api/v1/barber/bookings              GET (all by shop)
/api/v1/barber/bookings/stats        GET (counts by status)
/api/v1/barber/bookings/:id/status   PUT (update status)
/api/v1/barber/bookings/:id          DELETE (after payment)
/api/v1/barber/bookings/users/:id    GET (user booking details)
/api/v1/barber/photos                GET, POST (upload multiple)
/api/v1/barber/photos/:id            GET, DELETE
/api/v1/barber/photos/stats          GET
/api/v1/barber/earnings              GET
/api/v1/barber/ratings/:id           DELETE
```

**Route files:**
- `src/routes/index.js` — Mounts all route groups under `/api/v1`
- `src/routes/auth.routes.js`
- `src/routes/customer.routes.js`
- `src/routes/barber.routes.js`

---

# Phase 7 — Validators

Using **Joi** for input validation schemas.

**Files to create:**
- `src/validators/auth.validator.js` — Login/register schemas
- `src/validators/booking.validator.js` — Book, reschedule, cancel schemas
- `src/validators/shop.validator.js` — Update business info schema
- `src/validators/employee.validator.js` — Add/update employee schema
- `src/validators/service.validator.js` — Add/update service schema
- `src/validators/rating.validator.js` — Add rating schema
- `src/validators/common.validator.js` — ObjectId, pagination, date params

---

# Phase 8 — Entry Point & Wiring

**Files to create:**
- `src/app.js` — Express app creation, middleware stack, route mounting
- `src/server.js` — HTTP server startup (`app.listen()`) + graceful shutdown

### Middleware stack order (per the Blueprint):
1. Request Logger
2. Security Headers (helmet)
3. CORS (configured properly)
4. Body Parser (with size limits)
5. Rate Limiter
6. Routes (which internally apply: Authenticate → Authorize → Validate → Controller)
7. 404 handler
8. Global Error Handler

---

# Phase 9 — Testing & QA

### Step 9.1: Install dev dependencies
- `jest` & `supertest` for testing
- `eslint` & `prettier` for code quality

### Step 9.2: Test plan
- Unit tests for all services (mock repositories)
- Unit tests for validators
- Integration tests for routes (supertest + in-memory MongoDB)
- Test authentication and authorization flows

---

# File-by-File Migration Map

| OLD File | → NEW File(s) | Notes |
|---|---|---|
| `server.js` (root) | `src/app.js` + `src/server.js` | Split app config from server startup |
| `config/dbConnect.js` | `src/config/database.config.js` | Remove manual .env parsing |
| `config/cloudinary.js` | `src/config/cloudinary.config.js` | Unchanged, clean up |
| `firebaseService.js` | `src/config/firebase.config.js` | Move into config/ |
| `middleware/verifyToken.js` | `src/middleware/authenticate.middleware.js` + `src/middleware/authorize.middleware.js` | Split auth from role guard, REMOVE test tokens |
| `models/User.model.js` | `src/models/user.model.js` + `src/models/customer-profile.model.js` | Split into identity + profile |
| `models/Barber.model.js` | `src/models/shop.model.js` | Rename, change FK to `ownerId` |
| `models/EmployeeModel.js` | `src/models/employee.model.js` | Change FK from `firebaseUid` to `shopId` |
| `models/Service.js` | `src/models/service.model.js` | Change FK, consistent naming |
| `models/Booking.model.js` | `src/models/booking.model.js` | Rename fields, fix timestamps |
| `models/Rating.js` | `src/models/rating.model.js` | Add unique index, rename `advice` → `review` |
| `models/PhotoModel.js` | `src/models/photo.model.js` | Change FK to `shopId` |
| `controllers/user/auth/*` | `src/controllers/auth.controller.js` + `src/services/auth.service.js` | Split controller from service |
| `controllers/barber/auth/*` | `src/controllers/auth.controller.js` + `src/services/auth.service.js` | Merge both auth flows into one |
| `controllers/user/booking/*` | `src/controllers/customer/customer-booking.controller.js` + `src/services/booking.service.js` | Split |
| `controllers/barber/booking/*` | `src/controllers/barber/barber-booking.controller.js` + `src/services/booking.service.js` | Split and share service |
| `controllers/user/homepage/*` | `src/controllers/customer/customer-shop.controller.js` + `src/services/shop.service.js` | Consolidate |
| `controllers/user/searchPage/*` | `src/controllers/customer/customer-shop.controller.js` | Merge into shop controller |
| `controllers/user/shopInfo/*` | `src/controllers/customer/customer-shop.controller.js` | Merge |
| `controllers/user/rating/*` | `src/controllers/customer/customer-rating.controller.js` + `src/services/rating.service.js` | Split |
| `controllers/barber/ratingRemove/*` | `src/controllers/barber/barber-booking.controller.js` | Merge into barber controller |
| `controllers/barber/business/*` | `src/controllers/barber/barber-shop.controller.js` + `src/services/shop.service.js` | Extract validation to validator |
| `controllers/barber/profile/*` | `src/controllers/barber/barber-profile.controller.js` + `src/services/pin.service.js` | Split |
| `controllers/barber/barberEarning/*` | `src/controllers/barber/barber-earnings.controller.js` + `src/services/earnings.service.js` | Split |
| `utils/getUpcommingBoookings.js` | `src/utils/time.utils.js` + `src/services/booking.service.js` | Fix typo, move logic to service |
| `test.js` | **DELETE** | Hardcoded credentials, not a real test |
| `REFACTORING_PLAN.txt` | **DELETE** | Superseded by this plan |

---

# Naming Conventions

## Files & Directories
| Type | Convention | Example |
|---|---|---|
| Directories | `kebab-case/` | `src/middleware/` |
| Models | `kebab-case.model.js` | `customer-profile.model.js` |
| Controllers | `kebab-case.controller.js` | `barber-booking.controller.js` |
| Services | `kebab-case.service.js` | `service-catalog.service.js` |
| Repositories | `kebab-case.repository.js` | `booking.repository.js` |
| Middleware | `kebab-case.middleware.js` | `authenticate.middleware.js` |
| Validators | `kebab-case.validator.js` | `booking.validator.js` |
| Routes | `kebab-case.routes.js` | `customer.routes.js` |
| Utils | `kebab-case.js` or `kebab-case.utils.js` | `time.utils.js` |

## Variables & Functions
| Type | Convention | Example |
|---|---|---|
| Variables | `camelCase` | `customerProfile`, `totalAmount` |
| Functions | `camelCase` (verb-first) | `findByShopId()`, `calculateEarnings()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PHOTOS`, `BOOKING_STATUSES` |
| Classes | `PascalCase` | `BookingService`, `AppError` |

## Database Fields
| Convention | Example |
|---|---|
| `camelCase` for all fields | `customerId`, `shopId`, `totalAmount` |
| `is` prefix for booleans | `isActive`, `isOpen` |
| Timestamps via Mongoose `{ timestamps: true }` | `createdAt`, `updatedAt` auto-managed |
| Soft delete | `deletedAt: Date \| null` |
| Foreign keys end with `Id` | `customerId`, `shopId`, `employeeId` |

---

## Execution Order Summary

```
Phase 1 → Config, errors, logger, utilities (foundation)
Phase 2 → Models (database schema)
Phase 3 → Repositories (data access)
Phase 4 → Services (business logic)
Phase 5 → Controllers (thin handlers)
Phase 6 → Routes & middleware (wiring)
Phase 7 → Validators (input validation)
Phase 8 → App entry point (server startup)
Phase 9 → Testing & QA
```

Each phase builds on the previous. No phase depends on code not yet written.

---

> **NEXT STEP:** Once you approve this plan, I will begin implementation starting with Phase 1 — creating the foundation infrastructure inside a new `src/` directory. The old codebase will remain untouched until the new code is working and verified.

# EverCut API — Postman Collections

A complete set of Postman collections for every EverCut API route, with shared-variable automation, pre-wired file uploads, and automatic ID capture so requests can be run sequentially without manual copy-pasting.

---

## Files in This Directory

| File | Collection name | Description |
|---|---|---|
| `01-authentication.json` | EverCut - Authentication | Session bootstrap for both test users plus a health check |
| `02-onboarding.json` | EverCut - Onboarding | First-run profile creation for customer and barber |
| `03-customer-profile.json` | EverCut - Customer Profile | Profile read/update and homepage endpoints |
| `04-customer-bookings.json` | EverCut - Customer Bookings | Full booking lifecycle: create, update, reschedule, reorder, cancel |
| `05-customer-shop-discovery.json` | EverCut - Customer Shop Discovery | Nearby shop/service search and keyword search |
| `06-customer-ratings.json` | EverCut - Customer Ratings | Submit a rating and read shop rating data |
| `07-barber-profile-shop.json` | EverCut - Barber Profile & Shop | Shop management: info, UPI, status, images, PIN, account actions |
| `08-barber-employees.json` | EverCut - Barber Employees | Employee CRUD with optional photo upload |
| `09-barber-services.json` | EverCut - Barber Services | Service catalogue CRUD (single and bundled services) |
| `10-barber-bookings.json` | EverCut - Barber Bookings | Booking administration: list, stats, status update, delete |
| `11-barber-photos.json` | EverCut - Barber Photos | Shop gallery: upload, list, stats, delete |
| `12-barber-earnings.json` | EverCut - Barber Earnings | Earnings summary (requires completed bookings for non-zero values) |
| `13-barber-ratings.json` | EverCut - Barber Ratings | Rating reply management (add, update, delete) and rating removal |
| `EverCut.postman_environment.json` | — | Active environment — set `customer_firebase_token` and `barber_firebase_token` here |
| `assets/sample-upload.png` | — | Sample image pre-wired into all file-upload requests |

---

## Collection Request Reference

### `01-authentication.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | POST | `/api/v1/auth/session` | Create customer session |
| 2 | POST | `/api/v1/auth/session` | Create barber session |
| 3 | GET | `/api/v1/health` | Health check |

### `02-onboarding.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | POST | `/api/v1/onboarding/customers` | Complete customer profile (first run only) |
| 2 | POST | `/api/v1/onboarding/barbers` | Complete barber profile (first run only) |

### `03-customer-profile.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/customer/profile` | Get profile |
| 2 | PUT | `/api/v1/customer/profile` | Update profile |
| 3 | GET | `/api/v1/customer/homepage` | Get homepage |
| 4 | GET | `/api/v1/customer/homepage/services` | Get services by gender — also captures shared shop/service IDs |

### `04-customer-bookings.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/customer/bookings?type=upcoming` | List upcoming bookings — captures booking ID |
| 2 | GET | `/api/v1/customer/employees/{{employee_id}}/calendar` | Get employee availability |
| 3 | POST | `/api/v1/customer/bookings` | Create a booking |
| 4 | GET | `/api/v1/customer/bookings/{{booking_id}}` | Get booking details |
| 5 | GET | `/api/v1/customer/bookings/{{booking_id}}/confirmation` | Get booking confirmation |
| 6 | PUT | `/api/v1/customer/bookings/{{booking_id}}/favorite` | Toggle favorite |
| 7 | PUT | `/api/v1/customer/bookings/{{booking_id}}` | Update booking |
| 8 | PUT | `/api/v1/customer/bookings/{{booking_id}}/reschedule` | Reschedule booking |
| 9 | POST | `/api/v1/customer/bookings/{{booking_id}}/reorder` | Reorder booking |
| 10 | DELETE | `/api/v1/customer/bookings/{{booking_id}}/services/{{service_id}}` | Remove a service from booking |
| 11 | DELETE | `/api/v1/customer/bookings/{{booking_id}}` | Cancel booking |

### `05-customer-shop-discovery.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/customer/shops/nearby` | Get nearby shops — captures shop ID |
| 2 | GET | `/api/v1/customer/shops/{{shop_id}}` | Get shop details — captures service ID |
| 3 | GET | `/api/v1/customer/shops/doorstep` | Get doorstep shops |
| 4 | GET | `/api/v1/customer/search/services` | Search services by keyword and gender |
| 5 | GET | `/api/v1/customer/search/shops` | Search shops by keyword |

### `06-customer-ratings.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/customer/shops/nearby` | Bootstrap: get shop ID for the rating |
| 2 | POST | `/api/v1/customer/ratings` | Submit a rating (once per customer/shop — returns 409 on rerun) |
| 3 | GET | `/api/v1/customer/shops/{{shop_id}}/ratings` | List shop ratings |
| 4 | GET | `/api/v1/customer/shops/{{shop_id}}/ratings/summary` | Get rating summary |

### `07-barber-profile-shop.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/profile` | Get profile — captures shop ID |
| 2 | PUT | `/api/v1/barber/profile` | Update business info |
| 3 | GET | `/api/v1/barber/profile/upi` | Get UPI details |
| 4 | PUT | `/api/v1/barber/profile/upi` | Update UPI details |
| 5 | PUT | `/api/v1/barber/profile/toggle-status` | Ensure shop is open |
| 6 | PUT | `/api/v1/barber/profile/picture` | Update profile picture |
| 7 | PUT | `/api/v1/barber/profile/cover` | Update cover image |
| 8 | PUT | `/api/v1/barber/profile/pin` | Update PIN |
| 9A | POST | `/api/v1/barber/profile/sign-out-everywhere` | Sign out everywhere *(Terminal)* |
| 9B | DELETE | `/api/v1/barber/profile` | Delete account *(Terminal)* |

### `08-barber-employees.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/employees` | List employees — captures employee ID |
| 2 | POST | `/api/v1/barber/employees` | Add employee |
| 3 | PUT | `/api/v1/barber/employees/{{employee_id}}` | Update employee |
| 4 | DELETE | `/api/v1/barber/employees/{{employee_id}}` | Delete employee *(Terminal)* |

### `09-barber-services.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/services` | List services — captures service ID |
| 2 | POST | `/api/v1/barber/services` | Add a single service |
| 3 | POST | `/api/v1/barber/services` | Add a bundled service |
| 4 | PUT | `/api/v1/barber/services/{{service_id}}` | Update service |
| 5 | DELETE | `/api/v1/barber/services/{{service_id}}` | Delete service *(Terminal)* |

### `10-barber-bookings.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/bookings` | List all bookings — captures IDs for status update and delete |
| 2 | GET | `/api/v1/barber/bookings/stats` | Get booking stats |
| 3 | GET | `/api/v1/barber/bookings/status?status=confirmed` | Filter bookings by status |
| 4 | PUT | `/api/v1/barber/bookings/{{booking_id_status}}/status` | Update booking status |
| 5 | DELETE | `/api/v1/barber/bookings/{{booking_id_delete}}` | Delete a paid booking *(Terminal)* |

### `11-barber-photos.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/photos` | List gallery photos — captures photo ID |
| 2 | POST | `/api/v1/barber/photos` | Upload photos |
| 3 | GET | `/api/v1/barber/photos/stats` | Get photo stats |
| 4 | GET | `/api/v1/barber/photos/{{photo_id}}` | Get photo by ID |
| 5 | DELETE | `/api/v1/barber/photos/{{photo_id}}` | Delete photo *(Terminal)* |

### `12-barber-earnings.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/earnings` | Get earnings summary |

### `13-barber-ratings.json`

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | GET | `/api/v1/barber/ratings` | List ratings — captures seeded IDs for reply/remove operations |
| 2 | POST | `/api/v1/barber/ratings/{{rating_id_add_reply}}/reply` | Add reply to a rating |
| 3 | PUT | `/api/v1/barber/ratings/{{rating_id_update_reply}}/reply` | Update an existing reply |
| 4 | DELETE | `/api/v1/barber/ratings/{{rating_id_update_reply}}/reply` | Delete a reply |
| 5 | DELETE | `/api/v1/barber/ratings/{{rating_id_remove_rating}}` | Remove a rating |

---

## Setup

### 1. Generate tokens

```bash
cd server
node scripts/firebase-token-gen.js
```

This creates two Firebase test users (idempotent) and saves fresh ID tokens to `scripts/test-tokens.txt`.

### 2. Import into Postman

1. Import every `.json` collection from this folder.
2. Import `EverCut.postman_environment.json` as the active environment.
3. Copy the customer ID token from `scripts/test-tokens.txt` into the `customer_firebase_token` environment variable.
4. Copy the barber ID token into the `barber_firebase_token` environment variable.
5. Run requests.

> Re-run `node scripts/firebase-token-gen.js` and update the environment variables when tokens expire (after 1 hour).

### Test users

| Role | UID | Email | Phone |
|---|---|---|---|
| Customer | `test-customer-001` | `test.customer@example.com` | `+15550000001` |
| Barber | `test-barber-001` | `test.barber@example.com` | `+15550000002` |

### Environment variables

All collections read these from the active environment automatically:

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:5000` |
| `api_prefix` | `api/v1` |
| `customer_firebase_token` | Customer ID token (set by token generator) |
| `barber_firebase_token` | Barber ID token (set by token generator) |

---

## Recommended Run Order

### Barber side (must run first to create bookable data)

1. `01-authentication.json` → **2. Create Barber Session**
2. `02-onboarding.json` → **2. Complete Barber Profile** *(first run only)*
3. `07-barber-profile-shop.json` — captures `shared_shop_id`, ensures shop is open
4. `08-barber-employees.json` — at minimum run Add Employee to populate `shared_employee_id`
5. `09-barber-services.json` — at minimum run Add Service to populate `shared_service_id`
6. `11-barber-photos.json`
7. `10-barber-bookings.json`
8. `12-barber-earnings.json`
9. `13-barber-ratings.json` *(requires seeded data — see Special Cases below)*

### Customer side

1. `01-authentication.json` → **1. Create Customer Session**
2. `02-onboarding.json` → **1. Complete Customer Profile** *(first run only)*
3. `03-customer-profile.json`
4. `05-customer-shop-discovery.json`
5. `04-customer-bookings.json`
6. `06-customer-ratings.json`

> Requests marked ***(Terminal)*** are destructive (delete/sign-out). Run them last within their collection and do not run them if you need that data for subsequent requests.

---

## Shared Automation

Collections capture and share the following Postman globals automatically:

| Global | Set by | Used by |
|---|---|---|
| `shared_shop_id` | `07-barber-profile-shop.json` request 1 | Customer collections, ratings |
| `shared_employee_id` | `08-barber-employees.json` requests 1 & 2 | Customer bookings |
| `shared_service_id` | `09-barber-services.json` requests 1 & 2 | Customer bookings |
| `shared_booking_id` | `04-customer-bookings.json` requests 1 & 3 | Booking detail requests |
| `shared_photo_id` | `11-barber-photos.json` requests 1 & 2 | Photo detail/delete |
| `shared_barber_pin` | `07-barber-profile-shop.json` request 8 | Future PIN-gated requests |

---

## Special Cases

### `13-barber-ratings.json` — seed data required

The rating reply and remove requests each need ratings in different states (no reply, has reply, removable). The live API cannot manufacture these on demand. Run the seed script first:

```bash
cd server
node scripts/seed-barber-rating-mock-data.js
```

### `06-customer-ratings.json` — Add Rating (request 2)

Succeeds once per customer/shop pair. Returns `409 Conflict` on every subsequent run because the API enforces one rating per customer per shop. This is expected behaviour, not a bug.

### `10-barber-bookings.json` — Delete Paid Booking (request 5)

Only succeeds when a booking with `paymentStatus: success` exists. The collection captures one automatically if the backend returns it — otherwise skip this request.

---

## Sample Upload Asset

All file-upload requests (profile picture, cover image, employee photo, gallery photos) are pre-wired to:

```
server/postman-collections/assets/sample-upload.png
```

The path is absolute. If you move the repository, update the `src` field in the affected form-data requests, or re-run `node scripts/regenerate-postman-collections.mjs` after updating the path constant in that script.


# EverCut API - Postman Collections

## 📁 Collection Organization

This folder contains **13 modular Postman collections** organized by feature/module for the EverCut Salon & Barber Booking Platform API.

### Collections Overview

| # | Collection Name | Endpoints | Description |
|---|----------------|-----------|-------------|
| 01 | **Authentication** | 2 | Firebase session bootstrap and health check |
| 02 | **Onboarding** | 2 | Customer and barber profile creation |
| 03 | **Customer Profile** | 4 | Profile management, homepage, services by gender |
| 04 | **Customer Bookings** | 11 | Book, cancel, reschedule, reorder, favorites, employee calendar |
| 05 | **Customer Shop Discovery** | 5 | Nearby shops, doorstep services, search |
| 06 | **Customer Ratings** | 3 | Add ratings, view ratings with replies, rating summary |
| 07 | **Barber Profile & Shop** | 10 | Shop profile, owner picture, onboarding-shaped profile updates, dedicated UPI details, PIN, cover, status, session revocation, account deletion |
| 08 | **Barber Employees** | 4 | Employee CRUD operations |
| 09 | **Barber Services** | 5 | Service catalog management (single/bundled) |
| 10 | **Barber Bookings** | 5 | Booking management, stats, status updates |
| 11 | **Barber Photos** | 5 | Photo gallery management |
| 12 | **Barber Earnings** | 1 | Earnings tracking and summary |
| 13 | **Barber Ratings** | 5 | Barber-side rating moderation, replies, and rating removal |

**Total: 62 endpoints** across 13 collections

---

## 🚀 Quick Start

### Step 1: Generate Firebase Tokens

Before importing collections, generate test tokens using the provided script:

```bash
cd server
node scripts/firebase-token-gen.js
```

This script will:
- Create test users in Firebase Auth (if they don't exist)
- Apply custom claims (CUSTOMER or BARBER role)
- Generate ID tokens valid for 1 hour
- Save tokens to `scripts/test-tokens.txt`

**Test Users Created:**
- `test-customer-001` - Customer role (+15550000001)
- `test-barber-001` - Barber role (+15550000002)

**Important:** Tokens expire after 1 hour. Re-run the script to refresh them.

### Step 2: Import Collections into Postman

**Option A: Import All Collections at Once**
1. Open Postman
2. Click **Import** button (top left)
3. Select **Folder** tab
4. Choose the `postman-collections` folder
5. Click **Import** - all 13 collections will be imported

**Option B: Import Individual Collections**
1. Open Postman
2. Click **Import** button
3. Select individual JSON files (01-authentication.json, 02-onboarding.json, etc.)
4. Click **Import**

### Step 3: Configure Collection Variables

Each collection has built-in variables. You only need to set the Firebase token:

**Quick Setup (Recommended):**
1. Open `server/scripts/test-tokens.txt` (generated in Step 1)
2. Copy the ID token for the role you need (CUSTOMER or BARBER)
3. In Postman, click on a collection name
4. Go to **Variables** tab
5. Paste the token into the **Current Value** field for `firebase_token`
6. Click **Save**

**Variables (Pre-configured):**
```
base_url: http://localhost:5000  (change for production)
api_prefix: /api/v1  (do not change)
firebase_token: [PASTE YOUR TOKEN HERE]
```

**For production:**
- Change `base_url` to your production API URL (e.g., `https://api.evercut.com`)
- Keep `api_prefix` as `/api/v1`

**Token Management:**
- Customer token: Use for collections 01-06
- Barber token: Use for collections 01-02, 07-13
- Tokens expire after 1 hour - re-run `firebase-token-gen.js` to refresh

---

## 🔐 Authentication Flow

### Automated Testing Flow (Recommended)

**Using the Token Generator Script:**

```bash
# 1. Generate tokens
cd server
node scripts/firebase-token-gen.js

# 2. Copy token from scripts/test-tokens.txt
# 3. Paste into Postman collection variable 'firebase_token'
# 4. Start testing immediately!
```

**Test Users:**
- **Customer:** `test-customer-001` / +15550000001
- **Barber:** `test-barber-001` / +15550000002

Both users are created automatically by the script with proper roles.

### Manual Token Generation (Production/Real Users)

If you need tokens for real users (not test users):

```javascript
// In your mobile/web app (for real users)
firebase.auth().signInWithPhoneNumber(phoneNumber)
  .then(confirmationResult => confirmationResult.confirm(otpCode))
  .then(result => result.user.getIdToken())
  .then(idToken => {
    console.log('Firebase Token:', idToken);
    // Use this token in Postman
  });
```

### Testing Workflow

### Testing Workflow

**For Customer Testing:**
1. Use customer token from `test-tokens.txt`
2. Run `01-authentication` → **Create Session**
3. If new user, run `02-onboarding` → **Complete Customer Profile**
4. Now test all Customer collections (03-06)

**For Barber Testing:**
1. Use barber token from `test-tokens.txt`
2. Run `01-authentication` → **Create Session**
3. If new user, run `02-onboarding` → **Complete Barber Profile**
4. Now test all Barber collections (07-13)

**Note:** The test users created by `firebase-token-gen.js` are new users, so you'll need to complete onboarding first.

---

## 📋 Testing Workflows

### Customer Workflow

```
01-Authentication
  ↓ Create Session
02-Onboarding
  ↓ Complete Customer Profile
03-Customer Profile
  ↓ Get Profile → Update Profile
05-Customer Shop Discovery
  ↓ Get Nearby Shops → Get Shop Info
04-Customer Bookings
  ↓ Get Employee Calendar → Book Salon → Get Booking Details
06-Customer Ratings
  ↓ Add Rating
```

### Barber Workflow

```
01-Authentication
  ↓ Create Session
02-Onboarding
  ↓ Complete Barber Profile (multipart + 3 shop images)
07-Barber Profile & Shop
  ↓ Get Profile → Update Profile Picture / Update Business Info / Get/Update UPI Details / Change PIN / Update Cover Image / Sign-Out Everywhere / Delete Account
08-Barber Employees
  ↓ Add Employee (repeat for multiple employees)
09-Barber Services
  ↓ Add Single Service / Add Bundled Service (repeat)
11-Barber Photos
  ↓ Upload Photos
10-Barber Bookings
  ↓ Get All Bookings → Update Booking Status
12-Barber Earnings
  ↓ Get Earnings
13-Barber Ratings
  ↓ Get Ratings And Capture Seeded IDs → Add Reply / Update Reply / Delete Reply → Remove Rating
```

---

## 🔄 Collection Variables

### Shared Variables (All Collections)
- `base_url` - API server URL
- `api_prefix` - API version prefix (/api/v1)
- `firebase_token` - Firebase ID token for authentication

## 🔄 Collection Variables

### Shared Variables (All Collections)
- `base_url` - API server URL (default: http://localhost:5000)
- `api_prefix` - API version prefix (default: /api/v1) - **Do not change**
- `firebase_token` - Firebase ID token for authentication - **Set this from test-tokens.txt**

### Auto-Captured Variables (Set by Test Scripts)
These variables are automatically populated when you run certain requests:

| Variable | Captured From | Used In |
|----------|--------------|---------|
| `booking_id` | Book Salon, Get All Bookings | Booking operations (Collections 04, 10) |
| `shop_id` | Get Nearby Shops, Get Shop Info | Shop operations (Collections 05, 06) |
| `employee_id` | Add Employee | Employee operations (Collection 08) |
| `service_id` | Add Service | Service operations (Collection 09) |
| `photo_id` | Upload Photos | Photo operations (Collection 11) |
| `rating_id_add_reply` | Get Ratings (seeded data) | Add Reply (Collection 13) |
| `rating_id_update_reply` | Get Ratings (seeded data) | Update/Delete Reply (Collection 13) |
| `rating_id_remove_rating` | Get Ratings (seeded data) | Remove Rating (Collection 13) |

### Variable Scope Best Practices

**Option 1: Set token in each collection (Current setup)**
- Each collection has its own `firebase_token` variable
- Set the token separately in each collection you use
- Good for testing different roles in different collections

**Option 2: Use Postman Environment (Recommended for teams)**
1. Create a new Environment in Postman
2. Add variables: `base_url`, `api_prefix`, `firebase_token`
3. Select the environment before testing
4. All collections will use the same token

**Option 3: Collection-level inheritance**
- Create a parent collection or workspace
- Set variables at workspace level
- All collections inherit the values

### Collection-Specific Variables

See the "Auto-Captured Variables" table above for details on which variables are set automatically.

**Note:** Variables are automatically set using Test Scripts when you create resources or list them.

---

## 📝 Request Examples

### Example 1: Complete Customer Registration

```http
POST {{base_url}}{{api_prefix}}/onboarding/customers
Authorization: Bearer {{firebase_token}}
Content-Type: multipart/form-data

firstName: John
lastName: Doe
phoneNumber: +1234567890
email: john@example.com
gender: Male
dateOfBirth: 1990-01-01
address: 123 Main St, New York, NY
location: {"type":"Point","coordinates":[-73.935242,40.730610]}
photo: [file]
```

### Example 2: Book a Salon

```http
POST {{base_url}}{{api_prefix}}/customer/bookings
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "serviceId": ["service_id_1", "service_id_2"],
  "employeeId": "employee_id",
  "shopId": "shop_id",
  "date": "2024-03-15",
  "time": "14:30",
  "amount": 500
}
```

### Example 3: Get Nearby Shops

```http
GET {{base_url}}{{api_prefix}}/customer/shops/nearby?coordinates=-73.935242,40.730610
Authorization: Bearer {{firebase_token}}
```

---

## ⚙️ Advanced Features

### Automated ID Capture

Collections automatically capture resource IDs using test scripts, eliminating manual copy-paste:

**Auto-captured Variables:**
- `booking_id` - From booking creation or first booking in list
- `shop_id` - From shop info or first nearby shop
- `employee_id` - From employee creation
- `service_id` - From service creation
- `photo_id` - From photo upload
- `rating_id_*` - From seeded barber ratings (Collection 13)

**How it works:**
1. Run a request that creates or lists resources
2. The test script automatically extracts the ID
3. Subsequent requests use the captured ID via `{{variable_name}}`
4. No manual copying needed!

**Example Flow:**
```
1. Run "Book Salon" → booking_id auto-captured
2. Run "Get Booking Details" → uses {{booking_id}} automatically
3. Run "Cancel Booking" → uses {{booking_id}} automatically
```

### Test Scripts

Collections include test scripts that automatically:
- Save resource IDs to variables after creation
- Validate response status codes
- Extract data for subsequent requests

**Example:** After running "Book Salon", the `booking_id` is automatically saved and can be used in "Get Booking Details".

### Pre-request Scripts

Some requests include pre-request scripts for:
- Dynamic date generation
- Token validation
- Parameter formatting

---

## 🎯 Business Rules & Constraints

### Booking Rules
- Cannot book in the past
- Must be within shop hours (check shop openTime/closeTime)
- Employee must be available (check employee calendar first)
- Cancellation: At least 2 hours before appointment
- Reschedule: Maximum 1 time per booking
- Reorder: Unlimited (creates new booking)

### Service Rules
- Service types: `single` or `bundled`
- Service gender: `male`, `female`, or `unisex`
- Single service: requires duration, actualPrice, offerPrice, finalPrice
- Bundled service: requires bundledServices array, totalDuration, totalPrice

### Photo Rules
- Maximum 10 photos per shop
- Photo types: shop_interior, shop_exterior, work_sample, team_photo, certificate, other
- Files uploaded to Cloudinary
- Max file size: 5MB per photo

### Rating Rules
- One rating per customer per shop
- Rating: 1-5 (integer)
- Review: Optional, max 500 characters
- Updating: If rating exists, it will be updated
- Replies: Shop owners can reply to ratings (max 500 characters)
- Reply Management: Shop owners can add, update, or delete their replies

### PIN Rules
- Exactly 4 digits only
- Required for barber shop access
- Stored as bcrypt hash

---

## 🔍 Response Format

All API responses follow this standard format:

**Success Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { /* resource data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**Paginated Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Items fetched",
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## 🐛 Troubleshooting

### Token Issues

#### Issue: "No token provided"
**Solution:** 
1. Run `node scripts/firebase-token-gen.js` to generate tokens
2. Copy token from `scripts/test-tokens.txt`
3. Set the `firebase_token` variable in the collection
4. Ensure you're using the correct role token (CUSTOMER vs BARBER)

#### Issue: "Invalid or expired token"
**Solution:** 
- Firebase tokens expire after 1 hour
- Re-run `node scripts/firebase-token-gen.js` to generate fresh tokens
- Copy the new token to Postman

#### Issue: "This account has been deleted"
**Solution:**
- Deleted barber accounts are soft-deleted in MongoDB and blocked from future login
- You must use a different active test user or create a new Firebase test account
- Do not expect deleted accounts to re-onboard with the same token

#### Issue: "Access denied. Required role(s): CUSTOMER"
**Solution:** 
- You're using a barber token on a customer endpoint or vice versa
- Check which role the endpoint requires
- Use the correct token from `test-tokens.txt`:
  - Customer endpoints (03-06): Use `test-customer-001` token
  - Barber endpoints (07-13): Use `test-barber-001` token
  - Auth/Onboarding (01-02): Use appropriate token for the role you're testing

### Onboarding Issues

#### Issue: "User already has a profile"
**Solution:**
- The test user has already completed onboarding
- Skip the onboarding step and proceed to other endpoints
- Or create a new test user in `firebase-token-gen.js`

### Booking Issues
### Booking Issues

#### Issue: "Shop is currently closed"
**Solution:** Use "Toggle Shop Status" in Collection 07 to open the shop

#### Issue: "Cannot book in the past"
**Solution:** Use future dates in your booking requests (date must be >= today)

#### Issue: "Employee not available at this date/time"
**Solution:** 
1. Run "Get Employee Calendar" first to see available slots
2. Choose an available time slot
3. Ensure the time is within employee's working hours

#### Issue: "Cancellation not allowed within 2 hours of appointment"
**Solution:** Bookings can only be cancelled at least 2 hours before the appointment time

#### Issue: "You can only reschedule once"
**Solution:** Use "Reorder Booking" instead, which creates a new booking

### Variable Issues

#### Issue: Variables like {{booking_id}} or {{shop_id}} are empty
**Solution:**
1. Run the request that creates or lists the resource first
2. Check the test script output in Postman Console (View → Show Postman Console)
3. Verify the response contains the expected ID field
4. The variable should auto-populate after a successful request

#### Issue: "Cannot read property '_id' of undefined"
**Solution:**
- The API response structure may have changed
- Check the actual response in Postman
- Manually set the variable if needed: Collection → Variables → Set current value

---

## 📦 Files in This Folder

### Collection Files (Import these)
- `01-authentication.json` - Authentication endpoints
- `02-onboarding.json` - Customer and barber onboarding
- `03-customer-profile.json` - Customer profile management
- `04-customer-bookings.json` - Customer booking operations
- `05-customer-shop-discovery.json` - Shop discovery and search
- `06-customer-ratings.json` - Rating and review management
- `07-barber-profile-shop.json` - Barber shop management
- `08-barber-employees.json` - Employee management
- `09-barber-services.json` - Service catalog management
- `10-barber-bookings.json` - Barber booking management
- `11-barber-photos.json` - Photo gallery management
- `12-barber-earnings.json` - Earnings tracking and summary
- `13-barber-ratings.json` - Barber rating moderation, reply management, and seeded ID capture

### Documentation Files
- `README.md` - This file

### Archive Files (Reference only)
- No archive collection files are currently stored in this folder

---

## 🌐 Will Collections Appear in Postman App?

**Yes!** Once you import the collections:

1. **Desktop App:** Collections appear immediately in the left sidebar under "Collections"
2. **Web App:** Collections sync automatically if you're signed in
3. **Mobile App:** Collections sync across all devices

**Workspace:** Collections will be imported into your currently selected workspace. To import into a specific workspace:
1. Switch to the desired workspace first
2. Then import the collections

**Sharing:** To share with your team:
1. Right-click on a collection
2. Select "Share Collection"
3. Choose team members or generate a link

---

## 📊 Collection Statistics

```
Total Collections: 13
Total Endpoints: 62
Authentication: 2 endpoints
Onboarding: 2 endpoints
Customer Features: 23 endpoints
Barber Features: 35 endpoints

File Size: ~65KB total
Format: Postman Collection v2.1.0
```

---

## 🔗 Related Documentation

- **API Architecture:** `../docs/BACKEND_ARCHITECTURE_BLUEPRINT.md`
- **Implementation Plan:** `../docs/IMPLEMENTATION_PLAN.md`
- **Role-Based Auth:** `../docs/ROLE_BASED_AUTHENTICATION_ARCHITECTURE.md`

---

## 📞 Support

For API issues or questions:
- Check the collection notes and workflow guidance in this README
- Review the architecture documentation in `../docs/` folder
- Test endpoints in the order specified in the workflows above

---

## ✅ Testing Checklist

### Pre-Testing Setup
- [ ] Run `node scripts/firebase-token-gen.js` to generate test tokens
- [ ] Import all 13 collections into Postman
- [ ] Set `firebase_token` variable in each collection (or use collection-level inheritance)
- [ ] Verify `base_url` points to correct server (localhost:5000 for dev)

### Authentication & Onboarding
- [ ] Authentication flow (both customer and barber)
- [ ] Customer registration with photo upload
- [ ] Barber registration with all required fields and exactly 3 shop images

### Customer Features
- [ ] Customer profile management
- [ ] Nearby shops geospatial query
- [ ] Service search by gender
- [ ] Booking creation and validation
- [ ] Booking cancellation (with 2-hour rule)
- [ ] Booking reschedule (max 1 time)
- [ ] Employee calendar availability
- [ ] Rating submission (one per customer per shop)

### Barber Features
- [ ] Shop profile management
- [ ] Owner profile picture upload/update
- [ ] Business info updates using the onboarding field aliases (`shopOwner`, `businessCategory`, `amenities`, `workingDays`, `workingHours`, `breakTimings`, `upiAddress`)
- [ ] Dedicated UPI details read/update flow with verification status
- [ ] PIN management (4 digits)
- [ ] Cover image upload
- [ ] Shop status toggle (open/close)
- [ ] Sign out everywhere
- [ ] PIN-protected barber account deletion (soft-deletes the account profile and blocks future login)
- [ ] Employee CRUD operations, including optional employee photo replacement on update
- [ ] Service catalog management (single/bundled)
- [ ] Photo gallery management (multiple files)
- [ ] Booking management and stats
- [ ] Booking status updates
- [ ] Earnings calculation
- [ ] Barber rating reply flow (capture seeded IDs, add/update/delete reply, remove rating)

### Error Scenarios
- [ ] Invalid data validation
- [ ] Expired tokens (wait 1 hour or use expired token)
- [ ] Wrong role access (customer token on barber endpoint)
- [ ] Missing required fields
- [ ] Duplicate operations (e.g., rating same shop twice)

### Automation Features
- [ ] Verify auto-capture of booking_id after booking creation
- [ ] Verify auto-capture of shop_id from nearby shops
- [ ] Verify auto-capture of employee_id after employee creation
- [ ] Verify auto-capture of service_id after service creation
- [ ] Verify auto-capture of photo_id after photo upload
- [ ] Verify auto-capture of rating IDs in barber ratings collection

---

**Version:** 1.0.0  
**Last Updated:** March 9, 2026  
**API Version:** v1  
**Format:** Postman Collection v2.1.0

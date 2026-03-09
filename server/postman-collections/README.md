# EverCut API - Postman Collections

## 📁 Collection Organization

This folder contains **12 modular Postman collections** organized by feature/module for the EverCut Salon & Barber Booking Platform API.

### Collections Overview

| # | Collection Name | Endpoints | Description |
|---|----------------|-----------|-------------|
| 01 | **Authentication** | 2 | Firebase session bootstrap and health check |
| 02 | **Customer Profile** | 4 | Profile management, homepage, services by gender |
| 03 | **Customer Bookings** | 10 | Book, cancel, reschedule, reorder, favorites, employee calendar |
| 04 | **Customer Shop Discovery** | 5 | Nearby shops, doorstep services, search |
| 05 | **Customer Ratings** | 3 | Add ratings, view ratings with replies, rating summary |
| 06 | **Barber Profile & Shop** | 5 | Shop profile, business info, PIN, cover, status |
| 07 | **Barber Employees** | 4 | Employee CRUD operations |
| 08 | **Barber Services** | 5 | Service catalog management (single/bundled) |
| 09 | **Barber Bookings** | 5 | Booking management, stats, status updates |
| 10 | **Barber Photos** | 5 | Photo gallery management |
| 11 | **Barber Earnings** | 6 | Earnings tracking, rating management with replies |
| 12 | **Onboarding** | 2 | Customer and barber profile creation |

**Total: 56 endpoints** across 12 collections

---

## 🚀 Quick Start

### Step 1: Import Collections into Postman

**Option A: Import All Collections at Once**
1. Open Postman
2. Click **Import** button (top left)
3. Select **Folder** tab
4. Choose the `postman-collections` folder
5. Click **Import** - all 12 collections will be imported

**Option B: Import Individual Collections**
1. Open Postman
2. Click **Import** button
3. Select individual JSON files (01-authentication.json, 02-customer-profile.json, etc.)
4. Click **Import**

### Step 2: Configure Collection Variables

Each collection has built-in variables that need to be configured:

```
base_url: http://localhost:5000
api_prefix: /api/v1
firebase_token: YOUR_FIREBASE_ID_TOKEN_HERE
```

**To set variables:**
1. Click on a collection name
2. Go to **Variables** tab
3. Update **Current Value** for each variable
4. Click **Save**

**For production:**
- Change `base_url` to your production API URL (e.g., `https://api.evercut.com`)

---

## 🔐 Authentication Flow

### 1. Get Firebase Token (Client-side)

```javascript
// In your mobile/web app
firebase.auth().signInWithPhoneNumber(phoneNumber)
  .then(confirmationResult => confirmationResult.confirm(otpCode))
  .then(result => result.user.getIdToken())
  .then(idToken => {
    console.log('Firebase Token:', idToken);
    // Use this token in Postman
  });
```

### 2. Set Token in Postman

1. Copy the Firebase ID token
2. In each collection, go to **Variables** tab
3. Set `firebase_token` to the copied token
4. Save

### 3. Test Authentication

**For Customer:**
1. Run `01-authentication` → **Create Session**
2. If new user, run `12-onboarding` → **Complete Customer Profile**
3. Now you can use all Customer collections (02-05)

**For Barber:**
1. Run `01-authentication` → **Create Session**
2. If new user, run `12-onboarding` → **Complete Barber Profile**
3. Now you can use all Barber collections (06-11)

---

## 📋 Testing Workflows

### Customer Workflow

```
01-Authentication
  ↓ Create Session
12-Onboarding
  ↓ Complete Customer Profile
02-Customer Profile
  ↓ Get Profile → Update Profile
04-Customer Shop Discovery
  ↓ Get Nearby Shops → Get Shop Info
03-Customer Bookings
  ↓ Get Employee Calendar → Book Salon → Get Booking Details
05-Customer Ratings
  ↓ Add Rating
```

### Barber Workflow

```
01-Authentication
  ↓ Create Session
12-Onboarding
  ↓ Complete Barber Profile
06-Barber Profile & Shop
  ↓ Get Profile → Update Business Info → Update Cover Image
07-Barber Employees
  ↓ Add Employee (repeat for multiple employees)
08-Barber Services
  ↓ Add Single Service / Add Bundled Service (repeat)
10-Barber Photos
  ↓ Upload Photos
09-Barber Bookings
  ↓ Get All Bookings → Update Booking Status
11-Barber Earnings
  ↓ Get Earnings
```

---

## 🔄 Collection Variables

### Shared Variables (All Collections)
- `base_url` - API server URL
- `api_prefix` - API version prefix (/api/v1)
- `firebase_token` - Firebase ID token for authentication

### Collection-Specific Variables
- `booking_id` - Set automatically after creating a booking (Collections 03, 09)
- `shop_id` - Set automatically after getting shop info (Collections 04, 05)
- `employee_id` - Set automatically after adding employee (Collection 07)
- `service_id` - Set automatically after adding service (Collection 08)
- `photo_id` - Set automatically after uploading photos (Collection 10)
- `rating_id` - For rating removal (Collection 11)

**Note:** Variables are automatically set using Test Scripts when you create resources.

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
- 4-6 digits only
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

### Issue: "No token provided"
**Solution:** Set the `firebase_token` variable in the collection

### Issue: "Invalid or expired token"
**Solution:** Firebase tokens expire after 1 hour. Get a new token and update the variable

### Issue: "Access denied. Required role(s): CUSTOMER"
**Solution:** You're using a barber token on a customer endpoint or vice versa. Check your token's role.

### Issue: "Shop is currently closed"
**Solution:** Use "Toggle Shop Status" in Collection 06 to open the shop

### Issue: "Cannot book in the past"
**Solution:** Use future dates in your booking requests (date must be >= today)

### Issue: "Employee not available at this date/time"
**Solution:** 
1. Run "Get Employee Calendar" first to see available slots
2. Choose an available time slot
3. Ensure the time is within employee's working hours

### Issue: "Cancellation not allowed within 2 hours of appointment"
**Solution:** Bookings can only be cancelled at least 2 hours before the appointment time

### Issue: "You can only reschedule once"
**Solution:** Use "Reorder Booking" instead, which creates a new booking

---

## 📦 Files in This Folder

### Collection Files (Import these)
- `01-authentication.json` - Authentication endpoints
- `02-customer-profile.json` - Customer profile management
- `03-customer-bookings.json` - Customer booking operations
- `04-customer-shop-discovery.json` - Shop discovery and search
- `05-customer-ratings.json` - Rating and review management
- `06-barber-profile-shop.json` - Barber shop management
- `07-barber-employees.json` - Employee management
- `08-barber-services.json` - Service catalog management
- `09-barber-bookings.json` - Barber booking management
- `10-barber-photos.json` - Photo gallery management
- `11-barber-earnings.json` - Earnings and analytics
- `12-onboarding.json` - Customer and barber onboarding

### Documentation Files
- `README.md` - This file
- `POSTMAN_COLLECTION_README.md` - Detailed API documentation
- `.postman.json` - Metadata file

### Archive Files (Reference only)
- `evercut-postman-collection.json` - Original monolithic collection
- `evercut-collection-formatted.json` - Formatted version

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
Total Collections: 12
Total Endpoints: 56
Authentication: 2 endpoints
Onboarding: 2 endpoints
Customer Features: 22 endpoints
Barber Features: 30 endpoints

File Size: ~160KB total
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
- Check the detailed documentation in `POSTMAN_COLLECTION_README.md`
- Review the architecture documentation in `../docs/` folder
- Test endpoints in the order specified in the workflows above

---

## ✅ Testing Checklist

Before deploying to production, test:

- [ ] Authentication flow (both customer and barber)
- [ ] Customer registration with photo upload
- [ ] Barber registration with all required fields
- [ ] Booking creation and validation
- [ ] Booking cancellation (with 2-hour rule)
- [ ] Booking reschedule (max 1 time)
- [ ] Employee calendar availability
- [ ] Nearby shops geospatial query
- [ ] Service search by gender
- [ ] Rating submission (one per customer per shop)
- [ ] Photo upload (multiple files)
- [ ] Shop status toggle (open/close)
- [ ] Earnings calculation
- [ ] All error scenarios (invalid data, expired tokens, etc.)

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**API Version:** v1  
**Format:** Postman Collection v2.1.0

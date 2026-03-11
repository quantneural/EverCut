# Phone OTP Authentication: Firebase Auth vs MSG91 — EverCut

> **Research Date:** March 11, 2026  
> **Research Scope:** SMS OTP Authentication — Cost Efficiency, Scalability & Long-Term Production Suitability  
> **Primary Sources:** Firebase Official Docs, Google Cloud Identity Platform Pricing, MSG91 Official Site & Documentation  
> **Target Application:** EverCut (Barbershop Booking App — India-focused)

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Pricing Model Analysis](#2-pricing-model-analysis)
   - [2.1 Firebase Authentication Pricing](#21-firebase-authentication-pricing)
   - [2.2 MSG91 Pricing](#22-msg91-pricing)
   - [2.3 DLT Registration — India Compliance Costs](#23-dlt-registration--india-compliance-costs) ⚠️ **Required for MSG91; Not required for Firebase**
3. [Cost Simulation](#3-cost-simulation)
4. [Infrastructure & Resource Limits](#4-infrastructure--resource-limits)
5. [Integration & Developer Experience](#5-integration--developer-experience)
6. [Scalability & Architecture](#6-scalability--architecture)
7. [Performance & Reliability](#7-performance--reliability)
8. [Security & Compliance](#8-security--compliance)
9. [Developer Ecosystem](#9-developer-ecosystem)
10. [Vendor Lock-In Risk](#10-vendor-lock-in-risk)
11. [Pros & Cons](#11-pros--cons)
12. [Comparative Analysis](#12-comparative-analysis)
13. [Recommendation](#13-recommendation)
14. [Pricing Tier Guidance](#14-pricing-tier-guidance)
15. [Final Decision Matrix](#15-final-decision-matrix)

---

## Executive Summary

### A. Pricing Comparison (Latest — March 2026)

> Detailed breakdown below under [Section 2](#2-pricing-model-analysis) and [Section 3](#3-cost-simulation).  
> **Quick Summary:** MSG91 OTP SMS in India is priced via customized sales quotes (approximately ₹0.18–₹0.25/SMS ex-GST based on last published rates; current rates require contacting MSG91 sales). Firebase SMS OTP to India costs **$0.01/SMS (~₹0.92 at ₹92/USD)**. MSG91 is approximately **3–4x cheaper per SMS for India** at low-to-mid volume, and up to **~5x cheaper** at high volume when Firebase MAU costs are included.
>
> ⚠️ **DLT Registration (Critical Pricing Note):** MSG91 requires the developer to register as a Principal Entity on TRAI's DLT platform before sending any OTP SMS in India. This costs **~₹5,900/year** (paid to a telecom operator — Jio, Airtel, Vi, or BSNL) and takes 1–2 weeks to set up. Firebase does NOT require DLT registration — Google handles it internally. This cost must be factored into total cost of ownership, especially at low SMS volumes where it materially affects the MSG91 cost advantage. See [Section 2.3](#23-dlt-registration--india-compliance-costs) for complete details.
>
> ⚠️ **Correction vs. earlier estimates:** Previous versions of this research cited Firebase India SMS at $0.07/SMS. The verified current rate (confirmed via multiple sources, March 2026) is **$0.01/SMS** for India — the same tier as the US and Canada. Additionally, MSG91 has removed public pricing from their website; all SMS/OTP rates now require a sales quote.

---

### B. Development & Implementation Comparison

| Aspect | Firebase Phone Auth | MSG91 OTP |
|---|---|---|
| **Ease** | Moderate (reCAPTCHA mandatory on web) | OTP delivery is easy (Widget = near zero code); full auth system is complex |
| **Effort** | Medium — Firebase SDK + reCAPTCHA + flow handling | **High overall** — Widget/API is low-effort, but JWT auth system, session management, token refresh, and middleware all need to be built and maintained |
| **Timeline** | 1–2 days | **1–2 weeks total** — Widget/API integration itself is fast (2–4 hours), but a production-ready system also requires building JWT issuance, session management, token refresh, user record storage, and backend middleware from scratch |
| **Auth Management** | Built-in — session tokens, user records, JWTs issued automatically | Only OTP delivery — session management is your responsibility |
| **Backend required** | No (Firebase handles it) | Yes (custom session/token logic needed) |

---

### C. Firebase SMS OTP Login vs. MSG91 SMS OTP

**Firebase SMS OTP Login**  
Firebase Authentication can sign in users via phone number by sending a 6-digit OTP via SMS. On the web, it requires setting up a reCAPTCHA verifier (`RecaptchaVerifier`) to prevent abuse. You call `signInWithPhoneNumber()`, which triggers an SMS; the user enters the code; you call `confirmationResult.confirm(code)`, and Firebase returns a signed-in user with a JWT token managed entirely by Firebase. Firebase also creates and stores a user record. **This is a complete authentication solution** — not just OTP delivery. However, it only works on the **Blaze (pay-as-you-go) plan**, and SMS to India costs **$0.01/SMS (~₹0.92 at ₹92/USD)**.

**MSG91 SMS OTP**  
MSG91's OTP service is a **dedicated SMS/OTP delivery platform**. The correct production flow is entirely backend-mediated: the app sends the user's phone number to your backend → your backend calls MSG91's Send OTP API (`/api/v5/otp`) → MSG91 delivers the OTP via SMS → the user enters the OTP in the app → the app sends it to your backend → your backend calls MSG91's Verify OTP API → on success, your backend issues and returns access and refresh tokens to the app. **MSG91 does NOT manage user sessions, user records, or JWT tokens** — all of that is your backend's responsibility. MSG91 also supports fallback channels: if SMS fails, it can retry via Voice, WhatsApp, or Email. Cost for India: ~**₹0.18–₹0.25/SMS** (+18% GST).

---

## 1. Service Overview

### 1.1 Firebase Authentication

| Attribute | Details |
|---|---|
| **Company** | Google LLC (Alphabet Inc.) |
| **Founded** | Firebase founded 2011; acquired by Google 2014 |
| **Platform Description** | Cloud-based backend-as-a-service (BaaS) authentication platform with SDKs, UI libraries, and backend services |
| **Primary Use Cases** | User authentication for iOS, Android, and Web apps — email/password, phone OTP, social logins (Google, Facebook, Apple, etc.) |
| **Target Audience** | Startups, SMBs, Enterprises, Individual developers |
| **Core Services** | Email/password auth, Phone/SMS OTP auth, Social OAuth (Google, Facebook, Apple, Twitter, GitHub, Microsoft), Anonymous auth, Custom auth tokens, Admin SDK for user management, SAML/OIDC (Identity Platform upgrade) |
| **Key Differentiators** | Full user management included, seamlessly integrates with Firebase suite (Firestore, RTDB, Storage, Cloud Functions), industry-standard OAuth 2.0/OpenID Connect |
| **Market Position** | Global leader in mobile/web app authentication; part of the world's largest cloud platform (Google Cloud) |

**What it is:**  
Firebase Authentication is a **complete, end-to-end authentication system**. It handles user identity, session management, JWT token issuance, user record storage, and integrates deeply with all other Firebase services. Phone SMS OTP login is one of many sign-in methods it supports.

---

### 1.2 MSG91

| Attribute | Details |
|---|---|
| **Company** | Walkover Web Solutions Pvt. Ltd. |
| **Headquarters** | Indore, Madhya Pradesh, India |
| **Founded** | 2008 |
| **Platform Description** | Cloud Communication Platform as a Service (CPaaS) — messaging-focused API platform for SMS, OTP, WhatsApp, Email, and Voice |
| **Primary Use Cases** | OTP/2FA delivery, Transactional SMS, Marketing SMS, WhatsApp Business messaging, Email, Voice calls |
| **Target Audience** | Indian businesses (startups to enterprise), developers, e-commerce, fintech, edtech |
| **Core Services** | OTP (SendOTP), SMS API, WhatsApp API, Email API, Voice API, Hello (customer support chat), Campaign (marketing automation), Segmento (contact management), OTP Widget/SDK |
| **Key Differentiators** | Extremely low per-SMS cost for India, multi-channel OTP failover, free OTP Widget, 30,000+ active customers, India-optimized routing |
| **Market Position** | Leading CPaaS provider in India; very strong in Indian market; used by Razorpay, Xiaomi, Unacademy, Dream11, Indeed, Ixigo |

**What it is:**  
MSG91 is a **communication delivery platform** — NOT a full authentication system. Its OTP service handles only OTP generation, SMS/WhatsApp/Email delivery, and OTP verification. User session management, JWT tokens, and user records are handled by your own backend.

---

## 2. Pricing Model Analysis

### 2.1 Firebase Authentication Pricing

#### Free Tier (Spark Plan)

| Feature | Limit |
|---|---|
| **Plan Cost** | $0/month |
| **Email / Social / Anonymous / Custom auth** | 3,000 Daily Active Users (DAUs) |
| **SAML / OIDC providers** | 2 DAUs/day |
| **Phone/SMS OTP** | ❌ **NOT AVAILABLE** — Blaze plan only |
| **Email verification emails** | 1,000/day |
| **Password reset emails** | 150/day |
| **Email link sign-in emails** | 5/day (very limited) |
| **Free tier expiration** | No expiration for Spark; upgrade needed for phone auth |

> **Critical note for phone-based apps:** If your app uses phone (SMS) OTP as the primary login method, the Spark free plan is effectively unusable. You must be on the Blaze plan.

#### Paid Plan (Blaze — Pay-as-you-go)

| Component | Pricing |
|---|---|
| **Plan Base Cost** | $0/month (pay only for usage) |
| **First 50,000 MAU (Email/Social/Anonymous/Phone — Tier 1)** | **Free** |
| **50,001 – 999,999 MAU** | $0.0025 per MAU |
| **1,000,000+ MAU** | $0.0015 per MAU |
| **SAML/OIDC — First 50 MAU** | Free |
| **SAML/OIDC — 51+ MAU** | $0.015 per MAU |

#### Phone/SMS OTP Pricing (Per SMS Sent — Key Countries)

> Source: Google Cloud Identity Platform Pricing (March 2026).  
> ⚠️ **Important SMS-free note:** The first 10 SMS/day (per project) are not billed on all Blaze plan projects. However, this applies only to **test phone numbers** configured in the Firebase console — production SMS to real user numbers are billed from the first message on both base Firebase Auth and Identity Platform.

| Country | Price per SMS |
|---|---|
| **India (IN)** | **$0.01/SMS** (~₹0.92 at ₹92/USD) |
| United States (US) | $0.01/SMS |
| United Kingdom (GB) | $0.04/SMS |
| Brazil (BR) | $0.05/SMS |
| Australia (AU) | $0.02/SMS |
| Germany (DE) | $0.10/SMS |
| Indonesia (ID) | $0.33/SMS |
| Pakistan (PK) | $0.19/SMS |
| Bangladesh (BD) | $0.21/SMS |
| All other regions | $0.34/SMS (max) |

> **Important:** Firebase charges **per SMS sent** (not per successful verification). Failed or undelivered SMS are still billed.

#### Additional Firebase Charges

| Item | Cost |
|---|---|
| Identity Platform (upgraded Auth) | Same MAU pricing above; unlocks MFA, SAML, blocking functions |
| Cloud Functions (for blocking functions) | Standard Cloud Run Functions rate |
| Firebase project itself | Free to create |
| Enterprise support SLA | Requires Identity Platform upgrade + Google Cloud support plan |
| Increased email limits | Included on Blaze (100,000 email/day) |

---

### 2.2 MSG91 Pricing

#### OTP Service (SendOTP)

MSG91 SendOTP pricing is **volume-based** and **credit-based** (prepaid). As of March 2026, MSG91 has **removed public pricing from their website** and now requires direct contact with their sales team for quotes (msg91.com/in/pricing/otp shows "Talk to Sales"). The following rates are based on previously published pricing and third-party sources, and may have changed:

| Volume | Price per SMS (ex-GST) — *Approximate, based on last public rates* |
|---|---|
| 5,000 SMS | ~₹0.25/SMS |
| ~27,000 SMS | ~₹0.20/SMS |
| ~855,556 SMS | ~₹0.18/SMS |
| **Enterprise/Custom (talk to sales)** | **Down to ₹0.13/SMS or lower** |

> ⚠️ **Pricing note (March 2026):** MSG91 no longer publicly lists OTP/SMS rates — contact their sales team directly at msg91.com/in/contact-us for current pricing. The rates listed above are approximate figures from previously published materials and should be verified before making financial projections.
>
> All prices are exclusive of **18% GST** (GST-inclusive price = multiply by 1.18).  
> Example: 27,000 SMS at ₹0.20 = ₹5,400 + 18% GST = **₹6,372 total**

| Component | Cost |
|---|---|
| **OTP Widget / SDK** | **FREE** (no monthly fee) |
| **OTP via SMS** | ₹0.13 – ₹0.25/SMS (India) |
| **OTP via WhatsApp** | Separate WhatsApp pricing (generally higher) |
| **OTP via Voice** | Separate Voice pricing |
| **OTP via Email** | Separate Email pricing (very low) |
| **Failover (channel switching)** | No extra fee — uses standard channel rates |
| **Real-time analytics** | Included |
| **IP Security** | Included |
| **Invisible OTP** | Included |
| **Magic Links** | Included |

#### SMS Pricing (Bulk/Transactional)

| Volume | Price per SMS (India, ex-GST) |
|---|---|
| Standard | ₹0.13–₹0.25/SMS |
| Custom (enterprise) | Down to ₹0.13/SMS |

> For international SMS, pricing varies by country. MSG91 covers 210+ countries.

#### Hello (Customer Support) Pricing — Not relevant for auth, but provided for completeness

| Plan | Monthly Price | Tickets/month | Inboxes |
|---|---|---|---|
| Live Chat | ₹0 | Unlimited | 1 |
| Free | ₹0 | 50 | 2 |
| Basic | ₹1,500 | 1,000 | 2 |
| Premium | ₹3,000 | 2,000 | 3 |

> All MSG91 pricing is exclusive of 18% GST.

---

### 2.3 DLT Registration — India Compliance Costs

> **What is DLT?** TRAI (Telecom Regulatory Authority of India) mandates that every business sending commercial SMS in India — including OTP/transactional SMS — must be registered on the Distributed Ledger Technology (DLT) platform under the Telecom Commercial Communications Customer Preference Regulation 2018 (TCCCPR-2018). DLT is a blockchain-based system that records all entities, sender IDs, and SMS templates. Without DLT registration, telecom operators will block SMS delivery.

#### Does Firebase Require DLT Registration?

**No — the developer does NOT need DLT registration when using Firebase Phone Auth.**

When Firebase sends an OTP SMS to your user, it is Google (not EverCut) acting as the message sender. Firebase/Google maintains its own DLT registration, sender IDs, and pre-approved OTP templates at the infrastructure level. The SMS appears from Google's registered sender ID. EverCut has no role in the DLT chain and incurs **zero DLT registration costs** when using Firebase Phone Auth.

#### Does MSG91 Require DLT Registration?

**Yes — DLT registration is mandatory for EverCut when using MSG91.**

When using MSG91, EverCut is the "Principal Entity" (PE) — the business sending communications to its customers. MSG91 is the "Telemarketer" (the service provider). TRAI regulations require EverCut to:

1. **Register as a Principal Entity (PE)** on a TRAI-approved DLT portal
2. **Register a Sender ID (Header)** — a 6-character ID representing your brand, e.g., `EVRCUT`
3. **Register and get all OTP message templates approved** — e.g., `"Your OTP for EverCut login is {#var#}. Valid for 10 minutes. Do not share with anyone."`
4. **Bind MSG91 as the Telemarketer** in your DLT portal (PE–TM chain binding — mandatory for all SMS types)

MSG91 explicitly documents this requirement and provides step-by-step DLT guides for all its customers (see msg91.com/help/dlt-registration-in-india).

#### DLT Registration Charges by Operator (Annual)

> You only need to register on **one** DLT platform — registration syncs across all Indian telecom operators automatically. You do not pay multiple fees.

| Telecom Operator | DLT Platform | Annual Fee (incl. 18% GST) | Notes |
|---|---|---|---|
| **Reliance Jio** | TrueConnect (trueconnect.jio.com) | **~₹5,900/year** | Most popular; previously free; now charges for new registrations |
| **Airtel** | Airtel DLT (dltconnect.airtel.in) | **~₹5,900/year** | Market-standard rate |
| **Vodafone Idea (Vi)** | VILPower (vilpower.in) | **~₹5,900/year** (₹5,000 + GST) | Robust support |
| **BSNL** | UCC-BSNL (ucc-bsnl.co.in) | **~₹3,300/year** | Cheaper option; slower processing |
| **Videocon/STPL** | SmartPing/PingConnect (smartping.live) | **~₹5,900/year** | Fee was historically waived; currently charging |

> **Recommendation (from MSG91):** Register on Jio, Airtel, or Videocon — they are fastest to approve. You only need one.

#### Additional DLT Steps & Timelines (MSG91 path)

| Step | Description | Time | Cost |
|---|---|---|---|
| **Entity Registration** | Register EverCut as Principal Entity on chosen DLT portal | 1–3 working days | ₹5,900 (incl. GST) — annual fee |
| **Sender ID (Header) Registration** | Register a 6-char brand sender ID (e.g., `EVRCUT`) | 1–2 working days | ₹0 — included in entity fee |
| **OTP Template Registration** | Submit and get OTP SMS template text approved | 1–2 working days | ₹0 — included |
| **PE–TM Chain Binding** | Add MSG91 as Telemarketer in your DLT account | Immediate | ₹0 |
| **Annual DLT Renewal** | Renew entity registration every year | Ongoing | ~₹5,900/year |
| **Template Updates** | If OTP message wording changes, new template needs approval | 1–2 days | ₹0 |

> ⚠️ **Important constraint:** Under TRAI's 2024 variable tagging rules, every variable in your OTP template (e.g., the OTP value, validity duration) must be pre-tagged according to purpose. Changing the template content requires re-approval. Plan your OTP message text carefully before submission.

#### Documents Required for DLT Registration

- Company PAN Card
- GST Registration Certificate (or Certificate of Incorporation / Shop & Establishment)
- Proof of business address
- Authorized signatory ID proof (Aadhaar, PAN, or Passport)
- Authorization Letter on company letterhead
- Proof of correlation between Company Name and desired Sender ID (if they don't match)

#### DLT Cost Summary: Firebase vs MSG91

| Cost Item | Firebase Auth | MSG91 OTP |
|---|---|---|
| **DLT registration required by developer** | ❌ No — Google handles it | ✅ **Yes — mandatory** |
| **Annual DLT fee** | ₹0 | **~₹5,900/year** (incl. GST) |
| **One-time DLT setup effort** | None | 1–2 weeks for approval |
| **Sender ID setup** | N/A — Firebase uses Google's IDs | Must register own Sender ID (e.g., `EVRCUT`) |
| **OTP template approval** | N/A — Firebase uses own templates | Must submit and get templates approved |
| **DLT renewal** | N/A | ~₹5,900/year ongoing |

> **Bottom line:** Using MSG91 requires EverCut to complete DLT registration before going live. This is a **one-time setup effort of ~1–2 weeks** and an **annual recurring cost of ~₹5,900/year** (regardless of SMS volume). Factor this into total cost of ownership. At 1,000 OTPs/month (low scale), the DLT fee alone adds ~₹492/month to MSG91's cost — which partially offsets MSG91's per-SMS savings at very low volumes.

---

## 3. Cost Simulation

> **Context for EverCut:** Indian barbershop booking app. Users authenticate via phone OTP. Assuming India (IN) as primary market.  
> **Exchange rate used:** $1 USD = ₹92 (March 2026 — USD/INR has moved from ₹83 to ~₹92 year-on-year; use latest live rate for real projections)

---

### 3.1 Low Usage — Small Project (1,000–10,000 OTPs/month)

**Scenario:** Small barbershop, 1,000 unique users/month, 1 OTP per sign-in.

| Metric | Firebase Auth | MSG91 OTP |
|---|---|---|
| **OTPs sent / month** | 1,000 | 1,000 |
| **Cost per SMS (India)** | $0.01 = ₹0.92 | ~₹0.25 (approx, sales quote required) |
| **Monthly SMS cost** | $10 ≈ **₹920** | ~₹250 + 18% GST = **~₹295** |
| **MAU cost (Firebase)** | $0 (under 50K MAU free) | N/A |
| **DLT registration fee** | ₹0 (Google handles it) | ~₹492/month (₹5,900/year ÷ 12) |
| **Platform fee** | $0 | $0 |
| **Total Monthly Cost** | **~₹920** | **~₹787** |
| **Total Yearly Cost** | **~₹11,040** | **~₹9,440** (₹3,540 SMS + ₹5,900 DLT) |
| **Winner** | — | ✅ MSG91 (but margin is narrow at this scale) |
| **Savings with MSG91** | — | ~₹1,600/year (~14% cheaper) |

> ⚠️ **At very low OTP volumes, the DLT annual fee (~₹5,900/year) significantly narrows MSG91's per-SMS cost advantage.** At 1,000 OTPs/month, MSG91 is only ~14% cheaper annually (not 68% as SMS cost alone would suggest). The cost advantage widens rapidly as OTP volume grows.

---

### 3.2 Medium Usage — Startup Scale (10,000–100,000 OTPs/month)

**Scenario:** Growing barbershop chain, 50,000 OTPs/month, users log in + register.

| Metric | Firebase Auth | MSG91 OTP |
|---|---|---|
| **OTPs sent / month** | 50,000 | 50,000 |
| **Cost per SMS (India)** | $0.01 = ₹0.92 | ~₹0.20 (approx, mid-volume tier) |
| **Monthly SMS cost** | $500 ≈ **₹46,000** | ~₹10,000 + GST = **~₹11,800** |
| **MAU cost (Firebase)** | $0 (under 50K MAU) | N/A |
| **DLT registration fee** | ₹0 (Google handles it) | ~₹492/month (₹5,900/year ÷ 12) |
| **Total Monthly Cost** | **~₹46,000** | **~₹12,292** |
| **Total Yearly Cost** | **~₹5,52,000** | **~₹1,47,500** (₹1,41,600 SMS + ₹5,900 DLT) |
| **Winner** | — | ✅ MSG91 |
| **Savings with MSG91** | — | ~₹4,04,500/year (~73% cheaper) |

---

### 3.3 High Usage — Production Scale (100,000–1,000,000+ OTPs/month)

**Scenario:** Large-scale barbershop network, 500,000 OTPs/month.

| Metric | Firebase Auth | MSG91 OTP |
|---|---|---|
| **OTPs sent / month** | 500,000 | 500,000 |
| **Cost per SMS (India)** | $0.01 = ₹0.92 | ~₹0.18 (approx, high volume) |
| **Monthly SMS cost** | $5,000 ≈ **₹4,60,000** | ~₹90,000 + GST = **~₹1,06,200** |
| **MAU cost (if 500K users, Firebase)** | ~$1,125/month = ₹1,03,500 (450K MAU above free tier × $0.0025) | N/A |
| **DLT registration fee** | ₹0 (Google handles it) | ~₹492/month (₹5,900/year ÷ 12) |
| **Total Monthly Cost** | **~₹5,63,500** | **~₹1,06,692** |
| **Total Yearly Cost** | **~₹67,62,000** | **~₹12,80,300** (₹12,74,400 SMS + ₹5,900 DLT) |
| **Winner** | — | ✅ MSG91 |
| **Savings with MSG91** | — | ~₹54,81,700/year (~81% cheaper) |

> Note: At high volume, the ₹5,900/year DLT fee is negligible relative to total costs (< 0.05% of annual spend).

---

### 3.4 Cost Growth Summary Chart

```
(SMS costs only; Firebase = $0.01 × ₹92/USD; MSG91 approx. incl. 18% GST based on last published rates)
(DLT annual fee for MSG91 = ~₹5,900/year = ~₹492/month; add to MSG91 totals)

Monthly OTPs    Firebase (₹)    MSG91 (₹ SMS only, approx. incl. GST)    DLT (₹/mo)    MSG91 Total     Cost Ratio
────────────    ────────────    ─────────────────────────────────────    ──────────    ──────────      ──────────
1,000           ~920            ~295  (₹0.25 + GST)                      ~492          ~787            ~1.2x
5,000           ~4,600          ~1,475 (₹0.25 + GST)                     ~492          ~1,967          ~2.3x
10,000          ~9,200          ~2,596 (est ~₹0.22 + GST)                ~492          ~3,088          ~3.0x
50,000          ~46,000         ~11,800 (₹0.20 + GST)                    ~492          ~12,292         ~3.7x
100,000         ~92,000         ~22,420 (est ~₹0.19 + GST)               ~492          ~22,912         ~4.0x
500,000         ~5,63,500*      ~1,06,200 (₹0.18 + GST)                  ~492          ~1,06,692       ~5.3x
1,000,000       ~11,27,000**    ~2,12,400 (₹0.18 + GST)                  ~492          ~2,12,892       ~5.3x
```
*Includes ~₹1,03,500 MAU cost for 500K users on Blaze (450K × $0.0025 × ₹92)  
**Includes ~₹2,07,000 MAU cost for 1M users on Blaze (950K × $0.0025 × ₹92); SMS alone = ₹9,20,000

> **Conclusion:** When factoring in the ₹5,900/year DLT registration fee, MSG91 is still **3–5x cheaper** than Firebase at startup-to-production scale. However, at very low volumes (1,000 OTPs/month), the DLT fee nearly eliminates the cost advantage — MSG91 is only ~1.2x cheaper (not ~3x on SMS alone). The break-even point where MSG91 is decisively cheaper, even with DLT, is approximately **2,000–3,000 OTPs/month** and above.

> **Recommendation for EverCut:** Even if starting at 1,000 OTPs/month, MSG91 is the right long-term choice. The DLT setup is a one-time effort, and as volume grows the savings compound dramatically. Firebase remains completely zero-overhead on compliance.

---

## 4. Infrastructure & Resource Limits

### 4.1 Firebase Authentication Limits

| Resource | Spark (Free) | Blaze (Pay-as-you-go) |
|---|---|---|
| **Daily Active Users (Email/Social)** | 3,000/day | Unlimited (billed) |
| **Daily Active Users (SAML/OIDC)** | 2/day | Unlimited (billed) |
| **Anonymous accounts** | 100 million | 100 million |
| **Registered user accounts** | Unlimited | Unlimited |
| **Phone sign-ins** | ❌ Not available | 1,600/minute |
| **SMS sent (base Firebase Auth)** | ❌ Not available | 3,000/day limit |
| **SMS sent (Identity Platform)** | N/A | No limit |
| **Verification SMS per IP/hour** | — | 50/minute, 500/hour |
| **Verification SMS per project/minute** | — | 1,000/minute |
| **API requests per project** | 1,000/second | 1,000/second |
| **API requests per day** | 10 million | 10 million |
| **Account creation per IP/hour** | 100/hour | 100/hour |
| **Token exchanges** | 18,000/minute | 18,000/minute |
| **Custom token sign-ins** | 45,000/minute | 45,000/minute |
| **Email verification** | 1,000/day | 100,000/day |
| **Password reset emails** | 150/day | 10,000/day |

---

### 4.2 MSG91 Limits

| Resource | Details |
|---|---|
| **OTP delivery** | No stated hard limit; scales with credits |
| **API rate limits** | High throughput; designed for bulk OTP (not publicly stated specific numbers) |
| **OTP validity** | Configurable (typically 5–10 minutes) |
| **OTP retry** | Configurable retry count |
| **Channels** | SMS, WhatsApp, Email, Voice (all seamlessly failover) |
| **Global reach** | 210+ countries |
| **Concurrent requests** | Not publicly stated — enterprise plans discuss throughput |
| **SMS per minute** | Handles millions/day for enterprise clients (Dream11, etc.) |
| **OTP Widget** | No limit on widget usage |
| **Credit system** | Prepaid credits; auto-recharge available |

---

## 5. Integration & Developer Experience

### 5.1 Firebase Authentication Implementation

**Step-by-step Phone OTP (Web/Node.js):**

```javascript
// Step 1: Initialize reCAPTCHA verifier (REQUIRED)
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const auth = getAuth();
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'sign-in-button', {
  'size': 'invisible',   // or 'normal' for visible widget
  'callback': (response) => { onSignInSubmit(); }
});

// Step 2: Send OTP
const phoneNumber = "+919876543210";
signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
  .then((confirmationResult) => {
    window.confirmationResult = confirmationResult;
  }).catch((error) => {
    // Reset reCAPTCHA on error
    grecaptcha.reset(window.recaptchaWidgetId);
  });

// Step 3: Verify OTP
const code = getUserInput(); // e.g., "123456"
confirmationResult.confirm(code)
  .then((result) => {
    const user = result.user;   // Firebase user object with UID, token
    const idToken = await user.getIdToken(); // JWT for backend verification
  });

// Step 4: Backend verification (already implemented in EverCut)
// Firebase Admin SDK verifies the token
admin.auth().verifyIdToken(idToken).then(decodedToken => {
  const uid = decodedToken.uid;
});
```

**Implementation Complexity:** Moderate  
- Must enable phone auth in Firebase console  
- Must configure allowed domains (localhost not supported for phone auth)  
- reCAPTCHA is mandatory for web — adds UX friction  
- Billing must be enabled (Blaze plan required)  
- Testing uses fictional numbers in console  

**SDK Availability:**
- iOS ✅, Android ✅, Web (JS) ✅, Flutter ✅, C++ ✅, Unity ✅, Admin SDK (Node, Python, Java, Go, PHP, Ruby) ✅

---

### 5.2 MSG91 OTP Implementation

> ⚠️ **Production flow note:** The MSG91 authkey must **never** be exposed to the client. The entire OTP send and verify flow must be proxied through your own backend. The correct production architecture is: **App → Your Backend → MSG91 API** for both sending and verifying. Your backend then issues the access and refresh tokens.

**Production Flow — Backend-Mediated API (Required for production):**

```javascript
// ─── BACKEND (Node.js / Express) ───────────────────────────────────────

// Step 1: App sends phone number to your backend
// POST /api/auth/send-otp  { mobile: "9876543210" }
app.post('/api/auth/send-otp', async (req, res) => {
  const { mobile } = req.body;
  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'authkey': process.env.MSG91_AUTH_KEY,   // never sent to client
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${mobile}`,
      otp_length: 6,
      otp_expiry: 10   // minutes
    })
  });
  const data = await response.json();
  res.json({ success: data.type === 'success' });
});

// Step 2: User enters OTP in app → app sends it to your backend
// POST /api/auth/verify-otp  { mobile: "9876543210", otp: "482910" }
app.post('/api/auth/verify-otp', async (req, res) => {
  const { mobile, otp } = req.body;

  // Verify OTP with MSG91
  const response = await fetch(
    `https://control.msg91.com/api/v5/otp/verify?mobile=91${mobile}&otp=${otp}`,
    { method: 'GET', headers: { 'authkey': process.env.MSG91_AUTH_KEY } }
  );
  const result = await response.json();

  if (result.type !== 'success') {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  // Step 3: OTP verified — find or create user in your DB
  let user = await User.findOne({ mobile });
  if (!user) user = await User.create({ mobile });

  // Step 4: Issue access + refresh tokens (MSG91 does NOT do this)
  const accessToken  = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

  // Persist refresh token (for rotation / revocation)
  await RefreshToken.create({ userId: user._id, token: refreshToken });

  res.json({ accessToken, refreshToken });
});

// ─── CLIENT (App) ───────────────────────────────────────────────────────
// Step 1: Send phone number to your backend (not to MSG91 directly)
await fetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ mobile }) });

// Step 2: User enters OTP → send to your backend
const { accessToken, refreshToken } = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ mobile, otp })
}).then(r => r.json());

// Step 3: Store tokens and authenticate all subsequent requests with accessToken
```

**Implementation Complexity:** High (full auth system)
- No reCAPTCHA needed
- No domain configuration or billing plan change required for MSG91
- **BUT:** You must build and maintain the complete auth system: OTP proxy endpoints, JWT issuance, access + refresh token lifecycle, token rotation/revocation, and middleware for protecting all downstream routes

**SDK Availability:** iOS ✅, Android ✅, REST API (all languages) ✅  

---

### 5.3 Integration Complexity Comparison

| Aspect | Firebase Auth | MSG91 OTP |
|---|---|---|
| **Difficulty** | Moderate | High (complete auth system from scratch) |
| **reCAPTCHA required (Web)** | ✅ Yes (mandatory) | ❌ No |
| **Billing plan change needed** | ✅ Yes (must upgrade to Blaze) | ❌ No |
| **Console setup steps** | Multiple (console + domain + test numbers + regions) | Simple (API key + template) |
| **User record management** | ✅ Auto-managed by Firebase | ❌ Manual (your DB) |
| **Session/token issuance** | ✅ Auto (Firebase JWT) | ❌ Manual (your logic — access + refresh tokens) |
| **Backend verification** | Firebase Admin SDK (simple) | Your own logic (verify via MSG91 API, then issue tokens) |
| **Testing** | Fictional numbers in console | Test credentials or actual SMS |
| **Documentation quality** | Excellent | Good |
| **Time to first OTP (dev)** | 4–8 hours | 2–4 hours (Widget, OTP delivery only) |
| **Time to production** | 1–2 days | **1–2 weeks** — OTP delivery is fast; building the complete auth system (JWT issuance, session management, token refresh, middleware, user DB logic) is a significant engineering effort |

---

## 6. Scalability & Architecture

### 6.1 Firebase Authentication

| Feature | Details |
|---|---|
| **Auto-scaling** | Fully managed by Google; auto-scales globally |
| **Multi-region support** | Yes — Google's global infrastructure |
| **Load balancing** | Handled by Google Cloud load balancers |
| **High availability** | 99.95%+ (with Identity Platform SLA upgrade) |
| **Serverless** | Yes — fully serverless, no infrastructure management |
| **Horizontal scalability** | Unlimited — Google's infrastructure |
| **Architecture** | Microservices, distributed, backed by Google Cloud |
| **Rate limits at scale** | Some API limits (1,000 req/sec project-wide); can be increased |
| **Identity Platform** | Enterprise upgrade enables multi-tenancy, SAML, MFA |
| **Global SMS delivery** | Via Google's telecom partners (good, but expensive) |
| **Constraints** | Phone auth: 3,000 SMS/day hard limit on base Firebase Auth (no limit with Identity Platform) |

### 6.2 MSG91

| Feature | Details |
|---|---|
| **Auto-scaling** | Yes — infrastructure scales with demand |
| **Multi-region** | Primary India-based infrastructure with global routing |
| **Global coverage** | 210+ countries via localized telecom operators |
| **SMS routing** | Intelligent retry algorithm with automatic rerouting |
| **Failover channels** | Automatic failover: SMS → Voice → WhatsApp → Email |
| **High availability** | Not explicitly stated SLA; India-specific HA |
| **Bulk processing** | Handles millions of OTPs/day (used by Dream11, etc.) |
| **Architecture** | API-first, RESTful, distributed SMS gateway |
| **Rate limits** | Enterprise clients handle very high throughput (not publicly stated) |
| **Constraints** | Less transparent about infrastructure specs; SLA not publicly documented |

---

## 7. Performance & Reliability

### 7.1 Firebase Authentication

| Metric | Details |
|---|---|
| **Auth token latency** | <100ms globally (Google's CDN) |
| **SMS delivery speed** | Variable — depends on telecom partners globally |
| **Uptime SLA (base)** | No formal SLA on free tier |
| **Uptime SLA (Identity Platform)** | Yes — formal SLA per Google Cloud standards |
| **Disaster recovery** | Google-managed; multi-region redundancy |
| **Test environment** | Firebase emulator suite available locally |
| **SMS delivery in India** | Generally reliable but routing through international gateway adds latency vs direct Indian operators |
| **reCAPTCHA latency** | Adds ~1–3 seconds to phone auth flow on web |

### 7.2 MSG91

| Metric | Details |
|---|---|
| **SMS delivery speed** | Industry-standard 2–10 seconds for India; direct DLT-registered routes |
| **SMS delivery rate** | High for India (directly integrated with Indian telecom operators) |
| **Uptime SLA** | Not publicly documented for OTP service |
| **Failover** | Automatic channel failover ensures delivery |
| **Analytics** | Real-time delivery tracking |
| **India-specific reliability** | Higher delivery rates in India due to direct operator connections |
| **OTP expiry** | Configurable (typically 5–10 minutes) |
| **DLT compliance** | Yes — but registration, Sender ID, and template approval is the **developer's responsibility** (see Section 2.3) |

> **Key insight for India:** MSG91 has direct integrations with Indian telecom operators (TRAI DLT-compliant), which typically results in **faster and more reliable SMS delivery in India** compared to Firebase which routes through Google's global SMS gateway.

---

## 8. Security & Compliance

### 8.1 Firebase Authentication

| Feature | Details |
|---|---|
| **Encryption** | TLS in transit; AES-256 at rest |
| **Token standard** | JWT (RS256) — industry standard |
| **Compliance certifications** | SOC 1, SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018, FedRAMP, GDPR, HIPAA eligible |
| **reCAPTCHA** | Built-in abuse protection on phone auth |
| **Rate limiting** | Built-in per IP, per project |
| **Account enumeration protection** | Built-in |
| **MFA** | Available via Identity Platform upgrade |
| **SAML/OIDC** | Identity Platform upgrade |
| **Blocking functions** | Can reject sign-ins with custom logic |
| **Audit logging** | Identity Platform: Cloud Logging |
| **Data residency** | Limited; Google Cloud region selection |

### 8.2 MSG91

| Feature | Details |
|---|---|
| **Encryption** | TLS in transit; HTTPS API endpoints only |
| **OTP security** | OTPs are short-lived (configurable expiry), one-time use |
| **Invisible OTP** | Silent background verification (no user interaction) |
| **IP Security** | Inbuilt IP allowlist/blocklist for API access |
| **GDPR** | GDPR compliant (documented) |
| **DLT Compliance** | TRAI DLT compliance is **required and managed by the developer** — EverCut must register as Principal Entity on a DLT portal, register a Sender ID (Header, e.g., "EVRCUT"), get OTP templates approved, and add MSG91 as the Telemarketer. See Section 2.3 for full DLT details and costs. |
| **Certifications** | Has certificates listed on website (details at msg91.com/certificates) |
| **ISO** | Not explicitly documented publicly |
| **Data residency** | India-primary servers |
| **Audit logging** | Real-time analytics dashboard; no enterprise-grade audit logs |

---

## 9. Developer Ecosystem

### 9.1 Firebase Authentication

| Metric | Details |
|---|---|
| **Community size** | Massive — millions of developers globally |
| **Stack Overflow questions** | ~200,000+ Firebase questions |
| **GitHub stars** | Firebase SDK: 5,000+ stars; FirebaseUI: 3,500+ stars |
| **Official docs** | Extremely comprehensive — guides, API reference, code samples for all platforms |
| **Tutorials** | Thousands of official and community tutorials |
| **SDKs** | iOS, Android, Web, Flutter, C++, Unity, Node, Python, Java, Go, PHP, Ruby |
| **Plugin ecosystem** | Excellent — integrations with popular frameworks (React, Vue, Angular, Next.js, etc.) |
| **Support** | Community (free), Firebase Support (paid, requires plan), Google Cloud Support (enterprise) |
| **Open source** | FirebaseUI is open source; Firebase SDKs are open source |
| **CI/CD** | Firebase CLI, GitHub Actions integration, Emulator Suite for local testing |

### 9.2 MSG91

| Metric | Details |
|---|---|
| **Community size** | Smaller — India-focused developer community |
| **Documentation** | Good — REST API docs, step-by-step guides, help docs |
| **SDKs** | iOS, Android; REST API works with any language |
| **Official code samples** | Python, Node.js, PHP, Ruby, cURL shown in docs |
| **Plugins/integrations** | WHMCS, Magento, WordPress, and partner integrations |
| **Support** | Tech support via Calendly scheduling; chat support on site |
| **Startup policy** | Yes — special credits/pricing for startups |
| **Partner program** | Yes — reseller/partner network |
| **Open source** | Some SDK on GitHub (MSG91/sendotp-ios, MSG91/sendotp-android) |
| **API documentation** | docs.msg91.com — good, but not as comprehensive as Firebase |

---

## 10. Vendor Lock-In Risk

### 10.1 Firebase Authentication

| Risk Factor | Assessment |
|---|---|
| **Lock-in level** | **HIGH** |
| **User data portability** | Firebase user records can be exported via Admin SDK batch download |
| **Token portability** | Firebase JWTs are standard — your app code using `verifyIdToken()` is Firebase-specific |
| **Migration difficulty** | **Hard** — migrating users requires re-authentication; UID format changes; all Firebase dependencies must be replaced |
| **Proprietary dependencies** | Firebase SDK embedded in client apps; Admin SDK on backend; security rules language; Firestore rules auth objects |
| **Data export** | Admin SDK supports bulk export (accounts + hashed passwords for email users; phone users need re-auth) |
| **Alternative** | Can switch to Auth0, Supabase Auth, Clerk, AWS Cognito — but requires significant refactor |
| **Mitigation** | Keep auth layer abstracted behind a service interface (as EverCut already does in auth.service.js) |

### 10.2 MSG91

| Risk Factor | Assessment |
|---|---|
| **Lock-in level** | **LOW** |
| **Portability** | OTP delivery is a commodity service — easily replaceable with Twilio, AWS SNS, 2Factor, Fast2SMS, etc. |
| **Migration difficulty** | **Easy** — just change API endpoint and credentials; your user data stays in your own DB |
| **Proprietary dependencies** | Minimal — only the OTP Widget embed code and API calls |
| **Data export** | N/A — MSG91 doesn't store your user data; your DB is the source of truth |
| **Alternative providers** | Twilio, AWS SNS, 2Factor.in, Fast2SMS, Exotel — all can replace MSG91 |
| **Mitigation** | Abstract SMS provider behind a service layer (e.g., `otp.service.js`) for easy swapping |

---

## 11. Pros & Cons

### 11.1 Firebase Authentication

#### Pros ✅

- **Complete auth solution** — handles user identity, session management, JWT tokens, user records
- **Zero backend auth code** — no need to write session management, token logic
- **Multi-provider support** — email, phone, Google, Facebook, Apple, Twitter, GitHub, anonymous — all in one SDK
- **Deep ecosystem integration** — seamlessly works with Firestore, RTDB, Cloud Storage, Cloud Functions via security rules
- **Industry-standard security** — OAuth 2.0, OpenID Connect, JWT — enterprise-grade
- **Excellent documentation** — world-class docs, code examples, emulator suite
- **Free for non-phone auth** — generous 50K MAU free on Blaze for email/social auth
- **Global scale** — Google's infrastructure handles any traffic level
- **Multiple platform SDKs** — iOS, Android, Web, Flutter, C++, Unity all supported
- **reCAPTCHA abuse protection** — built-in bot protection
- **Anonymous auth** — lets users try app before registering
- **MFA** — available via Identity Platform upgrade

#### Cons ❌

- **SMS OTP is significantly more expensive for India** — $0.01/SMS (~₹0.92) vs ~₹0.21–₹0.295/SMS on MSG91 (incl. GST) = **approximately 3–5x more expensive** depending on volume and whether MAU charges apply
- **Phone auth requires paid plan** — cannot use phone auth on free Spark plan at all
- **3,000 SMS/day hard limit** on base Firebase Auth (need Identity Platform upgrade to remove)
- **reCAPTCHA mandatory on web** — adds friction and 1–3 second delay to phone auth UX
- **Vendor lock-in** — migrating away from Firebase is painful and time-consuming
- **No DLT overhead for India** — Google routes SMS through its own DLT-registered sender IDs; the developer has zero DLT compliance burden (unlike MSG91)
- **No SLA on free tier** — production-grade SLA requires Identity Platform upgrade
- **Data residency limited** — limited control over where data is stored

### 11.2 MSG91

#### Pros ✅

- **Significantly cheaper SMS for India** — ~₹0.18–₹0.25/SMS (+GST) vs Firebase's ~₹0.92/SMS = approximately **3–4x cheaper per SMS** at low-mid volume; up to ~5x at scale with Firebase MAU charges
- **India-optimized routing** — direct connections with Indian telecom operators; DLT-compliant
- **Free OTP Widget** — zero SDK/subscription cost; only pay per SMS
- **Multi-channel failover** — SMS → WhatsApp → Voice → Email auto-failover ensures delivery
- **Invisible OTP** — seamless background verification (no user code entry)
- **Magic Links** — password-free email/phone auth option
- **Low vendor lock-in** — easily replaceable with other OTP providers
- **30,000+ trusted businesses** — proven at scale (Dream11, Razorpay, Unacademy)
- **Real-time analytics** — delivery tracking and channel performance dashboards
- **Startup credits** — special pricing for early-stage companies
- **TRAI DLT compliant** — proper sender ID registration for Indian regulations
- **Volume discounts** — pricing improves with scale

#### Cons ❌

- **NOT a complete auth solution** — only handles OTP delivery; you must build/maintain user sessions, tokens, user records
- **Mandatory DLT registration** — before going live, EverCut must register as a Principal Entity on TRAI's DLT platform, get a Sender ID and OTP template approved (~1–2 weeks setup), and pay **~₹5,900/year** to a telecom operator. Firebase requires none of this.
- **India-centric** — primarily optimized for India; international SMS pricing may be less competitive than global leaders (Twilio)
- **No formal SLA published** — uptime guarantee not clearly documented
- **Limited enterprise certifications** — fewer compliance certs compared to Google Cloud
- **Smaller developer community** — fewer tutorials, Stack Overflow questions, open-source tools
- **Documentation depth** — good but not as comprehensive as Firebase
- **No built-in abuse protection** — you need to implement your own rate limiting and bot protection
- **GDPR applicability** — India-based company; may have different data handling requirements for EU users
- **Prepaid credit model** — must top up credits; no automatic billing

---

## 12. Comparative Analysis

### 12.1 Pricing Comparison (India, March 2026)

| Pricing Factor | Firebase Auth | MSG91 OTP | Winner |
|---|---|---|---|
| **Phone/SMS OTP cost (India)** | $0.01/SMS (~₹0.92 ex-GST) | ~₹0.18–₹0.25/SMS (approx, ex-GST; sales quote required) | ✅ MSG91 (~3–4x cheaper per SMS, ex-GST) |
| **Free SMS tier (production)** | 10 SMS/day for test numbers only (all Blaze plans) | No officially stated free SMS production tier | Firebase (nominal advantage for testing) |
| **MAU cost (0–50K users)** | Free | N/A — no MAU concept | Tie |
| **MAU cost (100K users)** | ~$125/month ($0.0025 × 50K above free tier) | N/A — no MAU billing | ✅ MSG91 |
| **Platform subscription fee** | $0 | $0 | Tie |
| **OTP Widget/SDK cost** | N/A (built into SDK) | Free | Tie |
| **DLT registration (India)** | ₹0 — Google handles it; no developer action needed | **~₹5,900/year** (incl. GST) — mandatory, paid to telecom operator annually | ✅ Firebase |
| **DLT setup effort** | None | 1–2 weeks (entity approval + Sender ID + template approval) | ✅ Firebase |
| **Enterprise negotiation** | Limited | Yes — down to ₹0.13/SMS or lower | ✅ MSG91 |
| **Annual cost (50K OTP/mo, incl. DLT)** | ~₹5,52,000 | ~₹1,47,500 | ✅ MSG91 |

---

### 12.2 Feature Comparison

| Feature | Firebase Auth | MSG91 OTP |
|---|---|---|
| **User account management** | ✅ Full | ❌ None |
| **JWT token issuance** | ✅ Auto | ❌ Manual |
| **Session management** | ✅ Auto | ❌ Manual |
| **Phone/SMS OTP** | ✅ Yes (Blaze required) | ✅ Yes |
| **Email/Password auth** | ✅ Yes | ❌ No |
| **Social login (Google, FB, etc.)** | ✅ Yes | ❌ No |
| **Anonymous auth** | ✅ Yes | ❌ No |
| **OTP Widget (plug & play)** | ✅ FirebaseUI | ✅ OTP Widget |
| **Multi-channel OTP** | ❌ SMS only | ✅ SMS, WhatsApp, Voice, Email |
| **OTP failover** | ❌ No | ✅ Yes |
| **Invisible OTP** | ❌ No | ✅ Yes |
| **Magic Links** | ✅ Email link sign-in | ✅ Yes (phone + email) |
| **MFA** | ✅ Identity Platform | ❌ No built-in MFA management |
| **SAML/OIDC** | ✅ Identity Platform | ❌ No |
| **reCAPTCHA (web)** | ✅ Required | ❌ Not required |
| **DLT compliance (India)** | ✅ Yes — Google manages its own DLT; **developer does NOT need to register** | ⚠️ Yes — **developer MUST register** as Principal Entity + get Sender ID + OTP templates approved; ~₹5,900/year |
| **Real-time analytics** | ✅ Firebase Console | ✅ Dashboard |
| **Blocking functions** | ✅ Custom | ❌ No |

---

### 12.3 Scalability Comparison

| Factor | Firebase Auth | MSG91 |
|---|---|---|
| **Infrastructure** | Google Cloud (world's best) | Indian CPaaS infrastructure |
| **Global reach** | 200+ countries, optimized globally | 210+ countries; India-optimized |
| **Auto-scaling** | ✅ Automatic, seamless | ✅ Yes |
| **Multi-region** | ✅ Yes | ⚠️ Limited |
| **SMS rate limit** | 3,000/day (base) / Unlimited (Identity Platform) | Very high (enterprise clients) |
| **API rate limit** | 1,000 req/sec | Not publicly stated |
| **Cost at scale (1M OTPs)** | ~₹11,27,000/month (SMS + MAU) | ~₹2,12,400/month (approx. incl. GST) |
| **India SMS delivery** | ⚠️ International routing | ✅ Direct operator routing |

---

### 12.4 Integration Complexity Comparison

| Factor | Firebase Auth | MSG91 OTP | Winner |
|---|---|---|---|
| **DLT registration required** | ❌ No — Google handles it | ✅ Yes — mandatory; ~1–2 weeks setup | ✅ Firebase |
| **Time to implement (basic OTP)** | 4–8 hours | 2–4 hours (Widget, OTP delivery only) | ≈ Tie |
| **Time to production (full auth)** | 1–2 days | **1–2 weeks** — complete auth system must be built from scratch | ✅ Firebase |
| **Session management code** | ❌ Not needed | ✅ Required | ✅ Firebase |
| **reCAPTCHA setup** | ✅ Required | ❌ Not required | ✅ MSG91 |
| **Billing plan change** | ✅ Required (Blaze) | ❌ Not required | ✅ MSG91 |
| **Backend token verification** | Simple (Admin SDK) | Simple (API call) | Tie |
| **Documentation quality** | Excellent | Good | ✅ Firebase |
| **Testing** | Fictional numbers | Test API available | Tie |
| **Zero-code OTP UI** | ✅ FirebaseUI | ✅ OTP Widget | Tie |

---

### 12.5 Performance Comparison

| Factor | Firebase Auth | MSG91 |
|---|---|---|
| **Auth token latency** | <100ms globally | N/A (handles only OTP, not auth tokens) |
| **SMS delivery speed (India)** | 5–30 seconds (via global gateway) | 2–10 seconds (direct operators) |
| **SMS delivery reliability (India)** | Good | Excellent (DLT-registered) |
| **Uptime SLA** | Identity Platform only | Not published |
| **Failover on SMS failure** | None | ✅ Auto-failover to Voice/WhatsApp |
| **reCAPTCHA overhead (web)** | 1–3 second delay | None |

---

## 13. Recommendation

### 13.1 For Small Scale (1–10K OTPs/month)

**Recommendation: Firebase Auth (for full-stack simplicity) OR MSG91 (if cost is priority)**

For very small projects that already use Firebase (like EverCut), Firebase Auth handles user management without writing custom auth code. However, **even at small scale, Firebase SMS OTP is more expensive** (~₹920/month vs ~₹295/month for 1,000 OTPs). 

**If phone OTP is the primary login method → Use MSG91 for OTP + your own JWT**  
**If multi-provider auth is needed (Google, email, phone) → Firebase Auth is still simpler overall**

---

### 13.2 For Startups

**Recommendation: MSG91 for OTP + Custom Backend Session Management**

At startup scale (10,000–100,000 OTPs/month), Firebase SMS costs become a meaningful operational expense. MSG91's ~3–4x cost advantage (at ₹0.20/SMS tier, incl. GST basis) directly impacts runway. The additional development effort (building session management) is a one-time investment that pays off within weeks.

**Practical approach for EverCut:** Replace Firebase phone auth with MSG91 OTP for cost savings. Keep Firebase Auth only for non-phone methods if needed, or fully replace with a custom JWT-based auth system.

---

### 13.3 For High-Scale Production

**Recommendation: MSG91 for India SMS + Firebase Auth for non-phone auth (hybrid), or fully custom**

At production scale (500K+ OTPs/month), Firebase SMS costs become very significant (~₹5,63,500/month vs ~₹1,06,200/month with MSG91). MSG91 is the clear winner for any India-focused app with phone-based authentication.

---

### 13.4 Most Cost-Efficient Platform

**Winner: MSG91 — by a clear margin (~3–5x cheaper per SMS for India, ex-GST; up to ~5x cheaper at scale including Firebase MAU charges)**

For India-focused applications where phone OTP is the primary authentication method, MSG91 is still materially cheaper than Firebase. The cost difference scales with growth — particularly once Firebase MAU charges kick in at 50K+ users. Note: MSG91 is no longer competitively priced vs. Firebase at a 23-32x ratio as previously reported; the verified Firebase India rate is $0.01/SMS (not $0.07), making the gap approximately 3–5x.

---

### 13.5 Best Developer Experience

**Winner: Firebase Auth (for complete auth experience)**  
Firebase wins on developer experience because it gives you a complete, managed authentication system with zero backend auth code. MSG91 requires building your own session management, which adds complexity.

**For OTP delivery only:** MSG91's Widget approach is simpler than Firebase's reCAPTCHA-required phone auth.

---

## 14. Pricing Tier Guidance

### 14.1 Firebase Auth — Plan Selection

| Usage Level | Best Plan | Reasoning |
|---|---|---|
| **Low usage (< 50K MAU, minimal phone OTP)** | Spark (Free) for email/social auth | Free tier handles non-phone auth well; avoid phone OTP if possible |
| **Low usage with phone OTP** | Blaze (Pay-as-you-go) | Required for any phone auth; 50K MAU free; pay only SMS costs |
| **Moderate usage (50K–500K MAU)** | Blaze + Identity Platform | Removes 3,000 SMS/day limit; adds SLA; enables MFA |
| **High usage (500K+ MAU)** | Blaze + Identity Platform + Google Cloud Support | Enterprise-grade SLA, audit logs, multi-tenancy |
| **When to upgrade** | Upgrade Spark → Blaze as soon as you need phone auth |
| **When to add Identity Platform** | When approaching 3,000 SMS/day limit or needing SLA/MFA |

---

### 14.2 MSG91 — Credit Volume Selection

| Usage Level | Best Plan | Reasoning |
|---|---|---|
| **Low usage (< 5,000 OTPs/month)** | Pay-as-you-go credits (₹0.25/SMS) | No monthly fee; buy minimum credits |
| **Moderate (5,000–100,000 OTPs/month)** | Volume credits (~₹0.20/SMS) | Buy larger credit packs for better per-SMS rate |
| **High (100,000+ OTPs/month)** | Enterprise/custom plan (down to ₹0.13/SMS) | Contact sales for custom pricing and SLA |
| **When to upgrade** | Move to volume credits when monthly OTPs exceed 5,000 |
| **Best value tier** | ~27,000 OTPs/month pack (₹0.20/SMS) |
| **Startup credits** | Apply for MSG91 Startup Program for additional discounts |

---

## 15. Final Decision Matrix

### 15.1 Scoring Table

Each platform is scored out of **10** across 7 dimensions relevant to EverCut (India-focused, phone OTP primary auth).

| Dimension | Weight | Firebase Auth | MSG91 OTP | Notes |
|---|---|---|---|---|
| **Pricing (India SMS OTP)** | 30% | 3/10 | 9/10 | Firebase is ~3–5x more expensive per SMS (verified at $0.01 India rate); gap widens with MAU charges at scale |
| **Scalability** | 15% | 10/10 | 7/10 | Google infrastructure is unmatched; MSG91 good for India |
| **Performance (India SMS)** | 10% | 6/10 | 9/10 | MSG91 has better delivery via direct operators; DLT-compliant |
| **Ease of Use / Integration** | 15% | 7/10 | 6/10 | Firebase: no custom auth code needed; MSG91: backend-mediated OTP flow requires building and maintaining a full JWT auth system |
| **Documentation** | 10% | 10/10 | 7/10 | Firebase docs are world-class |
| **Long-term Cost Efficiency** | 15% | 2/10 | 10/10 | Cost gap widens dramatically at scale |
| **Security & Compliance** | 5% | 10/10 | 7/10 | Firebase has more enterprise certifications |

### 15.2 Weighted Scores

| Platform | Weighted Score | Rank |
|---|---|---|
| **MSG91 OTP** | **(0.30×9) + (0.15×7) + (0.10×9) + (0.15×6) + (0.10×7) + (0.15×10) + (0.05×7) = 8.30/10** | **🥇 #1** |
| **Firebase Auth** | **(0.30×3) + (0.15×10) + (0.10×6) + (0.15×7) + (0.10×10) + (0.15×3) + (0.05×10) = 5.75/10** | **🥈 #2** |

---

### 15.3 Final Rankings Summary

| Rank | Platform | Best For | Score |
|---|---|---|---|
| 🥇 **#1** | **MSG91 OTP** | India-focused apps with phone OTP as primary auth | 8.30/10 |
| 🥈 **#2** | **Firebase Auth** | Multi-provider auth, global apps, full-stack auth management | 5.75/10 |

---

### 15.4 Recommended Architecture for EverCut

Given that EverCut is an **India-focused barbershop booking app** that already uses Firebase for some features, the recommended approach is:

```
┌────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDED HYBRID APPROACH                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. App sends phone number                                         │
│       ↓                                                            │
│  Your Backend (EverCut API)                                        │
│       ↓                                                            │
│  2. Backend calls MSG91 Send OTP API  ←── ~₹0.21/SMS              │
│       ↓                                                            │
│  MSG91 delivers OTP via SMS to user                                │
│       ↓                                                            │
│  3. User enters OTP in app                                         │
│       ↓                                                            │
│  4. App sends OTP to Your Backend                                  │
│       ↓                                                            │
│  5. Backend calls MSG91 Verify OTP API                             │
│       ↓                                                            │
│  6. OTP verified → Find or Create User in MongoDB                  │
│       ↓                                                            │
│  7. Backend issues Access Token + Refresh Token (jsonwebtoken)     │
│       ↓                                                            │
│  8. Tokens returned to App                                         │
│       ↓                                                            │
│  Authenticate all subsequent requests with Access Token            │
│                                                                    │
│  Monthly savings vs Firebase: ~₹625/month (per 1,000 OTPs)        │
│                 ~₹34,200/month (per 50,000 OTPs)                   │
└────────────────────────────────────────────────────────────────────┘
```

**What to keep from Firebase (if EverCut currently uses Firebase for other features):**
- Firebase Firestore / RTDB — keep if used
- Firebase Cloud Messaging (push notifications) — keep if used
- Firebase Storage / Cloudinary — keep as-is
- Firebase Auth for non-phone logins (email/social) — can keep for optional providers

**Replace:**
- Firebase Phone Auth → MSG91 OTP (for all phone-based OTP sign-ins)

**Pre-launch checklist for MSG91:**
- [ ] Complete DLT registration as Principal Entity on Jio/Airtel/Vi/BSNL (~₹5,900/year)
- [ ] Register Sender ID (e.g., `EVRCUT`) — 1–2 days for approval
- [ ] Register OTP message template and get it approved — 1–2 days
- [ ] Bind MSG91 as your Telemarketer in the DLT portal (PE–TM chain)
- [ ] Configure DLT Sender ID + Template ID in MSG91 dashboard
- [ ] Set DLT annual renewal reminder (~₹5,900 due each year)

---

## Summary Recommendation

> **For EverCut specifically** — an India-focused barbershop app where phone OTP is the primary authentication mechanism — **MSG91 is the clear, data-driven choice for SMS OTP delivery**. The cost difference is real and meaningful: Firebase SMS OTP to India costs **approximately 3–5 times more per message** ($0.01/SMS ≈ ₹0.92 vs ~₹0.21–₹0.295 for MSG91 incl. GST). At startup scale (50K OTPs/month), this translates to ~₹4 lakh+ in annual savings that can be reinvested into growth.
>
> ⚠️ **DLT Registration is mandatory for MSG91:** Before sending a single production OTP via MSG91, EverCut must complete TRAI DLT registration as a Principal Entity (~1–2 weeks), register its Sender ID and OTP templates, and pay **~₹5,900/year** to a telecom operator (Jio, Airtel, Vi, or BSNL). Firebase requires none of this — DLT compliance is handled entirely by Google. Factor the ₹5,900/year DLT fee into your total cost projections. At low volumes (1,000 OTPs/month), this fee narrows MSG91's advantage significantly; at 10,000+ OTPs/month, it becomes negligible.
>
> ⚠️ **Important correction:** An earlier version of this research cited Firebase India SMS at $0.07/SMS, implying a 23–32x price gap. The verified current rate is **$0.01/SMS** for India — the same as the US and Canada. The recommendation remains the same (MSG91 is cheaper), but the magnitude is ~3–5x, not 23–32x.
>
> Firebase Authentication remains excellent as a **complete, managed authentication platform** for apps needing multi-provider sign-in, global scale, and zero custom auth code. If phone OTP is the only sign-in method, or cost is a concern, MSG91 is the better choice.
>
> **Bottom line:** Use MSG91 for SMS OTP delivery. Complete DLT registration before launch (~1–2 weeks, ~₹5,900/year). Build (or keep) your own JWT-based session management. Save the Firebase SMS costs at every stage of growth.

---

*Sources: Firebase Authentication Docs (firebase.google.com/docs/auth) — Last verified 2026-03-11 | Google Cloud Identity Platform Pricing (cloud.google.com/identity-platform/pricing) | Firebase Pricing Page (firebase.google.com/pricing) — Last updated 2026-02-24 | MetaCTO Firebase Auth Pricing Guide (metacto.com, January 2026) | Firebase Auth Limits (firebase.google.com/docs/auth/limits) — Last updated 2026-03-04 | MSG91 OTP Pricing (msg91.com/in/pricing/otp) — Verified March 2026: now requires sales contact | MSG91 DLT Documentation (msg91.com/help/dlt-registration-in-india) | MSG91 Docs (docs.msg91.com/overview) | DLT Registration Charges — 2Factor.in, SMSGatewayHub, Infobip India DLT Guide, Authkey.io (verified March 2026: Jio/Airtel/Vi ~₹5,900 incl. GST/year; BSNL ~₹3,300 incl. GST/year) | USD/INR exchange rate (Trading Economics, March 11, 2026: ~₹92/USD)*

---

*⚠️ **Verification Notes (March 11, 2026):** This document was reviewed and corrected against official sources. Key findings: (1) Firebase India SMS price is $0.01/SMS, not $0.07 as previously stated; (2) USD/INR is ~₹92, not ₹83; (3) Firebase MAU pricing tiers have changed to $0.0025/MAU (50K–999K) and $0.0015/MAU (1M+); (4) MSG91 has removed public pricing from their website — all rates require contacting their sales team; (5) **DLT registration is mandatory for MSG91 users** — EverCut must register as Principal Entity on TRAI's DLT platform (~₹5,900/year incl. GST to one telecom operator), register its Sender ID and OTP message template, and bind MSG91 as its Telemarketer before any production OTP can be sent; (6) **Firebase does NOT require developer DLT registration** — Google handles its own DLT compliance internally. Cost comparisons in this document now include the DLT annual fee in MSG91's total cost of ownership.*

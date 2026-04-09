# QUICK START GUIDE - Sherbing Booking Platform

## Project Overview

Sherbing is a fully functional landscaping booking and management platform with:
- 🏠 Customer-facing booking system with instant price estimates
- 👥 Customer accounts to track bookings
- 📊 Employee admin dashboard with analytics
- 📝 Google Sheets integration for team collaboration
- 🔐 Authentication system (ready for Supabase integration)

## Next Steps to Complete

### 1. Run the Development Server

```bash
npm run dev
```

Visit: **http://localhost:3000**

### 2. Set Up Supabase (Backend Database)

**Why?** To store user accounts, bookings, and employee data persistently.

Steps:
1. Go to [supabase.com](https://supabase.com)
2. Create a new Free project
3. In **Settings > API**, copy:
   - `Project URL`
   - `anon public key`
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```
5. In Supabase SQL editor, run the schema from README.md (Database Schema section)
6. Restart the dev server

### 3. Set Up Google Sheets Integration (Booking Records)

**Why?** All bookings automatically save to a shared Google Sheet so your team can see customer info instantly.

Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Sheets API**
4. Create a **Service Account**:
   - Click "Create Service Account"
   - Name: "sherbing-app"
   - Create and download JSON key
5. Create a new Google Sheet in Google Drive
6. Share the sheet with the service account email (from JSON)
7. Copy sheet ID from URL (long alphanumeric string)
8. Add to `.env.local`:
   ```
   GOOGLE_SHEETS_PRIVATE_KEY_ID=from_json
   GOOGLE_SHEETS_PRIVATE_KEY=from_json
   GOOGLE_SHEETS_CLIENT_EMAIL=from_json
   GOOGLE_SHEETS_CLIENT_ID=from_json
   GOOGLE_SHEETS_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   GOOGLE_SHEETS_TOKEN_URI=https://oauth2.googleapis.com/token
   GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
   ```
9. Restart the dev server

### 4. Test the Platform

**Home Page:** http://localhost:3000
- Shows services overview
- "Book a Service" button

**Booking Page:** http://localhost:3000/booking
- Select service (12 options)
- Enter property address
- Specify property size (sqft)
- Get instant price estimate
- Submit with contact info
- Data automatically saves to Google Sheet ✓

**Employee Dashboard:** http://localhost:3000/employee/dashboard
- View all bookings
- See customer details
- Track revenue
- Filter by status
- Real-time updates

**Login/Signup:** http://localhost:3000/login & http://localhost:3000/signup
- Currently placeholders (will connect to Supabase Auth)

**Account:** http://localhost:3000/account
- View user's bookings
- Track booking status

### 5. Customize Pricing

Edit `lib/services/bookingService.ts`:

```typescript
export const SERVICE_PRICING = {
  lawn_mowing: { name: 'Lawn Mowing', pricePerSqft: 0.08, minimumPrice: 80 },
  // Adjust prices here
};
```

### 6. Services Offered

Current 12 services (add/remove in `bookingService.ts`):
1. Lawn Mowing - $0.08/sqft (min $80)
2. Lawn Treatment - $0.06/sqft (min $60)
3. Landscaping Design - $0.15/sqft (min $200)
4. Snow Removal - $0.12/sqft (min $100)
5. Gutter Cleaning - $0.04/sqft (min $100)
6. Yard Cleanup - $0.10/sqft (min $90)
7. Tree Service - $0.20/sqft (min $300)
8. Deck Staining - $0.18/sqft (min $250)
9. Mulch Installation - $0.12/sqft (min $120)
10. Rock Installation - $0.14/sqft (min $150)
11. Dog Waste Removal - $0.03/sqft (min $45)
12. Pool Cleaning - $0.05/sqft (min $80)

### 7. Branding (Optional)

- Logo: Replace "✓ Sherb" in components
- Colors: Green (#16a34a) is primary, Blue (#3b82f6) is accent
- Fonts: Tailwind defaults (Inter via Next.js)

### 8. Deploy (When Ready)

**Easiest: Vercel**
```bash
# Push to GitHub
git push origin main

# Go to vercel.com
# Import repo
# Add environment variables
# Deploy!
```

**Other options:** Railway, Render, AWS Amplify, Azure App Service

---

## Project Structure

```
sherbing/
├── app/
│   ├── page.tsx              # Home page
│   ├── booking/page.tsx      # Booking form
│   ├── account/page.tsx      # Customer account
│   ├── login/page.tsx        # Login
│   ├── signup/page.tsx       # Signup
│   ├── employee/dashboard/   # Employee admin
│   └── api/
│       ├── bookings/         # Booking API
│       ├── auth/             # Auth API
│       └── my-bookings/      # User bookings API
├── lib/
│   ├── types.ts              # TypeScript definitions
│   ├── supabase/client.ts    # Supabase setup
│   └── services/
│       ├── bookingService.ts # Pricing & booking logic
│       └── googleSheetsService.ts # Google Sheets API
├── .env.local                # Environment config
└── README.md                 # Full documentation
```

## Pricing Formula

For each booking:
```
Estimated Price = max(
  (Yard Size OR Property Size) × Service Rate per sqft,
  Service Minimum Price
)
```

Example:
- Service: Lawn Mowing ($0.08/sqft, min $80)
- Property: 5,000 sqft
- Calculates: 5,000 × $0.08 = $400
- Final: $400 (above minimum)

## Features Included ✅

- [x] Responsive design (mobile/tablet/desktop)
- [x] Dynamic pricing calculations
- [x] 12 landscaping services
- [x] Customer booking form
- [x] Employee dashboard
- [x] Google Sheets integration
- [x] Authentication framework
- [x] API routes
- [x] TypeScript support
- [x] Tailwind CSS styling

## Features to Add (Optional)

- [ ] Stripe payment processing
- [ ] Service scheduling calendar
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Service ratings/reviews
- [ ] Before/after photo gallery
- [ ] Admin email notifications
- [ ] Booking cancellations
- [ ] Service reschedule
- [ ] Discount codes

## Support

For questions or customization, contact RetroGigz Digital.

---

**All set!** 🚀 Your landscaping booking platform is ready to launch.

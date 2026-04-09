# Sherbing - Landscaping Booking Platform

**Sherbing** (Serve Boise) is a professional landscaping booking and management platform for customers to book services, receive instant price estimates, and manage their accounts. Employees can access an admin dashboard to view all bookings and customer information.

## Features

✅ **Customer Booking System** - Easy-to-use booking form with instant price estimates  
✅ **Dynamic Pricing** - Automatic price calculation based on property size and service type  
✅ **User Accounts** - Simple authentication and account management  
✅ **Employee Dashboard** - View all bookings, customer details, and revenue analytics  
✅ **Google Sheets Integration** - All bookings automatically saved to Google Sheets for team collaboration  
✅ **12 Services** - Lawn mowing, landscaping, snow removal, gutter cleaning, tree service, and more  
✅ **Responsive Design** - Works on mobile, tablet, and desktop

## Services

- Lawn Mowing
- Lawn Treatment
- Landscaping Design
- Snow Removal
- Gutter Cleaning
- Yard Cleanup
- Tree Service
- Deck Staining
- Mulch Installation
- Rock Installation
- Dog Waste Removal
- Pool Cleaning

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL) - *to be configured*
- **Authentication**: Supabase Auth - *to be configured*
- **Google Integration**: Google Sheets API for booking records
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Git
- Supabase account (free tier available)
- Google Cloud Project with Sheets API enabled

### Installation

1. **Clone the repository** (already done in the `sherb` folder)

2. **Install dependencies**:
   ```bash
   cd sherb
   npm install
   ```

3. **Set up environment variables** in `.env.local`:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   
   # Google Sheets Configuration
   GOOGLE_SHEETS_PRIVATE_KEY_ID=your_key_id
   GOOGLE_SHEETS_PRIVATE_KEY=your_private_key
   GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account@*.iam.gserviceaccount.com
   GOOGLE_SHEETS_CLIENT_ID=your_client_id
   GOOGLE_SHEETS_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   GOOGLE_SHEETS_TOKEN_URI=https://oauth2.googleapis.com/token
   GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:3000`

## Setup Guide

### Supabase Setup (Backend Database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings > API** and copy your `Project URL` and `anon key`
3. Add these to your `.env.local` file
4. Run migrations to set up the database schema (see Database Schema section below)

### Google Sheets Setup (Booking Records)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the **Google Sheets API**
4. Create a **Service Account** and download the JSON key
5. Create a Google Sheet and share it with the service account email
6. Add the service account credentials to `.env.local`
7. Add the spreadsheet ID to `.env.local`

### Gmail Email Setup (Verification + Booking Emails)

Sherbing now sends email through Gmail SMTP using `sherbing.contact@gmail.com`.

What you need to do:
1. Turn on 2-Step Verification for `sherbing.contact@gmail.com`.
2. Create a Gmail App Password.
3. Add these values to `.env.local`:
  ```bash
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=sherbing.contact@gmail.com
  SMTP_PASS=your_gmail_app_password
  SMTP_FROM_EMAIL=sherbing.contact@gmail.com
  SMTP_FROM_NAME=Sherbing
  ```

If email still does not send after that, the most common cause is that the app password was not created for the same Gmail account you are using as `SMTP_USER`.

For now, the app will also keep working if these values are absent, but verification emails will not send until Gmail SMTP is configured.

### Database Schema (Supabase)

Run these SQL commands in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services table
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_per_sqft DECIMAL,
  minimum_price DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  service_id TEXT REFERENCES services(id),
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  property_sqft DECIMAL,
  yard_sqft DECIMAL,
  estimated_price DECIMAL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  hourly_rate DECIMAL,
  hire_date TIMESTAMP,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Project Structure

```
sherb/
├── app/
│   ├── page.tsx                 # Home page
│   ├── booking/
│   │   └── page.tsx             # Booking form
│   ├── account/
│   │   └── page.tsx             # Customer account
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── signup/
│   │   └── page.tsx             # Signup page
│   ├── employee/
│   │   └── dashboard/
│   │       └── page.tsx         # Employee dashboard
│   └── api/
│       ├── bookings/
│       │   └── route.ts         # Booking submission
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.ts
│       │   └── signup/
│       │       └── route.ts
│       └── my-bookings/
│           └── route.ts
├── lib/
│   ├── types.ts                 # TypeScript type definitions
│   ├── supabase/
│   │   └── client.ts            # Supabase client
│   └── services/
│       ├── bookingService.ts    # Booking logic & pricing
│       └── googleSheetsService.ts # Google Sheets integration
├── .env.local                   # Environment variables (not in git)
└── package.json
```

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## API Endpoints

### Bookings
- **POST** `/api/bookings` - Submit a new booking
- **GET** `/api/bookings` - Get all bookings (employee)
- **GET** `/api/my-bookings` - Get user's bookings

### Authentication
- **POST** `/api/auth/login` - Login
- **POST** `/api/auth/signup` - Create a new account

## Features to Implement

- [ ] Supabase Auth integration (currently placeholder)
- [ ] Database queries for bookings & users
- [ ] Email notifications for bookings
- [ ] Payment processing (Stripe)
- [ ] Service scheduling calendar
- [ ] SMS reminders
- [ ] Admin panel refinements
- [ ] Mobile app (React Native)

## Pricing

The platform uses dynamic pricing based on:
- **Service type** - Different services have different base rates
- **Property size** - Priced per square foot
- **Minimum price** - Each service has a minimum charge

Example pricing (adjustable in `lib/services/bookingService.ts`):
- Lawn Mowing: $0.08/sqft (min $80)
- Landscaping: $0.15/sqft (min $200)
- Snow Removal: $0.12/sqft (min $100)
- Gutter Cleaning: $0.04/sqft (min $100)

## Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project" and import your repo
4. Add environment variables
5. Deploy!

### Deploy to Other Platforms

- **Railway**: Railway.app
- **Render**: render.com
- **AWS**: Amplify
- **Azure**: App Service

## Support

For issues or questions, contact RetroGigz Digital at [your-email].

## License

© 2024 Sherb (Serve Boise). All rights reserved.


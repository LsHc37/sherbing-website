import { google } from 'googleapis';
import type { JWTInput } from 'google-auth-library';
import type { BookingForm } from '@/lib/types';
import { calculatePayoutBreakdown } from '@/lib/services/payoutService';

type BookingSheetRow = {
  booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  city_state_zip: string;
  city?: string;
  state?: string;
  zip_code?: string;
  service: string;
  property_sqft: string;
  yard_sqft: string;
  scheduled_date?: string;
  scheduled_time?: string;
  estimated_price: string;
  customer_price: string;
  sherbing_fee: string;
  employee_payout: string;
  package: string;
  notes: string;
  status: string;
  assigned_employee: string;
  customer_update_request: string;
  timestamp: string;
};

type UserSheetRow = {
  created_at: string;
  email: string;
  full_name: string;
  phone: string;
  password_hash: string;
  role: 'customer' | 'employee' | 'admin';
  active: string;
  email_verified: string;
  email_verification_code?: string;
  email_verification_expires?: string;
  password_reset_token?: string;
  password_reset_expires?: string;
};

const authConfig: JWTInput = {
  type: 'service_account',
  project_id: 'sherbing-booking',
  private_key_id: process.env.GOOGLE_SHEETS_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_SHEETS_CLIENT_ID,
};

const bookingsTabName = () => process.env.GOOGLE_SHEETS_TAB_NAME || 'Bookings';
const usersTabName = () => process.env.GOOGLE_USERS_TAB_NAME || 'Users';

type SheetsClient = {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
};

let sheetsClientPromise: Promise<SheetsClient | null> | null = null;

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      if (!spreadsheetId || !authConfig.private_key || !authConfig.client_email) {
        return null;
      }

      const auth = new google.auth.GoogleAuth({
        credentials: authConfig,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      return { sheets, spreadsheetId };
    })();
  }

  return sheetsClientPromise;
}

function isRetryableSheetsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|5\d\d/i.test(message);
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableSheetsError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function columnNumberToName(columnNumber: number) {
  let column = columnNumber;
  let name = '';

  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }

  return name;
}

async function ensureHeaders(tabName: string, headers: string[]) {
  const client = await getSheetsClient();
  if (!client) return { success: true as const, skipped: true as const };

  const { sheets, spreadsheetId } = client;
  const endColumn = columnNumberToName(headers.length);
  const headerRange = `${tabName}!A1:${endColumn}1`;

  const ensureTabExists = async () => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = (spreadsheet.data.sheets || []).some(
      (sheet) => sheet.properties?.title === tabName
    );

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
    }
  };

  try {
    await withRetry(ensureTabExists);
    const data = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: headerRange }));
    if (!data.data.values || data.data.values.length === 0) {
      await withRetry(() => sheets.spreadsheets.values.update({
        spreadsheetId,
        range: headerRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      }));
    } else {
      const existingHeaders = data.data.values[0] || [];
      const missingHeaders = headers.filter((header) => !existingHeaders.includes(header));

      if (missingHeaders.length > 0) {
        const updatedHeaders = [...existingHeaders, ...missingHeaders];
        const updatedEndColumn = columnNumberToName(updatedHeaders.length);
        await withRetry(() => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1:${updatedEndColumn}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [updatedHeaders] },
        }));
      }
    }
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

async function getTabRows(tabName: string) {
  const client = await getSheetsClient();
  if (!client) return [] as string[][];

  const { sheets, spreadsheetId } = client;
  const res = await withRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabName,
  }));

  return (res.data.values || []) as string[][];
}

export async function initializeSheet() {
  const bookingHeaders = [
    'Timestamp',
    'Booking ID',
    'Customer Name',
    'Email',
    'Phone',
    'Address',
    'City/State/ZIP',
    'City',
    'State',
    'ZIP',
    'Service',
    'Property Size (sqft)',
    'Yard Size (sqft)',
    'Scheduled Date',
    'Scheduled Time',
    'Estimated Price',
    'Customer Price',
    'Sherbing Fee',
    'Employee Payout',
    'Package',
    'Notes',
    'Status',
    'Assigned Employee',
    'Customer Update Request',
  ];

  const userHeaders = [
    'Created At',
    'Email',
    'Full Name',
    'Phone',
    'Password Hash',
    'Role',
    'Active',
    'Email Verified',
    'Email Verification Code',
    'Email Verification Expires',
    'Password Reset Token',
    'Password Reset Expires',
  ];

  const bookingInit = await ensureHeaders(bookingsTabName(), bookingHeaders);
  if (!bookingInit.success) return bookingInit;

  return ensureHeaders(usersTabName(), userHeaders);
}

function parseBookingRows(rows: string[][]): BookingSheetRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const idx = (name: string) => headers.indexOf(name);
  const get = (row: string[], name: string) => {
    const index = idx(name);
    if (index < 0) return '';
    return row[index] || '';
  };

  return rows.slice(1).map((row) => {
    const estimatedPrice = Number(get(row, 'Estimated Price') || 0);
    const payout = calculatePayoutBreakdown(estimatedPrice);
    const city = get(row, 'City') || get(row, 'City/State/ZIP').split(',')[0]?.trim() || '';
    const state = get(row, 'State') || get(row, 'City/State/ZIP').split(',')[1]?.trim()?.split(' ')[0] || '';
    const zipCode = get(row, 'ZIP') || get(row, 'City/State/ZIP').split(' ').filter(Boolean).pop() || '';
    const cityStateZip = get(row, 'City/State/ZIP') || [city, state, zipCode].filter(Boolean).join(', ');
    return {
      timestamp: get(row, 'Timestamp'),
      booking_id: get(row, 'Booking ID'),
      customer_name: get(row, 'Customer Name'),
      customer_email: get(row, 'Email'),
      customer_phone: get(row, 'Phone'),
      address: get(row, 'Address'),
      city_state_zip: cityStateZip,
      city,
      state,
      zip_code: zipCode,
      service: get(row, 'Service'),
      property_sqft: get(row, 'Property Size (sqft)'),
      yard_sqft: get(row, 'Yard Size (sqft)'),
      scheduled_date: get(row, 'Scheduled Date'),
      scheduled_time: get(row, 'Scheduled Time'),
      estimated_price: get(row, 'Estimated Price') || '0',
      customer_price: get(row, 'Customer Price') || String(payout.customerPrice),
      sherbing_fee: get(row, 'Sherbing Fee') || String(payout.sherbingFee),
      employee_payout: get(row, 'Employee Payout') || String(payout.employeePayout),
      package: get(row, 'Package'),
      notes: get(row, 'Notes'),
      status: get(row, 'Status') || 'pending',
      assigned_employee: get(row, 'Assigned Employee'),
      customer_update_request: get(row, 'Customer Update Request'),
    };
  });
}

function parseUserRows(rows: string[][]): UserSheetRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const idx = (name: string) => headers.indexOf(name);
  const get = (row: Array<string | number>, name: string) => {
    const index = idx(name);
    if (index < 0) return '';
    const value = row[index];
    return value === undefined || value === null ? '' : String(value);
  };
  const isTruthy = (value: string) => ['true', '1', 'yes', 'y', 'verified'].includes(value.trim().toLowerCase());

  return rows.slice(1).map((row) => ({
    created_at: get(row, 'Created At'),
    email: get(row, 'Email').toLowerCase(),
    full_name: get(row, 'Full Name'),
    phone: get(row, 'Phone'),
    password_hash: get(row, 'Password Hash'),
    role: ((get(row, 'Role') || 'customer') as UserSheetRow['role']),
    active: get(row, 'Active') || 'true',
    email_verified: isTruthy(get(row, 'Email Verified')) ? 'true' : 'false',
    email_verification_code: get(row, 'Email Verification Code'),
    email_verification_expires: get(row, 'Email Verification Expires'),
    password_reset_token: get(row, 'Password Reset Token'),
    password_reset_expires: get(row, 'Password Reset Expires'),
  }));
}

export async function listUsersFromSheet() {
  const rows = await getTabRows(usersTabName());
  return parseUserRows(rows);
}

export async function addBookingToSheet(booking: BookingForm & { booking_id: string; estimated_price: number }) {
  try {
    const init = await initializeSheet();
    if (!init.success) return init;

    const client = await getSheetsClient();
    if (!client) return { success: true, skipped: true as const };

    const { sheets, spreadsheetId } = client;
    const selectedServices = booking.service_ids?.length
      ? booking.service_ids.join(', ')
      : (booking.service_id || '');
    const pricing = calculatePayoutBreakdown(booking.estimated_price);
    const city = String(booking.city || '').trim();
    const state = String(booking.state || '').trim();
    const zipCode = String(booking.zip_code || '').trim();

    const values = [[
      new Date().toISOString(),
      booking.booking_id,
      booking.customer_name,
      booking.customer_email || '',
      booking.customer_phone || '',
      booking.address,
      `${city}, ${state} ${zipCode}`.trim(),
      city,
      state,
      zipCode,
      selectedServices,
      String(booking.property_sqft ?? ''),
      String(booking.yard_sqft ?? ''),
      String(booking.scheduled_date ?? ''),
      String(booking.scheduled_time ?? ''),
      String(pricing.customerPrice),
      String(pricing.customerPrice),
      String(pricing.sherbingFee),
      String(pricing.employeePayout),
      booking.package_id || '',
      booking.notes || '',
      'pending',
      '',
      '',
    ]];

    await withRetry(() => sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${bookingsTabName()}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    }));

    return { success: true };
  } catch (error) {
    console.error('Error adding booking to sheet:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function listBookingsFromSheet() {
  const rows = await getTabRows(bookingsTabName());
  return parseBookingRows(rows);
}

export async function listBookingsByCustomerEmail(email: string) {
  const target = email.toLowerCase();
  const all = await listBookingsFromSheet();
  return all.filter((b) => b.customer_email.toLowerCase() === target);
}

export async function findBookingById(bookingId: string) {
  const all = await listBookingsFromSheet();
  return all.find((b) => b.booking_id === bookingId);
}

export async function updateBookingInSheet(
  bookingId: string,
  updates: Partial<Pick<BookingSheetRow, 'status' | 'assigned_employee' | 'customer_update_request' | 'notes'>>
) {
  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(bookingsTabName());
  if (rows.length < 2) return { success: false, error: 'No bookings found' };

  const headers = rows[0];
  const bookingIndex = rows.findIndex((r, i) => i > 0 && (r[headers.indexOf('Booking ID')] || '') === bookingId);
  if (bookingIndex === -1) return { success: false, error: 'Booking not found' };

  const row = rows[bookingIndex];
  const set = (header: string, value?: string) => {
    const index = headers.indexOf(header);
    if (index === -1 || value === undefined) return;
    row[index] = value;
  };

  set('Status', updates.status);
  set('Assigned Employee', updates.assigned_employee);
  set('Customer Update Request', updates.customer_update_request);
  set('Notes', updates.notes);

  const endColumn = columnNumberToName(headers.length);
  const range = `${bookingsTabName()}!A${bookingIndex + 1}:${endColumn}${bookingIndex + 1}`;

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  }));

  return { success: true };
}

export async function findUserByEmail(email: string) {
  const users = await listUsersFromSheet();
  return users.find((u) => u.email === email.toLowerCase());
}

export async function updateUserInSheet(
  email: string,
  updates: Partial<Pick<UserSheetRow, 'role' | 'active' | 'full_name' | 'phone' | 'password_hash' | 'email_verification_code' | 'email_verification_expires' | 'password_reset_token' | 'password_reset_expires'>> & { email_verified?: string | boolean }
) {
  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(usersTabName());
  if (rows.length < 2) return { success: false, error: 'No users found' };

  const headers = rows[0];
  const emailIdx = headers.indexOf('Email');
  const rowIndex = rows.findIndex((r, i) => i > 0 && (r[emailIdx] || '').toLowerCase() === email.toLowerCase());
  if (rowIndex === -1) return { success: false, error: 'User not found' };

  const row = rows[rowIndex];
  const set = (header: string, value?: string) => {
    const idx = headers.indexOf(header);
    if (idx === -1 || value === undefined) return;
    row[idx] = value;
  };

  set('Role', updates.role);
  set('Active', updates.active);
  set('Full Name', updates.full_name);
  set('Phone', updates.phone);
  set('Password Hash', updates.password_hash);
  if (updates.email_verified !== undefined) {
    set('Email Verified', (updates.email_verified === 'true' || updates.email_verified === true) ? 'true' : 'false');
  }
  set('Email Verification Code', updates.email_verification_code);
  set('Email Verification Expires', updates.email_verification_expires);
  set('Password Reset Token', updates.password_reset_token);
  set('Password Reset Expires', updates.password_reset_expires);

  const endColumn = columnNumberToName(headers.length);
  const range = `${usersTabName()}!A${rowIndex + 1}:${endColumn}${rowIndex + 1}`;

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  }));

  return { success: true };
}

export async function createUserInSheet(user: {
  email: string;
  full_name: string;
  phone?: string;
  password_hash: string;
  role: 'customer' | 'employee' | 'admin';
  email_verified?: boolean;
  email_verification_code?: string;
  email_verification_expires?: string;
}) {
  const init = await initializeSheet();
  if (!init.success) return init;

  const existing = await findUserByEmail(user.email);
  if (existing) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  await withRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${usersTabName()}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        user.email.toLowerCase(),
        user.full_name,
        user.phone || '',
        user.password_hash,
        user.role,
        'true',
        user.email_verified ? 'true' : 'false',
        user.email_verification_code || '',
        user.email_verification_expires || '',
        '', // Password Reset Token
        '', // Password Reset Expires
      ]],
    },
  }));

  return { success: true };
}

export async function findUserByPasswordResetToken(token: string) {
  const users = await listUsersFromSheet();
  const user = users.find((u) => u.password_reset_token === token);
  
  if (!user) return null;
  
  // Check if token has expired
  if (user.password_reset_expires) {
    const expiresAt = new Date(user.password_reset_expires);
    if (new Date() > expiresAt) {
      return null; // Token expired
    }
  }
  
  return user;
}

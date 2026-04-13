import { google } from 'googleapis';
import type { JWTInput } from 'google-auth-library';
import type { BookingForm } from '@/lib/types';
import { calculatePayoutBreakdown } from '@/lib/services/payoutService';

type BookingSheetRow = {
  booking_id: string;
  row_index?: number;
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
  available_dates?: string;
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
    'Available Dates',
  ];

  const bookingInit = await ensureHeaders(bookingsTabName(), bookingHeaders);
  if (!bookingInit.success) return bookingInit;

  return ensureHeaders(usersTabName(), userHeaders);
}

function parseBookingRows(rows: string[][]): BookingSheetRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const idx = (name: string) => headers.indexOf(name);
  const idxAny = (names: string[]) => {
    for (const name of names) {
      const index = idx(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const get = (row: string[], name: string) => {
    const index = idx(name);
    if (index < 0) return '';
    return row[index] || '';
  };
  const getAny = (row: string[], names: string[]) => {
    const index = idxAny(names);
    if (index < 0) return '';
    return row[index] || '';
  };

  return rows.slice(1).map((row, dataIndex) => {
    const rowIndex = dataIndex + 2;
    const estimatedPrice = Number(get(row, 'Estimated Price') || 0);
    const payout = calculatePayoutBreakdown(estimatedPrice);
    const city = get(row, 'City') || get(row, 'City/State/ZIP').split(',')[0]?.trim() || '';
    const state = get(row, 'State') || get(row, 'City/State/ZIP').split(',')[1]?.trim()?.split(' ')[0] || '';
    const zipCode = get(row, 'ZIP') || get(row, 'City/State/ZIP').split(' ').filter(Boolean).pop() || '';
    const cityStateZip = get(row, 'City/State/ZIP') || [city, state, zipCode].filter(Boolean).join(', ');
    const bookingId = getAny(row, ['Booking ID', 'booking_id', 'BookingId', 'ID']) || `ROW-${rowIndex}`;
    return {
      timestamp: get(row, 'Timestamp'),
      booking_id: bookingId,
      row_index: rowIndex,
      customer_name: getAny(row, ['Customer Name', 'customer_name', 'Name']),
      customer_email: getAny(row, ['Email', 'customer_email']),
      customer_phone: getAny(row, ['Phone', 'customer_phone']),
      address: getAny(row, ['Address', 'address']),
      city_state_zip: cityStateZip,
      city,
      state,
      zip_code: zipCode,
      service: getAny(row, ['Service', 'service_id', 'service']),
      property_sqft: getAny(row, ['Property Size (sqft)', 'property_sqft']),
      yard_sqft: getAny(row, ['Yard Size (sqft)', 'yard_sqft']),
      scheduled_date: getAny(row, ['Scheduled Date', 'scheduled_date']),
      scheduled_time: getAny(row, ['Scheduled Time', 'scheduled_time']),
      estimated_price: getAny(row, ['Estimated Price', 'estimated_price']) || '0',
      customer_price: getAny(row, ['Customer Price', 'customer_price']) || String(payout.customerPrice),
      sherbing_fee: getAny(row, ['Sherbing Fee', 'sherbing_fee']) || String(payout.sherbingFee),
      employee_payout: getAny(row, ['Employee Payout', 'employee_payout']) || String(payout.employeePayout),
      package: getAny(row, ['Package', 'package_id']),
      notes: getAny(row, ['Notes', 'notes']),
      status: getAny(row, ['Status', 'status']) || 'pending',
      assigned_employee: getAny(row, ['Assigned Employee', 'assigned_employee']),
      customer_update_request: getAny(row, ['Customer Update Request', 'customer_update_request']),
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
    available_dates: get(row, 'Available Dates'),
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

type SlotStatus = 'open' | 'booked';

export type BookingAvailabilitySlot = {
  time: string;
  status: SlotStatus;
};

const DEFAULT_BOOKING_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

function normalizeDateString(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTimeString(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const hhmmMatch = raw.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  if (hhmmMatch) return raw;

  const parsed = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (parsed) {
    let hour = Number(parsed[1]);
    const minute = parsed[2];
    const meridiem = parsed[3].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  return raw;
}

function isBookingBlockingSlot(status?: string) {
  return String(status || '').toLowerCase() !== 'cancelled';
}

export async function getBookingAvailabilityForDate(date: string): Promise<BookingAvailabilitySlot[]> {
  const targetDate = normalizeDateString(date);
  if (!targetDate) {
    return DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({ time, status: 'open' }));
  }

  const bookings = await listBookingsFromSheet();
  const bookedTimes = new Set(
    bookings
      .filter((booking) => normalizeDateString(booking.scheduled_date) === targetDate)
      .filter((booking) => isBookingBlockingSlot(booking.status))
      .map((booking) => normalizeTimeString(booking.scheduled_time))
      .filter(Boolean)
  );

  return DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({
    time,
    status: bookedTimes.has(time) ? 'booked' : 'open',
  }));
}

export async function isBookingSlotAvailable(date: string, time: string, excludeBookingId?: string) {
  const targetDate = normalizeDateString(date);
  const targetTime = normalizeTimeString(time);
  if (!targetDate || !targetTime) return true;

  const bookings = await listBookingsFromSheet();

  return !bookings.some((booking) => {
    const sameBooking = excludeBookingId && booking.booking_id === excludeBookingId;
    if (sameBooking) return false;

    return (
      normalizeDateString(booking.scheduled_date) === targetDate
      && normalizeTimeString(booking.scheduled_time) === targetTime
      && isBookingBlockingSlot(booking.status)
    );
  });
}

export async function clearAllBookingsInSheet() {
  const client = await getSheetsClient();
  if (!client) return { success: false as const, error: 'Google Sheets not configured' };
  const range = `${bookingsTabName()}!A2:ZZ`;

  try {
    await withRetry(() => client.sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range,
    }));

    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
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
  updates: Partial<Pick<BookingSheetRow, 'status' | 'assigned_employee' | 'customer_update_request' | 'notes' | 'scheduled_date' | 'scheduled_time'>>
) {
  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(bookingsTabName());
  if (rows.length < 2) return { success: false, error: 'No bookings found' };

  const headers = rows[0];
  const bookingIdHeaderIndexCandidates = ['Booking ID', 'booking_id', 'BookingId', 'ID']
    .map((name) => headers.indexOf(name))
    .filter((index) => index >= 0);

  if (bookingIdHeaderIndexCandidates.length === 0) {
    return { success: false, error: 'Booking ID column not found' };
  }

  let bookingIndex = -1;
  const syntheticMatch = /^ROW-(\d+)$/i.exec(bookingId);
  if (syntheticMatch) {
    const requestedRowNumber = Number(syntheticMatch[1]);
    if (Number.isFinite(requestedRowNumber) && requestedRowNumber >= 2 && requestedRowNumber <= rows.length) {
      bookingIndex = requestedRowNumber - 1;
    }
  }

  if (bookingIndex === -1) {
    bookingIndex = rows.findIndex((r, i) =>
      i > 0 && bookingIdHeaderIndexCandidates.some((columnIndex) => (r[columnIndex] || '') === bookingId)
    );
  }
  if (bookingIndex === -1) return { success: false, error: 'Booking not found' };

  const row = rows[bookingIndex];
  const set = (header: string, value?: string) => {
    const index = headers.indexOf(header);
    if (index === -1 || value === undefined) return;
    row[index] = value;
  };

  set('Status', updates.status);
  set('Assigned Employee', updates.assigned_employee);
  set('Scheduled Date', updates.scheduled_date);
  set('Scheduled Time', updates.scheduled_time);
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
  updates: Partial<Pick<UserSheetRow, 'role' | 'active' | 'full_name' | 'phone' | 'password_hash' | 'email_verification_code' | 'email_verification_expires' | 'password_reset_token' | 'password_reset_expires' | 'available_dates'>> & { email_verified?: string | boolean }
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
  set('Available Dates', updates.available_dates);

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
        '', // Available Dates
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

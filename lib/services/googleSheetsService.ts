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
  service_details?: string;
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

function normalizeHeaderValue(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderIndexes(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeaderValue);
  return headers
    .map((header, index) => ({ normalized: normalizeHeaderValue(header), index }))
    .filter(({ normalized }) => normalizedAliases.includes(normalized))
    .map(({ index }) => index);
}

function normalizeCellValue(value: string) {
  return normalizeBookingIdentifier(String(value || ''))
    .replace(/^'+|'+$/g, '')
    .trim()
    .toLowerCase();
}

function resolveBookingRowIndex(rows: string[][], bookingId: string, bookingIdHeaderIndexCandidates: number[]) {
  let bookingIndex = -1;
  const targetBookingId = normalizeBookingIdentifier(bookingId);

  const syntheticMatch = /^ROW-(\d+)$/i.exec(targetBookingId);
  if (syntheticMatch) {
    const requestedRowNumber = Number(syntheticMatch[1]);
    if (Number.isFinite(requestedRowNumber) && requestedRowNumber >= 2 && requestedRowNumber <= rows.length) {
      bookingIndex = requestedRowNumber - 1;
    }
  }

  if (bookingIndex === -1) {
    bookingIndex = rows.findIndex((r, i) =>
      i > 0 && bookingIdHeaderIndexCandidates.some((columnIndex) => bookingIdsMatch(String(r[columnIndex] || ''), targetBookingId))
    );
  }

  if (bookingIndex === -1) {
    const targetNormalized = normalizeCellValue(targetBookingId);
    bookingIndex = rows.findIndex((r, i) => {
      if (i <= 0) return false;
      return r.some((cell) => normalizeCellValue(String(cell || '')) === targetNormalized);
    });
  }

  return bookingIndex;
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
    'Service Details',
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
  const headers = rows[0].map((header) => String(header || '').trim());
  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedHeaders = headers.map(normalizeHeader);

  const aliasIndices = (aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    return normalizedHeaders
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => normalizedAliases.includes(header))
      .map(({ index }) => index);
  };

  const getByAliases = (row: string[], aliases: string[]) => {
    const indexes = aliasIndices(aliases);
    for (const index of indexes) {
      const value = String(row[index] || '').trim();
      if (value) return value;
    }
    return '';
  };

  const getAt = (row: string[], index: number) => String(row[index] || '').trim();
  const hasServiceDetailsColumn = aliasIndices(['Service Details', 'service_details']).length > 0;
  const hasLetters = (value: string) => /[a-zA-Z]/.test(value);
  const hasDigits = (value: string) => /\d/.test(value);
  const isLikelyEmail = (value: string) => /.+@.+\..+/.test(value);
  const isMostlyNumeric = (value: string) => /^[\d.,$\s-]+$/.test(value) && !hasLetters(value);

  const scoreCandidate = (candidate: Pick<BookingSheetRow, 'customer_name' | 'customer_email' | 'customer_phone' | 'address' | 'service' | 'city'>) => {
    let score = 0;
    if (isLikelyEmail(candidate.customer_email)) score += 4;
    if (candidate.customer_name && !isMostlyNumeric(candidate.customer_name)) score += 3;
    if (candidate.address && hasLetters(candidate.address) && hasDigits(candidate.address)) score += 3;
    if (candidate.service && !isMostlyNumeric(candidate.service)) score += 2;
    if ((candidate.customer_phone || '').replace(/\D/g, '').length >= 7) score += 1;
    if (candidate.city && hasLetters(candidate.city) && !isMostlyNumeric(candidate.city)) score += 1;
    return score;
  };

  return rows.slice(1).map((row, dataIndex) => {
    const rowIndex = dataIndex + 2;

    const headerBasedBase = {
      timestamp: getByAliases(row, ['Timestamp']),
      booking_id: getByAliases(row, ['Booking ID', 'booking_id', 'BookingId', 'ID']) || `ROW-${rowIndex}`,
      customer_name: getByAliases(row, ['Customer Name', 'customer_name', 'Name']),
      customer_email: getByAliases(row, ['Email', 'customer_email']),
      customer_phone: getByAliases(row, ['Phone', 'customer_phone']),
      address: getByAliases(row, ['Address', 'address']),
      city_state_zip: getByAliases(row, ['City/State/ZIP', 'city_state_zip']),
      city: getByAliases(row, ['City', 'city']),
      state: getByAliases(row, ['State', 'state']),
      zip_code: getByAliases(row, ['ZIP', 'zip_code', 'zip']),
      service: getByAliases(row, ['Service', 'service_id', 'service']),
      property_sqft: getByAliases(row, ['Property Size (sqft)', 'property_sqft']),
      yard_sqft: getByAliases(row, ['Yard Size (sqft)', 'yard_sqft']),
      scheduled_date: getByAliases(row, ['Scheduled Date', 'scheduled_date']),
      scheduled_time: getByAliases(row, ['Scheduled Time', 'scheduled_time']),
      estimated_price: getByAliases(row, ['Estimated Price', 'estimated_price']) || '0',
      customer_price: getByAliases(row, ['Customer Price', 'customer_price']),
      sherbing_fee: getByAliases(row, ['Sherbing Fee', 'sherbing_fee']),
      employee_payout: getByAliases(row, ['Employee Payout', 'employee_payout']),
      package: getByAliases(row, ['Package', 'package_id']),
      service_details: getByAliases(row, ['Service Details', 'service_details']),
      notes: getByAliases(row, ['Notes', 'notes']),
      status: getByAliases(row, ['Status', 'status']) || 'pending',
      assigned_employee: getByAliases(row, ['Assigned Employee', 'assigned_employee']),
      customer_update_request: getByAliases(row, ['Customer Update Request', 'customer_update_request']),
    };

    const positionalBase = {
      timestamp: getAt(row, 0),
      booking_id: getAt(row, 1) || `ROW-${rowIndex}`,
      customer_name: getAt(row, 2),
      customer_email: getAt(row, 3),
      customer_phone: getAt(row, 4),
      address: getAt(row, 5),
      city_state_zip: getAt(row, 6),
      city: getAt(row, 7),
      state: getAt(row, 8),
      zip_code: getAt(row, 9),
      service: getAt(row, 10),
      property_sqft: getAt(row, 11),
      yard_sqft: getAt(row, 12),
      scheduled_date: getAt(row, 13),
      scheduled_time: getAt(row, 14),
      estimated_price: getAt(row, 15) || '0',
      customer_price: getAt(row, 16),
      sherbing_fee: getAt(row, 17),
      employee_payout: getAt(row, 18),
      package: getAt(row, 19),
      service_details: hasServiceDetailsColumn ? getAt(row, 20) : '',
      notes: hasServiceDetailsColumn ? getAt(row, 21) : getAt(row, 20),
      status: (hasServiceDetailsColumn ? getAt(row, 22) : getAt(row, 21)) || 'pending',
      assigned_employee: hasServiceDetailsColumn ? getAt(row, 23) : getAt(row, 22),
      customer_update_request: hasServiceDetailsColumn ? getAt(row, 24) : getAt(row, 23),
    };

    const usePositional = scoreCandidate(positionalBase) > scoreCandidate(headerBasedBase);
    const base = usePositional ? positionalBase : headerBasedBase;

    const estimatedPrice = Number(base.estimated_price || 0);
    const payout = calculatePayoutBreakdown(estimatedPrice);
    const fallbackCity = base.city_state_zip.split(',')[0]?.trim() || '';
    const fallbackStateZip = base.city_state_zip.split(',')[1]?.trim() || '';
    const fallbackState = fallbackStateZip.split(' ')[0] || '';
    const fallbackZip = fallbackStateZip.split(' ').filter(Boolean).pop() || '';
    const city = base.city || fallbackCity;
    const state = base.state || fallbackState;
    const zipCode = base.zip_code || fallbackZip;
    const cityStateZip = base.city_state_zip || [city, state, zipCode].filter(Boolean).join(', ');

    return {
      timestamp: base.timestamp,
      booking_id: base.booking_id,
      row_index: rowIndex,
      customer_name: base.customer_name,
      customer_email: base.customer_email,
      customer_phone: base.customer_phone,
      address: base.address,
      city_state_zip: cityStateZip,
      city,
      state,
      zip_code: zipCode,
      service: base.service,
      property_sqft: base.property_sqft,
      yard_sqft: base.yard_sqft,
      scheduled_date: base.scheduled_date,
      scheduled_time: base.scheduled_time,
      estimated_price: base.estimated_price || '0',
      customer_price: base.customer_price || String(payout.customerPrice),
      sherbing_fee: base.sherbing_fee || String(payout.sherbingFee),
      employee_payout: base.employee_payout || String(payout.employeePayout),
      package: base.package,
      service_details: base.service_details,
      notes: base.notes,
      status: base.status || 'pending',
      assigned_employee: base.assigned_employee,
      customer_update_request: base.customer_update_request,
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
    email: get(row, 'Email').trim().toLowerCase(),
    full_name: get(row, 'Full Name').trim(),
    phone: get(row, 'Phone').trim(),
    password_hash: get(row, 'Password Hash').trim(),
    role: ((get(row, 'Role').trim() || 'customer') as UserSheetRow['role']),
    active: get(row, 'Active').trim() || 'true',
    email_verified: isTruthy(get(row, 'Email Verified')) ? 'true' : 'false',
    email_verification_code: get(row, 'Email Verification Code').trim(),
    email_verification_expires: get(row, 'Email Verification Expires').trim(),
    password_reset_token: get(row, 'Password Reset Token').trim(),
    password_reset_expires: get(row, 'Password Reset Expires').trim(),
    available_dates: get(row, 'Available Dates').trim(),
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
      booking.service_details || '',
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

export type EmployeeAvailabilityEntry = {
  date: string;
  start: string;
  end: string;
  type: 'open' | 'blocked';
  repeat?: 'none' | 'daily' | 'weekly' | 'weekdays';
  until?: string;
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

function compareTimeStrings(a: string, b: string) {
  return normalizeTimeString(a).localeCompare(normalizeTimeString(b));
}

function isTimeWithinRange(time: string, start: string, end: string) {
  const normalizedTime = normalizeTimeString(time);
  const normalizedStart = normalizeTimeString(start);
  const normalizedEnd = normalizeTimeString(end);

  if (!normalizedTime || !normalizedStart || !normalizedEnd) return false;
  return compareTimeStrings(normalizedTime, normalizedStart) >= 0
    && compareTimeStrings(normalizedTime, normalizedEnd) < 0;
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function daysBetween(start: string, end: string) {
  const ms = toDateOnly(end).getTime() - toDateOnly(start).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isWeekday(date: string) {
  const day = toDateOnly(date).getDay();
  return day >= 1 && day <= 5;
}

function appliesOnDate(entry: EmployeeAvailabilityEntry, targetDate: string) {
  if (!entry.date || targetDate < entry.date) return false;
  if (entry.until && targetDate > entry.until) return false;

  const repeat = entry.repeat || 'none';
  if (repeat === 'none') {
    return targetDate === entry.date;
  }

  if (repeat === 'daily') {
    return true;
  }

  if (repeat === 'weekdays') {
    return isWeekday(targetDate);
  }

  if (repeat === 'weekly') {
    const delta = daysBetween(entry.date, targetDate);
    return delta >= 0 && delta % 7 === 0;
  }

  return false;
}

export function parseEmployeeAvailabilityEntries(raw: string | undefined): EmployeeAvailabilityEntry[] {
  const value = String(raw || '').trim();
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [rawDate, rawStart, rawEnd, rawType, rawRepeat, rawUntil] = entry.split('|').map((part) => part.trim());
      const date = normalizeDateString(rawDate);

      // Support legacy date-only entries as full-day open availability.
      if (!rawStart && !rawEnd && !rawType && date) {
        return {
          date,
          start: '00:00',
          end: '23:59',
          type: 'open' as const,
        };
      }

      const start = normalizeTimeString(rawStart || '');
      const end = normalizeTimeString(rawEnd || '');
      const type = rawType === 'blocked' ? 'blocked' : 'open';
      const repeat = ['none', 'daily', 'weekly', 'weekdays'].includes(rawRepeat) ? (rawRepeat as EmployeeAvailabilityEntry['repeat']) : 'none';
      const until = normalizeDateString(rawUntil || '');

      if (!date || !start || !end || compareTimeStrings(start, end) >= 0) {
        return null;
      }

      if (until && until < date) {
        return null;
      }

      return {
        date,
        start,
        end,
        type,
        repeat,
        until: until || undefined,
      };
    })
    .filter((entry): entry is EmployeeAvailabilityEntry => Boolean(entry));
}

export async function getBookingAvailabilityForDate(date: string): Promise<BookingAvailabilitySlot[]> {
  const targetDate = normalizeDateString(date);
  if (!targetDate) {
    return DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({ time, status: 'open' }));
  }

  const bookings = await listBookingsFromSheet();
  const users = await listUsersFromSheet();
  const bookedCountsByTime = new Map<string, number>();
  for (const booking of bookings) {
    if (normalizeDateString(booking.scheduled_date) !== targetDate) continue;
    if (!isBookingBlockingSlot(booking.status)) continue;
    const normalizedTime = normalizeTimeString(booking.scheduled_time);
    if (!normalizedTime) continue;
    bookedCountsByTime.set(normalizedTime, (bookedCountsByTime.get(normalizedTime) || 0) + 1);
  }

  const activeWorkers = users.filter((user) => {
    const role = String(user.role || '').toLowerCase();
    const isActive = String(user.active || 'true').toLowerCase() !== 'false';
    return isActive && (role === 'employee' || role === 'admin');
  });

  const workerWindows = activeWorkers.map((worker) => {
    const entries = parseEmployeeAvailabilityEntries(worker.available_dates);
    return {
      open: entries.filter((entry) => entry.type === 'open' && appliesOnDate(entry, targetDate)),
      blocked: entries.filter((entry) => entry.type === 'blocked' && appliesOnDate(entry, targetDate)),
    };
  });

  const availableWorkerCountAtTime = (time: string) => {
    return workerWindows.reduce((count, windows) => {
      const hasOpenWindows = windows.open.length > 0;
      if (!hasOpenWindows) return count;

      const withinOpenWindow = windows.open.some((entry) => isTimeWithinRange(time, entry.start, entry.end));
      if (!withinOpenWindow) return count;

      const blockedByCalendar = windows.blocked.some((entry) => isTimeWithinRange(time, entry.start, entry.end));
      if (blockedByCalendar) return count;

      return count + 1;
    }, 0);
  };

  return DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({
    time,
    status: (() => {
      const workerCapacity = availableWorkerCountAtTime(time);
      if (workerCapacity <= 0) return 'booked';

      const bookedCount = bookedCountsByTime.get(time) || 0;
      return bookedCount >= workerCapacity ? 'booked' : 'open';
    })(),
  }));
}

export async function isBookingSlotAvailable(date: string, time: string, excludeBookingId?: string) {
  const targetDate = normalizeDateString(date);
  const targetTime = normalizeTimeString(time);
  if (!targetDate || !targetTime) return true;

  const bookings = await listBookingsFromSheet();
  const users = await listUsersFromSheet();

  const activeWorkers = users.filter((user) => {
    const role = String(user.role || '').toLowerCase();
    const isActive = String(user.active || 'true').toLowerCase() !== 'false';
    return isActive && (role === 'employee' || role === 'admin');
  });

  const workerCapacity = activeWorkers.reduce((count, worker) => {
    const entries = parseEmployeeAvailabilityEntries(worker.available_dates);
    const openWindows = entries.filter((entry) => entry.type === 'open' && appliesOnDate(entry, targetDate));
    if (openWindows.length === 0) return count;

    const withinOpen = openWindows.some((entry) => isTimeWithinRange(targetTime, entry.start, entry.end));
    if (!withinOpen) return count;

    const blockedWindows = entries.filter((entry) => entry.type === 'blocked' && appliesOnDate(entry, targetDate));
    const blocked = blockedWindows.some((entry) => isTimeWithinRange(targetTime, entry.start, entry.end));
    if (blocked) return count;

    return count + 1;
  }, 0);

  if (workerCapacity <= 0) return false;

  const bookedCount = bookings.reduce((count, booking) => {
    const sameBooking = excludeBookingId && booking.booking_id === excludeBookingId;
    if (sameBooking) return count;

    if (
      normalizeDateString(booking.scheduled_date) === targetDate
      && normalizeTimeString(booking.scheduled_time) === targetTime
      && isBookingBlockingSlot(booking.status)
    ) {
      return count + 1;
    }

    return count;
  }, 0);

  return bookedCount < workerCapacity;
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

function normalizeBookingIdentifier(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

function bookingIdsMatch(left: string, right: string) {
  return normalizeBookingIdentifier(left).toLowerCase() === normalizeBookingIdentifier(right).toLowerCase();
}

export async function findBookingById(bookingId: string) {
  const targetBookingId = normalizeBookingIdentifier(bookingId);
  const all = await listBookingsFromSheet();
  const directMatch = all.find((b) => bookingIdsMatch(b.booking_id, targetBookingId));
  if (directMatch) return directMatch;

  const syntheticMatch = /^ROW-(\d+)$/i.exec(targetBookingId);
  if (!syntheticMatch) return undefined;

  const rowNumber = Number(syntheticMatch[1]);
  if (!Number.isFinite(rowNumber)) return undefined;

  return all.find((b) => b.row_index === rowNumber);
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
  const bookingIdHeaderIndexCandidates = findHeaderIndexes(headers, ['Booking ID', 'booking_id', 'BookingId', 'ID']);

  if (bookingIdHeaderIndexCandidates.length === 0) {
    return { success: false, error: 'Booking ID column not found' };
  }

  const bookingIndex = resolveBookingRowIndex(rows, bookingId, bookingIdHeaderIndexCandidates);
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

export async function deleteBookingFromSheet(bookingId: string) {
  const client = await getSheetsClient();
  if (!client) return { success: false as const, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(bookingsTabName());
  if (rows.length < 2) return { success: false as const, error: 'No bookings found' };

  const headers = rows[0];
  const bookingIdHeaderIndexCandidates = findHeaderIndexes(headers, ['Booking ID', 'booking_id', 'BookingId', 'ID']);

  if (bookingIdHeaderIndexCandidates.length === 0) {
    return { success: false as const, error: 'Booking ID column not found' };
  }

  const bookingIndex = resolveBookingRowIndex(rows, bookingId, bookingIdHeaderIndexCandidates);

  if (bookingIndex <= 0) return { success: false as const, error: 'Booking not found' };

  const spreadsheet = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }));
  const bookingSheet = (spreadsheet.data.sheets || []).find(
    (sheet) => sheet.properties?.title === bookingsTabName()
  );
  const sheetId = bookingSheet?.properties?.sheetId;
  if (typeof sheetId !== 'number') {
    return { success: false as const, error: 'Bookings sheet not found' };
  }

  await withRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: bookingIndex,
              endIndex: bookingIndex + 1,
            },
          },
        },
      ],
    },
  }));

  return { success: true as const };
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

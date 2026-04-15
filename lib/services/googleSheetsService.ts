import { google } from 'googleapis';
import type { JWTInput } from 'google-auth-library';
import type { BookingForm } from '@/lib/types';
import type { JobApplication, JobApplicationStatus } from '@/lib/types';
import type { JobApplicationMessage } from '@/lib/types';
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
  scheduled_duration_minutes?: string;
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
  managed_groups?: string;
};

type JobApplicationSheetRow = {
  created_at: string;
  application_id: string;
  full_name: string;
  phone: string;
  email: string;
  city_zip: string;
  previous_experience: string;
  previous_experience_details: string;
  equipment_known: string;
  can_lift_50_plus_lbs: string;
  has_valid_license_and_transportation: string;
  available_start_date: string;
  general_availability: string;
  why_work_for_sherbing: string;
  own_equipment: string;
  resume_file_name: string;
  resume_url: string;
  resume_mime_type: string;
  status: JobApplicationStatus;
  interview_group?: string;
  interview_scheduled_at?: string;
  interview_meeting_url?: string;
  onboarding_notes?: string;
  interview_messages?: string;
  reviewed_by?: string;
  reviewed_at?: string;
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
const jobApplicationsTabName = () => process.env.GOOGLE_JOB_APPLICATIONS_TAB_NAME || 'Job Applications';

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
    'Scheduled Duration Minutes',
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
    'Managed Groups',
  ];

  const jobApplicationHeaders = [
    'Created At',
    'Application ID',
    'Full Name',
    'Phone',
    'Email',
    'City and Zip Code',
    'Previous Experience',
    'Previous Experience Details',
    'Equipment Known',
    'Can Lift 50+ lbs',
    'Valid License and Transportation',
    'Available Start Date',
    'General Availability',
    'Why Work for Sherbing',
    'Own Equipment',
    'Resume File Name',
    'Resume URL',
    'Resume Mime Type',
    'Status',
    'Interview Group',
    'Interview Scheduled At',
    'Interview Meeting URL',
    'Onboarding Notes',
    'Interview Messages',
    'Reviewed By',
    'Reviewed At',
  ];

  const bookingInit = await ensureHeaders(bookingsTabName(), bookingHeaders);
  if (!bookingInit.success) return bookingInit;

  const usersInit = await ensureHeaders(usersTabName(), userHeaders);
  if (!usersInit.success) return usersInit;

  return ensureHeaders(jobApplicationsTabName(), jobApplicationHeaders);
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
      scheduled_duration_minutes: getByAliases(row, ['Scheduled Duration Minutes', 'scheduled_duration_minutes', 'Duration Minutes', 'duration_minutes']),
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
      scheduled_duration_minutes: hasServiceDetailsColumn ? getAt(row, 25) : getAt(row, 24),
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
      scheduled_duration_minutes: base.scheduled_duration_minutes,
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
    managed_groups: get(row, 'Managed Groups').trim(),
  }));
}

function parseJobApplicationRows(rows: string[][]): JobApplication[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const idx = (name: string) => headers.indexOf(name);
  const get = (row: Array<string | number>, name: string) => {
    const index = idx(name);
    if (index < 0) return '';
    const value = row[index];
    return value === undefined || value === null ? '' : String(value);
  };
  const normalizeSelection = (value: string) => String(value || '').trim().toLowerCase();
  const parseMessages = (value: string): JobApplicationMessage[] => {
    const raw = String(value || '').trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as JobApplicationMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((message) => {
          const senderRole: JobApplicationMessage['sender_role'] = message.sender_role === 'admin' ? 'admin' : 'employee';
          return {
            id: String(message.id || '').trim(),
            sender_email: String(message.sender_email || '').trim().toLowerCase(),
            sender_name: String(message.sender_name || '').trim(),
            sender_role: senderRole,
            created_at: String(message.created_at || '').trim(),
            body: String(message.body || '').trim(),
          };
        })
        .filter((message) => message.id && message.sender_email && message.sender_name && message.body);
    } catch {
      return [];
    }
  };

  return rows.slice(1).map((row, rowOffset) => {
    const rawEquipment = get(row, 'Equipment Known');
    const applicationId = get(row, 'Application ID').trim() || `ROW-${rowOffset + 2}`;
    const status = normalizeSelection(get(row, 'Status')) as JobApplicationStatus;

    return {
      id: applicationId,
      created_at: get(row, 'Created At'),
      full_name: get(row, 'Full Name').trim(),
      phone: get(row, 'Phone').trim(),
      email: get(row, 'Email').trim().toLowerCase(),
      city_zip: get(row, 'City and Zip Code').trim(),
      previous_experience: normalizeSelection(get(row, 'Previous Experience')) === 'yes' ? 'yes' : 'no',
      previous_experience_details: get(row, 'Previous Experience Details').trim(),
      equipment_known: rawEquipment
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      can_lift_50_plus_lbs: normalizeSelection(get(row, 'Can Lift 50+ lbs')) === 'yes' ? 'yes' : 'no',
      has_valid_license_and_transportation: normalizeSelection(get(row, 'Valid License and Transportation')) === 'yes' ? 'yes' : 'no',
      available_start_date: get(row, 'Available Start Date').trim(),
      general_availability: get(row, 'General Availability').trim(),
      why_work_for_sherbing: get(row, 'Why Work for Sherbing').trim(),
      own_equipment: get(row, 'Own Equipment').trim(),
      resume_file_name: get(row, 'Resume File Name').trim(),
      resume_url: get(row, 'Resume URL').trim(),
      resume_mime_type: get(row, 'Resume Mime Type').trim(),
      status: ['new', 'reviewing', 'interview', 'onboarding', 'hired', 'rejected'].includes(status) ? status : 'new',
      interview_group: get(row, 'Interview Group').trim(),
      interview_scheduled_at: get(row, 'Interview Scheduled At').trim(),
      interview_meeting_url: get(row, 'Interview Meeting URL').trim(),
      onboarding_notes: get(row, 'Onboarding Notes').trim(),
      messages: parseMessages(get(row, 'Interview Messages')),
      reviewed_by: get(row, 'Reviewed By').trim(),
      reviewed_at: get(row, 'Reviewed At').trim(),
    };
  });
}

export async function listUsersFromSheet() {
  const rows = await getTabRows(usersTabName());
  return parseUserRows(rows);
}

export async function listJobApplicationsFromSheet() {
  const rows = await getTabRows(jobApplicationsTabName());
  return parseJobApplicationRows(rows);
}

function normalizeJobApplicationIdentifier(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

function jobApplicationIdsMatch(left: string, right: string) {
  return normalizeJobApplicationIdentifier(left).toLowerCase() === normalizeJobApplicationIdentifier(right).toLowerCase();
}

export async function findJobApplicationById(applicationId: string) {
  const targetApplicationId = normalizeJobApplicationIdentifier(applicationId);
  const all = await listJobApplicationsFromSheet();
  const directMatch = all.find((application) => jobApplicationIdsMatch(application.id, targetApplicationId));
  if (directMatch) return directMatch;

  const syntheticMatch = /^ROW-(\d+)$/i.exec(targetApplicationId);
  if (!syntheticMatch) return undefined;

  const rowNumber = Number(syntheticMatch[1]);
  if (!Number.isFinite(rowNumber)) return undefined;

  return all.find((application) => application.id === `ROW-${rowNumber}`);
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
      String(booking.scheduled_duration_minutes ?? 60),
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

const BOOKING_SLOT_INTERVAL_MINUTES = 30;
const BOOKING_DAY_START_MINUTES = 8 * 60;
const BOOKING_DAY_END_MINUTES = 18 * 60;

function minutesToTimeString(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timeStringToMinutes(value: string) {
  const normalized = normalizeTimeString(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function buildDefaultBookingTimeSlots() {
  const slots: string[] = [];
  for (let minute = BOOKING_DAY_START_MINUTES; minute < BOOKING_DAY_END_MINUTES; minute += BOOKING_SLOT_INTERVAL_MINUTES) {
    slots.push(minutesToTimeString(minute));
  }
  return slots;
}

const DEFAULT_BOOKING_TIME_SLOTS = buildDefaultBookingTimeSlots();

function parseDurationMinutes(value?: string | number) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.max(30, Math.min(480, Math.round(parsed / 15) * 15));
}

function bookingIntervalOverlapsTime(startMinutes: number, endMinutes: number, slotMinutes: number) {
  return slotMinutes >= startMinutes && slotMinutes < endMinutes;
}

function getBookingStartEndMinutes(booking: BookingSheetRow) {
  const startMinutes = timeStringToMinutes(String(booking.scheduled_time || ''));
  if (!Number.isFinite(startMinutes)) {
    return null;
  }

  const durationMinutes = parseDurationMinutes(booking.scheduled_duration_minutes);
  return {
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
  };
}

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

export async function getBookingAvailabilityForDate(date: string, requestedDurationMinutes = 60): Promise<BookingAvailabilitySlot[]> {
  const targetDate = normalizeDateString(date);
  if (!targetDate) {
    return DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({ time, status: 'open' }));
  }

  const bookings = await listBookingsFromSheet();
  const users = await listUsersFromSheet();
  const dayBookings = bookings.filter((booking) => (
    normalizeDateString(booking.scheduled_date) === targetDate
    && isBookingBlockingSlot(booking.status)
  ));

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

  const normalizedDuration = parseDurationMinutes(requestedDurationMinutes);
  const slotTimesWithMinutes = DEFAULT_BOOKING_TIME_SLOTS.map((time) => ({ time, minutes: timeStringToMinutes(time) }));

  return slotTimesWithMinutes.map(({ time, minutes }) => {
    const intervalEnd = minutes + normalizedDuration;
    const slotsCoveredByBooking = slotTimesWithMinutes.filter((slot) => slot.minutes >= minutes && slot.minutes < intervalEnd);

    if (slotsCoveredByBooking.length === 0) {
      return { time, status: 'booked' as const };
    }

    const canFit = slotsCoveredByBooking.every((slot) => {
      const workerCapacity = availableWorkerCountAtTime(slot.time);
      if (workerCapacity <= 0) return false;

      const overlappingBookings = dayBookings.reduce((count, booking) => {
        const interval = getBookingStartEndMinutes(booking);
        if (!interval) return count;
        return bookingIntervalOverlapsTime(interval.startMinutes, interval.endMinutes, slot.minutes) ? count + 1 : count;
      }, 0);

      return overlappingBookings < workerCapacity;
    });

    return {
      time,
      status: canFit ? ('open' as const) : ('booked' as const),
    };
  });
}

export async function isBookingSlotAvailable(date: string, time: string, excludeBookingId?: string, requestedDurationMinutes = 60) {
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

  const workerCapacityAtTime = (timeLabel: string) => activeWorkers.reduce((count, worker) => {
    const entries = parseEmployeeAvailabilityEntries(worker.available_dates);
    const openWindows = entries.filter((entry) => entry.type === 'open' && appliesOnDate(entry, targetDate));
    if (openWindows.length === 0) return count;

    const withinOpen = openWindows.some((entry) => isTimeWithinRange(timeLabel, entry.start, entry.end));
    if (!withinOpen) return count;

    const blockedWindows = entries.filter((entry) => entry.type === 'blocked' && appliesOnDate(entry, targetDate));
    const blocked = blockedWindows.some((entry) => isTimeWithinRange(timeLabel, entry.start, entry.end));
    if (blocked) return count;

    return count + 1;
  }, 0);

  const targetStartMinutes = timeStringToMinutes(targetTime);
  const targetDuration = parseDurationMinutes(requestedDurationMinutes);
  const targetEndMinutes = targetStartMinutes + targetDuration;
  const slotTimesWithMinutes = DEFAULT_BOOKING_TIME_SLOTS.map((slotTime) => ({
    time: slotTime,
    minutes: timeStringToMinutes(slotTime),
  }));
  const requestedSlots = slotTimesWithMinutes.filter((slot) => slot.minutes >= targetStartMinutes && slot.minutes < targetEndMinutes);
  if (requestedSlots.length === 0) return false;

  return requestedSlots.every((slot) => {
    const workerCapacity = workerCapacityAtTime(slot.time);
    if (workerCapacity <= 0) return false;

    const overlappingBookings = bookings.reduce((count, booking) => {
      const sameBooking = excludeBookingId && bookingIdsMatch(booking.booking_id, excludeBookingId);
      if (sameBooking) return count;
      if (normalizeDateString(booking.scheduled_date) !== targetDate) return count;
      if (!isBookingBlockingSlot(booking.status)) return count;

      const interval = getBookingStartEndMinutes(booking);
      if (!interval) return count;
      return bookingIntervalOverlapsTime(interval.startMinutes, interval.endMinutes, slot.minutes) ? count + 1 : count;
    }, 0);

    return overlappingBookings < workerCapacity;
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
  updates: Partial<Pick<BookingSheetRow,
    | 'status'
    | 'assigned_employee'
    | 'customer_update_request'
    | 'notes'
    | 'scheduled_date'
    | 'scheduled_time'
    | 'scheduled_duration_minutes'
    | 'customer_name'
    | 'customer_email'
    | 'customer_phone'
    | 'service'
    | 'service_details'
    | 'property_sqft'
    | 'yard_sqft'
    | 'package'
    | 'address'
    | 'city'
    | 'state'
    | 'zip_code'
    | 'city_state_zip'
  >>
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
  const setByAliases = (aliases: string[], value?: string) => {
    if (value === undefined) return;
    const indexes = findHeaderIndexes(headers, aliases);
    if (indexes.length === 0) return;
    row[indexes[0]] = value;
  };
  const getByAliases = (aliases: string[]) => {
    const indexes = findHeaderIndexes(headers, aliases);
    if (indexes.length === 0) return '';
    return String(row[indexes[0]] || '').trim();
  };

  setByAliases(['Status', 'status'], updates.status);
  setByAliases(['Assigned Employee', 'assigned_employee'], updates.assigned_employee);
  setByAliases(['Scheduled Date', 'scheduled_date'], updates.scheduled_date);
  setByAliases(['Scheduled Time', 'scheduled_time'], updates.scheduled_time);
  setByAliases(['Scheduled Duration Minutes', 'scheduled_duration_minutes', 'Duration Minutes', 'duration_minutes'], updates.scheduled_duration_minutes);
  setByAliases(['Customer Update Request', 'customer_update_request'], updates.customer_update_request);
  setByAliases(['Notes', 'notes'], updates.notes);
  setByAliases(['Customer Name', 'customer_name', 'Name'], updates.customer_name);
  setByAliases(['Email', 'customer_email'], updates.customer_email);
  setByAliases(['Phone', 'customer_phone'], updates.customer_phone);
  setByAliases(['Service', 'service_id', 'service'], updates.service);
  setByAliases(['Service Details', 'service_details'], updates.service_details);
  setByAliases(['Property Size (sqft)', 'property_sqft'], updates.property_sqft);
  setByAliases(['Yard Size (sqft)', 'yard_sqft'], updates.yard_sqft);
  setByAliases(['Package', 'package_id'], updates.package);
  setByAliases(['Address', 'address'], updates.address);
  setByAliases(['City', 'city'], updates.city);
  setByAliases(['State', 'state'], updates.state);
  setByAliases(['ZIP', 'zip_code', 'zip'], updates.zip_code);

  const resolvedCity = updates.city ?? getByAliases(['City', 'city']);
  const resolvedState = updates.state ?? getByAliases(['State', 'state']);
  const resolvedZip = updates.zip_code ?? getByAliases(['ZIP', 'zip_code', 'zip']);
  const cityStateZip = [resolvedCity, `${resolvedState} ${resolvedZip}`.trim()].filter(Boolean).join(', ').trim();
  if (cityStateZip) {
    setByAliases(['City/State/ZIP', 'city_state_zip'], cityStateZip);
  }

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
  updates: Partial<Pick<UserSheetRow, 'role' | 'active' | 'full_name' | 'phone' | 'password_hash' | 'email_verification_code' | 'email_verification_expires' | 'password_reset_token' | 'password_reset_expires' | 'available_dates' | 'managed_groups'>> & { email_verified?: string | boolean }
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
  set('Managed Groups', updates.managed_groups);

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
        '', // Managed Groups
      ]],
    },
  }));

  return { success: true };
}

export async function addJobApplicationToSheet(application: {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city_zip: string;
  previous_experience: 'yes' | 'no';
  previous_experience_details: string;
  equipment_known: string[];
  can_lift_50_plus_lbs: 'yes' | 'no';
  has_valid_license_and_transportation: 'yes' | 'no';
  available_start_date: string;
  general_availability: string;
  why_work_for_sherbing: string;
  own_equipment: string;
  resume_file_name: string;
  resume_url: string;
  resume_mime_type: string;
  status?: JobApplicationStatus;
  interview_group?: string;
}) {
  const init = await initializeSheet();
  if (!init.success) return init;

  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  await withRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${jobApplicationsTabName()}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        application.id,
        application.full_name,
        application.phone,
        application.email.toLowerCase(),
        application.city_zip,
        application.previous_experience,
        application.previous_experience_details,
        application.equipment_known.join(', '),
        application.can_lift_50_plus_lbs,
        application.has_valid_license_and_transportation,
        application.available_start_date,
        application.general_availability,
        application.why_work_for_sherbing,
        application.own_equipment,
        application.resume_file_name,
        application.resume_url,
        application.resume_mime_type,
        application.status || 'new',
        application.interview_group || '',
        '',
        '',
        '',
        '[]',
        '',
        '',
      ]],
    },
  }));

  return { success: true };
}

export async function updateJobApplicationInSheet(
  applicationId: string,
  updates: Partial<Pick<JobApplicationSheetRow, 'status' | 'interview_group' | 'interview_scheduled_at' | 'interview_meeting_url' | 'onboarding_notes' | 'interview_messages' | 'reviewed_by' | 'reviewed_at'>>
) {
  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(jobApplicationsTabName());
  if (rows.length < 2) return { success: false, error: 'No job applications found' };

  const headers = rows[0];
  const idIdx = headers.indexOf('Application ID');
  const targetApplicationId = normalizeJobApplicationIdentifier(applicationId);
  const rowIndex = rows.findIndex((r, i) => i > 0 && jobApplicationIdsMatch(String(r[idIdx] || ''), targetApplicationId));
  if (rowIndex === -1) return { success: false, error: 'Job application not found' };

  const row = rows[rowIndex];
  const set = (header: string, value?: string) => {
    const index = headers.indexOf(header);
    if (index === -1 || value === undefined) return;
    row[index] = value;
  };

  set('Status', updates.status);
  set('Interview Group', updates.interview_group);
  set('Interview Scheduled At', updates.interview_scheduled_at);
  set('Interview Meeting URL', updates.interview_meeting_url);
  set('Onboarding Notes', updates.onboarding_notes);
  set('Interview Messages', updates.interview_messages);
  set('Reviewed By', updates.reviewed_by);
  set('Reviewed At', updates.reviewed_at);

  const endColumn = columnNumberToName(headers.length);
  const range = `${jobApplicationsTabName()}!A${rowIndex + 1}:${endColumn}${rowIndex + 1}`;

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  }));

  return { success: true };
}

export async function deleteJobApplicationFromSheet(applicationId: string) {
  const client = await getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets not configured' };

  const { sheets, spreadsheetId } = client;
  const rows = await getTabRows(jobApplicationsTabName());
  if (rows.length < 2) return { success: false, error: 'No job applications found' };

  const headers = rows[0];
  const idIdx = headers.indexOf('Application ID');
  if (idIdx === -1) return { success: false, error: 'Application ID column not found' };

  const targetApplicationId = normalizeJobApplicationIdentifier(applicationId);
  const rowIndex = rows.findIndex((row, index) => index > 0 && jobApplicationIdsMatch(String(row[idIdx] || ''), targetApplicationId));
  if (rowIndex === -1) return { success: false, error: 'Job application not found' };

  const row = rows[rowIndex];
  const resumeFileName = String(row[headers.indexOf('Resume File Name')] || '').trim();
  const spreadsheetSheetId = await (async () => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = (spreadsheet.data.sheets || []).find((item) => item.properties?.title === jobApplicationsTabName());
    return sheet?.properties?.sheetId;
  })();

  if (typeof spreadsheetSheetId !== 'number') {
    return { success: false, error: 'Job applications sheet not found' };
  }

  await withRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: spreadsheetSheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  }));

  return { success: true, resumeFileName };
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

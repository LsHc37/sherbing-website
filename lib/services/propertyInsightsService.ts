import { listBookingsFromSheet } from '@/lib/services/googleSheetsService';

type AddressInput = {
  address: string;
  city: string;
  state: string;
  zipCode: string;
};

export type PropertyPricingInsights = {
  source: 'history' | 'none';
  sampleCount: number;
  propertySqft?: number;
  yardSqft?: number;
  lawnWeeklyBasePrice?: number;
  comparableLawnWeeklyPrice?: number;
  comparableMedianYardSqft?: number;
  comparableSampleCount: number;
  streetComparableSampleCount: number;
};

type CacheEntry = {
  expiresAt: number;
  value: PropertyPricingInsights;
};

type ComparableCandidate = {
  weeklyEquivalentPrice: number;
  yardSqft?: number;
  sameStreet: boolean;
};

const INSIGHTS_CACHE_TTL_MS = 10 * 60 * 1000;
const insightsCache = new Map<string, CacheEntry>();

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/[^a-z0-9]/g, '');
}

function extractStreetStem(address: string): string {
  return String(address || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^\s*\d+[a-z]?\s+/i, '')
    .replace(/\b(?:apt|apartment|unit|suite|ste|#)\s*[a-z0-9-]+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePositiveNumber(value?: string): number | null {
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function toAddressKey(input: AddressInput): string {
  return [
    normalizeText(input.address),
    normalizeText(input.city),
    normalizeText(input.state),
    normalizeText(input.zipCode),
  ].join('|');
}

function hasLawnService(serviceField: string): boolean {
  const normalized = String(serviceField || '').toLowerCase();
  if (!normalized) return false;

  return normalized.includes('lawn_mowing') || normalized.includes('lawn mowing');
}

function parseLawnFrequency(serviceDetails?: string): 'weekly' | 'bi_weekly' {
  const normalized = String(serviceDetails || '').toLowerCase();
  if (normalized.includes('bi_weekly') || normalized.includes('bi-weekly') || normalized.includes('bi weekly')) {
    return 'bi_weekly';
  }
  return 'weekly';
}

function isComparableStatus(status?: string): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized !== 'cancelled' && normalized !== 'canceled';
}

function getEmptyInsights(): PropertyPricingInsights {
  return {
    source: 'none',
    sampleCount: 0,
    comparableSampleCount: 0,
    streetComparableSampleCount: 0,
  };
}

export async function getPropertyPricingInsights(input: AddressInput): Promise<PropertyPricingInsights> {
  const key = toAddressKey(input);
  const now = Date.now();
  const cached = insightsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const bookings = await listBookingsFromSheet();
    const targetAddress = normalizeText(input.address);
    const targetCity = normalizeText(input.city);
    const targetState = normalizeText(input.state);
    const targetZip = normalizeText(input.zipCode);
    const targetStreetStem = extractStreetStem(input.address);

    const matches = bookings.filter((booking) => {
      if (!isComparableStatus(booking.status)) return false;

      const bookingAddress = normalizeText(booking.address || '');
      const bookingCity = normalizeText(booking.city || '');
      const bookingState = normalizeText(booking.state || '');
      const bookingZip = normalizeText(booking.zip_code || '');

      return (
        bookingAddress === targetAddress
        && bookingCity === targetCity
        && bookingState === targetState
        && bookingZip === targetZip
      );
    });

    if (!matches.length) {
      const emptyResult = getEmptyInsights();
      insightsCache.set(key, { value: emptyResult, expiresAt: now + INSIGHTS_CACHE_TTL_MS });
      return emptyResult;
    }

    const propertySqftSamples = matches
      .map((booking) => parsePositiveNumber(booking.property_sqft))
      .filter((value): value is number => value !== null);

    const yardSqftSamples = matches
      .map((booking) => parsePositiveNumber(booking.yard_sqft))
      .filter((value): value is number => value !== null);

    const lawnPriceSamples = matches
      .filter((booking) => hasLawnService(booking.service))
      .map((booking) => parsePositiveNumber(booking.customer_price) || parsePositiveNumber(booking.estimated_price))
      .filter((value): value is number => value !== null);

    const lawnComparableCandidates = bookings
      .filter((booking) => {
        if (!isComparableStatus(booking.status)) return false;
        if (!hasLawnService(booking.service)) return false;

        const bookingCity = normalizeText(booking.city || '');
        const bookingState = normalizeText(booking.state || '');
        const bookingZip = normalizeText(booking.zip_code || '');

        return bookingCity === targetCity && bookingState === targetState && bookingZip === targetZip;
      })
      .map((booking): ComparableCandidate | null => {
        const customerPrice = parsePositiveNumber(booking.customer_price) || parsePositiveNumber(booking.estimated_price);
        if (!customerPrice) return null;

        const frequency = parseLawnFrequency(booking.service_details);
        const weeklyEquivalentPrice = frequency === 'bi_weekly'
          ? customerPrice / 1.3
          : customerPrice;

        const candidateStreetStem = extractStreetStem(booking.address || '');
        const sameStreet = candidateStreetStem === targetStreetStem;

        return {
          weeklyEquivalentPrice,
          yardSqft: parsePositiveNumber(booking.yard_sqft) || undefined,
          sameStreet,
        };
      })
      .filter((value): value is ComparableCandidate => Boolean(value));

    const sameStreetComparables = lawnComparableCandidates.filter((candidate) => candidate.sameStreet);
    const selectedComparables = sameStreetComparables.length >= 2
      ? sameStreetComparables
      : lawnComparableCandidates;

    const comparableWeeklyPrices = selectedComparables.map((candidate) => candidate.weeklyEquivalentPrice);
    const comparableYardSqftSamples = selectedComparables
      .map((candidate) => candidate.yardSqft)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

    const result: PropertyPricingInsights = {
      source: 'history',
      sampleCount: matches.length,
      propertySqft: median(propertySqftSamples),
      yardSqft: median(yardSqftSamples),
      lawnWeeklyBasePrice: median(lawnPriceSamples),
      comparableLawnWeeklyPrice: median(comparableWeeklyPrices),
      comparableMedianYardSqft: median(comparableYardSqftSamples),
      comparableSampleCount: selectedComparables.length,
      streetComparableSampleCount: sameStreetComparables.length,
    };

    insightsCache.set(key, { value: result, expiresAt: now + INSIGHTS_CACHE_TTL_MS });
    return result;
  } catch {
    const emptyResult = getEmptyInsights();
    insightsCache.set(key, { value: emptyResult, expiresAt: now + INSIGHTS_CACHE_TTL_MS });
    return emptyResult;
  }
}

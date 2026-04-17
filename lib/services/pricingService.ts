import type {
  BookingForm,
  Service,
  ServiceType,
  PressureWashingScope,
  WindowCleaningScope,
} from '@/lib/types';
import { enforceMinimumCustomerPrice } from '@/lib/services/payoutService';

type WindowCleaningPricingInput = {
  windowCount?: number;
  scope?: WindowCleaningScope;
  screenTrackCount?: number;
};

type PressureWashingPricingInput = {
  scope?: PressureWashingScope;
};

type LawnMowingPricingInput = {
  frequency?: 'weekly' | 'bi_weekly';
  initialOvergrowth?: boolean;
  bagClippings?: boolean;
  heavyPetWaste?: boolean;
  accessBlocked?: boolean;
};

type GutterCleaningPricingInput = {
  storyCount?: number;
};

type EstimateContext = {
  lawnMowing?: LawnMowingPricingInput;
  windowCleaning?: WindowCleaningPricingInput;
  gutterCleaning?: GutterCleaningPricingInput;
  pressureWashing?: PressureWashingPricingInput;
};

type PricingRule = {
  name: string;
  pricePerSqft: number;
  minimumPrice: number;
  maximumPrice?: number;
  areaBasis?: 'yard' | 'property';
  description?: string;
  images?: string[];
};

type PackageRule = {
  id: string;
  name: string;
  discountPercent: number;
};

const LAWN_TARGET_HOURLY_RATE = 45;
const LAWN_BASE_PRODUCTIVITY_SQFT_PER_HOUR = 6200;
const LAWN_MIN_DURATION_MINUTES = 45;

// Boise service area zip codes
export const BOISE_SERVICE_AREA_ZIP_CODES = [
  '83702', '83703', '83704', '83705', '83706', '83707', '83708', '83709',
  '83712', '83714', '83716', '83722', '83724', '83725', '83726', '83728',
  '83713', '83715', '83717', '83719', '83720', '83721', '83723', '83727'
];

// Pricing tuned to your provided target ranges and competitive local defaults.
export const SERVICE_PRICING: Record<string, PricingRule> = {
  lawn_mowing: { 
    name: 'Lawn Mowing', 
    pricePerSqft: 0,
    minimumPrice: 35,
    description: 'Professional lawn cutting priced by mowable grass size, service frequency, and add-ons for overgrowth or special conditions.',
    images: ['/services/lawn-mowing-1.jpg', '/services/lawn-mowing-2.jpg']
  },
  lawn_treatment: { 
    name: 'Lawn Treatment', 
    pricePerSqft: 0.009, 
    minimumPrice: 45, 
    maximumPrice: 75,
    description: 'Fertilization, weed control, and lawn health treatments to keep your grass green and healthy.',
    images: ['/services/lawn-treatment-1.jpg']
  },
  snow_removal: { 
    name: 'Snow Removal', 
    pricePerSqft: 0.015, 
    minimumPrice: 60, 
    maximumPrice: 140,
    description: 'Quick emergency snow removal services for driveways and walkways.',
    images: ['/services/snow-removal-1.jpg']
  },
  gutter_cleaning: { 
    name: 'Gutter Cleaning', 
    pricePerSqft: 0, 
    minimumPrice: 75, 
    description: 'Professional gutter cleaning priced by home size and number of stories.',
    images: ['/services/gutter-cleaning-1.jpg']
  },
  hedge_trimming: { 
    name: 'Hedge Trimming', 
    pricePerSqft: 0, 
    minimumPrice: 20, 
    maximumPrice: 45,
    description: 'Precision hedge and bush trimming for a manicured appearance.',
    images: ['/services/hedge-trimming-1.jpg']
  },
  window_cleaning: { 
    name: 'Window Cleaning', 
    pricePerSqft: 0,
    minimumPrice: 30, 
    description: 'Crystal-clear window cleaning with a trip charge plus per-window pricing for exterior or interior and exterior cleans.',
    images: ['/services/window-cleaning-1.jpg']
  },
  dog_waste_removal: { 
    name: 'Dog Waste Pickup', 
    pricePerSqft: 0, 
    minimumPrice: 20, 
    maximumPrice: 20,
    description: 'Flat-rate dog waste pickup service to keep your yard clean and healthy.',
    images: ['/services/dog-waste-1.jpg']
  },
  pressure_washing: { 
    name: 'Pressure Washing', 
    pricePerSqft: 0,
    minimumPrice: 175,
    maximumPrice: 350,
    description: 'Driveway and walkway pressure washing. Choose driveway, walkway, or both when booking. Driveways: $175-$250. Walkways: $25-$50. We use the customer\'s water supply.',
    images: ['/services/pressure-washing-1.jpg']
  },
};

export const SERVICE_PACKAGES: PackageRule[] = [
  { id: 'starter_bundle', name: 'Starter Bundle (Lawn + Dog Waste)', discountPercent: 8 },
  { id: 'curb_appeal_bundle', name: 'Curb Appeal Bundle (Lawn + Windows)', discountPercent: 10 },
  { id: 'premium_property_bundle', name: 'Premium Property Bundle (Multi-Service)', discountPercent: 12 },
];

function getEstimatedWindowCount(propertySqft: number, yardSqft: number): number {
  const footprint = Math.max(propertySqft, yardSqft, 0);
  if (!footprint) {
    return 12;
  }

  return Math.min(30, Math.max(8, Math.round(footprint / 150)));
}

function getEstimatedMowableGrass(propertySqft: number, yardSqft: number): number {
  const footprint = Math.max(yardSqft, propertySqft, 0);
  if (!footprint) {
    return 5000;
  }

  return footprint;
}

function roundToNearestFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function roundMinutesToNearestFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function getLawnTierBasePrice(mowableGrass: number, isBiWeekly: boolean): number {
  if (mowableGrass < 4000) {
    return isBiWeekly ? 45 : 35;
  }

  if (mowableGrass < 7000) {
    return isBiWeekly ? 55 : 45;
  }

  if (mowableGrass < 10000) {
    return isBiWeekly ? 70 : 55;
  }

  if (mowableGrass < 13000) {
    return isBiWeekly ? 85 : 65;
  }

  const extraSqft = Math.max(0, mowableGrass - 13000);
  const extraBlocks = Math.ceil(extraSqft / 3000);
  const weeklyBase = 65 + (extraBlocks * 10);
  return isBiWeekly ? roundToNearestFive(weeklyBase * 1.3) : weeklyBase;
}

function applyLawnConditionAdjustments(basePrice: number, input: LawnMowingPricingInput = {}): number {
  let adjusted = basePrice;

  if (input.initialOvergrowth) {
    adjusted *= 1.5;
  }

  if (input.bagClippings) {
    adjusted += 10;
  }

  if (input.heavyPetWaste) {
    adjusted += 15;
  }

  if (input.accessBlocked) {
    adjusted = Math.max(adjusted, 35);
  }

  return adjusted;
}

export function estimateLawnMowingDurationMinutes(
  propertySqft: number,
  yardSqft: number,
  input: LawnMowingPricingInput = {}
): number {
  const mowableGrass = getEstimatedMowableGrass(propertySqft, yardSqft);
  let effectiveProductivity = LAWN_BASE_PRODUCTIVITY_SQFT_PER_HOUR;

  if (input.frequency === 'bi_weekly') {
    effectiveProductivity *= 0.82;
  }

  if (input.initialOvergrowth) {
    effectiveProductivity *= 0.62;
  }

  if (input.heavyPetWaste) {
    effectiveProductivity *= 0.9;
  }

  if (input.accessBlocked) {
    effectiveProductivity *= 0.85;
  }

  const mowingMinutes = (mowableGrass / Math.max(effectiveProductivity, 1800)) * 60;
  const setupAndCleanupMinutes = 12;
  const baggingMinutes = input.bagClippings ? 8 : 0;
  const petWasteHandlingMinutes = input.heavyPetWaste ? 10 : 0;
  const accessDelayMinutes = input.accessBlocked ? 8 : 0;

  const rawMinutes = mowingMinutes + setupAndCleanupMinutes + baggingMinutes + petWasteHandlingMinutes + accessDelayMinutes;
  const minDuration = input.initialOvergrowth ? 45 : LAWN_MIN_DURATION_MINUTES;
  return Math.max(minDuration, roundMinutesToNearestFive(rawMinutes));
}

function estimateLawnMowingPrice(
  propertySqft: number,
  yardSqft: number,
  input: LawnMowingPricingInput = {}
): number {
  const mowableGrass = getEstimatedMowableGrass(propertySqft, yardSqft);
  const frequency = input.frequency || 'weekly';
  const isBiWeekly = frequency === 'bi_weekly';

  const tierPrice = applyLawnConditionAdjustments(getLawnTierBasePrice(mowableGrass, isBiWeekly), input);
  const durationMinutes = estimateLawnMowingDurationMinutes(propertySqft, yardSqft, input);
  const laborPrice = (durationMinutes / 60) * LAWN_TARGET_HOURLY_RATE;

  return roundToNearestFive(Math.max(35, tierPrice, laborPrice));
}

function estimateGutterCleaningPrice(
  propertySqft: number,
  yardSqft: number,
  input: GutterCleaningPricingInput = {}
): number {
  const storyCount = Math.max(1, Math.round(input.storyCount || 1));
  const homeSize = Math.max(propertySqft, yardSqft, 0);

  let baseCharge = 0;

  if (homeSize < 1500) {
    baseCharge = storyCount >= 2 ? 130 : 90;
  } else if (homeSize < 2500) {
    baseCharge = storyCount >= 2 ? 180 : 120;
  } else {
    baseCharge = storyCount >= 2 ? 235 : 155;
  }

  return Math.max(baseCharge, 75);
}

function estimatePressureWashingPrice(
  propertySqft: number,
  yardSqft: number,
  input: PressureWashingPricingInput = {}
): number {
  const scope = input.scope || 'both';
  const footprint = Math.max(propertySqft, yardSqft, 0);

  let drivewayPrice = 175;
  let walkwayPrice = 25;

  if (footprint >= 1500) {
    drivewayPrice = 200;
    walkwayPrice = 35;
  }

  if (footprint >= 2500) {
    drivewayPrice = 225;
    walkwayPrice = 40;
  }

  if (footprint >= 3500) {
    drivewayPrice = 250;
    walkwayPrice = 50;
  }

  const combinedPrice = scope === 'driveway'
    ? drivewayPrice
    : scope === 'walkway'
      ? walkwayPrice
      : drivewayPrice + walkwayPrice;

  const scopeAdjustedPrice = scope === 'both' && footprint >= 3500
    ? combinedPrice * 1.15
    : combinedPrice;

  return roundToNearestFive(Math.min(350, scopeAdjustedPrice));
}

export function calculateEstimatePrice(serviceId: string, propertySqft: number, yardSqft: number, context?: EstimateContext): number {
  const pricing = SERVICE_PRICING[serviceId];
  if (!pricing) return 0;

  if (serviceId === 'pressure_washing') {
    return estimatePressureWashingPrice(propertySqft, yardSqft, context?.pressureWashing);
  }

  if (serviceId === 'window_cleaning') {
    const windowCleaning = context?.windowCleaning || {};
    const windowCount = Math.max(0, Math.round(windowCleaning.windowCount || getEstimatedWindowCount(propertySqft, yardSqft)));
    const screenTrackCount = Math.max(0, Math.round(windowCleaning.screenTrackCount || 0));
    const scope = windowCleaning.scope || 'exterior';
    const baseTripCharge = 30;
    const perWindowCharge = scope === 'interior_exterior' ? 8 : 5;

    return baseTripCharge + (windowCount * perWindowCharge) + (screenTrackCount * 2);
  }

  if (serviceId === 'lawn_mowing') {
    return estimateLawnMowingPrice(propertySqft, yardSqft, context?.lawnMowing);
  }

  if (serviceId === 'gutter_cleaning') {
    return estimateGutterCleaningPrice(propertySqft, yardSqft, context?.gutterCleaning);
  }

  const areaToUse = pricing.areaBasis === 'property'
    ? propertySqft
    : (yardSqft > 0 ? yardSqft : propertySqft);
  const calculatedPrice = areaToUse * pricing.pricePerSqft;
  const minAdjusted = Math.max(calculatedPrice, pricing.minimumPrice);

  // Respect optional caps for services with target ranges.
  if (typeof pricing.maximumPrice === 'number') {
    return Math.min(minAdjusted, pricing.maximumPrice);
  }

  return minAdjusted;
}

export function calculateMultiServiceEstimate(
  serviceIds: string[],
  propertySqft: number,
  yardSqft: number,
  packageId?: string,
  context?: EstimateContext
): number {
  if (!serviceIds.length) return 0;

  const subtotal = serviceIds.reduce((sum, serviceId) => {
    return sum + calculateEstimatePrice(serviceId, propertySqft, yardSqft, context);
  }, 0);

  if (!packageId) return enforceMinimumCustomerPrice(subtotal);

  const selectedPackage = SERVICE_PACKAGES.find((pkg) => pkg.id === packageId);
  if (!selectedPackage) return enforceMinimumCustomerPrice(subtotal);

  const discountMultiplier = 1 - selectedPackage.discountPercent / 100;
  return enforceMinimumCustomerPrice(Math.max(subtotal * discountMultiplier, 0));
}

export function getServices(): Service[] {
  return (Object.keys(SERVICE_PRICING) as ServiceType[]).map((key) => {
    const value = SERVICE_PRICING[key];
    return {
      id: key,
      name: value.name,
      type: key,
      description: value.description || `Professional ${value.name.toLowerCase()} services for your property`,
      base_price: value.pricePerSqft,
      minimum_price: value.minimumPrice,
      images: value.images,
    };
  });
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function isServiceAreaValid(zipCode: string): boolean {
  return BOISE_SERVICE_AREA_ZIP_CODES.includes(zipCode.trim());
}

export function isValidScheduleDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const selectedDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);
  
  // Booking must be at least 1 day in the future
  return selectedDate > today;
}

export function isValidScheduleTime(timeString: string): boolean {
  if (!timeString) return false;
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(timeString);
}

export function validateBookingForm(form: Partial<BookingForm>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const selectedServices = form.service_ids || (form.service_id ? [form.service_id] : []);

  if (!selectedServices.length) errors.push('Select at least one service');
  if (!form.address) errors.push('Address is required');
  if (!form.city) errors.push('City is required');
  if (!form.state) errors.push('State is required');
  if (!form.zip_code) errors.push('ZIP code is required');
  else if (!isServiceAreaValid(form.zip_code)) {
    errors.push('We currently only service the Boise area. Please check your ZIP code.');
  }
  if (!form.customer_name) errors.push('Customer name is required');
  if (!form.customer_email && !form.customer_phone) {
    errors.push('Provide at least one contact method: email or phone');
  }
  if (form.customer_email && form.customer_email.trim() && !isValidEmail(form.customer_email)) {
    errors.push('Valid email address is required');
  }
  if (form.customer_phone && form.customer_phone.trim() && !isValidPhoneNumber(form.customer_phone)) {
    errors.push('Valid phone number is required');
  }
  if (form.scheduled_date && !isValidScheduleDate(form.scheduled_date)) {
    errors.push('Service date must be at least 1 day in the future');
  }
  if (form.scheduled_time && !isValidScheduleTime(form.scheduled_time)) {
    errors.push('Please provide a valid time (HH:MM format)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

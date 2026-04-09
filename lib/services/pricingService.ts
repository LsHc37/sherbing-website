import type { BookingForm, Service, ServiceType } from '@/lib/types';
import { enforceMinimumCustomerPrice } from '@/lib/services/payoutService';

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
    pricePerSqft: 0.006, 
    minimumPrice: 35, 
    maximumPrice: 40,
    description: 'Professional lawn cutting with edge trimming and cleanup. Weekly or bi-weekly service available.',
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
  landscaping: { 
    name: 'Landscaping Design', 
    pricePerSqft: 0.08, 
    minimumPrice: 150,
    description: 'Custom landscape design and installation to transform your outdoor space.',
    images: ['/services/landscaping-1.jpg', '/services/landscaping-2.jpg']
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
    minimumPrice: 100, 
    maximumPrice: 100,
    description: 'Professional gutter cleaning to prevent water damage and keep drainage flowing.',
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
    pricePerSqft: 0.03, 
    minimumPrice: 30, 
    maximumPrice: 120, 
    areaBasis: 'property',
    description: 'Crystal-clear window cleaning inside and out for sparkling results.',
    images: ['/services/window-cleaning-1.jpg']
  },
  yard_cleanup: { 
    name: 'Yard Cleanup', 
    pricePerSqft: 0.02, 
    minimumPrice: 90,
    description: 'Spring and fall yard cleanup including leaf removal and debris hauling.',
    images: ['/services/yard-cleanup-1.jpg']
  },
  tree_service: { 
    name: 'Tree Service', 
    pricePerSqft: 0.03, 
    minimumPrice: 180,
    description: 'Professional tree trimming, removal, and stump grinding services.',
    images: ['/services/tree-service-1.jpg', '/services/tree-service-2.jpg']
  },
  deck_staining: { 
    name: 'Deck Staining', 
    pricePerSqft: 0.03, 
    minimumPrice: 160,
    description: 'Professional deck staining and sealing to protect and beautify your deck.',
    images: ['/services/deck-staining-1.jpg', '/services/deck-staining-2.jpg']
  },
  fence_painting: { 
    name: 'Fence Painting', 
    pricePerSqft: 0.03, 
    minimumPrice: 150,
    description: 'Quality fence painting to refresh and protect your fence investment.',
    images: ['/services/fence-painting-1.jpg']
  },
  fence_staining: { 
    name: 'Fence Staining', 
    pricePerSqft: 0.035, 
    minimumPrice: 175,
    description: 'Professional fence staining to enhance natural look and longevity.',
    images: ['/services/fence-staining-1.jpg']
  },
  mulch_installation: { 
    name: 'Mulch Installation', 
    pricePerSqft: 0.025, 
    minimumPrice: 120,
    description: 'Quality mulch installation for landscaping beds and erosion control.',
    images: ['/services/mulch-installation-1.jpg']
  },
  rock_installation: { 
    name: 'Rock Installation', 
    pricePerSqft: 0.03, 
    minimumPrice: 150,
    description: 'Decorative rock installation for landscaping and hardscaping projects.',
    images: ['/services/rock-installation-1.jpg']
  },
  dog_waste_removal: { 
    name: 'Dog Waste Pickup', 
    pricePerSqft: 0.002, 
    minimumPrice: 10, 
    maximumPrice: 15,
    description: 'Weekly dog waste removal service to keep your yard clean and healthy.',
    images: ['/services/dog-waste-1.jpg']
  },
  lawn_mow_dog_waste_combo: { 
    name: 'Lawn Mow + Dog Waste Combo', 
    pricePerSqft: 0.0065, 
    minimumPrice: 40, 
    maximumPrice: 45,
    description: 'Combined lawn mowing and dog waste removal service at a discount.',
    images: ['/services/combo-service-1.jpg']
  },
  pool_cleaning: { 
    name: 'Pool Cleaning', 
    pricePerSqft: 0, 
    minimumPrice: 80, 
    maximumPrice: 120,
    description: 'Professional pool cleaning and maintenance to keep your pool crystal clear.',
    images: ['/services/pool-cleaning-1.jpg']
  },
};

export const SERVICE_PACKAGES: PackageRule[] = [
  { id: 'starter_bundle', name: 'Starter Bundle (Mow + Cleanup)', discountPercent: 8 },
  { id: 'curb_appeal_bundle', name: 'Curb Appeal Bundle', discountPercent: 10 },
  { id: 'premium_property_bundle', name: 'Premium Property Bundle', discountPercent: 12 },
];

export function calculateEstimatePrice(serviceId: string, propertySqft: number, yardSqft: number): number {
  const pricing = SERVICE_PRICING[serviceId];
  if (!pricing) return 0;

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
  packageId?: string
): number {
  if (!serviceIds.length) return 0;

  const subtotal = serviceIds.reduce((sum, serviceId) => {
    return sum + calculateEstimatePrice(serviceId, propertySqft, yardSqft);
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

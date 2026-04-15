// Types for Sherbing Booking System

export type ServiceType = 
  | 'lawn_mowing'
  | 'lawn_treatment'
  | 'snow_removal'
  | 'gutter_cleaning'
  | 'hedge_trimming'
  | 'window_cleaning'
  | 'dog_waste_removal';

export type WindowCleaningScope = 'exterior' | 'interior_exterior';

export type LawnMowingFrequency = 'weekly' | 'bi_weekly';

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  description: string;
  base_price: number; // per square foot
  minimum_price: number;
  images?: string[]; // URLs to service photos
  rating?: number; // Average rating 0-5
  reviewCount?: number; // Number of reviews
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: 'customer' | 'employee' | 'admin';
  managed_groups?: string[];
  email_verified: boolean;
  email_verification_code?: string; // Temp code sent via email
  email_verification_expires?: string; // ISO timestamp, usually +10 min from now
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  service_id?: string;
  service_ids?: string[];
  package_id?: string;
  window_count?: number;
  window_scope?: WindowCleaningScope;
  window_screen_track_count?: number;
  lawn_mowing_frequency?: LawnMowingFrequency;
  lawn_initial_overgrowth?: boolean;
  lawn_bag_clippings?: boolean;
  lawn_heavy_pet_waste?: boolean;
  lawn_access_blocked?: boolean;
  gutter_story_count?: number;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_sqft?: number;
  yard_sqft?: number;
  estimated_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  scheduled_date?: string;
  scheduled_time?: string; // HH:MM format like "09:00" or "14:30"
  scheduled_duration_minutes?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  reminder_sent?: boolean;
}

export interface BookingForm {
  service_id?: string;
  service_ids?: string[];
  package_id?: string;
  service_details?: string;
  window_count?: string;
  window_scope?: WindowCleaningScope;
  window_screen_track_count?: string;
  lawn_mowing_frequency?: LawnMowingFrequency;
  lawn_initial_overgrowth?: 'yes' | 'no';
  lawn_bag_clippings?: 'yes' | 'no';
  lawn_heavy_pet_waste?: 'yes' | 'no';
  lawn_access_blocked?: 'yes' | 'no';
  gutter_story_count?: '1' | '2';
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_sqft?: number;
  yard_sqft?: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_duration_minutes?: number;
  notes?: string;
}

export interface Review {
  id: string;
  booking_id: string;
  customer_id: string;
  service_id: string;
  rating: number; // 1-5 stars
  title: string;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
}

export type JobApplicationStatus = 'new' | 'reviewing' | 'interview' | 'onboarding' | 'hired' | 'rejected';

export interface JobApplicationMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_role: 'employee' | 'admin';
  created_at: string;
  body: string;
}

export interface JobApplication {
  id: string;
  created_at: string;
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
  status: JobApplicationStatus;
  interview_group?: string;
  interview_scheduled_at?: string;
  interview_meeting_url?: string;
  onboarding_notes?: string;
  messages?: JobApplicationMessage[];
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface BookingUpdate {
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_duration_minutes?: number;
  notes?: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  cancellation_reason?: string;
  customer_email?: string;
  customer_phone?: string;
}

export interface Employee {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  hourly_rate: number;
  hire_date: string;
  status: 'active' | 'inactive';
}

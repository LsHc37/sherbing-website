// Types for Sherbing Booking System

export type ServiceType = 
  | 'lawn_mowing'
  | 'lawn_treatment'
  | 'snow_removal'
  | 'gutter_cleaning'
  | 'hedge_trimming'
  | 'window_cleaning'
  | 'dog_waste_removal';

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

export interface BookingUpdate {
  scheduled_date?: string;
  scheduled_time?: string;
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

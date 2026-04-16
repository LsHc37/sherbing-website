import { Suspense } from 'react';
import SpecialBookingContent from './special-booking-content';

function SpecialBookingLoading() {
  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto surface-card p-6 sm:p-8">
        <div className="h-10 bg-slate-200 rounded animate-pulse mb-4"></div>
        <div className="h-6 bg-slate-200 rounded animate-pulse mb-8"></div>
      </div>
    </main>
  );
}

export default function SpecialBookingPage() {
  return (
    <Suspense fallback={<SpecialBookingLoading />}>
      <SpecialBookingContent />
    </Suspense>
  );
}
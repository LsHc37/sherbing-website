'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const BANNER_STORAGE_KEY = 'sherbing-summer-special-banner-dismissed';

export default function SitePromotionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      try {
        const bannerDismissed = window.localStorage.getItem(BANNER_STORAGE_KEY) === 'true';
        setShowBanner(!bannerDismissed);
      } catch {
        setShowBanner(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(initTimer);
    };
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      window.localStorage.setItem(BANNER_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures.
    }
  };

  const dismissPopup = () => {
    setShowPopup(false);
  };

  return (
    <>
      {showBanner && (
        <div className="sticky top-0 z-[60] border-b border-amber-200 bg-gradient-to-r from-amber-100 via-lime-100 to-emerald-100 text-slate-900 shadow-sm">
          <div className="section-container flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-0">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                Summer Special
              </span>
              <div>
                <p className="font-semibold leading-6">Premium Summer Cleanup: $200 (For standard residential lots up to 1/4 acre).</p>
                <p className="text-sm text-slate-700">
                  Normal full-price cleanup jobs are usually around $350. This special includes dog poop pickup, lawn mowing, weed whacking, hedge trimming, and gutter cleaning for one flat price.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:self-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowPopup(true)}
                className="btn-secondary justify-center whitespace-nowrap px-4 py-2 text-sm"
              >
                View Details
              </button>
              <Link href="/special-booking" className="btn-primary justify-center whitespace-nowrap px-4 py-2 text-sm">
                Claim Special Now
              </Link>
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                aria-label="Dismiss summer special banner"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-4">
          <div className="surface-card relative w-full max-w-2xl overflow-hidden border-amber-200 bg-white max-h-[90vh] overflow-y-auto">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-lime-400 to-emerald-500" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-900">
                    Limited Time Offer
                  </p>
                  <h2 className="mt-4 text-3xl font-bold text-slate-950">Premium Summer Cleanup: $200 (For standard residential lots up to 1/4 acre).</h2>
                </div>
                <button
                  type="button"
                  onClick={dismissPopup}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  aria-label="Close summer special popup"
                >
                  ×
                </button>
              </div>

              <p className="mt-4 text-base leading-7 text-slate-700">
                One flat price covers the package for standard residential lots up to 1/4 acre. Normal cleanup jobs are usually around $350, so this is a strong seasonal discount: dog poop pickup, lawn mowing, weed whacking, hedge trimming, and gutter cleaning.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  'Flat $200 price',
                  'Standard lots up to 1/4 acre',
                  'Dog poop pickup included',
                  'Lawn mowing included',
                  'Weed whacking included',
                  'Hedge trimming included',
                  'Gutter cleaning included',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>

              <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                Severely overgrown hedges or larger properties may require a custom quote upon arrival. We are not responsible for damage to hidden sprinkler heads, unmarked landscape lighting, or toys left in the tall grass.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/special-booking" className="btn-primary justify-center px-5 py-3">
                  Claim This Deal
                </Link>
                <button
                  type="button"
                  onClick={dismissPopup}
                  className="btn-secondary justify-center px-5 py-3"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
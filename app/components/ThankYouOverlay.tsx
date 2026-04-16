'use client';

type ThankYouOverlayProps = {
  open: boolean;
  title: string;
  message: string;
};

export default function ThankYouOverlay({ open, title, message }: ThankYouOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="surface-card w-full max-w-md border-emerald-200 bg-white p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-2xl font-bold">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{message}</p>
        <p className="mt-4 text-xs text-slate-500">Taking you back home now...</p>
      </div>
    </div>
  );
}
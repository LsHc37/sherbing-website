'use client';

import Link from 'next/link';
import Script from 'next/script';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type SessionUser = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
};

type BareMuxConnection = {
  getTransport: () => Promise<string>;
  setTransport: (transport: string, config: Array<{ wisp: string }>) => Promise<void>;
};

type UVConfig = {
  prefix: string;
  encodeUrl: (value: string) => string;
  sw: string;
};

declare global {
  interface Window {
    BareMux?: {
      BareMuxConnection: new (workerPath: string) => BareMuxConnection;
    };
    __uv$config?: UVConfig;
  }
}

const HOME_URL = 'https://www.google.com';

function normalizeAddress(input: string) {
  const value = input.trim();
  if (!value) {
    throw new Error('Enter a website or search term.');
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
  const candidate = hasScheme ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.includes('.')) {
      return parsed.toString();
    }
  } catch {
    // Treat invalid URLs as search queries.
  }

  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export default function AdminBrowserPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(HOME_URL);
  const [status, setStatus] = useState('Ready.');
  const [statusIsError, setStatusIsError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const connectionRef = useRef<BareMuxConnection | null>(null);

  const browserUrl = useMemo(() => {
    if (typeof window === 'undefined' || !window.__uv$config) {
      return '';
    }

    return `${window.__uv$config.prefix}${window.__uv$config.encodeUrl(address)}`;
  }, [address]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        window.location.href = '/admin/login';
        return;
      }

      const payload = await response.json();
      const sessionUser = payload?.user as SessionUser | undefined;
      if (!sessionUser || sessionUser.role !== 'admin') {
        window.location.href = '/employee/dashboard';
        return;
      }

      setUser(sessionUser);
      setLoading(false);
    };

    void load();
  }, []);

  useEffect(() => {
    const setup = async () => {
      if (!window.__uv$config) return;
      if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

      await navigator.serviceWorker.register(window.__uv$config.sw, {
        scope: window.__uv$config.prefix,
      });
    };

    void setup();
  }, []);

  useEffect(() => {
    const setupTransport = async () => {
      if (!window.BareMux) return;
      if (connectionRef.current) return;

      connectionRef.current = new window.BareMux.BareMuxConnection('/baremux/worker.js');
      const wispUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/wisp/`;

      if ((await connectionRef.current.getTransport()) !== '/epoxy/index.mjs') {
        await connectionRef.current.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
      }
    };

    void setupTransport();
  }, []);

  const openBrowser = async (input: string) => {
    try {
      const normalizedUrl = normalizeAddress(input);
      setAddress(normalizedUrl);
      setStatus(`Loaded ${normalizedUrl}`);
      setStatusIsError(false);

      await connectionRef.current?.getTransport();
      if (iframeRef.current && window.__uv$config) {
        iframeRef.current.src = `${window.__uv$config.prefix}${window.__uv$config.encodeUrl(normalizedUrl)}`;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load browser page.');
      setStatusIsError(true);
    }
  };

  useEffect(() => {
    if (loading) return;
    void openBrowser(HOME_URL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await openBrowser(address);
  };

  const handleReload = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
      setStatus('Reloaded current page.');
      setStatusIsError(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-2xl border border-white/20 border-t-white animate-spin" />
          <p className="text-sm text-slate-300">Loading browser...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.15),_transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white px-4 py-4 sm:px-6 lg:px-8">
      <Script src="/baremux/index.js" strategy="afterInteractive" />
      <Script src="/uv/uv.bundle.js" strategy="afterInteractive" />
      <Script src="/uv/uv.config.js" strategy="afterInteractive" />

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4">
        <header className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                Restricted Browser
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sherbing Admin Browser</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Admin-only browser dashboard with automatic https prepending, Ultraviolet XOR encoding, and full viewport browsing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/admin" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10">
                Admin Home
              </Link>
              <Link href="/admin/users" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10">
                Users
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-5">
          <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <label className="sr-only" htmlFor="admin-browser-address">
              Website address
            </label>
            <input
              id="admin-browser-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Enter a URL or search term"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
            />
            <button
              type="button"
              onClick={() => void openBrowser(HOME_URL)}
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Home
            </button>
            <button
              type="submit"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Open
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={statusIsError ? 'text-sm text-rose-300' : 'text-sm text-emerald-300'}>{status}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => void openBrowser(address)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Refresh URL
              </button>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-slate-950/40">
          <iframe
            ref={iframeRef}
            title="Sherbing admin browser"
            src={browserUrl}
            className="h-full w-full border-0 bg-white"
          />
        </section>
      </div>
    </main>
  );
}

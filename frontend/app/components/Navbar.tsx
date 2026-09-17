'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, isAdmin, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-slate-200 border-t-4 border-t-blue-900 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-900 text-white rounded flex items-center justify-center font-bold text-xs shadow-xs">
              IR
            </div>
            <span className="text-base font-bold text-slate-800 tracking-tight">
              Railway Reservation System
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-5">
            {!isAdmin && (
              <>
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-700 hover:text-blue-900 transition-colors uppercase tracking-wider"
                >
                  Search Trains
                </Link>
                <Link
                  href="/pnr"
                  className="text-xs font-semibold text-slate-700 hover:text-blue-900 transition-colors uppercase tracking-wider"
                >
                  PNR Status
                </Link>
              </>
            )}

            {user && !isAdmin && (
              <Link
                href="/bookings"
                className="text-xs font-semibold text-slate-700 hover:text-blue-900 transition-colors uppercase tracking-wider"
              >
                My Bookings
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors uppercase tracking-wider"
              >
                Admin Panel
              </Link>
            )}
          </div>

          {/* Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="w-5 h-5 spinner" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  {user.name} {isAdmin && <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded ml-1 font-bold border border-amber-200">ADMIN</span>}
                </span>
                <button onClick={logout} className="btn-secondary text-xs !py-1 !px-2.5">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-secondary text-xs !py-1 !px-3">
                  Login
                </Link>
                <Link href="/register" className="btn-primary text-xs !py-1 !px-3">
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-slate-200">
            <div className="flex flex-col gap-2">
              {!isAdmin && (
                <>
                  <Link href="/" className="text-xs font-semibold text-slate-700 hover:text-slate-900 py-1" onClick={() => setMobileOpen(false)}>
                    SEARCH TRAINS
                  </Link>
                  <Link href="/pnr" className="text-xs font-semibold text-slate-700 hover:text-slate-900 py-1" onClick={() => setMobileOpen(false)}>
                    PNR STATUS
                  </Link>
                </>
              )}
              {user && !isAdmin && (
                <Link href="/bookings" className="text-xs font-semibold text-slate-700 hover:text-slate-900 py-1" onClick={() => setMobileOpen(false)}>
                  MY BOOKINGS
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="text-xs font-bold text-blue-900 py-1" onClick={() => setMobileOpen(false)}>
                  ADMIN PANEL
                </Link>
              )}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                {user ? (
                  <>
                    <span className="text-xs text-slate-700">{user.name}</span>
                    <button onClick={() => { logout(); setMobileOpen(false); }} className="text-xs text-red-600 font-semibold">
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 w-full">
                    <Link href="/login" className="btn-secondary text-xs flex-1 text-center" onClick={() => setMobileOpen(false)}>Login</Link>
                    <Link href="/register" className="btn-primary text-xs flex-1 text-center" onClick={() => setMobileOpen(false)}>Register</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

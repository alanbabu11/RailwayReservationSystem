'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { bookingAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Passenger {
  id: number;
  name: string;
  age: number;
  gender: string;
  berth_preference: string;
  seat_number?: number;
  status: string;
}

interface BookingDetails {
  id: number;
  pnr: string;
  schedule_date: string;
  train_number: string;
  train_name: string;
  from_station_name: string;
  from_station_code: string;
  to_station_name: string;
  to_station_code: string;
  coach_class: string;
  booking_type: string;
  total_fare: string;
  status: string;
  created_at: string;
  passengers: Passenger[];
}

function PNRSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const initialPNR = searchParams.get('pnr') || '';

  const [pnrInput, setPnrInput] = useState(initialPNR);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      router.push('/admin');
      return;
    }
    if (initialPNR) {
      handleSearchPNR(initialPNR);
    }
  }, [initialPNR, isAdmin, router]);

  const handleSearchPNR = async (pnrToSearch: string) => {
    const targetPNR = pnrToSearch.trim();
    if (!targetPNR) return;

    setLoading(true);
    setError('');
    setBooking(null);
    setSearched(true);

    try {
      const data = await bookingAPI.getPNR(targetPNR);
      setBooking(data.booking);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch PNR status');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearchPNR(pnrInput);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">PNR Status Enquiry</h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Enter your 10-character PNR number to check current booking status
        </p>
      </div>

      <form onSubmit={onSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            required
            maxLength={10}
            value={pnrInput}
            onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
            placeholder="Enter PNR (e.g. PNR1234567)"
            className="input-field text-sm font-mono flex-1"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-xs !py-2 !px-6"
          >
            {loading ? 'Searching...' : 'Check Status'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3 mb-4 text-center">
          {error}
        </div>
      )}

      {searched && !loading && booking && (
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  PNR: {booking.pnr}
                </span>
                <span
                  className={`badge ${
                    booking.status === 'confirmed'
                      ? 'badge-confirmed'
                      : booking.status === 'cancelled'
                      ? 'badge-cancelled'
                      : 'badge-waitlisted'
                  }`}
                >
                  {booking.status}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {booking.booking_type}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800 mt-2">
                {booking.train_number} - {booking.train_name}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900">₹{booking.total_fare}</div>
              <div className="text-xs text-slate-500">Class: {booking.coach_class}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">From:</span>
              <span className="font-semibold text-slate-800">
                {booking.from_station_name} ({booking.from_station_code})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">To:</span>
              <span className="font-semibold text-slate-800">
                {booking.to_station_name} ({booking.to_station_code})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Date of Journey:</span>
              <span className="font-semibold text-slate-800">
                {new Date(booking.schedule_date).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Passenger Details
            </h3>
            <div className="space-y-2">
              {booking.passengers?.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-slate-50 border border-slate-200 p-2.5 rounded flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-800">{idx + 1}. {p.name}</span>
                    <span className="text-slate-500 ml-2">
                      ({p.age} yrs, {p.gender})
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`badge text-[10px] ${
                        p.status === 'confirmed'
                          ? 'badge-confirmed'
                          : p.status === 'cancelled'
                          ? 'badge-cancelled'
                          : 'badge-waitlisted'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.seat_number && (
                      <span className="text-[11px] text-slate-600 ml-2 font-mono">
                        Seat #{p.seat_number}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PNRPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-xs text-slate-600">Loading PNR...</div>}>
      <PNRSearchContent />
    </Suspense>
  );
}

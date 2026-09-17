'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bookingAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Passenger {
  id: number;
  name: string;
  age: number;
  gender: string;
  berth_preference: string;
  seat_id: number | null;
  seat_number?: number;
  status: string;
}

interface Booking {
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

export default function BookingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) {
      router.push('/admin');
      return;
    }
    if (user) {
      fetchBookings();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, isAdmin, authLoading, router]);

  const fetchBookings = async () => {
    try {
      const data = await bookingAPI.getMyBookings();
      setBookings(data.bookings || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch bookings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setCancellingId(id);
    try {
      await bookingAPI.cancel(id);
      await fetchBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="text-center py-16 text-sm text-slate-600">
        Loading your bookings...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-md text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Authentication Required</h2>
        <p className="text-xs text-slate-600 mb-4">Please log in to view your bookings.</p>
        <Link href="/login" className="btn-primary text-xs inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Bookings</h1>
          <p className="text-xs text-slate-600">View ticket details or process cancellations</p>
        </div>
        <Link href="/" className="btn-primary text-xs">
          + Book New Ticket
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded mb-4">
          {error}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-md p-8 text-center">
          <h3 className="text-base font-bold text-slate-800 mb-1">No Bookings Found</h3>
          <p className="text-xs text-slate-600 mb-4">You have not booked any tickets yet.</p>
          <Link href="/" className="btn-primary text-xs inline-block">
            Search Trains
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white border border-slate-200 rounded-md p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3">
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
                  <h3 className="text-base font-bold text-slate-800 mt-2">
                    {booking.train_number} - {booking.train_name}
                  </h3>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">₹{booking.total_fare}</div>
                  <div className="text-xs text-slate-500">Class: {booking.coach_class}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Route:</span>
                  <span className="font-semibold text-slate-800">
                    {booking.from_station_name} ({booking.from_station_code}) → {booking.to_station_name} ({booking.to_station_code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Journey Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(booking.schedule_date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Booked Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(booking.created_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Passengers ({booking.passengers?.length || 0}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {booking.passengers?.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-50 border border-slate-200 p-2 rounded flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-slate-500 text-[11px]">
                          {p.age} yrs • {p.gender}
                        </div>
                      </div>
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
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <Link
                  href={`/pnr?pnr=${booking.pnr}`}
                  className="text-xs text-blue-700 font-medium hover:underline"
                >
                  View PNR Status →
                </Link>

                {booking.status !== 'cancelled' && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancellingId === booking.id}
                    className="btn-danger text-xs !py-1 !px-3"
                  >
                    {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

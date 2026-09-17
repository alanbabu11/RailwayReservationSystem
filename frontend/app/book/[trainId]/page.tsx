'use client';

import { useState, useEffect, Suspense, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trainAPI, bookingAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PaymentModal from '../../components/PaymentModal';

interface TrainDetails {
  id: number;
  train_number: string;
  name: string;
  train_type: string;
  departure_time: string;
  arrival_time: string;
  base_fare: string;
  source_code: string;
  source_name: string;
  dest_code: string;
  dest_name: string;
}

interface Passenger {
  name: string;
  age: string;
  gender: string;
  berth_preference: string;
}

function BookingContent({ params }: { params: { trainId: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const scheduleId = searchParams.get('schedule_id') || '';
  const coachClass = searchParams.get('class') || 'SL';
  const quota = searchParams.get('quota') || 'general';
  const date = searchParams.get('date') || '';

  const [train, setTrain] = useState<TrainDetails | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: '', age: '', gender: 'male', berth_preference: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push(`/login?redirect=/book/${params.trainId}?schedule_id=${scheduleId}&class=${coachClass}&quota=${quota}&date=${date}`);
      return;
    }
    if (isAdmin) {
      router.push('/admin');
      return;
    }
    trainAPI.getById(parseInt(params.trainId))
      .then(data => setTrain(data.train))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.trainId, user, isAdmin, router, scheduleId, coachClass, quota, date]);

  const addPassenger = () => {
    if (passengers.length >= 6) return;
    setPassengers([...passengers, { name: '', age: '', gender: 'male', berth_preference: '' }]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const classMultipliers: Record<string, number> = { 'SL': 1, '3A': 1.8, '2A': 2.5, '1A': 3.5 };
  const baseFare = train ? parseFloat(train.base_fare) : 0;
  const multiplier = classMultipliers[coachClass] || 1;
  let farePerPassenger = baseFare * multiplier;
  if (quota === 'tatkal') farePerPassenger *= 1.3;
  const totalFare = Math.round(farePerPassenger * passengers.length);

  const formatTime = (time: string) => time?.substring(0, 5) || '';

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    for (const p of passengers) {
      if (!p.name || !p.age || !p.gender) {
        setError('Please fill all passenger details');
        return;
      }
      if (parseInt(p.age) < 1 || parseInt(p.age) > 120) {
        setError('Please enter a valid age');
        return;
      }
    }

    setError('');
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentData: { payment_method: string; transaction_id: string }) => {
    setShowPaymentModal(false);
    setBooking(true);

    try {
      const data = await bookingAPI.create({
        schedule_id: parseInt(scheduleId),
        coach_class: coachClass,
        booking_type: quota,
        payment_method: paymentData.payment_method,
        transaction_id: paymentData.transaction_id,
        passengers: passengers.map(p => ({
          name: p.name,
          age: parseInt(p.age),
          gender: p.gender,
          berth_preference: p.berth_preference || undefined,
        })),
      });
      setResult(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Booking failed';
      setError(errorMessage);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-sm text-slate-600">
        Loading train details...
      </div>
    );
  }

  // Booking confirmation view
  if (result) {
    const bookingData = result.booking as Record<string, unknown>;
    const passengersData = result.passengers as Array<Record<string, unknown>>;
    const fareBreakdown = result.fare_breakdown as Record<string, unknown>;
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white border border-slate-200 rounded-md p-6 shadow-sm">
          <div className="mb-4 pb-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800">
              Booking {bookingData.status === 'confirmed' ? 'Successful' : 'Waitlisted'}
            </h2>
            <p className="text-xs text-slate-600 mt-1">Ticket reservation details are given below.</p>
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 text-xs">PNR Number:</span>
              <span className="font-mono font-bold text-slate-900">{String(bookingData.pnr)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 text-xs">Train:</span>
              <span className="font-medium text-slate-800">{String(bookingData.train_name)} ({String(bookingData.train_number)})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 text-xs">Date of Journey:</span>
              <span className="font-medium text-slate-800">{String(bookingData.journey_date)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 text-xs">Class / Quota:</span>
              <span className="font-medium text-slate-800">{String(bookingData.coach_class)} ({String(bookingData.booking_type)})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 text-xs">Overall Status:</span>
              <span className={`badge ${bookingData.status === 'confirmed' ? 'badge-confirmed' : 'badge-waitlisted'}`}>
                {String(bookingData.status)}
              </span>
            </div>
            
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 block mb-2">Passenger Information:</span>
              <div className="space-y-1.5">
                {passengersData.map((p: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex justify-between text-xs bg-slate-50 p-2 rounded border border-slate-200">
                    <span>{i + 1}. {String(p.name)} ({String(p.age)}/{(String(p.gender) || '')[0]?.toUpperCase()})</span>
                    <span className={`badge text-[10px] ${p.status === 'confirmed' ? 'badge-confirmed' : 'badge-waitlisted'}`}>
                      {p.status === 'confirmed'
                        ? `Seat ${p.seat_id || 'Allocated'}`
                        : `WL ${p.waitlist_number}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded text-xs space-y-1 mt-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-slate-800">{String(bookingData.transaction_id || 'N/A')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount Paid:</span>
                <span className="font-bold text-slate-900">₹{String(fareBreakdown.total_fare)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-slate-200">
            <Link href="/bookings" className="btn-primary text-xs">View My Bookings</Link>
            <Link href="/" className="btn-secondary text-xs">Book Another Ticket</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!train) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600 text-sm">{error || 'Train not found'}</p>
        <Link href="/" className="btn-secondary text-xs mt-3 inline-block">Go Back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href={`/search?from=${train.source_code}&to=${train.dest_code}&date=${date}&quota=${quota}`} className="text-xs text-blue-700 hover:underline mb-3 inline-block">
        ← Back to Results
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-1">Passenger Details</h1>
      <p className="text-xs text-slate-600 mb-6">Enter details for passengers travelling on this ticket</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleBookSubmit} className="space-y-4">
            {passengers.map((p, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-700">Passenger {i + 1}</h3>
                  {passengers.length > 1 && (
                    <button type="button" onClick={() => removePassenger(i)} className="text-red-600 text-xs hover:underline">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => updatePassenger(i, 'name', e.target.value)}
                      placeholder="Passenger Name"
                      className="input-field text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={p.age}
                      onChange={e => updatePassenger(i, 'age', e.target.value)}
                      placeholder="Age"
                      min="1"
                      max="120"
                      className="input-field text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                    <select
                      value={p.gender}
                      onChange={e => updatePassenger(i, 'gender', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Berth Preference</label>
                    <select
                      value={p.berth_preference}
                      onChange={e => updatePassenger(i, 'berth_preference', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">No Preference</option>
                      <option value="lower">Lower</option>
                      <option value="middle">Middle</option>
                      <option value="upper">Upper</option>
                      <option value="side-lower">Side Lower</option>
                      <option value="side-upper">Side Upper</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {passengers.length < 6 && (
              <button type="button" onClick={addPassenger} className="btn-secondary text-xs w-full py-2">
                + Add Another Passenger ({passengers.length}/6)
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={booking}
              className="btn-primary w-full text-sm py-2.5 font-medium"
            >
              {booking ? 'Processing...' : `Proceed to Payment — ₹${totalFare}`}
            </button>
          </form>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
              Fare Summary
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Train:</span>
                <span className="font-semibold text-slate-800">{train.name} ({train.train_number})</span>
              </div>
              <div className="flex justify-between">
                <span>Route:</span>
                <span className="font-medium text-slate-800">{train.source_code} → {train.dest_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium text-slate-800">{date}</span>
              </div>
              <div className="flex justify-between">
                <span>Class / Quota:</span>
                <span className="font-medium text-slate-800">{coachClass} / {quota}</span>
              </div>
              <div className="flex justify-between">
                <span>Passengers:</span>
                <span className="font-medium text-slate-800">{passengers.length}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                <span>Total Amount:</span>
                <span>₹{totalFare}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        amount={totalFare}
        trainName={train.name}
        passengersCount={passengers.length}
        coachClass={coachClass}
      />
    </div>
  );
}

export default function BookingPage({ params }: { params: Promise<{ trainId: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={
      <div className="text-center py-16 text-sm text-slate-600">
        Loading...
      </div>
    }>
      <BookingContent params={resolvedParams} />
    </Suspense>
  );
}

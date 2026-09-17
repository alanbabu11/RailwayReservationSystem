'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trainAPI } from '../lib/api';

interface TrainResult {
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
  schedule_id: number;
  journey_date: string;
  availability: Record<string, { total: number; available: number; waitlisted: number }>;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || '';
  const quota = searchParams.get('quota') || 'general';

  const [trains, setTrains] = useState<TrainResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (from && to && date) {
      setLoading(true);
      trainAPI.search(from, to, date)
        .then(data => { setTrains(data.trains); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [from, to, date]);

  const formatTime = (time: string) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  const getClassFare = (baseFare: string, cls: string) => {
    const multipliers: Record<string, number> = { 'SL': 1, '3A': 1.8, '2A': 2.5, '1A': 3.5 };
    let fare = parseFloat(baseFare) * (multipliers[cls] || 1);
    if (quota === 'tatkal') fare *= 1.3;
    return Math.round(fare);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <Link href="/" className="text-xs text-blue-700 hover:underline mb-1 inline-block">
            ← Change Search
          </Link>
          <h1 className="text-xl font-bold text-slate-800">
            {from} to {to}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Date: {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {quota === 'tatkal' && <span className="ml-2 badge badge-tatkal">Tatkal</span>}
          </p>
        </div>
        <div className="text-xs text-slate-600 font-medium">
          {trains.length} Train(s) Found
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-sm text-slate-600">
          Searching trains...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded text-sm text-center">
          <p>{error}</p>
          <Link href="/" className="btn-secondary text-xs mt-3 inline-block">Try Again</Link>
        </div>
      )}

      {/* No results */}
      {!loading && !error && trains.length === 0 && (
        <div className="bg-white border border-slate-200 rounded p-8 text-center">
          <h3 className="text-base font-bold text-slate-800 mb-1">No Trains Found</h3>
          <p className="text-xs text-slate-600 mb-4">There are no trains running on this route for the selected date.</p>
          <Link href="/" className="btn-primary text-xs inline-block">Back to Search</Link>
        </div>
      )}

      {/* Train Results */}
      <div className="space-y-4">
        {trains.map((train) => (
          <div
            key={train.id}
            className="bg-white border border-slate-200 rounded-md p-4 shadow-sm"
          >
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Train Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800 text-base">{train.name}</span>
                  <span className="text-xs text-slate-500 font-medium">({train.train_number})</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{train.train_type}</span>
                </div>

                <div className="flex items-center gap-6 mt-3 text-slate-700">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{formatTime(train.departure_time)}</div>
                    <div className="text-xs text-slate-500">{train.source_code}</div>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">→</div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">{formatTime(train.arrival_time)}</div>
                    <div className="text-xs text-slate-500">{train.dest_code}</div>
                  </div>
                </div>
              </div>

              {/* Classes / Availability */}
              <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                {['SL', '3A', '2A', '1A'].map(cls => {
                  const avail = train.availability[cls];
                  if (!avail) return null;

                  const hasSeats = avail.available > 0;
                  return (
                    <Link
                      key={cls}
                      href={`/book/${train.id}?schedule_id=${train.schedule_id}&class=${cls}&quota=${quota}&date=${date}`}
                      className={`border rounded p-2.5 text-center transition-colors ${
                        hasSeats
                          ? 'bg-green-50/50 border-green-300 hover:bg-green-100/50'
                          : 'bg-amber-50/50 border-amber-300 hover:bg-amber-100/50'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-700">{cls}</div>
                      <div className={`text-xs font-bold my-0.5 ${hasSeats ? 'text-green-700' : 'text-amber-700'}`}>
                        {hasSeats ? `AVL ${avail.available}` : `WL ${avail.waitlisted}`}
                      </div>
                      <div className="text-xs text-slate-600 font-medium">₹{getClassFare(train.base_fare, cls)}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-16 text-sm text-slate-600">
        Loading...
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

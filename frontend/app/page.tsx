'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { stationAPI } from './lib/api';

interface Station {
  id: number;
  code: string;
  name: string;
  city: string;
}

export default function HomePage() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [quota, setQuota] = useState('general');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    stationAPI.getAll().then(data => setStations(data.stations)).catch(console.error);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to || !date) return;
    if (from === to) return alert('Source and destination cannot be the same');
    setLoading(true);
    router.push(`/search?from=${from}&to=${to}&date=${date}&quota=${quota}`);
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 6);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  return (
    <div className="py-10 px-4 max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Train Ticket Booking</h1>
        <p className="text-sm text-slate-600 mt-1">Search trains and book seats easily</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-3 mb-4">
          Search Available Trains
        </h2>
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {/* From Station */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                From Station
              </label>
              <select
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="input-field text-sm"
                required
              >
                <option value="">Select Origin</option>
                {stations.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            {/* To Station */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                To Station
              </label>
              <select
                value={to}
                onChange={e => setTo(e.target.value)}
                className="input-field text-sm"
                required
              >
                <option value="">Select Destination</option>
                {stations.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Journey Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={today}
                max={maxDateStr}
                className="input-field text-sm"
                required
              />
            </div>

            {/* Quota */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quota
              </label>
              <select
                value={quota}
                onChange={e => setQuota(e.target.value)}
                className="input-field text-sm"
              >
                <option value="general">General</option>
                <option value="tatkal">Tatkal</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !from || !to || !date}
              className="btn-primary text-sm font-medium flex items-center gap-2"
            >
              {loading ? 'Searching...' : 'Search Trains'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

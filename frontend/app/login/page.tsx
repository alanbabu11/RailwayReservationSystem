'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillAdmin = () => {
    setEmail('admin@railway.com');
    setPassword('Admin@123');
  };

  return (
    <div className="py-12 px-4 max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-md p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">User Login</h1>
        <p className="text-sm text-slate-600 mb-6">Enter your credentials to access your account</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-sm py-2"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center space-y-2">
          <button
            onClick={fillAdmin}
            type="button"
            className="text-xs text-blue-700 hover:underline font-medium block w-full text-center"
          >
            Fill Admin Credentials (admin@railway.com)
          </button>

          <p className="text-xs text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-700 font-medium hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

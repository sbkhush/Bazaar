import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ShieldCheck, Store, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_SHOP_ID } from '../data/seedData';
import { BrandLogo } from '../components/common/BrandLogo';
import { BRAND } from '../config/brand';

export const LoginPage: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isSalesManager,
    isSalesman,
    isReferralAgent,
    authorizedRole,
    authorizedHomePath,
    shopMemberships,
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    loading,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Automatic strict workspace routing based on verified role
  useEffect(() => {
    if (loading || !currentUser) return;
    if (isSuperAdmin && shopMemberships.length === 0) {
      navigate('/super-admin', { replace: true });
    } else if (isSalesManager || isSalesman || isReferralAgent) {
      navigate(authorizedHomePath, { replace: true });
    } else if (!isSuperAdmin && shopMemberships.length > 0) {
      navigate('/dashboard', { replace: true });
    }
  }, [
    currentUser,
    isSuperAdmin,
    isSalesManager,
    isSalesman,
    isReferralAgent,
    authorizedRole,
    authorizedHomePath,
    shopMemberships,
    loading,
    navigate,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address above first.');
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not send reset link.');
    }
  };

  if (!loading && currentUser) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#065F46]">
              Signed In
            </p>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">{currentUser.email}</h1>
            <p className="text-xs text-slate-500 mt-1">Select your workspace to continue.</p>
          </div>

          <div className="space-y-2.5">
            {isSuperAdmin && (
              <Link
                to="/super-admin"
                className="w-full p-4 rounded-xl border border-[#065F46] bg-emerald-50/60 hover:bg-emerald-50 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#065F46]" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Super Admin Portal</p>
                    <p className="text-[11px] text-slate-600">
                      Manage all tenant shops, plans & payments
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#065F46]" />
              </Link>
            )}

            {shopMemberships.length > 0 && (
              <Link
                to="/dashboard"
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-slate-400 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-slate-800" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Shop Admin Dashboard</p>
                    <p className="text-[11px] text-slate-500">
                      {shopMemberships.map((m) => m.shopName).join(', ')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </Link>
            )}

            <Link
              to="/register"
              className="w-full p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700"
            >
              <span>Create a New Store</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to={`/s/${DEFAULT_SHOP_ID}`}
              className="w-full p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700"
            >
              <span>Browse {BRAND.name} Storefront</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <BrandLogo variant="full" tone="dark" size="lg" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-4">Workspace Sign In</h1>
          <p className="text-xs text-slate-500 mt-1">
            Access your Shop Admin Dashboard or Platform Control Portal
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
              Password reset link sent to {email}.
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-800 transition flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>

          <div className="relative flex items-center justify-center text-[11px] text-slate-400">
            <span className="bg-white px-3 z-10 uppercase tracking-wider">or with email</span>
            <div className="absolute inset-x-0 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@store.pk"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-semibold text-[#065F46] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In to Workspace'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-center text-xs text-slate-500">
              Want to launch an online store?{' '}
              <Link to="/register" className="text-[#065F46] font-bold hover:underline">
                Create your store free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

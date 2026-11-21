import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Share2,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ReferralLoginPage: React.FC = () => {
  const {
    currentUser,
    loading,
    isReferralAgent,
    authorizedRole,
    authorizedHomePath,
    salesMember,
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    refreshSalesMember,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (loading || !currentUser) return;
    if (isReferralAgent) {
      navigate('/referral', { replace: true });
    } else if (authorizedRole !== 'customer' && authorizedHomePath !== '/referral') {
      navigate(authorizedHomePath, { replace: true });
    }
  }, [loading, currentUser, isReferralAgent, authorizedRole, authorizedHomePath, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
      const sm = await refreshSalesMember();
      if (sm && sm.role === 'referral_agent' && (sm.accountStatus === 'active' || sm.accountStatus === 'invited')) {
        navigate('/referral', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials or unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      const sm = await refreshSalesMember();
      if (sm && sm.role === 'referral_agent' && (sm.accountStatus === 'active' || sm.accountStatus === 'invited')) {
        navigate('/referral', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your registered referral agent email first.');
      return;
    }
    setError('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setInfoMsg('Password setup / reset email sent if an account matches.');
    } catch (err: any) {
      setError(err?.message || 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#065F46]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#065F46] px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-emerald-200">
                SB Khush · Partner Network
              </p>
              <h1 className="text-xl font-extrabold leading-tight">Referral Agent Portal</h1>
            </div>
          </div>
          <p className="text-xs text-emerald-100 mt-3 leading-relaxed">
            Share your unique referral code &amp; QR card to introduce new merchants and view your approved referral rewards.
          </p>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {currentUser && !isReferralAgent && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-amber-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Referral Agent Account Required</p>
                  <p className="text-[11px] mt-1">
                    Signed in as <span className="font-semibold">{currentUser.email}</span>
                    {salesMember ? ` (${salesMember.role.replace('_', ' ')})` : ''}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-lg border border-amber-300 font-semibold"
              >
                Sign Out
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-[#065F46] rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-800 flex items-center justify-center gap-2 transition"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-4 h-4"
            />
            Continue with Google
          </button>

          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Registered Partner Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@sbkhush.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={handleReset}
                className="font-semibold text-[#065F46] hover:underline"
              >
                First-time setup / Forgot password?
              </button>
              <Link to="/merchant/login" className="text-slate-500 hover:text-slate-800">
                Merchant Login
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Enter Referral Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

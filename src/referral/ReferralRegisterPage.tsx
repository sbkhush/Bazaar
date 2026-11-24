import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Share2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase/config';
import { isValidPakistaniPhone } from '../data/seedData';
import { submitReferralPartnerApplication } from '../services/salesService';
import { BrandLogo } from '../components/common/BrandLogo';
import { CitySelect } from '../components/common/CitySelect';

export const ReferralRegisterPage: React.FC = () => {
  const {
    currentUser,
    loading,
    salesMember,
    isReferralAgent,
    authorizedRole,
    authorizedHomePath,
    loginWithGoogle,
    registerWithEmail,
    refreshSalesMember,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Karachi');
  const [territory, setTerritory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !currentUser) return;
    if (isReferralAgent) {
      navigate('/referral', { replace: true });
      return;
    }
    if (authorizedRole !== 'customer' && salesMember?.accountStatus !== 'pending_approval') {
      navigate(authorizedHomePath, { replace: true });
    }
  }, [loading, currentUser, isReferralAgent, authorizedRole, authorizedHomePath, salesMember, navigate]);

  useEffect(() => {
    if (currentUser) {
      setFullName((prev) => prev || currentUser.displayName || '');
      setEmail((prev) => prev || currentUser.email || '');
    }
  }, [currentUser]);

  const handleGoogleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      await refreshSalesMember();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = (fullName || currentUser?.displayName || '').trim();
    const cleanEmail = (currentUser?.email || email).trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isValidPakistaniPhone(cleanPhone)) {
      setError('Please enter a valid Pakistani mobile number (e.g. 03001234567).');
      return;
    }

    setSubmitting(true);
    try {
      let uid = currentUser?.uid;
      if (!uid) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await registerWithEmail(cleanName, cleanEmail, password, cleanPhone);
        uid = auth.currentUser?.uid;
        if (!uid) {
          throw new Error('Account created — please sign in and retry.');
        }
      }

      const member = await submitReferralPartnerApplication({
        uid,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        city,
        territory: territory.trim() || city,
      });
      await refreshSalesMember();
      setSubmittedCode(member.referralCode);
    } catch (err: any) {
      setError(err?.message || 'Unable to submit partner application.');
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

  const isPendingReview =
    Boolean(submittedCode) ||
    (salesMember?.role === 'referral_agent' && salesMember.accountStatus === 'pending_approval');
  const displayCode = submittedCode || salesMember?.referralCode;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#065F46] px-6 py-6 text-white space-y-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center">
              <BrandLogo variant="full" tone="light" size="sm" />
            </Link>
            <Link to="/referral/login" className="text-xs font-semibold text-emerald-100 hover:text-white">
              Partner Login &rarr;
            </Link>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-emerald-200">
                SB Khush · Affiliate Partner Program
              </p>
              <h1 className="text-xl font-extrabold leading-tight">Apply as Referral Partner</h1>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {isPendingReview ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2.5 text-amber-950">
                <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700" />
                  Application Received — Pending Super Admin Approval
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Your affiliate partner application has been recorded cleanly. Once the Super Admin approves your account in Sales Management, your referral link and QR dashboard will activate automatically.
                </p>
                {displayCode && (
                  <p className="text-xs">
                    Reserved Partner Code:{' '}
                    <span className="font-mono font-bold bg-white border border-amber-300 px-2 py-0.5 rounded">
                      {displayCode}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/referral/login"
                  className="px-4 py-2.5 bg-[#065F46] text-white rounded-xl font-bold inline-flex items-center gap-1.5"
                >
                  Go to Partner Login <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {currentUser ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900">Signed in as:</span>{' '}
                    <span className="text-emerald-800">{currentUser.email}</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#065F46]" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-800 flex items-center justify-center gap-2 transition"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="w-4 h-4"
                  />
                  Verify Email with Google First
                </button>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Salman Tariq"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        disabled={Boolean(currentUser?.email)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="partner@example.com"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="03001234567"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  {!currentUser && (
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Portal Password *</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City *</label>
                    <CitySelect
                      value={city}
                      onChange={setCity}
                      required
                      placeholder="Select city..."
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Promotion Territory / Channel</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={territory}
                        onChange={(e) => setTerritory(e.target.value)}
                        placeholder="e.g. Digital / Lahore Wholesale"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
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
                      <span>Submit Partner Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

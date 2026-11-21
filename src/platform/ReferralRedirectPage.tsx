import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, QrCode } from 'lucide-react';
import { trackQrScan } from '../services/salesService';

export const ReferralRedirectPage: React.FC = () => {
  const { refCode } = useParams<{ refCode: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying referral code...');

  useEffect(() => {
    let active = true;
    const run = async () => {
      const clean = String(refCode || '').trim().toUpperCase();
      if (!clean) {
        navigate('/register', { replace: true });
        return;
      }
      const owner = await trackQrScan(clean, 'qr_scan').catch(() => null);
      if (!active) return;
      if (owner && owner.accountStatus === 'active') {
        setStatus(`Verified representative: ${owner.salesmanName}. Redirecting to store setup...`);
      }
      setTimeout(() => {
        if (active) {
          navigate(`/register?ref=${encodeURIComponent(clean)}&src=qr_scan`, { replace: true });
        }
      }, 350);
    };
    run();
    return () => {
      active = false;
    };
  }, [refCode, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#065F46] flex items-center justify-center">
        <QrCode className="w-7 h-7" />
      </div>
      <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
        <Loader2 className="w-4 h-4 animate-spin text-[#065F46]" />
        <span>{status}</span>
      </div>
    </div>
  );
};

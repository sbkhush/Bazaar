import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode, ShieldCheck } from 'lucide-react';
import { buildPickupQrPayload } from '../../data/seedData';

interface PickupQrPassProps {
  orderNumber: string;
  pickupOtp: string;
  locationName?: string;
  pickupVerifiedAt?: string;
  pickupVerifiedBy?: string;
  compact?: boolean;
}

export const PickupQrPass: React.FC<PickupQrPassProps> = ({
  orderNumber,
  pickupOtp,
  locationName,
  pickupVerifiedAt,
  pickupVerifiedBy,
  compact = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const qrPayload = buildPickupQrPayload(orderNumber, pickupOtp);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      width: compact ? 128 : 168,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [qrPayload, compact]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pickupOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-2xl bg-slate-900 text-white border border-slate-800 ${
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      } flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
    >
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Self-Pickup Verification Pass
          </span>
          {pickupVerifiedAt ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              Picked Up &amp; Verified
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
              Present Code or QR at Store Counter
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {pickupVerifiedAt ? (
            <>
              Handover verified on{' '}
              <span className="text-white font-semibold tabular-nums">
                {new Date(pickupVerifiedAt).toLocaleString()}
              </span>
              {pickupVerifiedBy ? ` by ${pickupVerifiedBy}` : ''}.
            </>
          ) : (
            <>
              Show this 6-digit pickup code or let counter staff scan the QR code at{' '}
              <strong className="text-white">{locationName || 'the pickup counter'}</strong>.
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 bg-white text-slate-900 rounded-xl font-mono text-lg sm:text-xl font-black tracking-[0.2em] tabular-nums inline-flex items-center gap-2 hover:bg-emerald-50 transition"
            aria-label="Copy 6-digit pickup code"
          >
            <span>{pickupOtp}</span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-700" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
            QR: {qrPayload}
          </span>
        </div>
      </div>

      <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0 self-start sm:self-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`Pickup QR code for order ${orderNumber}`}
            className={compact ? 'w-24 h-24 block' : 'w-28 h-28 sm:w-32 sm:h-32 block'}
          />
        ) : (
          <div
            className={`${
              compact ? 'w-24 h-24' : 'w-28 h-28'
            } flex flex-col items-center justify-center text-slate-400 text-[10px] gap-1`}
          >
            <QrCode className="w-6 h-6" />
            <span>QR Pass</span>
          </div>
        )}
      </div>
    </div>
  );
};

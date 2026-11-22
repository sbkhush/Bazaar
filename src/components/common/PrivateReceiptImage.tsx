import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert, Lock } from 'lucide-react';
import { auth, db } from '../../firebase/config';

interface PrivateReceiptImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

/**
 * Authenticated receipt viewer:
 * - For `/api/payments/proof?...` URLs, attaches a Firebase ID Token Bearer header or reads the
 *   restricted Firestore receipt doc (`shops/{shopId}/payment_receipts/{id}` or
 *   `platform_payment_receipts/{id}`) under active security rules.
 * - Keeps private payment screenshots inaccessible to unauthenticated/public users.
 */
export const PrivateReceiptImage: React.FC<PrivateReceiptImageProps> = ({
  src,
  alt = 'Payment receipt',
  className = 'max-h-64 rounded-xl border border-slate-200 object-contain bg-slate-50',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!src) {
      setResolvedSrc('');
      setError(null);
      return;
    }

    if (!src.startsWith('/api/payments/proof')) {
      setResolvedSrc(src);
      setError(null);
      return;
    }

    const loadPrivateReceipt = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';

        // 1. Try authenticated Express API stream if running
        if (token) {
          try {
            const res = await fetch(src, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.startsWith('image/')) {
              const blob = await res.blob();
              if (!active) return;
              objectUrl = URL.createObjectURL(blob);
              setResolvedSrc(objectUrl);
              setLoading(false);
              return;
            }
          } catch {
            // Fall through to authenticated Firestore direct read for static SPA hosts
          }
        }

        // 2. Fallback for static hosting (GitHub Pages / Firebase Hosting) via locked Firestore rules
        const parsed = new URL(src, window.location.origin);
        const scope = parsed.searchParams.get('scope');
        const shopId = parsed.searchParams.get('shopId');
        const receiptId = parsed.searchParams.get('receiptId');

        if (!receiptId) {
          throw new Error('Invalid private receipt reference.');
        }

        if (scope === 'platform') {
          const snap = await getDoc(doc(db, 'platform_payment_receipts', receiptId));
          if (!snap.exists()) {
            throw new Error('Subscription receipt document not found or access denied.');
          }
          const data = snap.data();
          if (!active) return;
          setResolvedSrc(`data:${data.contentType || 'image/webp'};base64,${data.base64Data}`);
        } else if (shopId) {
          const snap = await getDoc(doc(db, 'shops', shopId, 'payment_receipts', receiptId));
          if (!snap.exists()) {
            throw new Error('Order receipt document not found or access denied.');
          }
          const data = snap.data();
          if (!active) return;
          setResolvedSrc(`data:${data.contentType || 'image/webp'};base64,${data.base64Data}`);
        } else {
          throw new Error('Missing receipt tenant scope.');
        }
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Sign in as authorized merchant/admin to view private receipt.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPrivateReceipt();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!src) return null;

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin text-[#065F46]" />
        <span>Loading protected payment receipt...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-2 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
        <span>{error}</span>
      </div>
    );
  }

  if (!resolvedSrc) return null;

  return (
    <div className="space-y-1">
      <img src={resolvedSrc} alt={alt} className={className} />
      {src.startsWith('/api/payments/proof') && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
          <Lock className="w-3 h-3" /> Protected private receipt (authorized access only)
        </span>
      )}
    </div>
  );
};

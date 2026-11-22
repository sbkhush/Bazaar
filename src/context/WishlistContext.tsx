import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { saveShopUserWishlist, loadShopUserWishlist } from '../services/tenantService';

interface WishlistContextType {
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { shopId } = useTenant();
  const storageKey = `sbkhush_wishlist_${shopId}`;
  const legacyStorageKey = `bazaarpk_wishlist_${shopId}`;

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      let saved = localStorage.getItem(storageKey);
      if (!saved) {
        const legacy = localStorage.getItem(legacyStorageKey);
        if (legacy) {
          localStorage.setItem(storageKey, legacy);
          localStorage.removeItem(legacyStorageKey);
          saved = legacy;
        }
      }
      setWishlistIds(saved ? JSON.parse(saved) : []);
    } catch {
      setWishlistIds([]);
    }
  }, [storageKey, legacyStorageKey]);

  useEffect(() => {
    if (currentUser?.uid && shopId) {
      loadShopUserWishlist(shopId, currentUser.uid).then((ids) => {
        if (ids && ids.length > 0) {
          setWishlistIds((prev) => Array.from(new Set([...prev, ...ids])));
        }
      });
    }
  }, [currentUser?.uid, shopId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(wishlistIds));
    } catch {}

    if (currentUser?.uid && shopId) {
      saveShopUserWishlist(shopId, currentUser.uid, wishlistIds);
    }
  }, [wishlistIds, currentUser?.uid, shopId, storageKey]);

  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartItem, Product, Coupon, StoreSettings, FulfillmentMethod } from '../types';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import {
  saveShopUserCart,
  loadShopUserCart,
  getShopPublicSettings,
  getShopCoupons,
  getShopProducts,
} from '../services/tenantService';
import { INITIAL_SETTINGS, FALLBACK_PRODUCT_IMAGE } from '../data/seedData';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedVariants?: Record<string, string>) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  fulfillmentMethod: FulfillmentMethod;
  setFulfillmentMethod: (method: FulfillmentMethod) => void;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  itemCount: number;
  settings: StoreSettings;
  refreshSettings: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { shopId, settings: tenantSettings } = useTenant();

  const cartStorageKey = `sbkhush_cart_${shopId}`;
  const couponStorageKey = `sbkhush_coupon_${shopId}`;
  const legacyCartKey = `bazaarpk_cart_${shopId}`;
  const legacyCouponKey = `bazaarpk_coupon_${shopId}`;

  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(tenantSettings || INITIAL_SETTINGS);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');

  // Re-load cart when active shopId switches (with one-time legacy key migration)
  useEffect(() => {
    try {
      let savedCart = localStorage.getItem(cartStorageKey);
      if (!savedCart) {
        const legacy = localStorage.getItem(legacyCartKey);
        if (legacy) {
          localStorage.setItem(cartStorageKey, legacy);
          localStorage.removeItem(legacyCartKey);
          savedCart = legacy;
        }
      }
      setItems(savedCart ? JSON.parse(savedCart) : []);

      let savedCoupon = localStorage.getItem(couponStorageKey);
      if (!savedCoupon) {
        const legacyCpn = localStorage.getItem(legacyCouponKey);
        if (legacyCpn) {
          localStorage.setItem(couponStorageKey, legacyCpn);
          localStorage.removeItem(legacyCouponKey);
          savedCoupon = legacyCpn;
        }
      }
      setAppliedCoupon(savedCoupon ? JSON.parse(savedCoupon) : null);
    } catch {
      setItems([]);
      setAppliedCoupon(null);
    }
  }, [cartStorageKey, couponStorageKey, legacyCartKey, legacyCouponKey]);

  useEffect(() => {
    if (tenantSettings) {
      setSettings(tenantSettings);
      if (tenantSettings.selfPickupDetails?.enabled === false) {
        setFulfillmentMethod('delivery');
      }
    }
  }, [tenantSettings]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getShopPublicSettings(shopId);
      setSettings(s);
      if (s.selfPickupDetails?.enabled === false) {
        setFulfillmentMethod('delivery');
      }
    } catch {}
  }, [shopId]);

  useEffect(() => {
    if (!currentUser?.uid || !shopId) return;
    let active = true;

    (async () => {
      try {
        const remoteItems = await loadShopUserCart(shopId, currentUser.uid);
        if (!active || !remoteItems || remoteItems.length === 0) return;
        const localSaved = localStorage.getItem(cartStorageKey);
        if (localSaved && JSON.parse(localSaved).length > 0) return;

        const catalog = await getShopProducts(shopId);
        const catalogMap = new Map(catalog.map((p) => [p.id, p]));

        const hydrated: CartItem[] = remoteItems.map((r: any) => {
          const matchedProduct = catalogMap.get(r.productId);
          return {
            productId: r.productId,
            quantity: r.quantity || 1,
            selectedVariants: r.selectedVariants,
            itemKey: r.itemKey || r.productId,
            product: matchedProduct || {
              id: r.productId,
              title: r.title || 'Product',
              regularPrice: r.regularPrice || r.price || 0,
              salePrice: r.salePrice,
              images: [r.image || FALLBACK_PRODUCT_IMAGE],
              slug: 'product',
              description: '',
              stock: typeof r.stock === 'number' ? r.stock : 20,
              category: r.category || 'general',
              brand: r.brand || settings.siteName,
              sku: 'SKU',
              isFeatured: false,
              isPublished: true,
              rating: 4.8,
              reviewCount: 0,
              createdAt: '',
            },
          };
        });
        if (active) setItems(hydrated);
      } catch {}
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.uid, shopId, cartStorageKey, settings.siteName]);

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(items));
    } catch {}

    if (currentUser?.uid && shopId) {
      saveShopUserCart(shopId, currentUser.uid, items);
    }
  }, [items, currentUser?.uid, shopId, cartStorageKey]);

  useEffect(() => {
    try {
      if (appliedCoupon) {
        localStorage.setItem(couponStorageKey, JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem(couponStorageKey);
      }
    } catch {}
  }, [appliedCoupon, couponStorageKey]);

  const generateItemKey = (productId: string, variants?: Record<string, string>) => {
    if (!variants || Object.keys(variants).length === 0) return productId;
    const sorted = Object.entries(variants).sort(([a], [b]) => a.localeCompare(b));
    return `${productId}_${sorted.map(([k, v]) => `${k}:${v}`).join('_')}`;
  };

  const addToCart = (product: Product, quantity = 1, selectedVariants?: Record<string, string>) => {
    const itemKey = generateItemKey(product.id, selectedVariants);
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.itemKey === itemKey);
      const maxStock = product.stock > 0 ? product.stock : 99;
      if (existingIndex > -1) {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + quantity;
        next[existingIndex] = {
          ...next[existingIndex],
          product,
          quantity: Math.min(newQty, maxStock),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: Math.min(quantity, maxStock),
          selectedVariants,
          itemKey,
        },
      ];
    });
    setCartDrawerOpen(true);
  };

  const removeFromCart = (itemKey: string) => {
    setItems((prev) => prev.filter((i) => i.itemKey !== itemKey));
  };

  const updateQuantity = (itemKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemKey);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.itemKey === itemKey) {
          const max = i.product.stock > 0 ? i.product.stock : 99;
          return { ...i, quantity: Math.min(quantity, max) };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setFulfillmentMethod('delivery');
  };

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.salePrice ?? item.product.regularPrice;
    return sum + price * item.quantity;
  }, 0);

  const shippingFee =
    items.length === 0
      ? 0
      : fulfillmentMethod === 'self_pickup'
      ? 0
      : subtotal >= settings.freeShippingThreshold
      ? 0
      : settings.shippingFee;

  let discount = 0;
  if (appliedCoupon && subtotal >= appliedCoupon.minOrderValue) {
    if (appliedCoupon.discountType === 'percentage') {
      discount = Math.round((subtotal * appliedCoupon.discountValue) / 100);
    } else {
      discount = Math.min(subtotal, appliedCoupon.discountValue);
    }
  }

  const total = Math.max(0, subtotal + shippingFee - discount);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Please enter a coupon code' };
    try {
      const coupons = await getShopCoupons(shopId);
      const match = coupons.find((c) => c.code.toUpperCase() === cleanCode && c.isActive);
      if (!match) return { success: false, message: 'Invalid or inactive coupon code' };
      if (match.usageLimit && match.usageCount >= match.usageLimit) {
        return { success: false, message: 'This coupon has reached its redemption limit' };
      }
      if (subtotal < match.minOrderValue) {
        return {
          success: false,
          message: `Minimum order value for this coupon is Rs. ${match.minOrderValue.toLocaleString()}`,
        };
      }
      if (match.expiryDate) {
        const endOfExpiry = new Date(`${match.expiryDate}T23:59:59`);
        if (!Number.isNaN(endOfExpiry.getTime()) && endOfExpiry < new Date()) {
          return { success: false, message: 'This coupon has expired' };
        }
      }
      setAppliedCoupon(match);
      return { success: true, message: `Coupon ${match.code} applied!` };
    } catch {
      return { success: false, message: 'Could not apply coupon right now' };
    }
  };

  const removeCoupon = () => setAppliedCoupon(null);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartDrawerOpen,
        setCartDrawerOpen,
        fulfillmentMethod,
        setFulfillmentMethod,
        subtotal,
        shippingFee,
        discount,
        total,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        itemCount,
        settings,
        refreshSettings,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

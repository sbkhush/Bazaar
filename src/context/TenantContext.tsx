import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ShopPublic, StoreSettings, SubscriptionPlan } from '../types';
import {
  DEFAULT_SHOP_ID,
  INITIAL_SETTINGS,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../data/seedData';
import {
  getShopPublicBySlug,
  getShopPublicById,
} from '../services/platformService';
import { getShopPublicSettings } from '../services/tenantService';
import { resolveTenantFromHostname } from '../utils/tenantDomain';

interface TenantContextType {
  shopId: string;
  shopSlug: string;
  shop: ShopPublic | null;
  settings: StoreSettings;
  plan: SubscriptionPlan;
  loading: boolean;
  notFound: boolean;
  isSuspended: boolean;
  isExpired: boolean;
  storeBasePath: string;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{
  slug?: string;
  shopIdOverride?: string;
  basePrefix?: '/s' | '/shop' | '/gym' | '/clinic' | '/carwash' | '/dealer';
  children: React.ReactNode;
}> = ({ slug, shopIdOverride, basePrefix = '/s', children }) => {
  const domainTenant = resolveTenantFromHostname();
  const targetSlug = slug || domainTenant || DEFAULT_SHOP_ID;
  const [shop, setShop] = useState<ShopPublic | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_SUBSCRIPTION_PLANS[0]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const flagshipPlan =
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'professional') ||
    DEFAULT_SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLANS.length - 1];
  const starterPlan =
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'starter') || DEFAULT_SUBSCRIPTION_PLANS[1];

  const loadTenant = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const resolvedShop = shopIdOverride
        ? await getShopPublicById(shopIdOverride)
        : await getShopPublicBySlug(targetSlug);

      if (!resolvedShop) {
        // Graceful flagship legacy store compatibility if migration hasn't run yet
        if (targetSlug === DEFAULT_SHOP_ID) {
          setShop({
            id: DEFAULT_SHOP_ID,
            slug: DEFAULT_SHOP_ID,
            name: INITIAL_SETTINGS.siteName,
            businessType: 'general_store',
            city: 'Karachi',
            publicContactPhone: INITIAL_SETTINGS.contactPhone,
            publicSupportEmail: INITIAL_SETTINGS.contactEmail,
            storefrontAddress: INITIAL_SETTINGS.address,
            businessHours: INITIAL_SETTINGS.businessHours,
            seoTitle: INITIAL_SETTINGS.seoTitle,
            seoDescription: INITIAL_SETTINGS.seoDescription,
            status: 'active',
            theme: {
              primaryColor: INITIAL_SETTINGS.primaryColor || '#065f46',
              accentColor: INITIAL_SETTINGS.accentColor || '#d97706',
              showBuyingGuide: true,
              showTestimonials: true,
            },
            createdAt: new Date().toISOString(),
          });
          setSettings(INITIAL_SETTINGS);
          setPlan(flagshipPlan);
          setLoading(false);
          return;
        }
        setShop(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const shopSettings = await getShopPublicSettings(resolvedShop.id);
      setShop(resolvedShop);
      setSettings(shopSettings);

      const showGuide =
        resolvedShop.id === DEFAULT_SHOP_ID || Boolean(resolvedShop.theme?.showBuyingGuide);
      const basePlan =
        resolvedShop.id === DEFAULT_SHOP_ID
          ? flagshipPlan
          : {
              ...starterPlan,
              features: {
                ...starterPlan.features,
                buyingGuide: showGuide,
              },
            };
      setPlan(basePlan);
    } catch (err) {
      console.warn('Tenant resolution note:', err);
    } finally {
      setLoading(false);
    }
  }, [targetSlug, shopIdOverride, flagshipPlan, starterPlan]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  const effectiveShopId = shop?.id || targetSlug;
  const effectiveSlug = shop?.slug || targetSlug;
  const isSuspended = shop ? shop.status === 'suspended' || shop.status === 'inactive' : false;
  const isExpired = false;

  return (
    <TenantContext.Provider
      value={{
        shopId: effectiveShopId,
        shopSlug: effectiveSlug,
        shop,
        settings,
        plan,
        loading,
        notFound,
        isSuspended,
        isExpired,
        storeBasePath: `${basePrefix}/${effectiveSlug}`,
        refreshTenant: loadTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    // Safe fallback for legacy standalone render contexts
    return {
      shopId: DEFAULT_SHOP_ID,
      shopSlug: DEFAULT_SHOP_ID,
      shop: null,
      settings: INITIAL_SETTINGS,
      plan:
        DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'professional') ||
        DEFAULT_SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLANS.length - 1],
      loading: false,
      notFound: false,
      isSuspended: false,
      isExpired: false,
      storeBasePath: `/s/${DEFAULT_SHOP_ID}`,
      refreshTenant: async () => {},
    } as TenantContextType;
  }
  return ctx;
};

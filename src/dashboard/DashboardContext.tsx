import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  Shop,
  StoreSettings,
  SubscriptionPlan,
  StaffPermission,
  StaffRole,
  PlanFeatures,
  BusinessType,
  IndustryGroup,
} from '../types';
import {
  buildIndustryPublicPath,
  getIndustryGroup,
} from '../config/industryConfig';
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  INITIAL_SETTINGS,
  DEFAULT_SHOP_ID,
} from '../data/seedData';
import {
  getShopById,
  getSubscriptionPlans,
  getShopSubscriptionStatus,
  getPlatformSettings,
} from '../services/platformService';
import { getShopSettings } from '../services/tenantService';

interface DashboardContextType {
  shopId: string;
  shop: Shop | null;
  businessType: BusinessType;
  industryGroup: IndustryGroup;
  publicStorePath: string;
  settings: StoreSettings;
  plan: SubscriptionPlan;
  loading: boolean;
  isReadOnly: boolean;
  userRole: StaffRole;
  isSuspended: boolean;
  isExpired: boolean;
  hasPermission: (perm: StaffPermission) => boolean;
  canUseFeature: (feat: keyof PlanFeatures) => boolean;
  refreshDashboard: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isSuperAdmin, shopMemberships, activeShopId } = useAuth();
  const [searchParams] = useSearchParams();
  const inspectShopId = searchParams.get('inspectShopId');

  const isInspecting = Boolean(inspectShopId && isSuperAdmin);
  const resolvedShopId = isInspecting
    ? inspectShopId!
    : activeShopId || shopMemberships[0]?.shopId || (isSuperAdmin ? DEFAULT_SHOP_ID : '');

  const [shop, setShop] = useState<Shop | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_SUBSCRIPTION_PLANS[0]);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(5);
  const [userRole, setUserRole] = useState<StaffRole>('shop_owner');
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    if (!resolvedShopId) {
      setShop(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [s, stg, plans, platformCfg] = await Promise.all([
        getShopById(resolvedShopId),
        getShopSettings(resolvedShopId),
        getSubscriptionPlans(),
        getPlatformSettings().catch(() => null),
      ]);

      setShop(s);
      setSettings(stg);
      if (platformCfg?.gracePeriodDays !== undefined) {
        setGracePeriodDays(platformCfg.gracePeriodDays);
      }

      const matchedPlan =
        plans.find((p) => p.id === s?.subscription?.planId) ||
        DEFAULT_SUBSCRIPTION_PLANS[0];
      setPlan(matchedPlan);

      if (isInspecting || isSuperAdmin || s?.ownerId === currentUser?.uid) {
        setUserRole('shop_owner');
        setPermissions([]);
      } else if (currentUser?.uid) {
        const staffSnap = await getDoc(doc(db, 'shops', resolvedShopId, 'staff', currentUser.uid));
        if (staffSnap.exists()) {
          const data = staffSnap.data();
          setUserRole((data.role as StaffRole) || 'shop_staff');
          setPermissions((data.permissions as StaffPermission[]) || ['overview']);
        }
      }
    } catch (err) {
      console.warn('Dashboard workspace load note:', err);
    } finally {
      setLoading(false);
    }
  }, [resolvedShopId, isInspecting, isSuperAdmin, currentUser?.uid]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const { isSuspended, isExpired } = getShopSubscriptionStatus(shop, gracePeriodDays);

  const hasPermission = (perm: StaffPermission): boolean => {
    if (isInspecting || isSuperAdmin || userRole === 'shop_owner' || userRole === 'shop_admin') {
      return true;
    }
    return permissions.includes(perm);
  };

  const canUseFeature = (feat: keyof PlanFeatures): boolean => {
    if (isSuspended || isExpired) return false;
    return Boolean(plan?.features?.[feat]);
  };

  const businessType: BusinessType = shop?.businessType || 'general_store';
  const industryGroup: IndustryGroup = getIndustryGroup(businessType);
  const publicStorePath = buildIndustryPublicPath(shop?.slug || resolvedShopId || 'store', businessType);

  return (
    <DashboardContext.Provider
      value={{
        shopId: resolvedShopId,
        shop,
        businessType,
        industryGroup,
        publicStorePath,
        settings,
        plan,
        loading,
        isReadOnly: isInspecting,
        userRole,
        isSuspended,
        isExpired,
        hasPermission,
        canUseFeature,
        refreshDashboard: loadWorkspace,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};

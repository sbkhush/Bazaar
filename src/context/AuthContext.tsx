import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  UserProfile,
  UserRole,
  UserAddress,
  ShopMembership,
  ShopInvite,
  SalesMember,
} from '../types';
import { SUPER_ADMIN_EMAIL } from '../data/seedData';
import { stripUndefined } from '../services/platformService';
import { linkSalesMemberOnLogin } from '../services/salesService';
import {
  AuthorizedPortalRole,
  getAuthorizedHomePath,
  resolveAuthorizedPortalRole,
} from '../services/roleGuard';
import { formatFirebaseAuthError, validateEmailAndPasswordInput } from '../utils/authErrors';

export interface AuthDiagnostics {
  emailVerified: boolean;
  platformAdminSynced: boolean;
  claimsSynced: boolean;
  warning?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  authDiagnostics: AuthDiagnostics;
  resendVerificationEmail: () => Promise<void>;
  salesMember: SalesMember | null;
  isSalesman: boolean;
  isSalesManager: boolean;
  isReferralAgent: boolean;
  authorizedRole: AuthorizedPortalRole;
  authorizedHomePath: string;
  refreshSalesMember: () => Promise<SalesMember | null>;
  shopMemberships: ShopMembership[];
  activeShopId: string | null;
  setActiveShopId: (shopId: string) => void;
  refreshMemberships: () => Promise<ShopMembership[]>;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserAddresses: (addresses: UserAddress[]) => Promise<void>;
  updateProfileDetails: (details: { displayName: string; phoneNumber?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { SUPER_ADMIN_EMAIL };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdminVerified, setIsSuperAdminVerified] = useState(false);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics>({
    emailVerified: false,
    platformAdminSynced: false,
    claimsSynced: false,
  });
  const [salesMember, setSalesMember] = useState<SalesMember | null>(null);
  const [shopMemberships, setShopMemberships] = useState<ShopMembership[]>([]);
  const [activeShopId, setActiveShopIdState] = useState<string | null>(() => {
    try {
      const current = localStorage.getItem('sbkhush_active_shop_id');
      if (current) return current;
      const legacy = localStorage.getItem('bazaarpk_active_shop_id');
      if (legacy) {
        localStorage.setItem('sbkhush_active_shop_id', legacy);
        return legacy;
      }
      return null;
    } catch {
      return null;
    }
  });

  const setActiveShopId = useCallback((shopId: string) => {
    setActiveShopIdState(shopId);
    try {
      localStorage.setItem('sbkhush_active_shop_id', shopId);
      localStorage.removeItem('bazaarpk_active_shop_id');
    } catch {}
  }, []);

  const trySyncCustomClaims = async (user: FirebaseUser): Promise<boolean> => {
    try {
      const fn = httpsCallable(getFunctions(auth.app), 'syncMyCustomClaims');
      await fn();
      await user.getIdToken(true);
      return true;
    } catch {
      return false;
    }
  };

  const checkSuperAdminPrivilege = async (user: FirebaseUser | null) => {
    if (!user) {
      setIsSuperAdminVerified(false);
      setAuthDiagnostics({
        emailVerified: false,
        platformAdminSynced: false,
        claimsSynced: false,
      });
      return;
    }

    if (user.email === SUPER_ADMIN_EMAIL && !user.emailVerified) {
      setIsSuperAdminVerified(false);
      setAuthDiagnostics({
        emailVerified: false,
        platformAdminSynced: false,
        claimsSynced: false,
        warning:
          'Super Admin email is not verified yet. Please verify your email address or sign in with verified Google to unlock Super Admin access.',
      });
      return;
    }

    // Bootstrap verified super admin email & sync platform_admins/{uid}
    if (user.email === SUPER_ADMIN_EMAIL && user.emailVerified) {
      setIsSuperAdminVerified(true);
      let syncedDoc = false;
      try {
        await setDoc(
          doc(db, 'platform_admins', user.uid),
          {
            uid: user.uid,
            email: user.email,
            role: 'super_admin',
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
        syncedDoc = true;
      } catch {}
      const claimsSynced = await trySyncCustomClaims(user);
      setAuthDiagnostics({
        emailVerified: true,
        platformAdminSynced: syncedDoc,
        claimsSynced,
      });
      return;
    }

    try {
      const platAdminSnap = await getDoc(doc(db, 'platform_admins', user.uid));
      if (platAdminSnap.exists()) {
        setIsSuperAdminVerified(true);
        const claimsSynced = await trySyncCustomClaims(user);
        setAuthDiagnostics({
          emailVerified: Boolean(user.emailVerified),
          platformAdminSynced: true,
          claimsSynced,
        });
        return;
      }
      // Also support legacy /admins/{uid} super_admin entry seamlessly
      const legacyAdminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (legacyAdminSnap.exists() && legacyAdminSnap.data().role === 'super_admin') {
        setIsSuperAdminVerified(true);
        const claimsSynced = await trySyncCustomClaims(user);
        setAuthDiagnostics({
          emailVerified: Boolean(user.emailVerified),
          platformAdminSynced: true,
          claimsSynced,
        });
        return;
      }
      setIsSuperAdminVerified(false);
      setAuthDiagnostics({
        emailVerified: Boolean(user.emailVerified),
        platformAdminSynced: false,
        claimsSynced: false,
      });
    } catch {
      setIsSuperAdminVerified(false);
      setAuthDiagnostics({
        emailVerified: Boolean(user.emailVerified),
        platformAdminSynced: false,
        claimsSynced: false,
      });
    }
  };

  const claimPendingInvites = async (user: FirebaseUser) => {
    if (!user.email) return;
    try {
      const q = query(
        collection(db, 'shop_invites'),
        where('email', '==', user.email.toLowerCase()),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      if (snap.empty) return;

      const now = new Date().toISOString();
      for (const invDoc of snap.docs) {
        const inv = invDoc.data() as ShopInvite;
        await setDoc(doc(db, 'shops', inv.shopId, 'staff', user.uid), {
          uid: user.uid,
          email: user.email,
          name: user.displayName || inv.name,
          role: inv.role,
          permissions: inv.permissions,
          status: 'active',
          inviteId: invDoc.id,
          createdAt: now,
        });
        await setDoc(doc(db, 'users', user.uid, 'shopMemberships', inv.shopId), {
          shopId: inv.shopId,
          shopName: inv.shopName,
          shopSlug: inv.shopSlug,
          role: inv.role,
          permissions: inv.permissions,
          joinedAt: now,
        });
        await updateDoc(doc(db, 'shop_invites', invDoc.id), {
          status: 'accepted',
          acceptedAt: now,
          acceptedBy: user.uid,
        });
      }
    } catch (err) {
      console.warn('Invite claim check note:', err);
    }
  };

  const loadUserMemberships = useCallback(async (uid: string): Promise<ShopMembership[]> => {
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'shopMemberships'));
      const list: ShopMembership[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as ShopMembership), shopId: d.id }));

      // Also fallback-check shops where ownerId == uid in case membership doc was skipped during legacy seed
      if (list.length === 0) {
        try {
          const ownedQ = query(collection(db, 'shops'), where('ownerId', '==', uid));
          const ownedSnap = await getDocs(ownedQ);
          for (const sDoc of ownedSnap.docs) {
            const s = sDoc.data();
            const m: ShopMembership = {
              shopId: sDoc.id,
              shopName: s.name || sDoc.id,
              shopSlug: s.slug || sDoc.id,
              role: 'shop_owner',
              joinedAt: s.createdAt || new Date().toISOString(),
            };
            list.push(m);
            await setDoc(doc(db, 'users', uid, 'shopMemberships', sDoc.id), m, { merge: true }).catch(() => {});
          }
        } catch {}
      }

      setShopMemberships(list);
      if (list.length > 0) {
        setActiveShopIdState((prev) => {
          if (prev && list.some((m) => m.shopId === prev)) return prev;
          return list[0].shopId;
        });
      }
      return list;
    } catch {
      setShopMemberships([]);
      return [];
    }
  }, []);

  const refreshMemberships = useCallback(async (): Promise<ShopMembership[]> => {
    if (!currentUser?.uid) return [];
    return loadUserMemberships(currentUser.uid);
  }, [currentUser?.uid, loadUserMemberships]);

  const syncUserProfile = async (user: FirebaseUser) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const isSuper = user.email === SUPER_ADMIN_EMAIL && user.emailVerified;
      const defaultRole: UserRole = isSuper ? 'super_admin' : 'customer';

      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || undefined,
          role: defaultRole,
          isBlocked: false,
          addresses: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, stripUndefined(newProfile));
        setUserProfile(newProfile);
      } else {
        const profile = userSnap.data() as UserProfile;
        if (isSuper && profile.role !== 'super_admin') {
          profile.role = 'super_admin';
          await setDoc(userRef, { role: 'super_admin' }, { merge: true }).catch(() => {});
        }
        setUserProfile({ ...profile, addresses: profile.addresses || [] });
      }
    } catch (err) {
      console.warn('Sync profile note:', err);
      setUserProfile({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'User',
        role: user.email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'customer',
        isBlocked: false,
        addresses: [],
        createdAt: new Date().toISOString(),
      });
    }
  };

  const refreshSalesMember = useCallback(async (): Promise<SalesMember | null> => {
    if (!currentUser?.uid) {
      setSalesMember(null);
      return null;
    }
    const sm = await linkSalesMemberOnLogin(currentUser.uid, currentUser.email);
    setSalesMember(sm);
    return sm;
  }, [currentUser?.uid, currentUser?.email]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await checkSuperAdminPrivilege(user);
        await syncUserProfile(user);
        await claimPendingInvites(user);
        const memberships = await loadUserMemberships(user.uid);
        const sm = await linkSalesMemberOnLogin(user.uid, user.email).catch(() => null);
        setSalesMember(sm);
        if (memberships.length > 0 || sm) {
          const claimsOk = await trySyncCustomClaims(user).catch(() => false);
          if (claimsOk) {
            setAuthDiagnostics((prev) => ({ ...prev, claimsSynced: true }));
          }
        }
      } else {
        setUserProfile(null);
        setIsSuperAdminVerified(false);
        setAuthDiagnostics({
          emailVerified: false,
          platformAdminSynced: false,
          claimsSynced: false,
        });
        setSalesMember(null);
        setShopMemberships([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserMemberships]);

  const wrapAuthError = (err: any, fallback: string): Error => {
    const wrapped = new Error(formatFirebaseAuthError(err, fallback));
    if (err?.code) (wrapped as any).code = err.code;
    return wrapped;
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      throw wrapAuthError(err, 'Google sign-in failed.');
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { email: cleanEmail, password } = validateEmailAndPasswordInput(email, pass);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: any) {
      throw wrapAuthError(err, 'Invalid email or password.');
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string, phone?: string) => {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please enter your full name (at least 2 characters).');
    }
    const { email: cleanEmail, password } = validateEmailAndPasswordInput(email, pass);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: cleanName });
        const newProfile: UserProfile = {
          uid: cred.user.uid,
          email: cleanEmail,
          displayName: cleanName,
          phoneNumber: phone?.trim() || undefined,
          role: 'customer',
          isBlocked: false,
          addresses: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', cred.user.uid), stripUndefined(newProfile));
        setUserProfile(newProfile);
      }
    } catch (err: any) {
      throw wrapAuthError(err, 'Account registration failed.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address first.');
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      throw wrapAuthError(err, 'Could not send password reset email.');
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Must be signed in to send verification email.');
    await sendEmailVerification(auth.currentUser);
  };

  const updateUserAddresses = async (addresses: UserAddress[]) => {
    if (!currentUser) return;
    const cleanAddresses = stripUndefined(addresses);
    await setDoc(
      doc(db, 'users', currentUser.uid),
      { addresses: cleanAddresses, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    if (userProfile) {
      setUserProfile({ ...userProfile, addresses: cleanAddresses });
    }
  };

  const updateProfileDetails = async (details: { displayName: string; phoneNumber?: string; photoURL?: string }) => {
    if (!currentUser) return;
    const cleanName = details.displayName.trim();
    const cleanPhone = details.phoneNumber?.trim() || undefined;
    const cleanPhoto = details.photoURL !== undefined ? details.photoURL.trim() || undefined : userProfile?.photoURL;
    const authUpdate: { displayName?: string; photoURL?: string | null } = {};
    if (cleanName && cleanName !== currentUser.displayName) {
      authUpdate.displayName = cleanName;
    }
    if (details.photoURL !== undefined && cleanPhoto !== (currentUser.photoURL || undefined)) {
      authUpdate.photoURL = cleanPhoto || '';
    }
    if (Object.keys(authUpdate).length > 0) {
      await updateProfile(currentUser, authUpdate).catch(() => {});
    }
    const updates = stripUndefined({
      displayName: cleanName,
      phoneNumber: cleanPhone,
      photoURL: cleanPhoto,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    if (userProfile) {
      setUserProfile({ ...userProfile, displayName: cleanName, phoneNumber: cleanPhone, photoURL: cleanPhoto });
    }
  };

  const isBlocked = Boolean(userProfile?.isBlocked);
  const isSuperAdmin = !isBlocked && isSuperAdminVerified;
  const hasActiveSalesAccount = Boolean(
    !isBlocked &&
      salesMember &&
      (salesMember.accountStatus === 'active' || salesMember.accountStatus === 'invited')
  );
  // Strict role separation: managers use /sales-manager, salesmen use /salesman, referral agents use /referral
  const isSalesManager = Boolean(hasActiveSalesAccount && salesMember?.role === 'sales_manager');
  const isReferralAgent = Boolean(hasActiveSalesAccount && salesMember?.role === 'referral_agent');
  const isSalesman = Boolean(
    hasActiveSalesAccount &&
      (salesMember?.role === 'salesman' || salesMember?.role === 'senior_salesman')
  );
  const authorizedRole = resolveAuthorizedPortalRole({
    isSuperAdmin,
    isBlocked,
    salesMember,
    shopMemberships,
  });
  const authorizedHomePath = getAuthorizedHomePath(authorizedRole);
  const isAdmin = !isBlocked && (isSuperAdmin || shopMemberships.length > 0);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAdmin,
        isSuperAdmin,
        isBlocked,
        authDiagnostics,
        resendVerificationEmail,
        salesMember,
        isSalesman,
        isSalesManager,
        isReferralAgent,
        authorizedRole,
        authorizedHomePath,
        refreshSalesMember,
        shopMemberships,
        activeShopId,
        setActiveShopId,
        refreshMemberships,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        resetPassword,
        updateUserAddresses,
        updateProfileDetails,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

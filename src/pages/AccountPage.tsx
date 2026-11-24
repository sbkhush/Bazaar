import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  User,
  Package,
  Heart,
  MapPin,
  KeyRound,
  LogOut,
  Truck,
  XCircle,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Store,
  Clock,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useTenant } from '../context/TenantContext';
import {
  getShopOrdersByUser,
  getShopProducts,
  updateShopOrderStatus,
} from '../services/tenantService';
import { Order, Product, UserAddress } from '../types';
import {
  formatPKR,
  FALLBACK_PRODUCT_IMAGE,
  getPaymentMethodLabel,
  derivePickupStatusFromOrderStatus,
} from '../data/seedData';
import { CitySelect } from '../components/common/CitySelect';
import { useToast } from '../components/common/Toast';
import { AuthModal } from '../components/common/AuthModal';
import { PickupQrPass } from '../components/common/PickupQrPass';

export const AccountPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userProfile, logout, resetPassword, updateUserAddresses, updateProfileDetails } = useAuth();
  const { wishlistIds, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { shopId, settings, storeBasePath } = useTenant();
  const { showToast } = useToast();

  const tabParam = searchParams.get('tab') || 'orders';
  const [activeTab, setActiveTab] = useState<string>(tabParam);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('Karachi');
  const [addrPostal, setAddrPostal] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'orders');
  }, [searchParams]);

  useEffect(() => {
    setEditName(userProfile?.displayName || currentUser?.displayName || '');
    setEditPhone(userProfile?.phoneNumber || '');
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (currentUser?.uid) {
      setLoadingOrders(true);
      getShopOrdersByUser(shopId, currentUser.uid)
        .then((res) => setOrders(res || []))
        .catch(console.warn)
        .finally(() => setLoadingOrders(false));
    }
  }, [currentUser?.uid, shopId]);

  useEffect(() => {
    if (wishlistIds.length > 0) {
      getShopProducts(shopId).then((all) => {
        setWishlistProducts(all.filter((p) => wishlistIds.includes(p.id)));
      });
    } else {
      setWishlistProducts([]);
    }
  }, [wishlistIds, shopId]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const confirmCancelOrder = async () => {
    if (!cancelTarget) return;
    setCancellingOrder(true);
    try {
      const nextPickupStatus = cancelTarget.fulfillmentMethod === 'self_pickup' ? ('Cancelled' as const) : undefined;
      await updateShopOrderStatus(
        shopId,
        cancelTarget.id,
        { orderStatus: 'Cancelled', ...(nextPickupStatus ? { pickupStatus: nextPickupStatus } : {}) },
        cancelTarget.orderNumber
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === cancelTarget.id
            ? { ...o, orderStatus: 'Cancelled', ...(nextPickupStatus ? { pickupStatus: nextPickupStatus } : {}) }
            : o
        )
      );
      showToast('Order has been cancelled.', 'info');
      setCancelTarget(null);
    } catch {
      showToast('Could not cancel order at this time.', 'error');
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast('Display name cannot be empty', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfileDetails({
        displayName: editName.trim(),
        phoneNumber: editPhone.trim(),
      });
      showToast('Profile details updated!', 'success');
    } catch {
      showToast('Could not update profile details', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName || !addrPhone || !addrStreet) {
      showToast('Please fill all required address fields', 'error');
      return;
    }
    const newAddr: UserAddress = {
      id: `addr_${Date.now()}`,
      fullName: addrName,
      phone: addrPhone,
      address: addrStreet,
      city: addrCity,
      postalCode: addrPostal,
      isDefault: (userProfile?.addresses?.length || 0) === 0,
    };
    const updated = [...(userProfile?.addresses || []), newAddr];
    try {
      await updateUserAddresses(updated);
      showToast('New shipping address saved!', 'success');
      setAddressModalOpen(false);
      setAddrName('');
      setAddrPhone('');
      setAddrStreet('');
      setAddrPostal('');
    } catch {
      showToast('Failed to save address', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const updated = (userProfile?.addresses || []).filter((a) => a.id !== id);
    try {
      await updateUserAddresses(updated);
      showToast('Address removed', 'info');
    } catch {
      showToast('Failed to remove address', 'error');
    }
  };

  const renderWishlistGrid = () => (
    <div>
      {wishlistProducts.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-slate-100 p-6">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base mb-1">Your Wishlist is Empty</h3>
          <p className="text-xs text-slate-500 mb-4">
            Click the heart icon on any product in {settings.siteName} to save it here.
          </p>
          <Link
            to={`${storeBasePath}/shop`}
            className="inline-block px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
          >
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {wishlistProducts.map((p) => {
            const price = p.salePrice ?? p.regularPrice;
            return (
              <div
                key={p.id}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div className="flex gap-3">
                  <img
                    src={p.images[0] || FALLBACK_PRODUCT_IMAGE}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                    }}
                    alt={p.title}
                    className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`${storeBasePath}/product/${p.id}`}
                      className="font-bold text-xs text-slate-800 hover:text-emerald-700 block line-clamp-1"
                    >
                      {p.title}
                    </Link>
                    <span className="text-xs font-black text-slate-900 block mt-1 tabular-nums">
                      {formatPKR(price)}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {p.stock > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      addToCart(p, 1);
                      showToast(`Moved "${p.title}" to cart!`, 'success');
                    }}
                    className="flex-1 py-2 px-3 bg-emerald-800 text-white rounded-lg text-xs font-semibold hover:bg-emerald-900 transition"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => toggleWishlist(p.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition"
                    title="Remove"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!currentUser) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16 space-y-8">
        <div className="max-w-md mx-auto text-center bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Customer Account</h2>
          <p className="text-xs text-slate-500 mb-6">
            Sign in or create an account to view your orders from {settings.siteName}, saved shipping addresses, and synced wishlist.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            Sign In / Create Account
          </button>
        </div>

        {(activeTab === 'wishlist' || wishlistProducts.length > 0) && (
          <div className="space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600 fill-rose-600" /> Saved Wishlist ({wishlistProducts.length})
            </h3>
            {renderWishlistGrid()}
          </div>
        )}

        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 sm:p-8 rounded-3xl shadow-lg mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-xl sm:text-2xl text-white shrink-0">
            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {userProfile?.displayName || currentUser.displayName || 'Customer'}
            </h1>
            <p className="text-xs text-emerald-100/80 truncate">{currentUser.email}</p>
            <p className="text-[11px] text-emerald-200/60 mt-0.5">
              Member since {new Date(currentUser.metadata.creationTime || Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-5 sm:gap-6 text-xs sm:text-sm font-bold mb-6 sm:mb-8 overflow-x-auto pb-1">
        <button
          onClick={() => handleTabChange('orders')}
          className={`pb-3 transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'orders'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" /> My Orders ({orders.length})
        </button>
        <button
          onClick={() => handleTabChange('wishlist')}
          className={`pb-3 transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'wishlist'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-4 h-4" /> Wishlist ({wishlistProducts.length})
        </button>
        <button
          onClick={() => handleTabChange('addresses')}
          className={`pb-3 transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'addresses'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" /> Saved Addresses ({userProfile?.addresses?.length || 0})
        </button>
        <button
          onClick={() => handleTabChange('security')}
          className={`pb-3 transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'security'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" /> Profile & Security
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-slate-500">Loading your orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base mb-1">No Orders Yet</h3>
              <p className="text-xs text-slate-500 mb-4">
                You haven't placed any orders at {settings.siteName} yet.
              </p>
              <Link
                to={`${storeBasePath}/shop`}
                className="inline-block px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Order Reference</span>
                      {ord.fulfillmentMethod === 'self_pickup' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Self-Pickup
                        </span>
                      )}
                      {ord.paymentProofImage && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          Proof Attached
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">{ord.orderNumber}</span>
                    <span className="text-[10px] text-slate-400 block">
                      Placed on {new Date(ord.createdAt).toLocaleDateString()} • {getPaymentMethodLabel(ord.paymentMethod, ord.fulfillmentMethod)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-md ${
                        ord.orderStatus === 'Delivered' || ord.orderStatus === 'Collected' || ord.orderStatus === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.orderStatus === 'Cancelled' || ord.orderStatus === 'Returned' || ord.orderStatus === 'Refunded'
                          ? 'bg-rose-100 text-rose-800'
                          : ord.orderStatus === 'Shipped' || ord.orderStatus === 'Ready for Pickup'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ord.fulfillmentMethod === 'self_pickup'
                        ? ord.pickupStatus || derivePickupStatusFromOrderStatus(ord.orderStatus)
                        : ord.orderStatus}
                    </span>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">{formatPKR(ord.total)}</span>
                  </div>
                </div>

                {ord.fulfillmentMethod === 'self_pickup' && (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1 text-xs">
                      <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-emerald-700" />
                        {ord.pickupDetails?.locationName || 'Store Counter Pickup'}
                      </p>
                      {(ord.pickupAddress || ord.pickupDetails?.address) && (
                        <p className="text-[11px] text-slate-600">{ord.pickupAddress || ord.pickupDetails?.address}</p>
                      )}
                      {(ord.pickupDetails?.pickupDate || ord.pickupDetails?.preferredTime) && (
                        <p className="text-[11px] text-slate-700 tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-700" />
                          {ord.pickupDetails.pickupDate
                            ? `${ord.pickupDetails.pickupDate} · ${ord.pickupDetails.pickupSlotLabel || ''}`
                            : ord.pickupDetails.preferredTime}
                        </p>
                      )}
                      {ord.pickupDetails?.preparationTime && (
                        <p className="text-[11px] text-slate-600">
                          Prep Time: <strong className="text-slate-800">{ord.pickupDetails.preparationTime}</strong>
                        </p>
                      )}
                      {ord.pickupDetails?.instructions && (
                        <p className="text-[11px] text-slate-600">{ord.pickupDetails.instructions}</p>
                      )}
                      {ord.pickupVerifiedAt && (
                        <p className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1 pt-0.5 tabular-nums">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          Picked Up &amp; Verified on {new Date(ord.pickupVerifiedAt).toLocaleString()}
                        </p>
                      )}
                      {ord.pickupDetails?.mapUrl && (
                        <a
                          href={ord.pickupDetails.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-[#065F46] hover:underline inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" /> Open Google Maps Directions
                        </a>
                      )}
                      {ord.customerNotifications && ord.customerNotifications.length > 0 && (
                        <p className="text-[11px] text-slate-600 flex items-center gap-1 pt-0.5">
                          <Bell className="w-3 h-3 text-emerald-700 shrink-0" />
                          {ord.customerNotifications[ord.customerNotifications.length - 1].title}
                        </p>
                      )}
                    </div>

                    {ord.pickupOtp && ord.orderStatus !== 'Cancelled' && (
                      <PickupQrPass
                        compact
                        orderNumber={ord.orderNumber}
                        pickupOtp={ord.pickupOtp}
                        locationName={ord.pickupDetails?.locationName}
                        pickupVerifiedAt={ord.pickupVerifiedAt}
                        pickupVerifiedBy={ord.pickupVerifiedBy}
                      />
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {ord.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <img
                        src={it.image || FALLBACK_PRODUCT_IMAGE}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                        }}
                        alt={it.title}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{it.title}</p>
                        <p className="text-[10px] text-slate-400 tabular-nums">Qty: {it.quantity}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                        {formatPKR(it.price * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      to={`${storeBasePath}/tracking?order=${ord.orderNumber}`}
                      state={{ order: ord }}
                      className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      {ord.fulfillmentMethod === 'self_pickup' ? (
                        <>
                          <Store className="w-3.5 h-3.5" /> Track Pickup
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5" /> Track Shipment
                        </>
                      )}
                    </Link>
                    <Link
                      to={`${storeBasePath}/order-success/${ord.id}`}
                      state={{ order: ord }}
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Receipt
                    </Link>
                  </div>

                  {ord.orderStatus === 'Pending' && (
                    <button
                      onClick={() => setCancelTarget(ord)}
                      className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Order
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'wishlist' && renderWishlistGrid()}

      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Delivery Addresses</h3>
            <button
              onClick={() => setAddressModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-900 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Address
            </button>
          </div>

          {!userProfile?.addresses || userProfile.addresses.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-slate-100 p-6">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base mb-1">No Saved Addresses</h3>
              <p className="text-xs text-slate-500 mb-4">
                Add your home or office shipping address in Pakistan for 1-click checkout.
              </p>
              <button
                onClick={() => setAddressModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
              >
                + Add Shipping Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {userProfile.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-900">{addr.fullName}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{addr.address}</p>
                    <p className="text-xs text-slate-600">
                      {addr.city} {addr.postalCode && `• ${addr.postalCode}`}
                    </p>
                    <p className="text-xs font-semibold text-emerald-800 mt-2">{addr.phone}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex justify-end">
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addressModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-base text-slate-900">Add New Shipping Address</h3>
                <form onSubmit={handleAddAddress} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Receiver name"
                      value={addrName}
                      onChange={(e) => setAddrName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pakistani Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="0300 1234567"
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      placeholder="House/Street/Sector"
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                      <CitySelect
                        value={addrCity}
                        onChange={setAddrCity}
                        required
                        placeholder="Select city..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        placeholder="75500"
                        value={addrPostal}
                        onChange={(e) => setAddrPostal(e.target.value)}
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setAddressModalOpen(false)}
                      className="flex-1 py-2 border rounded-xl text-xs font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4"
          >
            <h3 className="font-bold text-sm text-slate-900">Personal Profile Information</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                placeholder="0300 1234567"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 self-start">
            <h3 className="font-bold text-sm text-slate-900">Account Security & Password</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Click below to receive a secure password reset link on your registered email address ({currentUser.email}).
            </p>
            <button
              onClick={async () => {
                if (currentUser.email) {
                  await resetPassword(currentUser.email);
                  showToast('Password reset link dispatched to your inbox!', 'success');
                }
              }}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" /> Send Password Reset Email
            </button>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Cancel Pending Order?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to cancel order <code className="font-mono font-bold text-slate-900">{cancelTarget.orderNumber}</code>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancellingOrder}
                onClick={confirmCancelOrder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {cancellingOrder ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

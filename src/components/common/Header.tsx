import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Phone,
  Truck,
  ChevronDown,
  LogOut,
  Package,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useTenant } from '../../context/TenantContext';
import { AuthModal } from './AuthModal';
import { getShopProducts, getShopCategories } from '../../services/tenantService';
import { Product, Category } from '../../types';
import {
  formatPKR,
  FALLBACK_PRODUCT_IMAGE,
} from '../../data/seedData';
import { SafeImage } from './SafeImage';

export const Header: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { itemCount, setCartDrawerOpen } = useCart();
  const { wishlistIds } = useWishlist();
  const { shopId, settings, storeBasePath } = useTenant();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const brandColor = settings.primaryColor || '#065f46';

  useEffect(() => {
    let active = true;
    Promise.all([getShopProducts(shopId), getShopCategories(shopId)])
      .then(([prods, cats]) => {
        if (!active) return;
        setAllProducts(prods);
        setCategories(cats);
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, [shopId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w.length > 1);
    const hits = allProducts
      .filter((p) => {
        const fullText = `${p.title} ${p.brand} ${p.category}`.toLowerCase();
        if (fullText.includes(q)) return true;
        return (
          words.length > 0 &&
          words.some((w) => {
            const root = w.endsWith('es') ? w.slice(0, -2) : w.endsWith('s') ? w.slice(0, -1) : w;
            return fullText.includes(w) || (root.length > 2 && fullText.includes(root));
          })
        );
      })
      .slice(0, 5);
    setSearchResults(hits);
  }, [searchQuery, allProducts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktopSearch = searchRef.current && searchRef.current.contains(target);
      const inMobileSearch = mobileSearchRef.current && mobileSearchRef.current.contains(target);
      if (!inDesktopSearch && !inMobileSearch) {
        setSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchFocused(false);
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`${storeBasePath}/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        {/* 1. Announcement Bar */}
        <div
          className="text-white/95 text-[11px] sm:text-xs py-2 px-3 sm:px-4"
          style={{ backgroundColor: brandColor }}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 font-medium truncate max-w-full">
              <span className="inline-block shrink-0">🇵🇰</span>
              <span className="truncate">{settings.announcement}</span>
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-4 text-[11px] text-white/85 shrink-0">
              <Link to={`${storeBasePath}/tracking`} className="hover:text-white flex items-center gap-1 transition">
                <Truck className="w-3.5 h-3.5" /> Track Order
              </Link>
              {settings.contactPhone && (
                <>
                  <span>|</span>
                  <a
                    href={`tel:${settings.contactPhone}`}
                    className="hover:text-white flex items-center gap-1 transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> {settings.contactPhone}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Main Header */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 shrink-0"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo */}
            <Link to={storeBasePath} className="flex items-center gap-2.5 shrink-0 min-w-0">
              {settings.logoUrl ? (
                <SafeImage
                  src={settings.logoUrl}
                  alt={settings.siteName}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg sm:text-xl shadow-md shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  <span>{(settings.siteName || 'S')[0].toUpperCase()}</span>
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-0.5 truncate">
                  {settings.siteName === 'SB Khush' ? (
                    <>
                      SB <span className="text-emerald-700">Khush</span>
                    </>
                  ) : (
                    <span>{settings.siteName}</span>
                  )}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold -mt-0.5 hidden sm:block">
                  {settings.city ? `${settings.city} • Verified Store` : 'Pakistan Online Store'}
                </span>
              </div>
            </Link>

            {/* Desktop Search Bar */}
            <div ref={searchRef} className="flex-1 max-w-2xl relative hidden md:block">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder={`Search products in ${settings.siteName}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="w-full pl-11 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-22 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 text-white rounded-xl text-xs font-semibold transition"
                  style={{ backgroundColor: brandColor }}
                >
                  Search
                </button>
              </form>

              {/* Predictive Search Dropdown */}
              {searchFocused && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
                  {searchResults.length > 0 ? (
                    <div className="p-2 divide-y divide-slate-100">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Products matching "{searchQuery}"
                      </div>
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          to={`${storeBasePath}/product/${item.id}`}
                          onClick={() => setSearchFocused(false)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition"
                        >
                          <SafeImage
                            src={item.images[0] || FALLBACK_PRODUCT_IMAGE}
                            fallbackSrc={FALLBACK_PRODUCT_IMAGE}
                            alt={item.title}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-100 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 truncate">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold text-emerald-800 tabular-nums">
                                {formatPKR(item.salePrice ?? item.regularPrice)}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-medium">
                                {item.brand}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      <Link
                        to={`${storeBasePath}/shop?search=${encodeURIComponent(searchQuery)}`}
                        onClick={() => setSearchFocused(false)}
                        className="block text-center py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-xl transition"
                      >
                        View all results for "{searchQuery}"
                      </Link>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No matching products found in {settings.siteName}.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right actions (Customer Storefront Only — No Public Admin Links) */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Wishlist */}
              <Link
                to={`${storeBasePath}/account?tab=wishlist`}
                className="relative p-2 sm:p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition"
                title="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistIds.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {wishlistIds.length}
                  </span>
                )}
              </Link>

              {/* Cart Drawer Trigger */}
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition"
                aria-label="Open Cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-emerald-700" />
                  {itemCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-700 text-white rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {itemCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-emerald-900">Cart</span>
              </button>

              {/* User Account / Login */}
              <div ref={userMenuRef} className="relative">
                {currentUser ? (
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100 transition"
                    aria-label="Account Menu"
                  >
                    <div
                      className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center"
                      style={{ backgroundColor: brandColor }}
                    >
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                  </button>
                ) : (
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition shadow-xs"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden xs:inline sm:inline">Sign In</span>
                  </button>
                )}

                {/* Customer Account Dropdown */}
                {userDropdownOpen && currentUser && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in divide-y divide-slate-100">
                    <div className="px-4 py-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.displayName || 'Customer'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    </div>
                    <div className="py-1 text-xs text-slate-700">
                      <Link
                        to={`${storeBasePath}/account`}
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 transition"
                      >
                        <User className="w-4 h-4 text-slate-400" /> My Profile
                      </Link>
                      <Link
                        to={`${storeBasePath}/account?tab=orders`}
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 transition"
                      >
                        <Package className="w-4 h-4 text-slate-400" /> Order History
                      </Link>
                      <Link
                        to={`${storeBasePath}/account?tab=wishlist`}
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 transition"
                      >
                        <Heart className="w-4 h-4 text-slate-400" /> Wishlist ({wishlistIds.length})
                      </Link>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await logout();
                        }}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition font-medium"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Search with Predictive Dropdown */}
          <div ref={mobileSearchRef} className="mt-2.5 md:hidden relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder={`Search ${settings.siteName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-14 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-3 text-white rounded-lg text-xs font-semibold"
                style={{ backgroundColor: brandColor }}
              >
                Find
              </button>
            </form>

            {searchFocused && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                {searchResults.length > 0 ? (
                  <div className="p-2 divide-y divide-slate-100">
                    {searchResults.map((item) => (
                      <Link
                        key={item.id}
                        to={`${storeBasePath}/product/${item.id}`}
                        onClick={() => setSearchFocused(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50"
                      >
                        <SafeImage
                          src={item.images[0] || FALLBACK_PRODUCT_IMAGE}
                          fallbackSrc={FALLBACK_PRODUCT_IMAGE}
                          alt={item.title}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                          <p className="text-xs font-bold text-emerald-700 tabular-nums">
                            {formatPKR(item.salePrice ?? item.regularPrice)}
                          </p>
                        </div>
                      </Link>
                    ))}
                    <Link
                      to={`${storeBasePath}/shop?search=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setSearchFocused(false)}
                      className="block text-center py-2 text-xs font-semibold text-emerald-700"
                    >
                      View all results
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching products found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Desktop Category Navigation Bar */}
        <div className="bg-slate-50 border-t border-slate-100 hidden lg:block">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs font-medium text-slate-700">
            <div className="flex items-center gap-6 overflow-x-auto py-2.5">
              <Link
                to={`${storeBasePath}/shop`}
                className="text-emerald-800 font-bold hover:text-emerald-950 flex items-center gap-1 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" /> All Products
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`${storeBasePath}/shop?category=${cat.slug}`}
                  className="hover:text-emerald-700 transition whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                to={`${storeBasePath}/shop?featured=true`}
                className="text-rose-600 font-semibold hover:text-rose-800 whitespace-nowrap"
              >
                Flash Deals
              </Link>
            </div>
            <div className="flex items-center gap-4 text-slate-500 shrink-0">
              <Link to={`${storeBasePath}/about`} className="hover:text-emerald-700 transition">
                About
              </Link>
              <Link to={`${storeBasePath}/contact`} className="hover:text-emerald-700 transition">
                Contact
              </Link>
              <Link to={`${storeBasePath}/faq`} className="hover:text-emerald-700 transition">
                FAQs
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Slide Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white p-4 space-y-4 animate-fade-in shadow-xl max-h-[75vh] overflow-y-auto">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Browse Categories
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link to={`${storeBasePath}/shop`} className="p-2.5 bg-emerald-50 rounded-xl font-bold text-emerald-800">
                All Products
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`${storeBasePath}/shop?category=${cat.slug}`}
                  className="p-2.5 bg-slate-50 rounded-xl font-medium text-slate-800 hover:bg-slate-100 truncate"
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1 text-xs">
              <Link to={`${storeBasePath}/shop?featured=true`} className="flex items-center gap-2 p-2 text-rose-600 font-semibold">
                Flash Deals
              </Link>
              <Link to={`${storeBasePath}/tracking`} className="flex items-center gap-2 p-2 text-slate-700">
                <Truck className="w-4 h-4 text-emerald-700" /> Track My Parcel
              </Link>
              <Link to={`${storeBasePath}/account`} className="flex items-center gap-2 p-2 text-slate-700">
                <User className="w-4 h-4 text-emerald-700" /> My Account & Orders
              </Link>
              <Link to={`${storeBasePath}/about`} className="flex items-center gap-2 p-2 text-slate-700">
                About {settings.siteName}
              </Link>
              <Link to={`${storeBasePath}/contact`} className="flex items-center gap-2 p-2 text-slate-700">
                <Phone className="w-4 h-4 text-emerald-700" /> Customer Support
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
};

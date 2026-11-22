import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Truck,
  ShieldCheck,
  RotateCcw,
  Star,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  Award,
  Package,
} from 'lucide-react';
import {
  getShopProducts,
  getShopCategories,
  getShopBanners,
  getShopRecentReviews,
} from '../services/tenantService';
import { Product, Category, Banner, Review } from '../types';
import { ProductCard } from '../components/common/ProductCard';
import { QuickViewModal } from '../components/common/QuickViewModal';
import { FALLBACK_PRODUCT_IMAGE } from '../data/seedData';
import { useTenant } from '../context/TenantContext';
import defaultStoreBanner from '../assets/images/storefront_banner_default_1795028612348.jpg';

export const HomePage: React.FC = () => {
  const { shopId, settings, storeBasePath } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveStoreLink = (link?: string) => {
    if (!link) return `${storeBasePath}/shop`;
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    if (link.startsWith('/s/')) return link;
    return `${storeBasePath}${link.startsWith('/') ? link : `/${link}`}`;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getShopProducts(shopId),
      getShopCategories(shopId),
      getShopBanners(shopId),
      getShopRecentReviews(shopId, 6),
    ])
      .then(([prods, cats, bans, revs]) => {
        if (!active) return;
        setProducts(prods);
        setCategories(cats);
        setRecentReviews(revs);

        if (bans.length > 0) {
          setBanners(bans);
        } else {
          setBanners([
            {
              id: 'default-store-hero',
              title: `Welcome to ${settings.siteName}`,
              subtitle: `Quality everyday essentials, verified brands, and express courier or self-pickup service in ${settings.city || 'Pakistan'}.`,
              link: '/shop',
              imageUrl: defaultStoreBanner,
              buttonText: 'Shop Catalog',
              isActive: true,
              order: 1,
            },
          ]);
        }
        setCurrentBanner(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shopId, settings.siteName, settings.city]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const trendingProducts = products.slice(0, 8);
  const bestSellers = [...products].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4);
  const brandColor = settings.primaryColor || '#065f46';

  return (
    <div className="space-y-10 sm:space-y-16 pb-16">
      {/* 1. Hero Banner Carousel */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="relative min-h-[420px] sm:min-h-[500px] lg:min-h-[540px] flex items-center">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <img
                src={banner.imageUrl || defaultStoreBanner}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = defaultStoreBanner;
                }}
                alt={banner.title}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/20" />

              <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-14 h-full flex flex-col justify-center">
                <div className="max-w-xl space-y-3 sm:space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] sm:text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    {settings.siteName} • {settings.city || 'Pakistan'}
                  </div>

                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                    {banner.title}
                  </h1>

                  <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-lg">
                    {banner.subtitle}
                  </p>

                  <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-2">
                    <Link
                      to={resolveStoreLink(banner.link)}
                      className="px-5 sm:px-6 py-3 sm:py-3.5 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 transition hover:brightness-110"
                      style={{ backgroundColor: brandColor }}
                    >
                      {banner.buttonText || 'Shop Collection'}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to={`${storeBasePath}/shop`}
                      className="px-5 sm:px-6 py-3 sm:py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-xs sm:text-sm backdrop-blur-xs transition"
                    >
                      Explore All Products
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {banners.length > 1 && (
            <>
              <button
                onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
                className="hidden sm:flex absolute left-3 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
                className="hidden sm:flex absolute right-3 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition"
                aria-label="Next Slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 sm:bottom-5 inset-x-0 z-20 flex justify-center gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentBanner ? 'w-8 bg-emerald-500' : 'w-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. Key Trust Bar */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Nationwide COD</h4>
              <p className="text-[11px] text-slate-500">Pay when order reaches your door</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">EasyPaisa & JazzCash</h4>
              <p className="text-[11px] text-slate-500">Mobile wallets & Bank IBFT accepted</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">7-Day Free Return</h4>
              <p className="text-[11px] text-slate-500">Easy exchange guarantee</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Self-Pickup & Courier</h4>
              <p className="text-[11px] text-slate-500">Collect in store or ship via TCS</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6 gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Curated Collections
              </span>
              <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Shop by Category
              </h2>
            </div>
            <Link
              to={`${storeBasePath}/shop`}
              className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group shrink-0"
            >
              All Categories <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`${storeBasePath}/shop?category=${cat.slug}`}
                className="group relative bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 hover:border-emerald-300 hover:shadow-lg transition flex flex-col items-center text-center p-3.5 sm:p-4"
              >
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border-2 border-white shadow-md group-hover:scale-105 transition duration-300">
                  <img
                    src={cat.imageUrl || FALLBACK_PRODUCT_IMAGE}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                    }}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-emerald-700 transition">
                  {cat.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cat.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Trending Products */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6 gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600">
              <Flame className="w-4 h-4 fill-rose-600" />
              <span>Featured in {settings.siteName}</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Trending Products
            </h2>
          </div>
          <Link
            to={`${storeBasePath}/shop`}
            className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group shrink-0"
          >
            View More <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : trendingProducts.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Catalog Updating Soon</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {settings.siteName} is preparing fresh products. Check back shortly or message us on WhatsApp!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {trendingProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Promotional Discount Banner */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-950 text-white p-6 sm:p-12 shadow-2xl">
          <div className="relative z-10 max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider border border-rose-400/30">
              <Clock className="w-3.5 h-3.5" /> Limited Time Deal
            </div>
            <h3 className="text-2xl sm:text-4xl font-black leading-tight">
              Festive Season Savings at {settings.siteName}
            </h3>
            <p className="text-xs sm:text-sm text-slate-200">
              Enjoy nationwide Cash on Delivery or Rs. 0 Self-Pickup directly from our {settings.city || 'store'} outlet. Free delivery unlocked above Rs. {settings.freeShippingThreshold.toLocaleString('en-PK')}.
            </p>
            <div className="pt-2">
              <Link
                to={`${storeBasePath}/shop?featured=true`}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg"
              >
                Shop Featured Deals <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="absolute -right-12 -bottom-12 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </div>
      </section>

      {/* 6. Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6 gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Customer Favorites
              </span>
              <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Best Sellers
              </h2>
            </div>
            <Link
              to={`${storeBasePath}/shop`}
              className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group shrink-0"
            >
              Browse All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {bestSellers.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. Customer Reviews (Rendered only when real reviews exist in Firestore) */}
      {recentReviews.length > 0 && (
        <section className="bg-slate-50 py-12 sm:py-14 border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Customer Feedback
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Recent Shopper Reviews
              </h2>
              <p className="text-xs text-slate-500 mt-2">
                Reviews submitted by customers on {settings.siteName}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {recentReviews.slice(0, 6).map((rev) => {
                const initials = (rev.userName || 'C')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() || '')
                  .join('') || 'C';
                return (
                  <div
                    key={rev.id}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex text-amber-400 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.round(rev.rating || 5) ? 'fill-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-4">
                        "{rev.comment}"
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{rev.userName}</h4>
                        <p className="text-[10px] text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

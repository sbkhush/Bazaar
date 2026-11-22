import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Filter,
  SlidersHorizontal,
  X,
  Search,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import { getShopProducts, getShopCategories } from '../services/tenantService';
import { Product, Category } from '../types';
import { ProductCard } from '../components/common/ProductCard';
import { QuickViewModal } from '../components/common/QuickViewModal';
import { MarketBuyingGuide } from '../components/shop/MarketBuyingGuide';
import { formatPKR } from '../data/seedData';
import { useTenant } from '../context/TenantContext';
import { DynamicSeoHead } from '../components/common/DynamicSeoHead';

export const ShopPage: React.FC = () => {
  const { shopId, shop, settings, plan } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryParam = searchParams.get('category') || '';
  const searchParam = searchParams.get('search') || '';
  const featuredParam = searchParams.get('featured') === 'true';

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [searchQuery, setSearchQuery] = useState<string>(searchParam);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [priceMax, setPriceMax] = useState<number>(25000);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getShopProducts(shopId), getShopCategories(shopId)])
      .then(([prods, cats]) => {
        if (!active) return;
        setProducts(prods);
        setCategories(cats);

        const maxProdPrice = prods.reduce((m, p) => Math.max(m, p.regularPrice || 0), 25000);
        setPriceMax(Math.max(25000, Math.ceil(maxProdPrice / 5000) * 5000));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shopId]);

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || '');
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const sliderMax = useMemo(() => {
    const highest = products.reduce((m, p) => Math.max(m, p.regularPrice || 0), 25000);
    return Math.max(25000, Math.ceil(highest / 5000) * 5000);
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory && p.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const words = q.split(/\s+/).filter((w) => w.length > 1);
          const fullText = `${p.title} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
          const directMatch = fullText.includes(q);
          const keywordsMatch =
            words.length > 0 &&
            words.some((w) => {
              const rootWord = w.endsWith('es') ? w.slice(0, -2) : w.endsWith('s') ? w.slice(0, -1) : w;
              return fullText.includes(w) || (rootWord.length > 2 && fullText.includes(rootWord));
            });
          if (!directMatch && !keywordsMatch) return false;
        }
        if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
        const effectivePrice = p.salePrice ?? p.regularPrice;
        if (effectivePrice > priceMax) return false;
        if (inStockOnly && p.stock <= 0) return false;
        if (featuredParam && !p.isFeatured) return false;

        return true;
      })
      .sort((a, b) => {
        const priceA = a.salePrice ?? a.regularPrice;
        const priceB = b.salePrice ?? b.regularPrice;
        if (sortBy === 'price-low') return priceA - priceB;
        if (sortBy === 'price-high') return priceB - priceA;
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return b.reviewCount - a.reviewCount;
      });
  }, [
    products,
    selectedCategory,
    searchQuery,
    selectedBrand,
    priceMax,
    inStockOnly,
    sortBy,
    featuredParam,
  ]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setSelectedBrand('all');
    setPriceMax(sliderMax);
    setInStockOnly(false);
    setSortBy('popularity');
    setSearchParams({});
  };

  const activeCategoryName = selectedCategory
    ? categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory
    : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <DynamicSeoHead
        shop={shop}
        settings={settings}
        categoryName={activeCategoryName}
        searchQuery={searchQuery.trim() || undefined}
      />
      {/* Top Breadcrumb & Title */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {selectedCategory
              ? categories.find((c) => c.slug === selectedCategory)?.name || 'Category Collection'
              : searchQuery
              ? `Search Results for "${searchQuery}"`
              : featuredParam
              ? 'Featured Deals & Flash Sale'
              : `${settings.siteName} Catalog`}
          </h1>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Showing {filteredProducts.length} products available for delivery & pickup
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-auto text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              <option value="popularity">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>
      </div>

      {/* Google Search Grounded Buying Guide & Pakistan Market Trends */}
      {Boolean(plan?.features?.buyingGuide) && (
        <div className="mb-8">
          <MarketBuyingGuide
            currentCategory={selectedCategory}
            storeName={settings.siteName}
            onApplySearch={(q) => {
              setSearchQuery(q);
              setSearchParams({ search: q });
            }}
          />
        </div>
      )}

      <div className="flex gap-8 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="w-64 shrink-0 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hidden lg:block space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-700" /> Filter Catalog
            </h3>
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-slate-400 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Keyword Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Categories</label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  const next = new URLSearchParams(searchParams);
                  next.delete('category');
                  setSearchParams(next);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                  selectedCategory === ''
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat.slug).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.slug);
                      setSearchParams({ category: cat.slug });
                    }}
                    className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                      selectedCategory === cat.slug
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span>Max Price</span>
              <span className="text-emerald-700 font-bold tabular-nums">{formatPKR(priceMax)}</span>
            </div>
            <input
              type="range"
              min="500"
              max={sliderMax}
              step="500"
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
              <span>Rs. 500</span>
              <span>{formatPKR(sliderMax)}</span>
            </div>
          </div>

          {brands.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded text-emerald-700 focus:ring-emerald-600"
              />
              <span>In Stock Only</span>
            </label>
          </div>
        </aside>

        {/* Mobile Filter Drawer */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileFilterOpen(false)}
            />
            <div className="relative ml-auto w-full max-w-xs bg-white h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-base text-slate-800">Filter Products</h3>
                  <button onClick={() => setMobileFilterOpen(false)} className="p-1" aria-label="Close Filters">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Keyword Search</label>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {brands.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="all">All Brands</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-2 tabular-nums">
                    Max Price: <span className="text-emerald-700">{formatPKR(priceMax)}</span>
                  </label>
                  <input
                    type="range"
                    min="500"
                    max={sliderMax}
                    step="500"
                    value={priceMax}
                    onChange={(e) => setPriceMax(Number(e.target.value))}
                    className="w-full accent-emerald-700"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded text-emerald-700"
                  />
                  In Stock Only
                </label>
              </div>

              <div className="pt-6 border-t flex gap-2">
                <button
                  onClick={() => {
                    handleResetFilters();
                    setMobileFilterOpen(false);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Reset
                </button>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex-1 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold"
                >
                  Show ({filteredProducts.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-slate-100 rounded-2xl" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-8 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">No products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                {products.length === 0
                  ? `${settings.siteName} has not added products to this catalog yet.`
                  : "We couldn't find any products matching your filters. Try resetting the filters."}
              </p>
              {products.length > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={(p) => setQuickViewProduct(p)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

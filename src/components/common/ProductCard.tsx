import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star, Eye } from 'lucide-react';
import { Product } from '../../types';
import { formatPKR, FALLBACK_PRODUCT_IMAGE } from '../../data/seedData';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from './Toast';
import { SafeImage } from './SafeImage';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { storeBasePath } = useTenant();
  const { showToast } = useToast();
  const [isHovered, setIsHovered] = useState(false);

  const price = product.salePrice ?? product.regularPrice;
  const hasDiscount = Boolean(product.salePrice && product.salePrice < product.regularPrice);
  const discountPercent = hasDiscount
    ? Math.round(((product.regularPrice - product.salePrice!) / product.regularPrice) * 100)
    : 0;
  const isFavorited = isInWishlist(product.id);
  const productUrl = `${storeBasePath}/product/${product.id}`;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.variants && product.variants.length > 0 && onQuickView) {
      onQuickView(product);
      return;
    }

    addToCart(product, 1);
    showToast(`Added "${product.title}" to your cart!`, 'success');
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
    showToast(
      isFavorited ? 'Removed from wishlist' : 'Saved to your wishlist!',
      isFavorited ? 'info' : 'success'
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
    >
      {/* Image container */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        <Link to={productUrl} className="block w-full h-full">
          <SafeImage
            src={product.images[0] || FALLBACK_PRODUCT_IMAGE}
            fallbackSrc={FALLBACK_PRODUCT_IMAGE}
            fallbackText={product.title}
            alt={product.title}
            width={400}
            height={400}
            className={`w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
              product.images[1] && isHovered ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
            decoding="async"
          />
          {product.images[1] && (
            <SafeImage
              src={product.images[1]}
              fallbackSrc={FALLBACK_PRODUCT_IMAGE}
              alt={product.title}
              width={400}
              height={400}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
                isHovered ? 'opacity-100 scale-105' : 'opacity-0'
              }`}
              loading="lazy"
              decoding="async"
            />
          )}
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10 pointer-events-none">
          {hasDiscount && (
            <span className="bg-rose-600 text-white font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md shadow-sm tabular-nums">
              -{discountPercent}% OFF
            </span>
          )}
          {product.isFeatured && (
            <span className="bg-emerald-700 text-white font-semibold text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm">
              Featured
            </span>
          )}
          {product.stock <= 5 && product.stock > 0 && (
            <span className="bg-amber-600 text-white font-semibold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md shadow-sm tabular-nums">
              Only {product.stock} left
            </span>
          )}
        </div>

        {/* Floating actions */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <button
            onClick={handleWishlistToggle}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
              isFavorited
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-white/90 backdrop-blur-xs text-slate-600 hover:text-rose-600 hover:bg-white'
            }`}
            title="Add to Wishlist"
            aria-label="Add to Wishlist"
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-600' : ''}`} />
          </button>

          {onQuickView && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 backdrop-blur-xs text-slate-600 hover:text-emerald-700 hover:bg-white flex items-center justify-center shadow-md transition md:opacity-0 md:group-hover:opacity-100"
              title="Quick View"
              aria-label="Quick View"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Add overlay button */}
        <div className="hidden md:block absolute bottom-3 inset-x-3 z-10 transition-all duration-300 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
          <button
            onClick={handleQuickAdd}
            disabled={product.stock <= 0}
            className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-lg flex items-center justify-center gap-2 transition disabled:bg-slate-400"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {product.stock <= 0 ? 'Out of Stock' : product.variants?.length ? 'Choose Options' : 'Quick Add to Cart'}
          </button>
        </div>
      </div>

      {/* Info details */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 gap-1">
            <span className="uppercase tracking-wider font-semibold text-[10px] text-emerald-800 truncate">
              {product.brand}
            </span>
            <div className="flex items-center gap-0.5 text-amber-500 font-semibold text-[11px] shrink-0 tabular-nums">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-slate-400 text-[10px]">({product.reviewCount})</span>
            </div>
          </div>

          <Link to={productUrl} className="block">
            <h3 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 hover:text-emerald-700 transition leading-snug">
              {product.title}
            </h3>
          </Link>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-baseline gap-1.5 flex-wrap tabular-nums">
              <span className="text-sm sm:text-base font-extrabold text-slate-900">
                {formatPKR(price)}
              </span>
              {hasDiscount && (
                <span className="text-[11px] text-slate-400 line-through">
                  {formatPKR(product.regularPrice)}
                </span>
              )}
            </div>
            <span className="hidden sm:inline-block text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
              Verified
            </span>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={product.stock <= 0}
            className="md:hidden w-full py-2 px-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition disabled:bg-slate-300"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {product.stock <= 0 ? 'Out of Stock' : product.variants?.length ? 'Options' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

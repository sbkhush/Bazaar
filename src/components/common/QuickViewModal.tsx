import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, ShoppingBag, ArrowRight, Heart, ShieldCheck, Truck } from 'lucide-react';
import { Product } from '../../types';
import { formatPKR, FALLBACK_PRODUCT_IMAGE } from '../../data/seedData';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from './Toast';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ product, onClose }) => {
  const { addToCart, setCartDrawerOpen } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { storeBasePath } = useTenant();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>('');

  React.useEffect(() => {
    if (product) {
      setSelectedImage(product.images[0] || FALLBACK_PRODUCT_IMAGE);
      const defaults: Record<string, string> = {};
      if (product.variants) {
        product.variants.forEach((v) => {
          if (v.options && v.options.length > 0) {
            defaults[v.name] = v.options[0];
          }
        });
      }
      setSelectedVariants(defaults);
      setQuantity(1);
    }
  }, [product]);

  if (!product) return null;

  const price = product.salePrice ?? product.regularPrice;
  const hasDiscount = Boolean(product.salePrice && product.salePrice < product.regularPrice);
  const isFavorited = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedVariants);
    showToast(`Added ${quantity}x "${product.title}" to cart!`, 'success');
    onClose();
  };

  const handleBuyNow = () => {
    addToCart(product, quantity, selectedVariants);
    onClose();
    setCartDrawerOpen(false);
    navigate(`${storeBasePath}/checkout`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-y-auto md:overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col md:flex-row">
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-900 shadow-md transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gallery */}
        <div className="md:w-1/2 p-4 sm:p-6 bg-slate-50 flex flex-col justify-between shrink-0">
          <div className="aspect-square w-full max-h-64 sm:max-h-none mx-auto rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-xs mb-3 sm:mb-4">
            <img
              src={selectedImage || product.images[0] || FALLBACK_PRODUCT_IMAGE}
              alt={product.title}
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
              }}
              className="w-full h-full object-cover object-center"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                    selectedImage === img ? 'border-emerald-700 ring-2 ring-emerald-200' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img || FALLBACK_PRODUCT_IMAGE}
                    alt={`${product.title} thumbnail ${idx + 1}`}
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                    }}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="md:w-1/2 p-4 sm:p-6 flex flex-col justify-between md:overflow-y-auto">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-bold text-emerald-800 uppercase tracking-wider">{product.brand}</span>
              <span className="text-slate-400">SKU: {product.sku}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 leading-snug mb-2">{product.title}</h2>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.floor(product.rating) ? 'fill-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">{product.rating}</span>
              <span className="text-xs text-slate-400 tabular-nums">({product.reviewCount} reviews)</span>
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-3 mb-4 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 tabular-nums">
              <span className="text-2xl font-black text-slate-900">{formatPKR(price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-slate-400 line-through">
                    {formatPKR(product.regularPrice)}
                  </span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
                    Save {formatPKR(product.regularPrice - product.salePrice!)}
                  </span>
                </>
              )}
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-3 mb-4">
                {product.variants.map((v) => (
                  <div key={v.name}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {v.name}: <span className="font-normal text-emerald-800">{selectedVariants[v.name]}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {v.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setSelectedVariants((prev) => ({ ...prev, [v.name]: opt }))
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                            selectedVariants[v.name] === opt
                              ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs font-semibold text-slate-700">Quantity:</span>
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-l-xl"
                >
                  -
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-800 tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock || 99, q + 1))}
                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-r-xl"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>

            {/* Quick Guarantees */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-3 mb-4">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cash on Delivery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Authentic Item</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="flex-1 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition disabled:bg-slate-300"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Cart
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={product.stock <= 0}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition disabled:bg-slate-300"
              >
                Buy Now
              </button>
            </div>
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => {
                  toggleWishlist(product.id);
                  showToast(isFavorited ? 'Removed from wishlist' : 'Saved to wishlist!', 'info');
                }}
                className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1.5 font-medium"
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-rose-600 text-rose-600' : ''}`} />
                {isFavorited ? 'Saved to Wishlist' : 'Add to Wishlist'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`${storeBasePath}/product/${product.id}`);
                }}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                View Full Specifications <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

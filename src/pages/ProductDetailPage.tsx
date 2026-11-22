import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star,
  ShoppingBag,
  Heart,
  Truck,
  ShieldCheck,
  RotateCcw,
  Check,
  ArrowRight,
  Share2,
  MessageSquare,
} from 'lucide-react';
import {
  getShopProductById,
  getShopProducts,
  getShopProductReviews,
  addShopProductReview,
} from '../services/tenantService';
import { Product, Review } from '../types';
import {
  formatPKR,
  FALLBACK_PRODUCT_IMAGE,
} from '../data/seedData';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../components/common/Toast';
import { ProductCard } from '../components/common/ProductCard';
import { DynamicSeoHead } from '../components/common/DynamicSeoHead';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, setCartDrawerOpen } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { currentUser } = useAuth();
  const { shopId, shop, settings, storeBasePath } = useTenant();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews'>('desc');
  const [loading, setLoading] = useState(true);

  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    getShopProductById(shopId, id)
      .then((found) => {
        if (!active) return;
        const resolved = found;
        setProduct(resolved);
        if (resolved) {
          setSelectedImage(resolved.images[0] || FALLBACK_PRODUCT_IMAGE);
          const defs: Record<string, string> = {};
          resolved.variants?.forEach((v) => {
            if (v.options?.length > 0) defs[v.name] = v.options[0];
          });
          setSelectedVariants(defs);

          getShopProducts(shopId, { category: resolved.category }).then((all) => {
            if (!active) return;
            setRelatedProducts(all.filter((item) => item.id !== resolved.id).slice(0, 4));
          });

          getShopProductReviews(shopId, resolved.id).then((revs) => {
            if (active) setReviews(revs);
          });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, shopId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-slate-500">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          The item you are searching for might have been moved or unpublished.
        </p>
        <Link
          to={`${storeBasePath}/shop`}
          className="px-6 py-3 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
        >
          Return to {settings.siteName}
        </Link>
      </div>
    );
  }

  const price = product.salePrice ?? product.regularPrice;
  const hasDiscount = Boolean(product.salePrice && product.salePrice < product.regularPrice);
  const isFavorited = isInWishlist(product.id);

  const displayRating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
      : product.rating;
  const displayReviewCount = Math.max(reviews.length, product.reviewCount || 0);

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedVariants);
    showToast(`Added ${quantity}x "${product.title}" to cart!`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity, selectedVariants);
    setCartDrawerOpen(false);
    navigate(`${storeBasePath}/checkout`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: product.title,
          text: `Check out ${product.title} at ${settings.siteName}:`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard!', 'info');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingReview(true);
    try {
      const revData = {
        productId: product.id,
        userId: currentUser?.uid || 'guest_buyer',
        userName: reviewerName.trim() || currentUser?.displayName || 'Verified Buyer',
        userEmail: currentUser?.email || settings.contactEmail || 'customer@store.pk',
        rating: newRating,
        comment: newComment.trim(),
      };
      const newId = await addShopProductReview(shopId, revData);
      setReviews((prev) => [
        {
          ...revData,
          id: newId,
          shopId,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewComment('');
      setReviewerName('');
      showToast('Thank you! Your review has been published.', 'success');
    } catch {
      showToast('Could not save your review right now.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-10 sm:space-y-12">
      <DynamicSeoHead shop={shop} settings={settings} product={product} />
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <Link to={storeBasePath} className="hover:text-emerald-700">Home</Link>
        <span>/</span>
        <Link to={`${storeBasePath}/shop`} className="hover:text-emerald-700">Shop</Link>
        <span>/</span>
        <Link to={`${storeBasePath}/shop?category=${product.category}`} className="hover:text-emerald-700 capitalize">
          {product.category.replace(/-/g, ' ')}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-semibold truncate max-w-[180px] sm:max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-start">
        <div className="space-y-4">
          <div className="aspect-square w-full rounded-3xl overflow-hidden bg-slate-50 border border-slate-200/80 shadow-xs relative">
            <img
              src={selectedImage || product.images[0] || FALLBACK_PRODUCT_IMAGE}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
              }}
              alt={product.title}
              className="w-full h-full object-cover object-center"
            />
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-rose-600 text-white font-black text-xs px-3 py-1.5 rounded-md shadow-md tabular-nums">
                SAVE {formatPKR(product.regularPrice - product.salePrice!)}
              </span>
            )}
            <button
              onClick={handleShare}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/80 hover:bg-white text-slate-600 shadow-md backdrop-blur-xs transition"
              title="Share Product"
              aria-label="Share Product"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition shrink-0 ${
                    selectedImage === img
                      ? 'border-emerald-700 ring-2 ring-emerald-200'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img || FALLBACK_PRODUCT_IMAGE}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                    }}
                    alt="thumb"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-bold text-emerald-800 uppercase tracking-widest text-[11px]">
                {product.brand}
              </span>
              <span className="font-mono">SKU: {product.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {product.title}
            </h1>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(displayRating) ? 'fill-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-800 tabular-nums">{displayRating}</span>
              <span className="text-slate-300">•</span>
              <button
                onClick={() => setActiveTab('reviews')}
                className="text-xs text-emerald-700 hover:underline font-semibold tabular-nums"
              >
                {displayReviewCount} customer reviews
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-baseline gap-3 tabular-nums">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{formatPKR(price)}</span>
            {hasDiscount && (
              <>
                <span className="text-sm sm:text-base text-slate-400 line-through">
                  {formatPKR(product.regularPrice)}
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                  Verified Price
                </span>
              </>
            )}
          </div>

          {product.variants && product.variants.length > 0 && (
            <div className="space-y-4 pt-2">
              {product.variants.map((v) => (
                <div key={v.name}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Select {v.name}: <span className="font-medium text-emerald-800">{selectedVariants[v.name]}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setSelectedVariants((prev) => ({ ...prev, [v.name]: opt }))
                        }
                        className={`px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                          selectedVariants[v.name] === opt
                            ? 'border-emerald-700 bg-emerald-800 text-white shadow-xs'
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

          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="text-xs font-bold text-slate-800">Quantity:</span>
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded-l-xl font-bold"
                >
                  -
                </button>
                <span className="px-4 py-1.5 text-xs font-extrabold text-slate-800 tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock || 99, q + 1))}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded-r-xl font-bold"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-slate-500">
                {product.stock > 0 ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 tabular-nums">
                    <Check className="w-3.5 h-3.5" /> In Stock ({product.stock} units available)
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">Out of Stock</span>
                )}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="flex-1 py-3.5 px-6 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:bg-slate-300"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Shopping Cart
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={product.stock <= 0}
                className="flex-1 py-3.5 px-6 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:bg-slate-300"
              >
                Buy Now (Direct Checkout)
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleWishlist(product.id);
                  showToast(isFavorited ? 'Removed from wishlist' : 'Saved to wishlist!', 'info');
                }}
                className={`p-3.5 rounded-xl border transition flex items-center justify-center ${
                  isFavorited
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-slate-50'
                }`}
                title="Wishlist"
                aria-label="Toggle Wishlist"
              >
                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-600' : ''}`} />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Nationwide Delivery & Self-Pickup: </span>
                <span>2-4 business days via TCS / Leopards Courier or free pickup from {settings.city || 'our store'}.</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Cash on Delivery (COD), EasyPaisa, JazzCash & Bank Transfer Accepted</span>
            </div>
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>7-Day Return and Exchange Guarantee on unused items.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pt-8 border-t border-slate-200">
        <div className="flex border-b border-slate-200 gap-6 text-xs sm:text-sm font-bold overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('desc')}
            className={`pb-3 transition border-b-2 shrink-0 ${
              activeTab === 'desc'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Product Description
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-3 transition border-b-2 shrink-0 ${
              activeTab === 'specs'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Specifications
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 transition border-b-2 shrink-0 ${
              activeTab === 'reviews'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Customer Reviews ({reviews.length})
          </button>
        </div>

        <div className="py-6">
          {activeTab === 'desc' && (
            <div className="prose max-w-none text-slate-700 text-sm leading-relaxed space-y-4">
              <p>{product.description}</p>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 max-w-xl">
                <h4 className="font-bold text-xs uppercase text-slate-800 mb-2">Quality Assurance from {settings.siteName}</h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                  <li>Verified authentic sourcing & stock inspection before dispatch</li>
                  <li>Secure sealed packaging for courier transit</li>
                  <li>Direct WhatsApp customer support</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="max-w-2xl bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {product.specifications && Object.keys(product.specifications).length > 0 ? (
                Object.entries(product.specifications).map(([key, val]) => (
                  <div key={key} className="flex flex-col sm:flex-row px-4 sm:px-5 py-3 text-xs gap-1">
                    <span className="sm:w-1/3 font-semibold text-slate-500">{key}</span>
                    <span className="sm:w-2/3 text-slate-900 font-medium">{val}</span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-xs text-slate-500">Standard product specifications apply.</div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200/80 max-w-xl">
                <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-700" /> Write a Review
                </h4>
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-1"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {!currentUser && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Asad Siddiqui"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Feedback</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Share your experience regarding material quality, sizing, and delivery..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>

              <div className="space-y-4 max-w-2xl">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Be the first to review this product!</p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            {rev.userName[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">{rev.userName}</h5>
                            <span className="text-[10px] text-emerald-700 font-medium">Verified Customer</span>
                          </div>
                        </div>
                        <div className="flex text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-amber-400' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="pt-10 sm:pt-12 border-t border-slate-200">
          <div className="flex items-center justify-between mb-6 gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">You May Also Like</h3>
            <Link
              to={`${storeBasePath}/shop?category=${product.category}`}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 shrink-0"
            >
              More in Category <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

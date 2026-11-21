import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X } from 'lucide-react';
import { getAllProductsAdmin, saveProduct, deleteProduct, getCategories } from '../services/storeService';
import { Product, Category, ProductVariant } from '../types';
import { formatPKR, FALLBACK_PRODUCT_IMAGE } from '../data/seedData';
import { useToast } from '../components/common/Toast';

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('eastern-wear');
  const [brand, setBrand] = useState('SB Khush');
  const [regularPrice, setRegularPrice] = useState<number>(3500);
  const [salePrice, setSalePrice] = useState<number | undefined>(undefined);
  const [stock, setStock] = useState<number>(20);
  const [imageUrls, setImageUrls] = useState<string>('');
  const [variantsList, setVariantsList] = useState<{ name: string; optionsText: string }[]>([]);
  const [specsList, setSpecsList] = useState<{ key: string; value: string }[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([getAllProductsAdmin(), getCategories()]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setTitle('');
    setSku(`SKU-${Math.floor(100000 + Math.random() * 900000)}`);
    setDescription('');
    setCategory(categories[0]?.slug || 'eastern-wear');
    setBrand('SB Khush');
    setRegularPrice(3500);
    setSalePrice(undefined);
    setStock(25);
    setImageUrls(FALLBACK_PRODUCT_IMAGE);
    setVariantsList([]);
    setSpecsList([]);
    setIsFeatured(false);
    setIsPublished(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setTitle(p.title);
    setSku(p.sku);
    setDescription(p.description);
    setCategory(p.category);
    setBrand(p.brand);
    setRegularPrice(p.regularPrice);
    setSalePrice(p.salePrice);
    setStock(p.stock);
    setImageUrls(p.images.join('\n'));
    setVariantsList(
      (p.variants || []).map((v) => ({
        name: v.name,
        optionsText: v.options.join(', '),
      }))
    );
    setSpecsList(
      p.specifications
        ? Object.entries(p.specifications).map(([key, value]) => ({ key, value }))
        : []
    );
    setIsFeatured(p.isFeatured);
    setIsPublished(p.isPublished);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, prodTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${prodTitle}" from catalog?`)) {
      return;
    }
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast('Product removed successfully.', 'info');
    } catch {
      showToast('Could not delete product.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a product title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const imagesArr = imageUrls
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const parsedVariants: ProductVariant[] = variantsList
        .map((v) => ({
          name: v.name.trim(),
          options: v.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
        }))
        .filter((v) => v.name && v.options.length > 0);

      const parsedSpecs: Record<string, string> = {};
      specsList.forEach((s) => {
        if (s.key.trim() && s.value.trim()) {
          parsedSpecs[s.key.trim()] = s.value.trim();
        }
      });

      const payload: Partial<Product> = {
        id: editingProduct?.id,
        title: title.trim(),
        sku: sku.trim(),
        description: description.trim(),
        category,
        brand: brand.trim(),
        regularPrice: Number(regularPrice),
        salePrice: salePrice ? Number(salePrice) : undefined,
        stock: Number(stock),
        images: imagesArr.length > 0 ? imagesArr : [FALLBACK_PRODUCT_IMAGE],
        variants: parsedVariants,
        specifications: parsedSpecs,
        isFeatured,
        isPublished,
        rating: editingProduct?.rating || 4.8,
        reviewCount: editingProduct?.reviewCount || 0,
        createdAt: editingProduct?.createdAt,
      };

      await saveProduct(payload);
      showToast(
        editingProduct ? 'Product updated successfully!' : 'New product created!',
        'success'
      );
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = products.filter((p) => {
    if (selectedCat !== 'all' && p.category !== selectedCat) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-xs text-slate-500">
            Manage your store inventory, pricing, descriptions, specifications, and variants
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Product
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white w-full sm:w-auto"
        >
          <option value="all">All Categories ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading catalog...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No products found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Price (PKR)</th>
                  <th className="py-3 px-3">Stock</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={prod.images[0] || FALLBACK_PRODUCT_IMAGE}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                          }}
                          alt={prod.title}
                          className="w-11 h-11 object-cover rounded-xl border border-slate-100 shrink-0 bg-slate-50"
                        />
                        <div className="min-w-0 max-w-xs">
                          <span className="font-bold text-slate-900 block truncate hover:text-emerald-800">
                            {prod.title}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {prod.brand}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 font-semibold whitespace-nowrap">{prod.sku}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-[11px] capitalize">
                        {prod.category.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 block">
                        {formatPKR(prod.salePrice ?? prod.regularPrice)}
                      </span>
                      {prod.salePrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {formatPKR(prod.regularPrice)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          prod.stock <= 5 ? 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-800'
                        }`}
                      >
                        {prod.stock} units
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            prod.isPublished ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span className="text-[11px] text-slate-600">
                          {prod.isPublished ? 'Published' : 'Draft'}
                        </span>
                        {prod.isFeatured && (
                          <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(prod.id, prod.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-extrabold text-lg text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Handmade Charsadda Double Sole Peshawari Chappal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Regular Price (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sale Price (PKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={salePrice ?? ''}
                    onChange={(e) =>
                      setSalePrice(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stock Units Available *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Image URLs (One URL per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrls}
                  onChange={(e) => setImageUrls(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              {/* Variants Builder */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Product Variants (Size, Color, etc.)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setVariantsList([...variantsList, { name: '', optionsText: '' }])
                    }
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    + Add Variant Group
                  </button>
                </div>
                {variantsList.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No variants configured.</p>
                ) : (
                  variantsList.map((v, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Name (e.g. Size)"
                        value={v.name}
                        onChange={(e) => {
                          const next = [...variantsList];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setVariantsList(next);
                        }}
                        className="sm:col-span-4 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Options comma-separated (S, M, L)"
                        value={v.optionsText}
                        onChange={(e) => {
                          const next = [...variantsList];
                          next[idx] = { ...next[idx], optionsText: e.target.value };
                          setVariantsList(next);
                        }}
                        className="sm:col-span-7 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setVariantsList(variantsList.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Specifications Builder */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Specifications (Key / Value)
                  </label>
                  <button
                    type="button"
                    onClick={() => setSpecsList([...specsList, { key: '', value: '' }])}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    + Add Spec
                  </button>
                </div>
                {specsList.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No specifications added.</p>
                ) : (
                  specsList.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Attribute (e.g. Fabric)"
                        value={s.key}
                        onChange={(e) => {
                          const next = [...specsList];
                          next[idx] = { ...next[idx], key: e.target.value };
                          setSpecsList(next);
                        }}
                        className="sm:col-span-5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 100% Cotton)"
                        value={s.value}
                        onChange={(e) => {
                          const next = [...specsList];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setSpecsList(next);
                        }}
                        className="sm:col-span-6 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setSpecsList(specsList.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Detailed description of material, sizes, origin, and features..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded text-emerald-700"
                  />
                  Mark as Featured Product
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded text-emerald-700"
                  />
                  Published (Visible to Customers)
                </label>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

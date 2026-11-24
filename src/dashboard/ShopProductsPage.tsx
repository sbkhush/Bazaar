import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  X,
  Archive,
  RotateCcw,
  Upload,
  Download,
  AlertTriangle,
  Barcode,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopProductsAdmin,
  getShopCategories,
  saveShopProduct,
  deleteShopProduct,
  archiveShopProduct,
  countActiveProducts,
  getProductLimitErrorMessage,
} from '../services/tenantService';
import { Product, Category } from '../types';
import {
  formatPKR,
  FALLBACK_PRODUCT_IMAGE,
  PRODUCT_UNITS,
} from '../data/seedData';
import { ImageUploader } from '../components/common/ImageUploader';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopProductsPage: React.FC = () => {
  const { shopId, shop, plan, isReadOnly } = useDashboard();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const loadCatalog = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        getShopProductsAdmin(shopId),
        getShopCategories(shopId),
      ]);
      setProducts(prods);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [shopId]);

  const activeCount = countActiveProducts(products);
  const isUnlimited = plan.maxProducts === -1;
  const atActiveQuota = !isUnlimited && activeCount >= plan.maxProducts;

  const filtered = products.filter((p) => {
    const isArchived = p.status === 'archived' || p.isPublished === false;
    if (statusFilter === 'active' && isArchived) return false;
    if (statusFilter === 'archived' && !isArchived) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleOpenNew = () => {
    setError(null);
    setSuccessMsg(null);
    if (atActiveQuota) {
      setError(getProductLimitErrorMessage(plan.id, plan.name, activeCount, plan.maxProducts));
      return;
    }
    setEditing({
      title: '',
      description: '',
      regularPrice: 0,
      salePrice: undefined,
      purchasePrice: undefined,
      stock: 10,
      minStockAlert: 5,
      unit: 'pcs',
      barcode: '',
      category: categories[0]?.slug || 'general',
      brand: '',
      sku: `SKU-${Date.now().toString().slice(-5)}`,
      images: [],
      isFeatured: false,
      isPublished: true,
      status: 'active',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      await saveShopProduct(shopId, editing);
      setEditing(null);
      setSuccessMsg('Product saved cleanly.');
      await loadCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteProduct || isReadOnly) return;
    setError(null);
    try {
      await deleteShopProduct(shopId, confirmDeleteProduct.id);
      setConfirmDeleteProduct(null);
      setSuccessMsg('Product deleted from catalog.');
      await loadCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete product.');
    }
  };

  const handleArchiveToggle = async (product: Product, archive: boolean) => {
    if (isReadOnly) return;
    setError(null);
    try {
      await archiveShopProduct(shopId, product.id, archive);
      setSuccessMsg(archive ? 'Product archived (archived items do not count against active quota).' : 'Product restored to active catalog.');
      await loadCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to update product archive status.');
    }
  };

  const exportProductsCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-products-${new Date().toISOString().slice(0, 10)}.csv`,
      ['title', 'sku', 'barcode', 'category', 'regularPrice', 'salePrice', 'purchasePrice', 'stock', 'minStockAlert', 'unit', 'brand', 'status'],
      filtered.map((p) => [
        p.title,
        p.sku,
        p.barcode || '',
        p.category,
        p.regularPrice,
        p.salePrice ?? '',
        p.purchasePrice ?? '',
        p.stock,
        p.minStockAlert ?? 5,
        p.unit || 'pcs',
        p.brand || '',
        p.status === 'archived' ? 'archived' : 'active',
      ])
    );
  };

  const handleCsvImport = async (rows: Record<string, string>[]) => {
    if (isReadOnly) throw new Error('Read-only access cannot import products.');
    const existingSkus = new Set(products.map((p) => (p.sku || '').trim().toLowerCase()).filter(Boolean));
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const title = (r.title || r.productname || r.name || '').trim();
      if (!title) {
        skipped++;
        continue;
      }
      const sku = (r.sku || `SKU-${Date.now().toString().slice(-4)}-${i + 1}`).trim();
      if (existingSkus.has(sku.toLowerCase())) {
        skipped++;
        continue;
      }
      const reg = Number(r.regularprice || r.price) || 0;
      const saleRaw = Number(r.saleprice);
      const costRaw = Number(r.purchaseprice || r.costprice);
      try {
        await saveShopProduct(shopId, {
          title,
          sku,
          barcode: r.barcode || undefined,
          category: r.category || categories[0]?.slug || 'general',
          regularPrice: Math.max(1, reg),
          salePrice: saleRaw > 0 ? saleRaw : undefined,
          purchasePrice: costRaw > 0 ? costRaw : undefined,
          stock: Math.max(0, Number(r.stock) || 0),
          minStockAlert: Math.max(0, Number(r.minstockalert) || 5),
          unit: r.unit || 'pcs',
          brand: r.brand || shop?.name || '',
          description: r.description || title,
          images: [],
          isPublished: true,
          status: 'active',
        });
        existingSkus.add(sku.toLowerCase());
        imported++;
      } catch {
        skipped++;
      }
    }

    await loadCatalog();
    setSuccessMsg(`Imported ${imported} product(s)${skipped ? ` (skipped ${skipped} duplicate/empty)` : ''}.`);
    return {
      imported,
      skipped,
      notes: skipped > 0 ? 'Duplicate SKUs or blank titles were skipped.' : undefined,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Products Management</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {activeCount} active of {isUnlimited ? 'Unlimited' : plan.maxProducts} allowed on{' '}
            <strong>{plan.name}</strong> ({products.length - activeCount} archived/draft).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={exportProductsCsv}
            className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCsvModalOpen(true);
                }}
                className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" /> CSV Import
              </button>
              <button
                type="button"
                onClick={handleOpenNew}
                className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {atActiveQuota && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{getProductLimitErrorMessage(plan.id, plan.name, activeCount, plan.maxProducts)}</span>
          </div>
          <Link
            to="/dashboard/subscription"
            className="px-3 py-1.5 bg-amber-900 text-white rounded-lg font-bold shrink-0"
          >
            Upgrade Plan
          </Link>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {successMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product title, SKU, barcode, or category..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
          />
        </div>

        <div className="inline-flex border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold self-start">
          {(['active', 'archived', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded-md capitalize ${
                statusFilter === tab ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No products in this view. Click &ldquo;Add Product&rdquo; to publish items to your storefront.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Cost (PKR)</th>
                  <th className="py-3 px-4 text-right">Sell Price</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  {!isReadOnly && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const isArchived = p.status === 'archived' || p.isPublished === false;
                  const lowStock = p.stock <= (p.minStockAlert ?? 5);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images?.[0] || FALLBACK_PRODUCT_IMAGE}
                            alt={p.title}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{p.title}</p>
                            <p className="text-[11px] font-mono text-slate-400">
                              {p.sku}
                              {p.barcode ? ` · BC: ${p.barcode}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.category}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-500">
                        {p.purchasePrice !== undefined ? formatPKR(p.purchasePrice) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="font-bold text-slate-900">
                          {formatPKR(p.salePrice ?? p.regularPrice)}
                        </span>
                        {p.salePrice && (
                          <span className="block text-[10px] line-through text-slate-400">
                            {formatPKR(p.regularPrice)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className={lowStock ? 'text-red-600' : 'text-slate-900'}>
                          {p.stock} {p.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold text-[11px] uppercase ${
                            isArchived ? 'text-slate-400' : 'text-emerald-700'
                          }`}
                        >
                          {p.status === 'archived' ? 'Archived' : p.isPublished ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setEditing(p);
                              }}
                              title="Edit product"
                              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveToggle(p, !isArchived)}
                              title={isArchived ? 'Restore to Active' : 'Archive product'}
                              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700"
                            >
                              {isArchived ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Archive className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProduct(p)}
                              title="Delete permanently"
                              className="p-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={editing.category || ''}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                  {categories.length === 0 && <option value="general">General Store</option>}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={editing.brand || ''}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Regular Price (PKR) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editing.regularPrice || 0}
                  onChange={(e) => setEditing({ ...editing, regularPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sale Price (Optional)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.salePrice || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      salePrice: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cost / Purchase Price (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editing.purchasePrice ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      purchasePrice: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="Used for COGS & margin reports"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                <select
                  value={editing.unit || 'pcs'}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stock Quantity *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editing.stock ?? 0}
                  onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  min={0}
                  value={editing.minStockAlert ?? 5}
                  onChange={(e) =>
                    setEditing({ ...editing, minStockAlert: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={editing.sku || ''}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5" /> Barcode (EAN / UPC)
                </label>
                <input
                  type="text"
                  value={editing.barcode || ''}
                  onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                  placeholder="Scan or type barcode"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              {(shop?.businessType === 'cosmetics' || editing.shade || editing.variantSize) && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Shade / Tone</label>
                    <input
                      type="text"
                      value={editing.shade || ''}
                      onChange={(e) => setEditing({ ...editing, shade: e.target.value })}
                      placeholder="e.g. Warm Ivory, Rose Matte"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pack Volume / Size</label>
                    <input
                      type="text"
                      value={editing.variantSize || ''}
                      onChange={(e) => setEditing({ ...editing, variantSize: e.target.value })}
                      placeholder="e.g. 50ml, 100g"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Skin / Hair Type Category</label>
                    <input
                      type="text"
                      value={editing.skinHairCategory || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, skinHairCategory: e.target.value })
                      }
                      placeholder="e.g. Oily Skin, Dry & Frizzy Hair"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </>
              )}

              {(shop?.businessType === 'clothing' || editing.color || editing.designRef) && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Color</label>
                    <input
                      type="text"
                      value={editing.color || ''}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      placeholder="e.g. Emerald Green, Black"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Design / Stitching Code</label>
                    <input
                      type="text"
                      value={editing.designRef || ''}
                      onChange={(e) => setEditing({ ...editing, designRef: e.target.value })}
                      placeholder="e.g. LAWN-3PC-2026"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <ImageUploader
              shopId={shopId}
              folder="products"
              subPath={editing.id || 'draft'}
              images={editing.images || []}
              onChange={(imgs) => setEditing({ ...editing, images: imgs })}
              multiple
              maxImages={6}
              label="Product Gallery Images (Firebase Storage)"
            />

            <div className="flex flex-wrap items-center gap-6 text-xs pt-2">
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={editing.isPublished !== false && editing.status !== 'archived'}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      isPublished: e.target.checked,
                      status: e.target.checked ? 'active' : 'archived',
                    })
                  }
                />
                Published / Active on Storefront
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isFeatured)}
                  onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })}
                />
                Featured on Homepage
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#065F46] text-white rounded-lg text-xs font-bold"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Bulk CSV Product Import"
        subtitle={`Plan quota limits (${isUnlimited ? 'Unlimited' : `${plan.maxProducts} active`}) and duplicate SKU checks apply per row.`}
        expectedHeaders={['title', 'sku', 'barcode', 'category', 'regularPrice', 'salePrice', 'purchasePrice', 'stock', 'minStockAlert', 'unit', 'brand']}
        requiredHeaders={['title', 'regularPrice']}
        sampleFilename={`${shop?.slug || shopId}-products-sample.csv`}
        sampleRows={[['Basmati Rice 5kg', 'RICE-5KG', '8964001001', categories[0]?.slug || 'general', 1950, 1850, 1600, 25, 5, 'kg', 'Guard']]}
        onImport={handleCsvImport}
      />

      {/* Delete Confirmation Modal */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Delete Product?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently remove{' '}
              <strong>{confirmDeleteProduct.title}</strong>? If you only want to free up a plan slot, you can Archive it instead.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

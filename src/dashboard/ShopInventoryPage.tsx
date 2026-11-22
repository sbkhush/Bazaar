import React, { useEffect, useState } from 'react';
import {
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  Sliders,
  X,
  Download,
  Upload,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopProductsAdmin,
  getShopStockMovements,
  adjustShopStock,
} from '../services/tenantService';
import { calculateInventoryValuation } from '../services/retailService';
import { Product, StockMovement, StockMovementType } from '../types';
import { formatPKR } from '../data/seedData';
import { useAuth } from '../context/AuthContext';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopInventoryPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<StockMovementType>('stock_in');
  const [moveQty, setMoveQty] = useState(1);
  const [moveNote, setMoveNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prods, mvs] = await Promise.all([
        getShopProductsAdmin(shopId),
        getShopStockMovements(shopId),
      ]);
      setProducts(prods);
      setMovements(mvs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId]);

  const handleQuickAdjust = async (productId: string, delta: number) => {
    if (isReadOnly) return;
    await adjustShopStock(
      shopId,
      productId,
      delta,
      delta > 0 ? 'Quick Stock In' : 'Quick Stock Out',
      currentUser?.email || 'Admin',
      delta > 0 ? 'stock_in' : 'stock_out'
    );
    await loadData();
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProduct || isReadOnly) return;
    setSubmitting(true);
    try {
      const isNegative =
        moveType === 'stock_out' || moveType === 'damaged' || moveType === 'wastage';
      const signedDelta = isNegative ? -Math.abs(moveQty) : Math.abs(moveQty);
      await adjustShopStock(
        shopId,
        modalProduct.id,
        signedDelta,
        moveNote.trim() || moveType.replace('_', ' ').toUpperCase(),
        currentUser?.email || 'Admin',
        moveType
      );
      setModalProduct(null);
      setMoveQty(1);
      setMoveNote('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading inventory ledger...
      </div>
    );
  }

  const valuation = calculateInventoryValuation(products);
  const activeProds = products.filter((p) => p.status !== 'archived');
  const lowStockCount = activeProds.filter((p) => p.stock > 0 && p.stock <= (p.minStockAlert ?? 5)).length;
  const outOfStockCount = activeProds.filter((p) => p.stock <= 0).length;

  const exportStockCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-inventory-stock-${new Date().toISOString().slice(0, 10)}.csv`,
      ['title', 'sku', 'barcode', 'stock', 'minStockAlert', 'unit', 'costPricePKR', 'sellPricePKR'],
      products.map((p) => [
        p.title,
        p.sku,
        p.barcode || '',
        p.stock,
        p.minStockAlert ?? 5,
        p.unit || 'pcs',
        p.purchasePrice ?? '',
        p.salePrice ?? p.regularPrice,
      ])
    );
  };

  const handleImportAdjustments = async (rows: Record<string, string>[]) => {
    if (isReadOnly) throw new Error('Read-only mode.');
    let imported = 0;
    let skipped = 0;
    for (const r of rows) {
      const sku = (r.sku || '').trim().toLowerCase();
      const barcode = (r.barcode || '').trim().toLowerCase();
      const deltaRaw = Number(r.delta ?? r.quantitychange ?? r.adjustment ?? r.quantity ?? 0);
      if (!Number.isFinite(deltaRaw) || deltaRaw === 0) {
        skipped++;
        continue;
      }
      const match = products.find(
        (p) =>
          (sku && (p.sku || '').trim().toLowerCase() === sku) ||
          (barcode && (p.barcode || '').trim().toLowerCase() === barcode)
      );
      if (!match) {
        skipped++;
        continue;
      }
      const rawType = (r.type || '').trim().toLowerCase();
      const validTypes: StockMovementType[] = ['stock_in', 'stock_out', 'damaged', 'wastage', 'opening', 'adjustment'];
      const movementType: StockMovementType = validTypes.includes(rawType as StockMovementType)
        ? (rawType as StockMovementType)
        : deltaRaw > 0
        ? 'stock_in'
        : 'adjustment';
      await adjustShopStock(
        shopId,
        match.id,
        deltaRaw,
        (r.reason || 'CSV Stock Adjustment').trim(),
        currentUser?.email || 'Admin',
        movementType
      );
      imported++;
    }
    await loadData();
    return {
      imported,
      skipped,
      notes: skipped > 0 ? 'Unmatched SKU/barcode rows or zero-delta rows were skipped.' : undefined,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Inventory &amp; Stock Movements</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track live quantities, low-stock thresholds, inventory valuation, damaged/wastage, and audit movements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={exportStockCsv}
            className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Stock CSV
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              className="px-3.5 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Import Adjustments CSV
            </button>
          )}
        </div>
      </div>

      {/* Valuation Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Inventory Cost Value</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(valuation.costValuation)}
          </p>
          <p className="text-[11px] text-slate-400">
            {valuation.totalUnits} total units on hand
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Retail Value</p>
          <p className="text-xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {formatPKR(valuation.retailValuation)}
          </p>
          <p className="text-[11px] text-slate-400">At current selling prices</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Low Stock Alerts</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1 tabular-nums">
            {lowStockCount}
          </p>
          <p className="text-[11px] text-slate-400">At or below alert threshold</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Out of Stock</p>
          <p className="text-xl font-extrabold text-rose-700 mt-1 tabular-nums">
            {outOfStockCount}
          </p>
          <p className="text-[11px] text-slate-400">Needs immediate restock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
            Product Stock Levels
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {products.map((p) => {
              const isLow = p.stock <= (p.minStockAlert ?? 5);
              return (
                <div key={p.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 truncate">{p.title}</p>
                      {isLow && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Low
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">
                      {p.sku} · Cost: {p.purchasePrice !== undefined ? formatPKR(p.purchasePrice) : 'N/A'} · Alert &le; {p.minStockAlert ?? 5}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-extrabold tabular-nums text-sm ${
                        isLow ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {p.stock} {p.unit || 'pcs'}
                    </span>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(p.id, -1)}
                          className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                          title="Deduct 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(p.id, 5)}
                          className="px-2 py-1.5 bg-[#065F46] text-white rounded-lg text-[11px] font-bold flex items-center gap-0.5"
                          title="Add 5"
                        >
                          <Plus className="w-3 h-3" /> 5
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalProduct(p);
                            setMoveType('stock_in');
                            setMoveQty(1);
                            setMoveNote('');
                          }}
                          className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700"
                          title="Log Damaged / Wastage / Opening / Adjustment"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
            Stock Movement Ledger ({movements.length})
          </div>
          {movements.length === 0 ? (
            <p className="text-xs text-slate-500 p-6 text-center">No stock movements logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs max-h-[540px] overflow-y-auto">
              {movements.map((m) => (
                <div key={m.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{m.productTitle}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="uppercase font-semibold text-slate-700">{m.type.replace('_', ' ')}</span>
                      {m.reason ? ` · ${m.reason}` : ''} · {m.userEmail || m.userId}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <span
                      className={`font-bold ${
                        m.quantityChange > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {m.previousQuantity} &rarr; {m.newQuantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Stock Movement Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleModalSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Stock Movement — {modalProduct.title}
              </h3>
              <button
                type="button"
                onClick={() => setModalProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Movement Reason</label>
              <select
                value={moveType}
                onChange={(e) => setMoveType(e.target.value as StockMovementType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="stock_in">Stock In (+)</option>
                <option value="opening">Opening Stock (+)</option>
                <option value="stock_out">Stock Out (-)</option>
                <option value="damaged">Damaged (-)</option>
                <option value="wastage">Expired / Wastage (-)</option>
                <option value="adjustment">Manual Positive Adjustment (+)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                required
                value={moveQty}
                onChange={(e) => setMoveQty(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference Note</label>
              <input
                type="text"
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                placeholder="e.g. Damaged during transit / Shelf count"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalProduct(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#065F46] text-white rounded-lg font-bold"
              >
                {submitting ? 'Updating...' : 'Record Movement'}
              </button>
            </div>
          </form>
        </div>
      )}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import Stock Adjustments CSV"
        subtitle="Match products by SKU or barcode and apply signed delta adjustments (+ to add, - to deduct)."
        expectedHeaders={['sku', 'barcode', 'delta', 'type', 'reason']}
        requiredHeaders={['delta']}
        sampleFilename={`${shop?.slug || shopId}-stock-adjustments-sample.csv`}
        sampleRows={[[products[0]?.sku || 'SKU-001', products[0]?.barcode || '', 10, 'stock_in', 'Warehouse restock']]}
        onImport={handleImportAdjustments}
      />
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Upload, Download, X, AlertCircle, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { downloadCsvFile, parseCsvRows } from '../../utils/csvUtils';

export interface CsvImportResult {
  imported: number;
  skipped?: number;
  notes?: string;
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  expectedHeaders: string[];
  requiredHeaders?: string[];
  sampleFilename: string;
  sampleRows: (string | number)[][];
  extraControls?: React.ReactNode;
  onImport: (rows: Record<string, string>[], rawCsv: string) => Promise<CsvImportResult>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  expectedHeaders,
  requiredHeaders = [],
  sampleFilename,
  sampleRows,
  extraControls,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!csvText.trim()) {
      return { headers: [] as string[], records: [] as Record<string, string>[], missingRequired: [] as string[] };
    }
    const matrix = parseCsvRows(csvText);
    if (matrix.length === 0) {
      return { headers: [] as string[], records: [] as Record<string, string>[], missingRequired: [] as string[] };
    }
    const rawHeaders = matrix[0].map((h) => h.trim());
    const normHeaders = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const requiredNorms = requiredHeaders.map((r) => ({
      label: r,
      norm: r.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }));
    const missingRequired = requiredNorms
      .filter((r) => !normHeaders.includes(r.norm))
      .map((r) => r.label);

    const records: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i];
      if (!row || row.every((cell) => !cell.trim())) continue;
      const obj: Record<string, string> = {};
      rawHeaders.forEach((h, idx) => {
        const normKey = normHeaders[idx];
        const val = (row[idx] ?? '').trim();
        if (normKey) obj[normKey] = val;
        if (h) obj[h.toLowerCase()] = val;
      });
      records.push(obj);
    }

    return { headers: rawHeaders, records, missingRequired };
  }, [csvText, requiredHeaders]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResultMsg(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.onerror = () => setError('Failed to read CSV file.');
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    downloadCsvFile(sampleFilename, expectedHeaders, sampleRows);
  };

  const handleRunImport = async () => {
    setError(null);
    setResultMsg(null);
    if (parsed.records.length === 0) {
      setError('Provide a header row and at least 1 data row before importing.');
      return;
    }
    if (parsed.missingRequired.length > 0) {
      setError(`Missing required CSV column(s): ${parsed.missingRequired.join(', ')}`);
      return;
    }
    setImporting(true);
    try {
      const res = await onImport(parsed.records, csvText);
      const summary = `Imported ${res.imported} row(s)${res.skipped ? `, skipped ${res.skipped}` : ''}.${res.notes ? ` ${res.notes}` : ''}`;
      setResultMsg(summary);
      setCsvText('');
    } catch (err: any) {
      setError(err?.message || 'CSV import failed.');
    } finally {
      setImporting(false);
    }
  };

  const previewColumns = parsed.headers.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto text-xs">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#065F46]" />
              {title}
            </h3>
            {subtitle && <p className="text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
            aria-label="Close CSV import modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div>
            <p className="font-bold text-slate-800">Expected Columns</p>
            <p className="font-mono text-[11px] text-slate-600 break-all">
              {expectedHeaders.join(', ')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Sample CSV
          </button>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">
            Upload `.csv` file or paste CSV rows below
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-xs mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
          />
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setError(null);
              setResultMsg(null);
            }}
            placeholder={expectedHeaders.join(',')}
            className="w-full p-3 border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-[#065F46] focus:outline-none"
          />
        </div>

        {extraControls}

        {parsed.missingRequired.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              Missing required column(s): <strong>{parsed.missingRequired.join(', ')}</strong>
            </span>
          </div>
        )}

        {parsed.records.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-bold text-slate-700">
              <span>Preview ({parsed.records.length} data row(s) detected)</span>
              {parsed.headers.length > 6 && (
                <span className="text-[10px] text-slate-500">
                  Showing first 6 of {parsed.headers.length} columns
                </span>
              )}
            </div>
            <div className="overflow-x-auto max-h-44">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                  <tr>
                    {previewColumns.map((h, i) => (
                      <th key={i} className="px-2.5 py-1.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.records.slice(0, 6).map((rec, idx) => (
                    <tr key={idx}>
                      {previewColumns.map((h, colIdx) => (
                        <td key={colIdx} className="px-2.5 py-1.5 text-slate-700 max-w-[160px] truncate">
                          {rec[h.toLowerCase().replace(/[^a-z0-9]/g, '')] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resultMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{resultMsg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={importing || parsed.records.length === 0 || parsed.missingRequired.length > 0}
            onClick={handleRunImport}
            className="px-5 py-2 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importing ? 'Importing...' : `Import ${parsed.records.length || ''} Row(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

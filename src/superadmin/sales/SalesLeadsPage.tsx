import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  UserCheck,
  AlertTriangle,
  History,
  Loader2,
  X,
} from 'lucide-react';
import {
  ALL_ACTIVITY_TYPES,
  ALL_LEAD_STATUSES,
  bulkAssignLeads,
  createSalesLead,
  getAllSalesActivities,
  getAllSalesLeads,
  getAllSalesMembers,
  importLeadsFromCsvText,
  recordSalesActivity,
  updateSalesLead,
} from '../../services/salesService';
import { BUSINESS_TYPE_OPTIONS, PAKISTAN_CITIES } from '../../data/seedData';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvUtils';
import { useToast } from '../../components/common/Toast';
import {
  BusinessType,
  SalesActivity,
  SalesLead,
  SalesLeadSource,
  SalesLeadStatus,
  SalesMember,
} from '../../types';

export const SalesLeadsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');

  // Create Lead modal + duplicate resolution
  const [createOpen, setCreateOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Karachi');
  const [industry, setIndustry] = useState<BusinessType>('general_store');
  const [businessAddress, setBusinessAddress] = useState('');
  const [assignedSalesmanId, setAssignedSalesmanId] = useState('');
  const [leadSource, setLeadSource] = useState<SalesLeadSource>('field_visit');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ match: SalesLead; reason: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);

  // CSV Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importAssigneeId, setImportAssigneeId] = useState('');
  const [importing, setImporting] = useState(false);

  // Lead Activity drawer
  const [activeLead, setActiveLead] = useState<SalesLead | null>(null);
  const [actType, setActType] = useState<SalesActivity['activityType']>('Phone call');
  const [actResult, setActResult] = useState<SalesActivity['resultStatus']>('positive');
  const [actNotes, setActNotes] = useState('');
  const [actNextFollowUp, setActNextFollowUp] = useState('');
  const [savingAct, setSavingAct] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [l, m, a] = await Promise.all([
        getAllSalesLeads().catch(() => []),
        getAllSalesMembers().catch(() => []),
        getAllSalesActivities().catch(() => []),
      ]);
      setLeads(l);
      setMembers(m);
      setActivities(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateLead = async (e: React.FormEvent, allowOverride = false) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim() || !phone.trim()) {
      showToast('Business name, owner name, and phone are required.', 'error');
      return;
    }

    setSavingLead(true);
    setDuplicateWarning(null);
    try {
      const assignee = members.find((m) => m.id === assignedSalesmanId);
      await createSalesLead(
        {
          businessName,
          ownerName,
          phone,
          email: email.trim() || undefined,
          city,
          industry,
          businessAddress,
          assignedSalesmanId: assignee?.id,
          assignedSalesmanUid: assignee?.uid,
          assignedSalesmanName: assignee?.fullName,
          assignedManagerId: assignee?.assignedManagerId,
          assignedManagerUid: assignee?.assignedManagerUid,
          leadSource,
          nextFollowUpDate: nextFollowUpDate || undefined,
          notes,
          allowDuplicateOverride: allowOverride,
          duplicateResolutionNote: allowOverride ? 'Super Admin verified distinct branch/record' : undefined,
        },
        leads
      );
      showToast('Lead added cleanly.', 'success');
      setCreateOpen(false);
      setBusinessName('');
      setOwnerName('');
      setPhone('');
      setEmail('');
      setBusinessAddress('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      if (err?.duplicateMatch) {
        setDuplicateWarning({ match: err.duplicateMatch, reason: err.duplicateReason });
      } else {
        showToast(err?.message || 'Could not create lead.', 'error');
      }
    } finally {
      setSavingLead(false);
    }
  };

  const handleMergeWithExisting = async () => {
    if (!duplicateWarning) return;
    setSavingLead(true);
    try {
      const assignee = members.find((m) => m.id === assignedSalesmanId);
      await updateSalesLead(duplicateWarning.match.id, {
        notes: [duplicateWarning.match.notes, notes.trim()].filter(Boolean).join(' | Merged: '),
        nextFollowUpDate: nextFollowUpDate || duplicateWarning.match.nextFollowUpDate,
        assignedSalesmanId: assignee?.id || duplicateWarning.match.assignedSalesmanId,
        assignedSalesmanUid: assignee?.uid || duplicateWarning.match.assignedSalesmanUid,
        assignedSalesmanName: assignee?.fullName || duplicateWarning.match.assignedSalesmanName,
        duplicateResolutionNote: `Merged duplicate submission on ${new Date().toISOString().slice(0, 10)}`,
      });
      showToast(`Merged notes into existing lead ${duplicateWarning.match.businessName}.`, 'success');
      setDuplicateWarning(null);
      setCreateOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Merge failed.', 'error');
    } finally {
      setSavingLead(false);
    }
  };

  const handleBulkAssign = async () => {
    const assignee = members.find((m) => m.id === bulkAssigneeId);
    if (!assignee || selectedIds.length === 0) {
      showToast('Select leads and choose a target salesman.', 'error');
      return;
    }
    try {
      await bulkAssignLeads(selectedIds, assignee);
      showToast(`Assigned ${selectedIds.length} lead(s) to ${assignee.fullName}.`, 'success');
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Bulk assignment failed.', 'error');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      showToast('Paste CSV content or upload a CSV file first.', 'error');
      return;
    }
    setImporting(true);
    try {
      const assignee = members.find((m) => m.id === importAssigneeId);
      const res = await importLeadsFromCsvText(csvText, { assignTo: assignee, skipDuplicates: true });
      showToast(
        `Imported ${res.imported} lead(s). Skipped ${res.skippedDuplicates.length} duplicate(s).`,
        'success'
      );
      setImportOpen(false);
      setCsvText('');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'CSV import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleStatusChange = async (leadId: string, nextStatus: SalesLeadStatus) => {
    try {
      await updateSalesLead(leadId, { status: nextStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus } : l)));
      showToast(`Lead marked as ${nextStatus}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    }
  };

  const handleReassignSingle = async (lead: SalesLead, memberId: string) => {
    const assignee = members.find((m) => m.id === memberId);
    try {
      await updateSalesLead(lead.id, {
        businessName: lead.businessName,
        assignedSalesmanId: assignee?.id || undefined,
        assignedSalesmanUid: assignee?.uid || undefined,
        assignedSalesmanName: assignee?.fullName || undefined,
        assignedManagerId: assignee?.assignedManagerId || undefined,
        assignedManagerUid: assignee?.assignedManagerUid || undefined,
        status: assignee ? (lead.status === 'New' ? 'Assigned' : lead.status) : lead.status,
      });
      showToast(assignee ? `Assigned to ${assignee.fullName}` : 'Unassigned lead', 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Reassignment failed', 'error');
    }
  };

  const handleLogLeadActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !actNotes.trim()) return;
    setSavingAct(true);
    try {
      const repId = activeLead.assignedSalesmanId || members[0]?.id || 'super_admin';
      const repName = activeLead.assignedSalesmanName || 'Super Admin';
      await recordSalesActivity({
        salesmanId: repId,
        salesmanUid: activeLead.assignedSalesmanUid,
        salesmanName: repName,
        leadId: activeLead.id,
        leadName: activeLead.businessName,
        activityType: actType,
        activityDateTime: new Date().toISOString(),
        notes: actNotes.trim(),
        nextFollowUpDate: actNextFollowUp || undefined,
        resultStatus: actResult,
      });
      showToast('Activity & contact log saved.', 'success');
      setActNotes('');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Could not log activity.', 'error');
    } finally {
      setSavingAct(false);
    }
  };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (salesmanFilter !== 'all') {
        if (salesmanFilter === 'unassigned' && l.assignedSalesmanId) return false;
        if (salesmanFilter !== 'unassigned' && l.assignedSalesmanId !== salesmanFilter) return false;
      }
      if (cityFilter !== 'all' && l.city !== cityFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = `${l.businessName} ${l.ownerName} ${l.phone} ${l.email || ''} ${l.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, salesmanFilter, cityFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const exportCsv = () => {
    downloadCsvFile(
      `sbkhush-sales-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Lead ID', 'Business Name', 'Owner Name', 'Phone', 'Email', 'City', 'Industry', 'Status', 'Assigned To', 'Source', 'Next Follow-Up', 'Notes'],
      filtered.map((l) => [
        l.id,
        l.businessName,
        l.ownerName,
        l.phone,
        l.email || '',
        l.city,
        l.industry,
        l.status,
        l.assignedSalesmanName || 'Unassigned',
        l.leadSource,
        l.nextFollowUpDate || '',
        l.notes || '',
      ])
    );
    showToast(`Exported ${filtered.length} leads.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Leads CRM</h1>
          <p className="text-xs text-slate-500 mt-1">
            Create leads, import CSV sheets with automatic duplicate blocking, bulk assign reps, and track follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> CSV Import
          </button>
          <button
            type="button"
            onClick={() => {
              setDuplicateWarning(null);
              setCreateOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search business, owner, mobile, email..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="all">All Pipeline Statuses</option>
          {ALL_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={salesmanFilter}
          onChange={(e) => {
            setSalesmanFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned Only</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="all">All Cities</option>
          {PAKISTAN_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Assignment Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-emerald-900">{selectedIds.length} lead(s) selected</span>
          <div className="flex items-center gap-2">
            <select
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white"
            >
              <option value="">Choose Representative...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.city})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkAssign}
              className="px-3.5 py-1.5 rounded-lg bg-[#065F46] text-white font-bold flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" /> Assign Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No leads match your filters. Add or import leads to populate the pipeline.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && paginated.every((l) => selectedIds.includes(l.id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? paginated.map((l) => l.id) : [])
                      }
                    />
                  </th>
                  <th className="px-3 py-3">Merchant / Business</th>
                  <th className="px-3 py-3">Location & Industry</th>
                  <th className="px-3 py-3">Assigned Representative</th>
                  <th className="px-3 py-3">Pipeline Status</th>
                  <th className="px-3 py-3">Follow-Up</th>
                  <th className="px-3 py-3 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(l.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-900">{l.businessName}</p>
                      <p className="text-[11px] text-slate-600">{l.ownerName} · {l.phone}</p>
                      {l.email && <p className="text-[10px] text-slate-400">{l.email}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800">{l.city}</p>
                      <p className="text-[11px] text-slate-500 capitalize">{l.industry.replace('_', ' ')}</p>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={l.assignedSalesmanId || ''}
                        onChange={(e) => handleReassignSingle(l, e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-[11px] max-w-[160px]"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusChange(l.id, e.target.value as SalesLeadStatus)}
                        className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-[11px] font-semibold"
                      >
                        {ALL_LEAD_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-600">
                      {l.nextFollowUpDate || '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveLead(l)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <History className="w-3 h-3" /> Log / View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Page {page} of {totalPages} ({filtered.length} leads)</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal with Duplicate Resolution */}
      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Add Merchant Lead</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs">
                <div className="flex items-start gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p>Duplicate Lead Detected: {duplicateWarning.reason}</p>
                    <p className="font-normal text-amber-800 mt-0.5">
                      Existing Lead: <strong>{duplicateWarning.match.businessName}</strong> ({duplicateWarning.match.status})
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleMergeWithExisting}
                    disabled={savingLead}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold"
                  >
                    Merge Notes into Existing Lead
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCreateLead(e, true)}
                    disabled={savingLead}
                    className="px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-900 font-semibold"
                  >
                    Create Separate Branch Anyway
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleCreateLead(e, false)} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business / Shop Name *</label>
                  <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner / Contact Name *</label>
                  <input type="text" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp *</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    {PAKISTAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Industry</label>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value as BusinessType)} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    {BUSINESS_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign to Salesman</label>
                  <select value={assignedSalesmanId} onChange={(e) => setAssignedSalesmanId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    <option value="">Leave Unassigned (New)</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.city})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Source</label>
                  <select value={leadSource} onChange={(e) => setLeadSource(e.target.value as SalesLeadSource)} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    <option value="field_visit">Field Visit</option>
                    <option value="referral">Referral</option>
                    <option value="inbound_web">Inbound Web</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
                  <input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <input type="text" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold">Cancel</button>
                <button type="submit" disabled={savingLead} className="px-5 py-2 rounded-xl bg-[#065F46] text-white font-bold">
                  {savingLead ? 'Checking...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Import Leads from CSV</h2>
              <button type="button" onClick={() => setImportOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Required headers: <code>businessName,ownerName,phone,email,city,industry,notes</code>. Duplicate phone, email, or business+city matches are automatically skipped.
              </p>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="block w-full text-xs" />
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={'businessName,ownerName,phone,city,industry\nAl-Noor Kiryana,Usman Ali,03001122334,Lahore,general_store'}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-[11px]"
              />
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Imported Leads To (Optional)</label>
                <select value={importAssigneeId} onChange={(e) => setImportAssigneeId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                  <option value="">Keep Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.city})</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold">Cancel</button>
                <button type="button" onClick={handleImportCsv} disabled={importing} className="px-5 py-2 rounded-xl bg-[#065F46] text-white font-bold">
                  {importing ? 'Importing...' : 'Run Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Activity History Modal */}
      {activeLead && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{activeLead.businessName}</h2>
                <p className="text-[11px] text-slate-500">{activeLead.ownerName} · {activeLead.phone} · {activeLead.city}</p>
              </div>
              <button type="button" onClick={() => setActiveLead(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogLeadActivity} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <p className="font-bold text-slate-800">Log Follow-Up Activity</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={actType} onChange={(e) => setActType(e.target.value as any)} className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white">
                  {ALL_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={actResult} onChange={(e) => setActResult(e.target.value as any)} className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="positive">Positive</option>
                  <option value="follow_up_needed">Follow-up Needed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="no_answer">No Answer</option>
                  <option value="converted">Converted</option>
                </select>
                <input type="date" value={actNextFollowUp} onChange={(e) => setActNextFollowUp(e.target.value)} className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white" />
              </div>
              <textarea required rows={2} value={actNotes} onChange={(e) => setActNotes(e.target.value)} placeholder="Call summary, store owner feedback..." className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
              <div className="flex justify-end">
                <button type="submit" disabled={savingAct} className="px-4 py-1.5 rounded-lg bg-[#065F46] text-white font-bold">
                  {savingAct ? 'Saving...' : 'Add Activity'}
                </button>
              </div>
            </form>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-800">Contact History</p>
              {activities.filter((a) => a.leadId === activeLead.id).length === 0 ? (
                <p className="text-slate-400 py-4 text-center">No logged interactions yet.</p>
              ) : (
                activities
                  .filter((a) => a.leadId === activeLead.id)
                  .map((a) => (
                    <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{a.activityType} · {a.salesmanName}</span>
                        <span className="text-[10px] text-slate-400">{new Date(a.activityDateTime).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{a.notes}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

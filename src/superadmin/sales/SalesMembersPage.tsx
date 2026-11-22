import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Download,
  Mail,
  ShieldCheck,
  Edit3,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  getAllSalesMembers,
  getAllSalesTeams,
  getSalesSettings,
  createSalesMember,
  updateSalesMember,
  sendSalesmanPortalReset,
} from '../../services/salesService';
import { PAKISTAN_CITIES, BUSINESS_TYPE_OPTIONS, formatPKR } from '../../data/seedData';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvUtils';
import { useToast } from '../../components/common/Toast';
import {
  BusinessType,
  PayoutMethod,
  SalesAccountStatus,
  SalesEmploymentStatus,
  SalesMember,
  SalesMemberRole,
  SalesSettings,
  SalesTeam,
} from '../../types';

export const SalesMembersPage: React.FC<{ defaultCreateOpen?: boolean }> = ({ defaultCreateOpen = false }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [teams, setTeams] = useState<SalesTeam[]>([]);
  const [settings, setSettings] = useState<SalesSettings | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const perPage = 12;

  const [modalOpen, setModalOpen] = useState(defaultCreateOpen);
  const [editingMember, setEditingMember] = useState<SalesMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Karachi');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<SalesMemberRole>('salesman');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [territory, setTerritory] = useState('Karachi Central');
  const [industryFocus, setIndustryFocus] = useState<BusinessType | 'all'>('all');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employmentStatus, setEmploymentStatus] = useState<SalesEmploymentStatus>('full_time');
  const [monthlyTarget, setMonthlyTarget] = useState('50000');
  const [yearlyTarget, setYearlyTarget] = useState('600000');
  const [commissionPlanId, setCommissionPlanId] = useState('tier-standard');
  const [accountStatus, setAccountStatus] = useState<SalesAccountStatus>('invited');
  const [preferredMethod, setPreferredMethod] = useState<PayoutMethod>('bank_transfer');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [sendResetInvite, setSendResetInvite] = useState(true);

  const resetCreateFields = (defaultPlanId?: string) => {
    setEditingMember(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setCity('Karachi');
    setAddress('');
    setRole('salesman');
    setAssignedManagerId('');
    setTeamId('');
    setTerritory('Karachi');
    setIndustryFocus('all');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setEmploymentStatus('full_time');
    setMonthlyTarget('50000');
    setYearlyTarget('600000');
    setCommissionPlanId(defaultPlanId || settings?.commissionPlans[0]?.id || 'tier-standard');
    setAccountStatus('invited');
    setPreferredMethod('bank_transfer');
    setAccountTitle('');
    setAccountNumber('');
    setBankName('');
    setSendResetInvite(true);
    setFormError(null);
  };

  useEffect(() => {
    setModalOpen(defaultCreateOpen);
    if (defaultCreateOpen) {
      resetCreateFields();
    }
  }, [defaultCreateOpen]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, t, s] = await Promise.all([
        getAllSalesMembers(),
        getAllSalesTeams(),
        getSalesSettings(),
      ]);
      setMembers(m);
      setTeams(t);
      setSettings(s);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load sales directory from Firestore.';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const managers = useMemo(() => members.filter((m) => m.role === 'sales_manager'), [members]);

  const openCreateModal = () => {
    resetCreateFields();
    setModalOpen(true);
  };

  const openEditModal = (m: SalesMember) => {
    setEditingMember(m);
    setFullName(m.fullName);
    setEmail(m.email);
    setPhone(m.phone);
    setCity(m.city);
    setAddress(m.address || '');
    setRole(m.role);
    setAssignedManagerId(m.assignedManagerId || '');
    setTeamId(m.teamId || '');
    setTerritory(m.territory);
    setIndustryFocus(m.industryFocus);
    setJoiningDate(m.joiningDate);
    setEmploymentStatus(m.employmentStatus);
    setMonthlyTarget(String(m.monthlyTarget));
    setYearlyTarget(String(m.yearlyTarget));
    setCommissionPlanId(m.commissionPlanId);
    setAccountStatus(m.accountStatus);
    setPreferredMethod(m.payoutDetails?.preferredMethod || 'bank_transfer');
    setAccountTitle(m.payoutDetails?.accountTitle || '');
    setAccountNumber(m.payoutDetails?.accountNumber || '');
    setBankName(m.payoutDetails?.bankName || '');
    setSendResetInvite(false);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      const msg = 'Full name, email, and mobile number are required.';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    setSaving(true);
    try {
      const selectedManager = managers.find((mg) => mg.id === assignedManagerId);
      const selectedTeam = teams.find((tm) => tm.id === teamId);
      const selectedPlan = settings?.commissionPlans.find((p) => p.id === commissionPlanId);

      const payoutDetails =
        accountTitle.trim() && accountNumber.trim()
          ? {
              preferredMethod,
              accountTitle: accountTitle.trim(),
              accountNumber: accountNumber.trim(),
              bankName: bankName.trim() || undefined,
            }
          : undefined;

      if (editingMember) {
        await updateSalesMember(editingMember.id, {
          fullName: fullName.trim(),
          phone: phone.trim(),
          city,
          address: address.trim() || undefined,
          role,
          assignedManagerId: selectedManager?.id || undefined,
          assignedManagerUid: selectedManager?.uid || undefined,
          assignedManagerName: selectedManager?.fullName || undefined,
          teamId: selectedTeam?.id || undefined,
          teamName: selectedTeam?.name || undefined,
          territory: territory.trim() || city,
          industryFocus,
          joiningDate,
          employmentStatus,
          monthlyTarget: Number(monthlyTarget) || 0,
          yearlyTarget: Number(yearlyTarget) || 0,
          commissionPlanId: selectedPlan?.id || commissionPlanId,
          commissionPlanName: selectedPlan?.name || commissionPlanId,
          accountStatus,
          payoutDetails,
        });
        showToast('Salesman profile updated.', 'success');
      } else {
        const created = await createSalesMember({
          fullName,
          email,
          phone,
          city,
          address,
          role,
          assignedManagerId: selectedManager?.id,
          assignedManagerUid: selectedManager?.uid,
          assignedManagerName: selectedManager?.fullName,
          teamId: selectedTeam?.id,
          teamName: selectedTeam?.name,
          territory,
          industryFocus,
          joiningDate,
          employmentStatus,
          monthlyTarget: Number(monthlyTarget) || 0,
          yearlyTarget: Number(yearlyTarget) || 0,
          commissionPlanId: selectedPlan?.id || commissionPlanId,
          commissionPlanName: selectedPlan?.name || commissionPlanId,
          accountStatus,
          payoutDetails,
          sendPasswordResetInvite: sendResetInvite,
        });
        if (sendResetInvite) {
          showToast(
            created._resetEmailSent
              ? `Salesman created (${created.employeeId}) & Firebase Auth invite/reset email sent.`
              : `Salesman created (${created.employeeId}). Note: ${created._resetEmailWarning || 'Send portal invite via Mail icon if needed.'}`,
            created._resetEmailSent ? 'success' : 'info'
          );
        } else {
          showToast(`Salesman profile created (${created.employeeId}) with Referral Code ${created.referralCode}.`, 'success');
        }
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save salesman.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (m: SalesMember) => {
    const next: SalesAccountStatus = m.accountStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateSalesMember(m.id, { accountStatus: next });
      showToast(`${m.fullName} marked as ${next}.`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.', 'error');
    }
  };

  const handleApproveMember = async (m: SalesMember) => {
    try {
      await updateSalesMember(m.id, {
        accountStatus: 'active',
        inviteStatus: 'accepted',
        acceptedAt: new Date().toISOString(),
      });
      showToast(`Approved & activated referral partner ${m.fullName} (${m.referralCode}).`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve partner.', 'error');
    }
  };

  const handleSendReset = async (m: SalesMember) => {
    try {
      await sendSalesmanPortalReset(m.email, m.id);
      showToast(`Firebase Auth reset/invite email dispatched to ${m.email}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not dispatch reset email.', 'error');
    }
  };

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.accountStatus !== statusFilter) return false;
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (cityFilter !== 'all' && m.city !== cityFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = `${m.fullName} ${m.email} ${m.employeeId} ${m.referralCode} ${m.phone} ${m.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [members, statusFilter, roleFilter, cityFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const exportCsv = () => {
    downloadCsvFile(
      `sbkhush-salesmen-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Employee ID', 'Name', 'Email', 'Phone', 'Role', 'City', 'Territory', 'Manager', 'Referral Code', 'Status', 'Monthly Target', 'Commission Plan'],
      filtered.map((m) => [
        m.employeeId,
        m.fullName,
        m.email,
        m.phone,
        m.role,
        m.city,
        m.territory,
        m.assignedManagerName || 'None',
        m.referralCode,
        m.accountStatus,
        m.monthlyTarget,
        m.commissionPlanName,
      ])
    );
    showToast(`Exported ${filtered.length} salesmen to CSV.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">All Salesmen & Managers</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage sales representatives, territories, targets, Firebase Auth portal invites, and referral codes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add New Salesman
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
            placeholder="Search name, email, employee ID, referral code..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="all">All Roles</option>
          <option value="salesman">Salesman</option>
          <option value="senior_salesman">Senior Salesman</option>
          <option value="sales_manager">Sales Manager</option>
          <option value="referral_agent">Referral Agent</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
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

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-bold text-rose-700">{loadError}</p>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold hover:bg-emerald-900"
            >
              Retry Loading Directory
            </button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">No salesmen found</p>
            <p className="text-xs text-slate-500">Create your first salesman account to issue referral codes and assign leads.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Representative</th>
                  <th className="px-4 py-3">Role & Manager</th>
                  <th className="px-4 py-3">Territory & Target</th>
                  <th className="px-4 py-3">Referral Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/super-admin/sales/members/${m.id}`}
                        className="font-bold text-slate-900 hover:text-[#065F46]"
                      >
                        {m.fullName}
                      </Link>
                      <div className="text-[11px] text-slate-500">
                        {m.employeeId} · {m.email}
                      </div>
                      <div className="text-[11px] text-slate-400">{m.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold capitalize">
                        {m.role.replace('_', ' ')}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Mgr: {m.assignedManagerName || 'Direct Super Admin'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {m.city} ({m.territory})
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        Monthly: {formatPKR(m.monthlyTarget)} · {m.commissionPlanName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-[#065F46] bg-emerald-50 px-2 py-1 rounded-lg">
                        {m.referralCode}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">QR Scans: {m.qrScanCount || 0}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                          m.accountStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : m.accountStatus === 'pending_approval'
                            ? 'bg-blue-50 text-blue-700'
                            : m.accountStatus === 'invited'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {m.accountStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.accountStatus === 'pending_approval' && (
                          <button
                            type="button"
                            onClick={() => handleApproveMember(m)}
                            title="Approve & Activate Partner"
                            className="px-2.5 py-1 rounded-lg bg-[#065F46] hover:bg-emerald-900 text-white font-bold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        <Link
                          to={`/super-admin/sales/members/${m.id}`}
                          title="View Details"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          title="Edit Profile"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReset(m)}
                          title="Send Firebase Auth Password Reset / Portal Invite"
                          className="p-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(m)}
                          title={m.accountStatus === 'active' ? 'Suspend Account' : 'Activate Account'}
                          className="p-1.5 rounded-lg border border-slate-200 text-amber-700 hover:bg-amber-50"
                        >
                          {m.accountStatus === 'active' ? (
                            <PauseCircle className="w-3.5 h-3.5" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {page} of {totalPages} ({filtered.length} records)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {editingMember ? `Edit ${editingMember.fullName}` : 'Add New Salesman'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Authentication uses Firebase Auth email/Google invites — passwords are never stored.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmed Khan"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingMember)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed.sales@sbkhush.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300 1234567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as SalesMemberRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="salesman">Salesman</option>
                    <option value="senior_salesman">Senior Salesman</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="referral_agent">Referral Agent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {PAKISTAN_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Territory / Zone</label>
                  <input
                    type="text"
                    value={territory}
                    onChange={(e) => setTerritory(e.target.value)}
                    placeholder="Gulberg & DHA Zone"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Manager</label>
                  <select
                    value={assignedManagerId}
                    onChange={(e) => setAssignedManagerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Direct (Super Admin)</option>
                    {managers
                      .filter((mg) => mg.id !== editingMember?.id)
                      .map((mg) => (
                        <option key={mg.id} value={mg.id}>
                          {mg.fullName} ({mg.city})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sales Team</label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.territory})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Industry Focus</label>
                  <select
                    value={industryFocus}
                    onChange={(e) => setIndustryFocus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="all">All Industries</option>
                    {BUSINESS_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commission Plan Tier</label>
                  <select
                    value={commissionPlanId}
                    onChange={(e) => setCommissionPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {(settings?.commissionPlans || []).map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name} ({cp.firstSubRatePct}% first / {cp.renewalRatePct}% renewal)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employment Status</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as SalesEmploymentStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="probation">Probation</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Revenue Target (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Yearly Revenue Target (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={yearlyTarget}
                    onChange={(e) => setYearlyTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={accountStatus}
                    onChange={(e) => setAccountStatus(e.target.value as SalesAccountStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="invited">Invited (Claim Pending)</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address (Optional)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="font-bold text-slate-800">Commission Payout Bank / Wallet Details (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={preferredMethod}
                    onChange={(e) => setPreferredMethod(e.target.value as PayoutMethod)}
                    className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="jazzcash">JazzCash</option>
                  </select>
                  <input
                    type="text"
                    value={accountTitle}
                    onChange={(e) => setAccountTitle(e.target.value)}
                    placeholder="Account Title"
                    className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  />
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="IBAN / Account / Mobile #"
                    className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  />
                </div>
                {preferredMethod === 'bank_transfer' && (
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank Name (e.g. Meezan Bank)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  />
                )}
              </div>

              {!editingMember && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendResetInvite}
                    onChange={(e) => setSendResetInvite(e.target.checked)}
                    className="rounded text-[#065F46]"
                  />
                  <ShieldCheck className="w-4 h-4 text-[#065F46]" />
                  <span>Send Firebase Auth invite/password-setup email upon creation</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white font-bold flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingMember ? 'Save Changes' : 'Create Salesman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

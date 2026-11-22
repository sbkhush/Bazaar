import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit3, Loader2, X } from 'lucide-react';
import {
  getAllSalesTeams,
  getAllSalesMembers,
  saveSalesTeam,
  deleteSalesTeam,
} from '../../services/salesService';
import { formatPKR, PAKISTAN_CITIES } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import { SalesMember, SalesTeam } from '../../types';

export const SalesTeamsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teams, setTeams] = useState<SalesTeam[]>([]);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesTeam | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [managerMemberId, setManagerMemberId] = useState('');
  const [territory, setTerritory] = useState('Punjab North');
  const [selectedCities, setSelectedCities] = useState<string[]>(['Lahore']);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [monthlyTeamTarget, setMonthlyTeamTarget] = useState('250000');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, m] = await Promise.all([
        getAllSalesTeams(),
        getAllSalesMembers(),
      ]);
      setTeams(t);
      setMembers(m);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load sales teams from Firestore.';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (team?: SalesTeam) => {
    if (team) {
      setEditing(team);
      setName(team.name);
      setManagerMemberId(team.managerMemberId);
      setTerritory(team.territory);
      setSelectedCities(team.cities || []);
      setMemberIds(team.memberIds || []);
      setMonthlyTeamTarget(String(team.monthlyTeamTarget || 0));
      setDescription(team.description || '');
    } else {
      setEditing(null);
      setName('');
      setManagerMemberId('');
      setTerritory('Karachi South');
      setSelectedCities(['Karachi']);
      setMemberIds([]);
      setMonthlyTeamTarget('250000');
      setDescription('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Team name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const mgr = members.find((m) => m.id === managerMemberId);
      await saveSalesTeam({
        id: editing?.id,
        name: name.trim(),
        managerMemberId: mgr?.id || '',
        managerUid: mgr?.uid,
        managerName: mgr?.fullName || 'Super Admin',
        territory: territory.trim(),
        cities: selectedCities,
        memberIds,
        monthlyTeamTarget: Number(monthlyTeamTarget) || 0,
        description: description.trim() || undefined,
        isActive: true,
        createdAt: editing?.createdAt,
      });
      showToast('Sales team saved.', 'success');
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save team.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: SalesTeam) => {
    try {
      await deleteSalesTeam(team.id);
      showToast(`Deleted team ${team.name}`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Could not delete team.', 'error');
    }
  };

  const managers = members.filter((m) => m.role === 'sales_manager' || m.role === 'senior_salesman');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Teams</h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize regional sales pods, assign team managers, territories, cities, and collective monthly targets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New Sales Team
        </button>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-rose-800">{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold hover:bg-rose-800 self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-10 flex justify-center bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No sales teams created yet</p>
          <p className="text-xs text-slate-500">Group field representatives into city-based teams with a manager.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{t.name}</h3>
                  <p className="text-xs text-[#065F46] font-semibold">{t.territory}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openModal(t)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <p>Manager: <strong className="text-slate-900">{t.managerName}</strong></p>
                <p>Members: <strong>{t.memberIds.length}</strong> · Target: <strong>{formatPKR(t.monthlyTeamTarget)}/mo</strong></p>
                <p className="text-[11px] text-slate-500">Cities: {t.cities.join(', ') || 'All'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">
                {editing ? `Edit ${editing.name}` : 'Create Sales Team'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Karachi Merchant Growth"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Territory *</label>
                  <input
                    type="text"
                    required
                    value={territory}
                    onChange={(e) => setTerritory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Team Manager</label>
                  <select
                    value={managerMemberId}
                    onChange={(e) => setManagerMemberId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Super Admin Managed</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Revenue Target (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyTeamTarget}
                    onChange={(e) => setMonthlyTeamTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Covered Cities</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 border border-slate-200 rounded-xl">
                  {PAKISTAN_CITIES.map((c) => {
                    const checked = selectedCities.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() =>
                          setSelectedCities((prev) =>
                            checked ? prev.filter((x) => x !== c) : [...prev, c]
                          )
                        }
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                          checked ? 'bg-[#065F46] text-white border-[#065F46]' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Team Members ({memberIds.length} selected)</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                  {members.map((m) => {
                    const checked = memberIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setMemberIds((prev) =>
                              checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                            )
                          }
                        />
                        <span className="font-semibold text-slate-800">{m.fullName}</span>
                        <span className="text-slate-400">({m.employeeId} · {m.city})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#065F46] text-white font-bold flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

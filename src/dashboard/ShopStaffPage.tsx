import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopStaff,
  inviteShopStaff,
  removeShopStaff,
  cancelShopInvite,
} from '../services/tenantService';
import { StaffMember, ShopInvite, StaffPermission, StaffRole } from '../types';
import {
  getDefaultPermissionsForRole,
  getPermissionsForIndustry,
  getRoleOptionsForIndustry,
} from '../config/industryConfig';

export const ShopStaffPage: React.FC = () => {
  const { shopId, shop, businessType, plan, isReadOnly } = useDashboard();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<ShopInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = getRoleOptionsForIndustry(businessType);
  const industryPermissions = getPermissionsForIndustry(businessType);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Exclude<StaffRole, 'shop_owner'>>('shop_staff');
  const [permissions, setPermissions] = useState<StaffPermission[]>(() =>
    getDefaultPermissionsForRole('shop_staff', businessType)
  );
  const [inviting, setInviting] = useState(false);

  const loadStaff = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getShopStaff(shopId);
      setStaff(res.staff);
      setInvites(res.invites);
    } catch (err: any) {
      setError(err?.message || 'Could not load team members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [shopId]);

  useEffect(() => {
    setPermissions(getDefaultPermissionsForRole(role, businessType));
  }, [role, businessType]);

  const togglePerm = (perm: StaffPermission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || isReadOnly) return;
    setError(null);
    setInviting(true);
    try {
      await inviteShopStaff(shopId, shop.name, shop.slug, {
        email,
        name,
        role,
        permissions:
          role === 'shop_admin'
            ? industryPermissions.map((p) => p.key)
            : permissions,
      });
      setEmail('');
      setName('');
      await loadStaff();
    } catch (err: any) {
      setError(err?.message || 'Could not invite team member');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Team &amp; Role Permissions</h2>
        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
          {staff.length + invites.length} of {plan.maxStaff} seats used on your {plan.name} plan.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form onSubmit={handleInvite} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#065F46]" /> Invite Team Member
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@email.com"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<StaffRole, 'shop_owner'>)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {role !== 'shop_admin' && (
            <div className="pt-2 space-y-2">
              <p className="font-semibold text-slate-700">Allowed Workspace Modules:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {industryPermissions.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.includes(perm.key)}
                      onChange={() => togglePerm(perm.key)}
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={inviting}
            className="px-5 py-2.5 bg-[#065F46] text-white rounded-xl font-bold"
          >
            {inviting ? 'Sending Invite...' : 'Send Team Invite'}
          </button>
          <p className="text-[11px] text-slate-400">
            When the invited user signs in via `/login` with this email, tenant access activates automatically.
          </p>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
          Authorized Team Members
        </div>
        {loading ? (
          <div className="py-10 flex justify-center text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading team...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((st) => (
              <div key={st.uid} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{st.name}</p>
                  <p className="text-[11px] text-slate-500">{st.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold uppercase text-[#065F46]">
                    {st.role.replace(/_/g, ' ')}
                  </span>
                  {!isReadOnly && st.role !== 'shop_owner' && (
                    <button
                      type="button"
                      onClick={() =>
                        removeShopStaff(shopId, st.uid)
                          .then(loadStaff)
                          .catch((err: any) =>
                            setError(err?.message || 'Could not remove team member.')
                          )
                      }
                      className="p-1.5 border border-red-200 text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {invites.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-4 bg-slate-50/70">
                <div>
                  <p className="font-bold text-slate-800">{inv.name} (Pending Invite)</p>
                  <p className="text-[11px] text-slate-500">
                    {inv.email} · Role: {inv.role.replace(/_/g, ' ')}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      cancelShopInvite(shopId, inv.id)
                        .then(loadStaff)
                        .catch((err: any) =>
                          setError(err?.message || 'Could not revoke pending invite.')
                        )
                    }
                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg font-semibold"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

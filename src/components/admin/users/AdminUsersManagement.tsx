import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { UserProfile, UserRole } from '../../../types/auth';
import {
  getAllUsers,
  updateUserByAdmin,
  setUserActive,
  deleteUser,
  checkUserDeleteSafety,
  provisionActionerByAdmin,
  ensureStandardActioners,
} from '../../../services/userService';

export const AdminUsersManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'actioner'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'deactivated'>('ALL');

  // Modals state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('actioner');
  const [editActive, setEditActive] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [provUid, setProvUid] = useState('');
  const [provFullName, setProvFullName] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [submittingProvision, setSubmittingProvision] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteSafety, setDeleteSafety] = useState<{
    safe: boolean;
    assignedActionCount: number;
    inspectionCount: number;
    reason?: string;
  } | null>(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsersList = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  const handleEnsureStandardActioners = async () => {
    try {
      setLoading(true);
      await ensureStandardActioners();
      await fetchUsersList();
      setFeedback({
        type: 'success',
        message: 'Standard actioners (Japie Breitenbach & Hannes Bronkhorst) verified and ready in Firestore.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to verify standard actioners.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditActive(user.active !== false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editFullName.trim()) {
      setFeedback({ type: 'error', message: 'Full name cannot be empty.' });
      return;
    }

    // Safety: Prevent active admin from demoting or deactivating their own currently logged-in account
    if (editingUser.uid === currentUser?.uid) {
      if (editRole !== 'admin') {
        setFeedback({ type: 'error', message: 'Safety check: You cannot demote your own administrator account.' });
        return;
      }
      if (!editActive) {
        setFeedback({ type: 'error', message: 'Safety check: You cannot deactivate your own administrator account.' });
        return;
      }
    }

    setSubmittingEdit(true);
    try {
      await updateUserByAdmin(editingUser.uid, {
        fullName: editFullName,
        role: editRole,
        active: editActive,
      });
      setEditingUser(null);
      setFeedback({ type: 'success', message: `User "${editFullName}" successfully updated.` });
      await fetchUsersList();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user profile.' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      setFeedback({ type: 'error', message: 'Safety check: You cannot deactivate your own account.' });
      return;
    }
    const newStatus = !(user.active !== false);
    try {
      await setUserActive(user.uid, newStatus);
      setFeedback({
        type: 'success',
        message: `Account for ${user.fullName} has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await fetchUsersList();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user active status.' });
    }
  };

  const handleOpenDelete = async (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      setFeedback({ type: 'error', message: 'Safety check: You cannot delete your own account.' });
      return;
    }
    setDeleteTarget(user);
    setCheckingSafety(true);
    try {
      const safety = await checkUserDeleteSafety(user.uid);
      setDeleteSafety(safety);
    } catch {
      setDeleteSafety({ safe: false, assignedActionCount: 0, inspectionCount: 0 });
    } finally {
      setCheckingSafety(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmittingDelete(true);
    try {
      await deleteUser(deleteTarget.uid);
      setFeedback({ type: 'success', message: `User record for "${deleteTarget.fullName}" deleted.` });
      setDeleteTarget(null);
      setDeleteSafety(null);
      await fetchUsersList();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user profile.' });
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleProvisionActioner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provFullName.trim() || !provEmail.trim()) {
      setFeedback({ type: 'error', message: 'Please provide full name and email.' });
      return;
    }

    const targetUid = provUid.trim() || `actioner_${Date.now()}`;
    setSubmittingProvision(true);
    try {
      await provisionActionerByAdmin(targetUid, provFullName, provEmail);
      setProvisionModalOpen(false);
      setProvUid('');
      setProvFullName('');
      setProvEmail('');
      setFeedback({ type: 'success', message: `Actioner profile for ${provFullName} provisioned successfully.` });
      await fetchUsersList();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to provision actioner profile.' });
    } finally {
      setSubmittingProvision(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const nameMatch = u.fullName.toLowerCase().includes(q);
      const emailMatch = u.email.toLowerCase().includes(q);
      const uidMatch = u.uid.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !uidMatch) return false;
    }
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && u.active === false) return false;
    if (statusFilter === 'deactivated' && u.active !== false) return false;
    return true;
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.active !== false).length;
  const actionerCount = users.filter((u) => u.role === 'actioner' && u.active !== false).length;
  const deactivatedCount = users.filter((u) => u.active === false).length;

  return (
    <div id="admin-users-management-view" className="space-y-6">
      {/* Feedback message */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalUsers}</div>
          <div className="text-xs text-slate-400 mt-1">Platform-registered profiles</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Admins</span>
            <Shield className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{adminCount}</div>
          <div className="text-xs text-slate-400 mt-1">Full administrative access</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Actioners</span>
            <UserCheck className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-sky-600">{actionerCount}</div>
          <div className="text-xs text-slate-400 mt-1">Departmental remediators</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Deactivated</span>
            <UserX className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{deactivatedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Access suspended</div>
        </div>
      </div>

      {/* Control Bar: Filters & Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="input-search-users"
              type="text"
              placeholder="Search by name, email, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
            />
          </div>

          {/* Role Filter */}
          <select
            id="select-user-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admins Only</option>
            <option value="actioner">Actioners Only</option>
          </select>

          {/* Status Filter */}
          <select
            id="select-user-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Deactivated Only</option>
          </select>

          <button
            type="button"
            onClick={fetchUsersList}
            title="Refresh Users"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-ensure-actioners"
            type="button"
            onClick={handleEnsureStandardActioners}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
          >
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            Ensure Standard Actioners
          </button>

          <button
            id="btn-provision-actioner"
            type="button"
            onClick={() => setProvisionModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            + Provision Actioner
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">UID / Identifier</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading platform users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No users matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isActive = user.active !== false;
                  const isCurrent = user.uid === currentUser?.uid;

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                            {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">{user.fullName || 'Unnamed'}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                            user.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-sky-100 text-sky-800 border border-sky-300'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <Shield className="h-3 w-3" />
                          ) : (
                            <UserCheck className="h-3 w-3" />
                          )}
                          {user.role.toUpperCase()}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* UID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={user.uid}>
                        {user.uid}
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit User Profile"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Deactivate / Reactivate Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(user)}
                            disabled={isCurrent}
                            title={
                              isCurrent
                                ? 'You cannot deactivate your own account'
                                : isActive
                                ? 'Deactivate User Account'
                                : 'Reactivate User Account'
                            }
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive
                                ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Reactivate'}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(user)}
                            disabled={isCurrent}
                            title={isCurrent ? 'You cannot delete your own account' : 'Delete User Record'}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Edit User Profile */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-slate-600" />
                Edit User Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="text"
                  value={editingUser.email}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Email is bound to Firebase Authentication.</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">User Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  disabled={editingUser.uid === currentUser?.uid}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  <option value="actioner">Actioner (Departmental Remediation)</option>
                  <option value="admin">Administrator (Lead Inspector & Management)</option>
                </select>
                {editingUser.uid === currentUser?.uid && (
                  <span className="text-[10px] text-amber-600 mt-0.5 block">
                    You cannot change your own administrator role.
                  </span>
                )}
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    disabled={editingUser.uid === currentUser?.uid}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-semibold text-slate-800">Account is Active</span>
                </label>
                <span className="text-[10px] text-slate-400 mt-0.5 block pl-6">
                  Deactivated users are blocked from logging in, viewing actions, and accessing APIs.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={submittingEdit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Provision Actioner Profile */}
      {provisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleProvisionActioner}
            className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-slate-600" />
                Provision Departmental Actioner
              </h3>
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Create an authorized Firestore user profile for a departmental actioner (e.g. for Japie Breitenbach or Hannes Bronkhorst) to immediately enable task allocation during inspections.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Japie Breitenbach"
                  value={provFullName}
                  onChange={(e) => setProvFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. japie@spiralsystems.co.za"
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Firebase Authentication UID <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate identifier"
                  value={provUid}
                  onChange={(e) => setProvUid(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  If the actioner has already registered in Firebase Auth, paste their exact Auth UID here to link immediately.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingProvision}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submittingProvision ? 'Provisioning...' : 'Provision Actioner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Delete Safety Warning & Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm User Deletion</h3>
                <p className="text-xs text-slate-500">Checking data dependencies for {deleteTarget.fullName}</p>
              </div>
            </div>

            {checkingSafety ? (
              <div className="py-6 text-center text-xs text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-slate-400" />
                Verifying assigned corrective actions and inspection records...
              </div>
            ) : deleteSafety && !deleteSafety.safe ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                <div className="flex items-start gap-2 text-amber-800 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>Historical Data Dependency Warning</span>
                </div>
                <p className="text-amber-700 leading-relaxed">
                  {deleteSafety.reason}
                </p>
                <div className="text-[11px] text-amber-800 font-medium">
                  • Assigned Actions: <span className="font-bold">{deleteSafety.assignedActionCount}</span>
                  <br />
                  • Created Inspections: <span className="font-bold">{deleteSafety.inspectionCount}</span>
                </div>
                <p className="text-slate-600 pt-1 text-[11px]">
                  Permanently deleting this user profile will leave orphaned ID references in historical audits. We recommend choosing <strong className="text-slate-800">Deactivate</strong> instead.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                No active actions or inspections are linked to this user. This user record can be safely deleted.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteSafety(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submittingDelete || checkingSafety}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submittingDelete ? 'Deleting...' : 'Delete User Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

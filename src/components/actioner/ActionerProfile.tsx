import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateSelfProfile } from '../../services/userService';
import { User, Mail, Shield, Key, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const ActionerProfile: React.FC = () => {
  const { currentUser, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const trimmed = fullName.trim();
    if (!trimmed) {
      setErrorMessage('Full name cannot be empty.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateSelfProfile(currentUser.uid, trimmed);
      await refreshProfile();
      setSuccessMessage('Profile name updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="actioner-profile-view" className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Profile</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal actioner account details and workplace display name.
          </p>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Full Name Field (Editable) */}
          <div>
            <label htmlFor="actioner-fullname-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name (Display Name)
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="actioner-fullname-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-xs"
                placeholder="e.g. Japie Breitenbach"
              />
            </div>
          </div>

          {/* Email Address (Read-Only) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Email Address (Authentication)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Email address is linked to authentication credentials and cannot be modified here.
            </p>
          </div>

          {/* Security & Access Grid (Read-Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Shield className="h-3.5 w-3.5 text-sky-600" />
                Assigned Role
              </div>
              <div className="text-sm font-bold text-slate-900 capitalize">
                {currentUser?.role || 'Actioner'}
              </div>
              <div className="text-[11px] text-slate-500">
                Workplace Corrective Action Assignee
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Account Status
              </div>
              <div className="text-sm font-bold text-emerald-700">
                {currentUser?.active ? 'Active' : 'Deactivated'}
              </div>
              <div className="text-[11px] text-slate-500">
                Authorized for Actioner Portal
              </div>
            </div>
          </div>

          {/* UID Snippet */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Key className="h-3.5 w-3.5 text-slate-400" />
              Firebase Unique Identifier (UID)
            </div>
            <code className="text-xs font-mono text-slate-600 block break-all">
              {currentUser?.uid || 'Not available'}
            </code>
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || fullName.trim() === currentUser?.fullName}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Update Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

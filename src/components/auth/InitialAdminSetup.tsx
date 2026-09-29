import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertBanner } from '../common/AlertBanner';
import { ShieldAlert, User, Mail, Lock, Loader2, ArrowLeft, KeyRound } from 'lucide-react';

interface InitialAdminSetupProps {
  onSwitchToLogin: () => void;
}

export const InitialAdminSetup: React.FC<InitialAdminSetupProps> = ({ onSwitchToLogin }) => {
  const { registerInitialAdmin, initialAdminExists } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your administrator email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await registerInitialAdmin(fullName, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initial administrator setup failed.');
    } finally {
      setLoading(false);
    }
  };

  if (initialAdminExists) {
    return (
      <div id="initial-admin-locked" className="space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Setup Already Completed</h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
          The initial administrator has already been registered and locked. Further administrative roles can only be granted by the existing administrator.
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
        >
          Return to Sign In
        </button>
      </div>
    );
  }

  return (
    <div id="initial-admin-setup-container" className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Bootstrap Initial Administrator</h2>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          This one-time bootstrap securely designates the primary workplace Inspector / Admin.
        </p>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold text-amber-950 mb-1">Security Guarantee:</p>
        Once this primary administrator account is created, Firestore locks the system configuration. No future registering user can claim the admin role; all other accounts will strictly receive the <strong>Actioner</strong> role.
      </div>

      {error && <AlertBanner id="admin-setup-error" type="error" message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="admin-fullname" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Administrator Full Name
          </label>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <input
              id="admin-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Lead SHEQ Inspector"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <div>
          <label htmlFor="admin-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Official Email Address
          </label>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sheq@spiralsystems.co.za"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Admin Password
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 chars"
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Confirm Password
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="admin-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
              />
            </div>
          </div>
        </div>

        <button
          id="btn-submit-initial-admin"
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Configuring Administrator...</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4" />
              <span>Claim & Register Initial Admin</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

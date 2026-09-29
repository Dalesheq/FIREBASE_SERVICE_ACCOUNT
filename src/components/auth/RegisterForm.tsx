import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertBanner } from '../common/AlertBanner';
import { User, Mail, Lock, Loader2, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { registerActioner } = useAuth();
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
      setError('Please enter your workplace email address.');
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
      await registerActioner(fullName, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="register-form-container" className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Register Actioner Account</h2>
        <p className="text-xs text-slate-500 mt-1">
          Create an individual account to view and resolve assigned corrective actions.
        </p>
      </div>

      {/* Role enforcement notice */}
      <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-700">
        <ShieldCheck className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Role Enforcement: </span>
          All standard registrations are provisioned as <strong>Actioner</strong>. For safety compliance, administrative and inspection privileges are controlled by the system administrator.
        </div>
      </div>

      {error && <AlertBanner id="register-error-banner" type="error" message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Full Name
          </label>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <input
              id="reg-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Japie Breitenbach or Hannes Bronkhorst"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Workplace Email
          </label>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. japie@company.com"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Password
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="reg-password"
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
            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Confirm
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="reg-confirm-password"
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
          id="btn-submit-register"
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Create Actioner Account</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-slate-500">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-slate-900 hover:underline cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </div>
  );
};

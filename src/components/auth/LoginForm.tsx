import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertBanner } from '../common/AlertBanner';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
  onSwitchToInitialAdmin?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToRegister,
  onSwitchToReset,
  onSwitchToInitialAdmin,
}) => {
  const { login, initialAdminExists } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-form-container" className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
        <p className="text-xs text-slate-500 mt-1">Enter your registered workplace credentials to continue.</p>
      </div>

      {error && <AlertBanner id="login-error-banner" type="error" message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Email Address
          </label>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. inspector@company.com"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <button
              type="button"
              id="btn-goto-forgot-password"
              onClick={onSwitchToReset}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative rounded-md shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
            />
          </div>
        </div>

        <button
          id="btn-submit-login"
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-3 border-t border-slate-200 flex flex-col gap-2.5 text-center text-xs text-slate-600">
        <div>
          New actioner team member?{' '}
          <button
            type="button"
            id="btn-goto-register"
            onClick={onSwitchToRegister}
            className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Register account
          </button>
        </div>

        {!initialAdminExists && onSwitchToInitialAdmin && (
          <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
            <p className="font-semibold">Initial Setup Required</p>
            <p className="text-[11px] text-amber-800 mt-0.5 mb-1.5">
              No administrator has been configured for this system yet.
            </p>
            <button
              type="button"
              id="btn-goto-initial-admin"
              onClick={onSwitchToInitialAdmin}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-xs cursor-pointer"
            >
              Configure First Administrator
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

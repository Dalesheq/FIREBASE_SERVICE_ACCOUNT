import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertBanner } from '../common/AlertBanner';
import { Mail, Loader2, ArrowLeft, Send } from 'lucide-react';

interface PasswordResetFormProps {
  onSwitchToLogin: () => void;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onSwitchToLogin }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="password-reset-container" className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Reset your password</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter your registered workplace email address and we'll send you a password reset link.
        </p>
      </div>

      {error && <AlertBanner id="reset-error-banner" type="error" message={error} onDismiss={() => setError(null)} />}
      {success && (
        <AlertBanner
          id="reset-success-banner"
          type="success"
          message="Password reset instructions have been sent to your email address. Please check your inbox and spam folder."
        />
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. inspector@company.com"
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
              />
            </div>
          </div>

          <button
            id="btn-submit-reset"
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Reset Link</span>
              </>
            )}
          </button>
        </form>
      )}

      <div className="pt-2 text-center text-xs text-slate-500">
        Remembered your password?{' '}
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

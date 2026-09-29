import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { PasswordResetForm } from '../components/auth/PasswordResetForm';
import { InitialAdminSetup } from '../components/auth/InitialAdminSetup';
import { ShieldCheck, CheckCircle2, Lock, FileText } from 'lucide-react';

type AuthView = 'login' | 'register' | 'reset' | 'initial-admin';

export const AuthPage: React.FC = () => {
  const { initialAdminExists } = useAuth();
  const [view, setView] = useState<AuthView>('login');

  useEffect(() => {
    // If no admin exists, suggest or guide to initial admin setup
    if (!initialAdminExists) {
      setView('initial-admin');
    }
  }, [initialAdminExists]);

  return (
    <div id="auth-page" className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 shadow-md">
            <ShieldCheck className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              SHEQ <span className="text-amber-600 font-extrabold text-xl">PORTAL</span>
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-slate-700 font-bold mt-1">
              Safety • Health • Environment • Quality
            </p>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 sm:px-8 shadow-xs rounded-xl border border-slate-200">
          {view === 'login' && (
            <LoginForm
              onSwitchToRegister={() => setView('register')}
              onSwitchToReset={() => setView('reset')}
              onSwitchToInitialAdmin={() => setView('initial-admin')}
            />
          )}

          {view === 'register' && (
            <RegisterForm onSwitchToLogin={() => setView('login')} />
          )}

          {view === 'reset' && (
            <PasswordResetForm onSwitchToLogin={() => setView('login')} />
          )}

          {view === 'initial-admin' && (
            <InitialAdminSetup onSwitchToLogin={() => setView('login')} />
          )}
        </div>

        {/* Phase 1 Security & Architecture Indicators */}
        <div className="mt-6 p-4 rounded-lg bg-slate-200/80 border border-slate-300 text-slate-700 text-xs space-y-2">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <Lock className="h-3.5 w-3.5 text-slate-800" />
            Phase 1 Authorization Architecture
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Firebase Auth (Email/PW)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>UID-Based Identity</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Strict Firestore Rules</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Zero-Trust Action Isolation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

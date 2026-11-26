import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import type { UsageStats, UserProfile } from '../types';
import { LegalModals, type LegalModalType } from './LegalModals';
import { NeoLogo } from './NeoLogo';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile, usage: UsageStats) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState({ googleConfigured: false, appleConfigured: false });
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  useEffect(() => {
    api
      .getAuthProviders()
      .then((res) =>
        setProviders({
          googleConfigured: res.googleConfigured,
          appleConfigured: res.appleConfigured,
        })
      )
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!acceptedTerms) {
        setError('Please accept the Terms and Conditions to create an account.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res = await api.forgotPassword(email || identifier);
        setInfoMessage(res.message);
      } else if (mode === 'register') {
        const res = await api.register({
          email,
          phone: phone.trim() || undefined,
          username,
          password,
          rememberMe,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.usage);
      } else {
        const res = await api.login({
          identifier,
          password,
          rememberMe,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.usage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthNotice = (provider: 'Google' | 'Apple') => {
    setError(null);
    const configured =
      provider === 'Google' ? providers.googleConfigured : providers.appleConfigured;
    if (!configured) {
      setInfoMessage(
        `${provider} Sign-In is not configured in this environment. Use your email or phone number below to sign in or create an account.`
      );
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-white text-[#111827] px-4 py-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 neo-soft-shadow-lg"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <NeoLogo size="lg" showWordmark={false} className="mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
            {mode === 'login'
              ? 'Welcome Back'
              : mode === 'register'
                ? 'Create Account'
                : 'Password Recovery'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            NEO AI · Your Personal AI Assistant
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F5F5F5] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2.5 min-h-[42px] rounded-lg text-sm font-medium transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#111827] neo-soft-shadow'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2.5 min-h-[42px] rounded-lg text-sm font-medium transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-[#111827] neo-soft-shadow'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Create Account
          </button>
        </div>

        {mode === 'login' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => handleOAuthNotice('Google')}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#FAFAFA] text-xs sm:text-sm font-medium text-[#111827] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthNotice('Apple')}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#FAFAFA] text-xs sm:text-sm font-medium text-[#111827] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
                </svg>
                <span>Continue with Apple</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center mb-5">
              <div className="w-full border-t border-[#E5E7EB]" />
              <span className="px-3 text-xs text-[#6B7280] bg-white whitespace-nowrap">
                or sign in with credentials
              </span>
              <div className="w-full border-t border-[#E5E7EB]" />
            </div>
          </>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xl border border-[#E5E7EB] bg-[#F5F5F5] text-[#111827] text-xs sm:text-sm flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#111827]" />
            <span>{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] placeholder:text-[#6B7280]/70 focus:outline-none focus:border-[#111827] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] placeholder:text-[#6B7280]/70 focus:outline-none focus:border-[#111827] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Phone Number <span className="text-[#6B7280]">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 010 2030"
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] placeholder:text-[#6B7280]/70 focus:outline-none focus:border-[#111827] focus:bg-white"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'login' && (
            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1">
                Email or Phone Number
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +1 555 010 2030"
                  className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] placeholder:text-[#6B7280]/70 focus:outline-none focus:border-[#111827] focus:bg-white"
                />
              </div>
            </div>
          )}

          {mode === 'forgot' && (
            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1">
                Account Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
                />
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#111827]">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-xs font-medium text-[#111827] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <label className="flex items-center gap-2.5 text-xs text-[#6B7280] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#E5E7EB] accent-[#111827]"
              />
              <span>Remember Me</span>
            </label>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-[#6B7280] cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-[#E5E7EB] accent-[#111827]"
              />
              <span>
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="text-[#111827] font-medium hover:underline cursor-pointer"
                >
                  Terms and Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="text-[#111827] font-medium hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#111827] hover:bg-black active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {loading
                ? 'Please wait...'
                : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot'
                    ? 'Send Recovery Request'
                    : 'Login'}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfoMessage(null);
              }}
              className="w-full py-2 text-xs font-medium text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              Back to Login
            </button>
          )}
        </form>
      </motion.div>

      <LegalModals modal={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};

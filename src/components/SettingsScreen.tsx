import React, { useState } from 'react';
import {
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  MessageSquare,
  Mic,
  Shield,
  Sun,
  User as UserIcon,
  Volume2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ModelBackendInfo, UserProfile } from '../types';
import { BackendSelector } from './BackendSelector';
import { LegalModals, type LegalModalType } from './LegalModals';

interface SettingsScreenProps {
  user: UserProfile;
  backends: ModelBackendInfo[];
  onUserUpdated: (user: UserProfile) => void;
  onNavigateProfile: () => void;
  onLogout: () => void;
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi', 'Portuguese'];
const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  backends,
  onUserUpdated,
  onNavigateProfile,
  onLogout,
}) => {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const updatePref = async (patch: Partial<UserProfile>) => {
    try {
      const res = await api.updateProfile(patch);
      onUserUpdated(res.user);
    } catch {
      // Ignore
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    setSavingPw(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwStatus({ type: 'ok', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setPwStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
          Settings
        </h1>
        <p className="text-sm text-[#6B7280]">
          Account, language, notifications, chat & voice preferences, privacy, and security.
        </p>
      </div>

      {/* Account Settings Summary */}
      <section className="rounded-3xl bg-white p-5 flex flex-wrap items-center justify-between gap-4 neo-soft-shadow">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={user.avatarUrl}
            alt={user.username}
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-2xl object-cover border border-[#E5E7EB] shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827] truncate">
              {user.username}
            </p>
            <p className="text-xs text-[#6B7280] truncate">
              {user.email} {user.phone ? `· ${user.phone}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNavigateProfile}
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:border-[#111827] cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>Edit Account</span>
        </button>
      </section>

      {/* Appearance, Language, Notifications */}
      <section className="rounded-3xl bg-white divide-y divide-[#F1F1F4] neo-soft-shadow">
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sun className="w-5 h-5 text-[#111827]" />
            <div>
              <p className="text-sm font-medium text-[#111827]">Appearance</p>
              <p className="text-xs text-[#6B7280]">
                Minimalist pure white workspace mode
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-[#111827]">
            Pure White
          </span>
        </div>

        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-[#111827]" />
            <div>
              <p className="text-sm font-medium text-[#111827]">Language</p>
              <p className="text-xs text-[#6B7280]">
                Preferred response language
              </p>
            </div>
          </div>
          <select
            value={user.language}
            onChange={(e) => void updatePref({ language: e.target.value })}
            aria-label="Preferred language"
            className="px-3.5 py-2 min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111827] cursor-pointer focus:outline-none focus:border-[#111827]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#111827]" />
            <div>
              <p className="text-sm font-medium text-[#111827]">Notifications</p>
              <p className="text-xs text-[#6B7280]">
                Task alerts and workspace notifications
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={user.notificationsEnabled}
            onClick={() => void updatePref({ notificationsEnabled: !user.notificationsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer ${
              user.notificationsEnabled ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                user.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-[#111827]" />
            <div>
              <p className="text-sm font-medium text-[#111827]">Sound Effects</p>
              <p className="text-xs text-[#6B7280]">
                Subtle audio tones on send and completion
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={user.soundEffectsEnabled}
            onClick={() => void updatePref({ soundEffectsEnabled: !user.soundEffectsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer ${
              user.soundEffectsEnabled ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                user.soundEffectsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Chat & Voice Preferences */}
      <section className="rounded-3xl bg-white divide-y divide-[#F1F1F4] neo-soft-shadow">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#111827]" />
            <div>
              <h2 className="font-display text-base font-semibold text-[#111827]">
                Chat Preferences & AI Backends
              </h2>
              <p className="text-xs text-[#6B7280]">
                Choose default AI provider backends and real-time streaming behavior.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[#111827] mb-1.5">
                Chat & Plugins Backend
              </p>
              <BackendSelector
                backends={backends}
                capability="chat"
                value={user.preferredChatBackend}
                onChange={(val) => void updatePref({ preferredChatBackend: val })}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-[#111827] mb-1.5">
                Image Generation Backend
              </p>
              <BackendSelector
                backends={backends}
                capability="image"
                value={user.preferredImageBackend}
                onChange={(val) => void updatePref({ preferredImageBackend: val })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-sm font-medium text-[#111827]">
                Stream AI Responses
              </p>
              <p className="text-xs text-[#6B7280]">
                Display tokens live as NEO writes replies
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.streamResponses}
              onClick={() => void updatePref({ streamResponses: !user.streamResponses })}
              className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer ${
                user.streamResponses ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  user.streamResponses ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mic className="w-5 h-5 text-[#111827]" />
            <div>
              <h2 className="font-display text-base font-semibold text-[#111827]">
                Voice Preferences
              </h2>
              <p className="text-xs text-[#6B7280]">
                Configure spoken voice identity and automatic playback.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-medium text-[#111827]">
              Preferred Assistant Voice
            </span>
            <select
              value={user.preferredVoice}
              onChange={(e) => void updatePref({ preferredVoice: e.target.value })}
              aria-label="Preferred voice"
              className="px-3.5 py-2 min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111827] cursor-pointer focus:outline-none focus:border-[#111827]"
            >
              {VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#111827]">
                Auto-Speak Voice Replies
              </p>
              <p className="text-xs text-[#6B7280]">
                Automatically read aloud replies in Voice Assistant mode
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.autoSpeakVoice}
              onClick={() => void updatePref({ autoSpeakVoice: !user.autoSpeakVoice })}
              className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer ${
                user.autoSpeakVoice ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  user.autoSpeakVoice ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Privacy, Security & About NEO AI */}
      <section className="rounded-3xl bg-white divide-y divide-[#F1F1F4] neo-soft-shadow">
        <div className="p-5">
          <button
            type="button"
            onClick={() => {
              setShowPasswordForm((v) => !v);
              setPwStatus(null);
            }}
            className="w-full flex items-center justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-[#111827]" />
              <div className="text-left">
                <p className="text-sm font-medium text-[#111827]">
                  Security · Change Password
                </p>
                <p className="text-xs text-[#6B7280]">
                  Update your account password
                </p>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-[#6B7280] transition-transform ${
                showPasswordForm ? 'rotate-90' : ''
              }`}
            />
          </button>

          {pwStatus && (
            <p
              className={`mt-3 text-xs ${
                pwStatus.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {pwStatus.text}
            </p>
          )}

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-3 max-w-md">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
              />
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
              />
              <button
                type="submit"
                disabled={savingPw}
                className="px-5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer"
              >
                {savingPw ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLegalModal('privacy')}
          className="w-full p-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#6B7280]" />
            <span className="text-sm font-medium text-[#111827]">
              Privacy Policy
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
        </button>

        <button
          type="button"
          onClick={() => setLegalModal('terms')}
          className="w-full p-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#6B7280]" />
            <span className="text-sm font-medium text-[#111827]">
              Terms and Conditions
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
        </button>

        <button
          type="button"
          onClick={() => setLegalModal('help')}
          className="w-full p-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-[#6B7280]" />
            <span className="text-sm font-medium text-[#111827]">
              Help & Support
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
        </button>

        <button
          type="button"
          onClick={() => setLegalModal('about')}
          className="w-full p-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-[#6B7280]" />
            <span className="text-sm font-medium text-[#111827]">
              About NEO AI
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
        </button>

        <div className="p-5">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </section>

      <LegalModals modal={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};

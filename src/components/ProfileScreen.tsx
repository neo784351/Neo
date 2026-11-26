import React, { useRef, useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  Crown,
  Globe,
  KeyRound,
  LogOut,
  Phone,
  Settings,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ScreenId, UsageStats, UserProfile } from '../types';

interface ProfileScreenProps {
  user: UserProfile;
  usage: UsageStats;
  onUserUpdated: (user: UserProfile) => void;
  onNavigate: (screen: ScreenId) => void;
  onLogout: () => void;
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi', 'Portuguese'];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  usage,
  onUserUpdated,
  onNavigate,
  onLogout,
}) => {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const updatePref = async (patch: Partial<UserProfile>) => {
    try {
      const res = await api.updateProfile(patch);
      onUserUpdated(res.user);
    } catch {
      // Ignore
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateProfile({
        username: username.trim(),
        phone: phone.trim(),
      });
      onUserUpdated(res.user);
      setEditing(false);
      setMessage('Profile updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) return;
      try {
        const res = await api.updateProfile({ avatarUrl: dataUrl });
        onUserUpdated(res.user);
      } catch {
        // Ignore
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    setSavingPw(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwMessage({ type: 'ok', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setShowPwForm(false);
    } catch (err) {
      setPwMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setSavingPw(false);
    }
  };

  const stats = [
    { label: 'Conversations', value: usage.totalChats },
    { label: 'AI Responses', value: usage.totalResponses },
    { label: 'Images Created', value: usage.totalImages },
    { label: 'Projects', value: usage.totalProjects },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            Profile
          </h1>
          <p className="text-sm text-[#6B7280]">
            Manage your personal details, security, language, and account preferences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-[#111827] hover:border-[#111827] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Settings className="w-4 h-4" />
          <span>All Settings</span>
        </button>
      </div>

      {/* Identity Card */}
      <section className="rounded-3xl bg-white p-6 sm:p-8 neo-soft-shadow">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative shrink-0">
            <img
              src={user.avatarUrl}
              alt={user.username}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-3xl object-cover border border-[#E5E7EB]"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile picture"
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-[#111827] text-white flex items-center justify-center shadow-md cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 w-full">
            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 max-w-md mx-auto sm:mx-0">
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2 min-h-[42px] rounded-xl border border-[#111827] bg-white text-sm text-[#111827] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 010 2030"
                    className="w-full px-3.5 py-2 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-sm font-medium text-white bg-[#111827] hover:bg-black cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 min-h-[40px] rounded-xl text-sm font-medium border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111827] truncate">
                  {user.username}
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5 truncate">
                  {user.email}
                </p>
                {user.phone && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] mt-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{user.phone}</span>
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(user.username);
                      setPhone(user.phone || '');
                      setEditing(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-medium border border-[#E5E7EB] bg-white hover:border-[#111827] text-[#111827] cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPwForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-medium border border-[#E5E7EB] bg-white hover:border-[#111827] text-[#111827] cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Change Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('premium')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-[#111827] hover:bg-black text-white cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>NEO AI Premium</span>
                  </button>
                </div>
              </>
            )}

            {message && (
              <p className="mt-3 text-xs font-medium text-[#111827]">
                {message}
              </p>
            )}
          </div>
        </div>

        {showPwForm && (
          <form
            onSubmit={handlePasswordChange}
            className="mt-6 pt-6 border-t border-[#F1F1F4] space-y-3 max-w-md"
          >
            <h3 className="text-sm font-semibold text-[#111827]">
              Update Password
            </h3>
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
              {savingPw ? 'Updating...' : 'Save New Password'}
            </button>
          </form>
        )}

        {pwMessage && (
          <p
            className={`mt-3 text-xs font-medium ${
              pwMessage.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {pwMessage.text}
          </p>
        )}
      </section>

      {/* Usage Statistics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white p-4 neo-soft-shadow"
          >
            <p className="text-xs text-[#6B7280] mb-1">{s.label}</p>
            <p className="font-display text-2xl font-bold text-[#111827] tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      {/* Workspace Appearance, Language, Notifications & Account Info */}
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
                Preferred assistant language
              </p>
            </div>
          </div>
          <select
            value={user.language}
            onChange={(e) => void updatePref({ language: e.target.value })}
            aria-label="Language settings"
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
                Task alerts and activity updates
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

        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#6B7280]">Account Information</p>
            <p className="text-sm font-medium text-[#111827] mt-0.5">
              {user.plan === 'premium' ? 'Premium Plan' : 'Free Plan'} · Member since{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </section>
    </div>
  );
};

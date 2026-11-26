import React, { useEffect, useState } from 'react';
import { Check, Crown, Image as ImageIcon, Layers, Sparkles, Zap } from 'lucide-react';
import { api } from '../lib/api';
import type { UsageStats, UserProfile } from '../types';

interface PremiumScreenProps {
  user: UserProfile;
  usage: UsageStats;
}

const PREMIUM_FEATURES = [
  {
    title: 'Expanded AI Usage',
    description: 'Higher daily limits for multi-turn chat, project threads, and scheduled tasks.',
    icon: Sparkles,
  },
  {
    title: 'Priority Speed',
    description: 'Fast streaming responses, transcription, and voice synthesis.',
    icon: Zap,
  },
  {
    title: 'Higher Image Generation Limits',
    description: 'Generate multi-image batches across all 8 visual styles.',
    icon: ImageIcon,
  },
  {
    title: 'All Plugins & Projects',
    description: 'Full access to specialized plugins, library storage, and project workspaces.',
    icon: Layers,
  },
];

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ user, usage }) => {
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState(false);

  useEffect(() => {
    api
      .getAuthProviders()
      .then((res) => setBillingConfigured(res.billingConfigured))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 pb-8">
      {/* Header Banner */}
      <section className="rounded-3xl bg-white p-6 sm:p-8 neo-soft-shadow">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#111827] text-white flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] text-balance">
              NEO AI Premium
            </h1>
            <p className="text-sm sm:text-base text-[#6B7280] leading-relaxed">
              Compare your Free workspace plan with NEO AI Premium capabilities, usage limits, and studio image generation capacity.
            </p>
          </div>

          {/* Current Usage Snapshot */}
          <div className="rounded-2xl bg-[#FAFAFA] p-4 min-w-[220px] space-y-2">
            <p className="text-xs font-semibold text-[#111827]">
              Your Workspace Usage
            </p>
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>AI Responses</span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {usage.totalResponses}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Images Generated</span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {usage.totalImages}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Active Projects</span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {usage.totalProjects}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Free Plan vs Premium Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <section className="rounded-3xl bg-white p-6 space-y-5 neo-soft-shadow flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#111827]">
                Free Plan
              </h2>
              {user.plan !== 'premium' && (
                <span className="text-xs font-semibold text-[#111827]">
                  Current Plan
                </span>
              )}
            </div>
            <p className="text-sm text-[#6B7280]">
              Essential everyday AI assistant tools for chat, search, projects, and voice.
            </p>
            <ul className="space-y-2.5 text-sm text-[#111827]">
              {[
                'Real-time streaming AI chat',
                'Library & project workspace organization',
                'Voice transcription and speech playback',
                'Standard image generation limits (when configured)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#111827] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-[#F1F1F4]">
            <p className="text-xs text-[#6B7280]">
              Included with your NEO AI account
            </p>
          </div>
        </section>

        {/* Premium Plan */}
        <section className="rounded-3xl bg-white p-6 space-y-5 neo-soft-shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#111827]" />
                <h2 className="font-display text-xl font-bold text-[#111827]">
                  Premium Plan
                </h2>
              </div>
              {user.plan === 'premium' && (
                <span className="text-xs font-semibold text-emerald-600">Active</span>
              )}
            </div>
            <p className="text-sm text-[#6B7280]">
              Built for creators and power users requiring higher throughput and larger image batches.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {PREMIUM_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-2xl bg-[#FAFAFA] p-3.5 flex items-start gap-3"
                  >
                    <Icon className="w-4 h-4 text-[#111827] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {feat.title}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setUpgradeNotice(true)}
              className="w-full min-h-[46px] px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              <span>{billingConfigured ? 'Upgrade to Premium' : 'Upgrade Plan'}</span>
            </button>

            {upgradeNotice && (
              <div className="rounded-xl bg-[#FAFAFA] p-3 text-xs text-[#6B7280] leading-relaxed">
                {billingConfigured
                  ? 'Billing provider connected. Checkout can now be launched from your billing settings.'
                  : 'Subscription checkout is not configured on this server yet. All configured AI models, chat, projects, and tools remain available in your workspace.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

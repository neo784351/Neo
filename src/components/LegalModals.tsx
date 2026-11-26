import React from 'react';
import { X } from 'lucide-react';

export type LegalModalType = 'terms' | 'privacy' | 'help' | 'about' | null;

interface LegalModalsProps {
  modal: LegalModalType;
  onClose: () => void;
}

export const LegalModals: React.FC<LegalModalsProps> = ({ modal, onClose }) => {
  if (!modal) return null;

  const content: Record<Exclude<LegalModalType, null>, { title: string; body: string[] }> = {
    terms: {
      title: 'Terms and Conditions',
      body: [
        'By accessing NEO AI, you agree to use the assistant responsibly and in compliance with applicable laws.',
        'AI-generated text, code, and imagery should be reviewed before production or critical decision-making use.',
        'You retain ownership of prompts you author and outputs you create within your workspace.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      body: [
        'NEO AI stores your account profile, conversation threads, projects, files, and generated images privately in your workspace database.',
        'Your credentials are protected with cryptographic scrypt password hashing and server-verified HttpOnly session tokens.',
        'AI requests are proxied strictly through NEO AI backend API routes so provider keys never reach client bundles.',
      ],
    },
    help: {
      title: 'Help & Support',
      body: [
        'Ask AI & Projects: Start a conversation from Home or organize project files and chats inside Projects.',
        'Images & Library: Generate visuals across 8 styles and save favorite chats, images, and documents to your Library.',
        'Voice Assistant: Grant microphone permission in your browser to speak naturally with NEO and hear spoken replies.',
      ],
    },
    about: {
      title: 'About NEO AI',
      body: [
        'NEO AI — Your Personal AI Assistant (Ask • Create • Explore).',
        'Built with a clean multi-provider AI architecture supporting streaming chat, studio image generation, project workspaces, scheduled tasks, plugins, and voice interaction.',
      ],
    },
  };

  const active = content[modal];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 neo-soft-shadow-lg">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 id="legal-modal-title" className="font-display text-lg font-semibold text-[#111827]">
            {active.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-[#6B7280] leading-relaxed">
          {active.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

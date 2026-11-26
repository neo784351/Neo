import React, { useRef, useState } from 'react';
import {
  CalendarClock,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Puzzle,
  Send,
  X,
} from 'lucide-react';
import {
  GENERATED_ASSETS,
  type MediaAttachment,
  type ModelBackendInfo,
  type ScreenId,
  type UserProfile,
} from '../types';
import { BackendSelector } from './BackendSelector';

interface HomeDashboardProps {
  user: UserProfile;
  backends: ModelBackendInfo[];
  activeChatBackend: string;
  onChangeChatBackend: (key: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onQuickPrompt: (prompt: string, attachments?: MediaAttachment[]) => void;
}

const QUICK_ACTIONS: Array<{
  id: string;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  screen: ScreenId;
}> = [
  {
    id: 'ask-ai',
    title: 'Ask AI',
    description: 'Start a real-time streamed chat or attach images',
    icon: MessageSquare,
    screen: 'chat',
  },
  {
    id: 'create-image',
    title: 'Create Image',
    description: 'Turn text prompts into art across 8 visual styles',
    icon: ImageIcon,
    screen: 'image-gen',
  },
  {
    id: 'explore-library',
    title: 'Explore Library',
    description: 'Access saved chats, images, files, and favorites',
    icon: Layers,
    screen: 'library',
  },
  {
    id: 'create-project',
    title: 'Create Project',
    description: 'Organize conversations and documents by workspace',
    icon: FolderPlus,
    screen: 'projects',
  },
  {
    id: 'discover-plugins',
    title: 'Discover Plugins',
    description: 'Enable specialized AI skills and workflows',
    icon: Puzzle,
    screen: 'plugins',
  },
  {
    id: 'scheduled-tasks',
    title: 'Scheduled Tasks',
    description: 'Automate recurring prompts and daily briefings',
    icon: CalendarClock,
    screen: 'scheduled',
  },
];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  backends,
  activeChatBackend,
  onChangeChatBackend,
  onNavigate,
  onQuickPrompt,
}) => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [imgFailed, setImgFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.split(',')[1];
        if (base64) {
          setAttachments((prev) => [
            ...prev.slice(0, 2),
            { mimeType: file.type, data: base64, name: file.name },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && attachments.length === 0) return;
    onQuickPrompt(prompt.trim() || 'Analyze this image.', attachments);
    setPrompt('');
    setAttachments([]);
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8 pb-8">
      {/* Welcome Card */}
      <section className="rounded-3xl bg-white p-6 sm:p-8 neo-soft-shadow">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#6B7280]">
                Hello! 👋 {user.username}
              </p>
              <BackendSelector
                backends={backends}
                capability="chat"
                value={activeChatBackend}
                onChange={onChangeChatBackend}
                compact
              />
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] text-balance">
              How can I help you today?
            </h1>
            <p className="text-sm sm:text-base text-[#6B7280] max-w-2xl leading-relaxed">
              Ask questions, create visual concepts, organize projects, or speak naturally with your personal AI assistant.
            </p>

            <form onSubmit={handleSubmit} className="pt-2">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E5E7EB]"
                    >
                      <img
                        src={`data:${att.mimeType};base64,${att.data}`}
                        alt={att.name || 'Attachment'}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove attachment"
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-2 focus-within:border-[#111827] focus-within:bg-white transition-all">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('chat')}
                    aria-label="New chat"
                    className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask Neo anything..."
                    className="flex-1 bg-transparent px-2 py-2 text-sm sm:text-base text-[#111827] placeholder:text-[#6B7280] focus:outline-none min-w-0"
                  />
                </div>
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('voice')}
                    aria-label="Open Voice Assistant"
                    className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl font-semibold text-sm text-white bg-[#111827] hover:bg-black active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Send</span>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* 3D AI Robot Mascot */}
          <div className="relative aspect-square w-44 sm:w-52 lg:w-full mx-auto rounded-3xl overflow-hidden bg-white neo-soft-shadow">
            {!imgFailed ? (
              <img
                src={GENERATED_ASSETS.whiteMascot}
                alt="NEO 3D AI Robot Mascot"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <MessageSquare className="w-10 h-10 text-[#111827]" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6 Quick Action Cards */}
      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="font-display text-lg font-semibold text-[#111827] mb-4"
        >
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onNavigate(action.screen)}
                className="group text-left rounded-2xl bg-white p-5 hover:-translate-y-0.5 transition-all duration-150 neo-soft-shadow cursor-pointer flex items-start gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-base text-[#111827] mb-1">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

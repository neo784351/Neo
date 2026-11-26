import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CalendarClock,
  Crown,
  Folder,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Layers,
  LogOut,
  Menu,
  MessageSquarePlus,
  Puzzle,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { api, setAuthToken } from './lib/api';
import type {
  MediaAttachment,
  ModelBackendInfo,
  NotificationItem,
  ScreenId,
  UsageStats,
  UserProfile,
} from './types';
import { AuthScreen } from './components/AuthScreen';
import { ChatScreen } from './components/ChatScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { ImageGeneratorScreen } from './components/ImageGeneratorScreen';
import { LegalModals, type LegalModalType } from './components/LegalModals';
import { LibraryScreen } from './components/LibraryScreen';
import { NeoLogo } from './components/NeoLogo';
import { PluginsScreen } from './components/PluginsScreen';
import { PremiumScreen } from './components/PremiumScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ScheduledTasksScreen } from './components/ScheduledTasksScreen';
import { SearchScreen } from './components/SearchScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SplashScreen } from './components/SplashScreen';
import { VoiceAssistantScreen } from './components/VoiceAssistantScreen';

type AppStage = 'splash' | 'auth' | 'app';

export default function App() {
  const [stage, setStage] = useState<AppStage>('splash');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<UsageStats>({
    totalChats: 0,
    totalResponses: 0,
    totalImages: 0,
    totalWritings: 0,
    totalProjects: 0,
  });
  const [backends, setBackends] = useState<ModelBackendInfo[]>([]);
  const [screen, setScreen] = useState<ScreenId>('home');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<{
    text: string;
    attachments?: MediaAttachment[];
  } | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  // Always enforce pure white mode globally
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [backendRes, notifRes, usageRes] = await Promise.all([
        api.getBackends(),
        api.getNotifications(),
        api.getUsage(),
      ]);
      setBackends(backendRes.backends);
      setNotifications(notifRes.notifications);
      setUsage(usageRes.usage);
    } catch {
      // Ignore background refresh error
    }
  }, []);

  const refreshUsage = useCallback(() => {
    api
      .getUsage()
      .then((res) => setUsage(res.usage))
      .catch(() => {});
  }, []);

  const handleSplashComplete = useCallback(async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      setUsage(res.usage);
      setStage('app');
      setScreen('home');
      void loadWorkspaceData();
    } catch {
      setStage('auth');
    }
  }, [loadWorkspaceData]);

  const handleAuthenticated = (authedUser: UserProfile, initialUsage: UsageStats) => {
    setUser(authedUser);
    setUsage(initialUsage);
    setStage('app');
    setScreen('home');
    void loadWorkspaceData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    setAuthToken(null);
    setUser(null);
    setActiveConvId(null);
    setActiveProjectId(null);
    setMobileMenuOpen(false);
    setStage('auth');
  };

  const handleBackendPreference = async (
    field: 'preferredChatBackend' | 'preferredImageBackend' | 'preferredWriterBackend',
    value: string
  ) => {
    if (!user) return;
    setUser({ ...user, [field]: value });
    try {
      const res = await api.updateProfile({ [field]: value });
      setUser(res.user);
    } catch {
      // Ignore
    }
  };

  const handleNavigate = (target: ScreenId) => {
    if (target === 'chat') {
      setActiveProjectId(null);
    }
    setScreen(target);
    setMobileMenuOpen(false);
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setActiveProjectId(null);
    setPendingChatPrompt(null);
    setScreen('chat');
    setMobileMenuOpen(false);
  };

  const handleQuickPrompt = (prompt: string, attachments?: MediaAttachment[]) => {
    setActiveConvId(null);
    setActiveProjectId(null);
    setPendingChatPrompt({ text: prompt, attachments });
    setScreen('chat');
  };

  const handleOpenConversation = (conversationId: string) => {
    setActiveProjectId(null);
    setActiveConvId(conversationId);
    setScreen('chat');
  };

  const handleOpenProjectChat = (projectId: string, conversationId?: string | null) => {
    setActiveProjectId(projectId);
    setActiveConvId(conversationId ?? null);
    setScreen('chat');
  };

  const handleOpenNotifications = async () => {
    setShowNotifDrawer(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    } catch {
      // Ignore
    }
  };

  const handleHamburgerClick = () => {
    if (window.innerWidth >= 1024) {
      setSidebarExpanded((prev) => !prev);
    } else {
      setMobileMenuOpen((prev) => !prev);
    }
  };

  if (stage === 'splash') {
    return <SplashScreen onComplete={() => void handleSplashComplete()} />;
  }

  if (stage === 'auth' || !user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const unreadCount = notifications.filter((n) => n.read === 0).length;

  const sidebarItems: Array<{
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    isActive: boolean;
    onClick: () => void;
    tone?: 'danger';
  }> = [
    {
      id: 'new-chat',
      label: 'New Chat',
      icon: MessageSquarePlus,
      isActive: screen === 'chat' && activeConvId === null,
      onClick: handleNewChat,
    },
    {
      id: 'home',
      label: 'Dashboard',
      icon: Home,
      isActive: screen === 'home',
      onClick: () => handleNavigate('home'),
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      isActive: screen === 'search',
      onClick: () => handleNavigate('search'),
    },
    {
      id: 'images',
      label: 'Images',
      icon: ImageIcon,
      isActive: screen === 'image-gen',
      onClick: () => handleNavigate('image-gen'),
    },
    {
      id: 'library',
      label: 'Library',
      icon: Layers,
      isActive: screen === 'library',
      onClick: () => handleNavigate('library'),
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: Folder,
      isActive: screen === 'projects',
      onClick: () => handleNavigate('projects'),
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      icon: CalendarClock,
      isActive: screen === 'scheduled',
      onClick: () => handleNavigate('scheduled'),
    },
    {
      id: 'plugins',
      label: 'Plugins',
      icon: Puzzle,
      isActive: screen === 'plugins',
      onClick: () => handleNavigate('plugins'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isActive: screen === 'settings',
      onClick: () => handleNavigate('settings'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      isActive: false,
      onClick: () => {
        setMobileMenuOpen(false);
        setLegalModal('help');
      },
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: LogOut,
      isActive: false,
      onClick: () => void handleLogout(),
      tone: 'danger',
    },
  ];

  return (
    <div className="min-h-screen w-full flex bg-white text-[#111827]">
      {/* Desktop Expandable Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[#F1F1F4] bg-white py-4 justify-between sticky top-0 h-screen transition-all duration-200 ${
          sidebarExpanded ? 'w-64 px-3.5' : 'w-[76px] px-2.5'
        }`}
      >
        <div className="space-y-4 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className={`w-full flex items-center cursor-pointer px-2 py-1 ${
              sidebarExpanded ? 'justify-start' : 'justify-center'
            }`}
            aria-label="NEO AI Home"
          >
            <NeoLogo size="md" showWordmark={sidebarExpanded} />
          </button>

          <nav className="space-y-1" aria-label="Sidebar Navigation">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  title={sidebarExpanded ? undefined : item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[42px] rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    sidebarExpanded ? 'justify-start' : 'justify-center'
                  } ${
                    item.isActive
                      ? 'bg-[#111827] text-white'
                      : item.tone === 'danger'
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#111827]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {sidebarExpanded && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {sidebarExpanded && (
          <button
            type="button"
            onClick={() => handleNavigate('premium')}
            className="w-full mt-3 rounded-2xl bg-white p-3.5 text-left neo-soft-shadow hover:-translate-y-0.5 transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] mb-1">
              <Crown className="w-4 h-4" />
              <span>NEO AI Premium</span>
            </div>
            <p className="text-xs text-[#6B7280]">
              View plans & usage limits
            </p>
          </button>
        )}
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-[#F1F1F4] bg-white/95 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleHamburgerClick}
              aria-label="Toggle menu"
              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#111827] hover:bg-[#F5F5F5] transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="flex items-center gap-2.5 cursor-pointer shrink-0"
              aria-label="Go to NEO AI Dashboard"
            >
              <NeoLogo size="sm" showWordmark />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('search')}
              aria-label="Search"
              className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                screen === 'search'
                  ? 'bg-[#111827] text-white'
                  : 'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#111827]'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => void handleOpenNotifications()}
              aria-label="Notifications"
              className="relative min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#111827] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#111827]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('premium')}
              aria-label="NEO AI Premium"
              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center bg-[#111827] text-white hover:bg-black transition-colors cursor-pointer"
            >
              <Crown className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('profile')}
              aria-label="Open Profile"
              className="w-9 h-9 rounded-xl overflow-hidden border border-[#E5E7EB] hover:border-[#111827] transition-colors cursor-pointer shrink-0 ml-0.5"
            >
              <img
                src={user.avatarUrl}
                alt={user.username}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </header>

        {/* Active Screen Viewport */}
        <main className="flex-1 px-4 sm:px-6 pt-6 pb-8 overflow-x-hidden bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {screen === 'home' && (
                <HomeDashboard
                  user={user}
                  backends={backends}
                  activeChatBackend={user.preferredChatBackend}
                  onChangeChatBackend={(val) =>
                    void handleBackendPreference('preferredChatBackend', val)
                  }
                  onNavigate={handleNavigate}
                  onQuickPrompt={handleQuickPrompt}
                />
              )}

              {screen === 'chat' && (
                <ChatScreen
                  user={user}
                  backends={backends}
                  activeChatBackend={user.preferredChatBackend}
                  onChangeChatBackend={(val) =>
                    void handleBackendPreference('preferredChatBackend', val)
                  }
                  conversationId={activeConvId}
                  onSelectConversation={setActiveConvId}
                  initialPrompt={pendingChatPrompt}
                  onConsumeInitialPrompt={() => setPendingChatPrompt(null)}
                  onUsageChanged={refreshUsage}
                  projectId={activeProjectId}
                />
              )}

              {screen === 'search' && (
                <SearchScreen
                  onOpenConversation={handleOpenConversation}
                  onOpenProjects={() => handleNavigate('projects')}
                  onOpenImages={() => handleNavigate('image-gen')}
                  onOpenLibrary={() => handleNavigate('library')}
                />
              )}

              {screen === 'image-gen' && (
                <ImageGeneratorScreen
                  backends={backends}
                  activeImageBackend={user.preferredImageBackend}
                  onChangeImageBackend={(val) =>
                    void handleBackendPreference('preferredImageBackend', val)
                  }
                  onUsageChanged={refreshUsage}
                />
              )}

              {screen === 'library' && (
                <LibraryScreen onOpenConversation={handleOpenConversation} />
              )}

              {screen === 'projects' && (
                <ProjectsScreen
                  onOpenProjectChat={handleOpenProjectChat}
                  onUsageChanged={refreshUsage}
                />
              )}

              {screen === 'scheduled' && (
                <ScheduledTasksScreen onUsageChanged={refreshUsage} />
              )}

              {screen === 'plugins' && (
                <PluginsScreen
                  activeChatBackend={user.preferredChatBackend}
                  onUsageChanged={refreshUsage}
                />
              )}

              {screen === 'voice' && (
                <VoiceAssistantScreen
                  user={user}
                  onUserUpdated={setUser}
                  onUsageChanged={refreshUsage}
                />
              )}

              {screen === 'profile' && (
                <ProfileScreen
                  user={user}
                  usage={usage}
                  onUserUpdated={setUser}
                  onNavigate={handleNavigate}
                  onLogout={() => void handleLogout()}
                />
              )}

              {screen === 'settings' && (
                <SettingsScreen
                  user={user}
                  backends={backends}
                  onUserUpdated={setUser}
                  onNavigateProfile={() => handleNavigate('profile')}
                  onLogout={() => void handleLogout()}
                />
              )}

              {screen === 'premium' && <PremiumScreen user={user} usage={usage} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-black/25 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          <div className="w-72 max-w-[85vw] h-full bg-white p-4 flex flex-col justify-between neo-soft-shadow-lg">
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between px-1">
                <NeoLogo size="md" showWordmark />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        item.isActive
                          ? 'bg-[#111827] text-white'
                          : item.tone === 'danger'
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#111827]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('premium')}
              className="w-full mt-3 rounded-2xl bg-white p-3.5 text-left neo-soft-shadow cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] mb-1">
                <Crown className="w-4 h-4" />
                <span>NEO AI Premium</span>
              </div>
              <p className="text-xs text-[#6B7280]">
                View plans & limits
              </p>
            </button>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotifDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
        >
          <div className="w-full max-w-sm h-full bg-white p-5 flex flex-col neo-soft-shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F1F4]">
              <h2 className="font-display font-semibold text-base text-[#111827]">
                Notifications
              </h2>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                aria-label="Close notifications"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-[#6B7280] text-center py-8">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl bg-[#FAFAFA] p-3.5"
                  >
                    <p className="text-sm font-semibold text-[#111827]">
                      {n.title}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      {n.body}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-2 tabular-nums">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <LegalModals modal={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}

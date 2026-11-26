import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Edit2,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { playUiTone } from '../lib/sound';
import type {
  ChatMessage,
  ConversationItem,
  MediaAttachment,
  ModelBackendInfo,
  UserProfile,
} from '../types';
import { BackendSelector } from './BackendSelector';
import { MarkdownRenderer } from './MarkdownRenderer';
import { NeoLogo } from './NeoLogo';

interface ChatScreenProps {
  user: UserProfile;
  backends: ModelBackendInfo[];
  activeChatBackend: string;
  onChangeChatBackend: (key: string) => void;
  conversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  initialPrompt?: { text: string; attachments?: MediaAttachment[] } | null;
  onConsumeInitialPrompt: () => void;
  onUsageChanged: () => void;
  projectId?: string | null;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  user,
  backends,
  activeChatBackend,
  onChangeChatBackend,
  conversationId,
  onSelectConversation,
  initialPrompt,
  onConsumeInitialPrompt,
  onUsageChanged,
  projectId,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvMeta, setActiveConvMeta] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const refreshConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    void refreshConversations();
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setActiveConvMeta(null);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    api
      .getConversation(conversationId)
      .then((res) => {
        setActiveConvMeta(res.conversation);
        setMessages(res.messages);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load conversation.');
      })
      .finally(() => setLoadingMessages(false));
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const sendMessageText = async (
    textToSend: string,
    atts: MediaAttachment[] = [],
    targetConvId?: string
  ) => {
    if (streaming) return;
    const clean = textToSend.trim();
    if (!clean && atts.length === 0) return;

    setError(null);
    setStreaming(true);
    setStreamingText('');
    playUiTone('send', user.soundEffectsEnabled);

    let convId = targetConvId ?? conversationId;
    try {
      if (!convId) {
        const created = await api.createConversation(
          clean.slice(0, 48) || 'New Conversation',
          'ai-chat',
          projectId || undefined
        );
        convId = created.conversation.id;
        setActiveConvMeta(created.conversation);
        onSelectConversation(convId);
      }

      const tempUserMsg: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId: convId,
        role: 'user',
        content: clean || 'Analyze the attached image.',
        attachments: atts,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      let fullReply = '';
      await api.streamChat(
        convId,
        {
          message: clean || 'Analyze the attached image.',
          attachments: atts,
          backendKey: activeChatBackend,
        },
        (evt) => {
          if (evt.type === 'text' && evt.text) {
            fullReply += evt.text;
            setStreamingText(fullReply);
          } else if (evt.type === 'error') {
            setError(evt.error || 'AI response failed.');
          } else if (evt.type === 'done') {
            playUiTone('receive', user.soundEffectsEnabled);
          }
        }
      );

      const updated = await api.getConversation(convId);
      setActiveConvMeta(updated.conversation);
      setMessages(updated.messages);
      setStreamingText('');
      await refreshConversations();
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  useEffect(() => {
    if (initialPrompt && !streaming) {
      const p = initialPrompt;
      onConsumeInitialPrompt();
      void sendMessageText(p.text, p.attachments || [], undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = input;
    const currentAtts = attachments;
    setInput('');
    setAttachments([]);
    void sendMessageText(currentInput, currentAtts);
  };

  const handleNewChat = () => {
    setError(null);
    onSelectConversation(null);
    setActiveConvMeta(null);
    setMessages([]);
    setStreamingText('');
  };

  const handleRenameSubmit = async () => {
    if (!conversationId || !renameText.trim()) return;
    try {
      const res = await api.updateConversation(conversationId, { title: renameText.trim() });
      setActiveConvMeta(res.conversation);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? res.conversation : c))
      );
      setRenaming(false);
    } catch {
      // Ignore
    }
  };

  const handleDeleteConv = async () => {
    if (!conversationId) return;
    try {
      await api.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      handleNewChat();
    } catch {
      // Ignore
    }
  };

  const handleToggleConvFlag = async (field: 'isFavorite' | 'isSaved') => {
    if (!conversationId || !activeConvMeta) return;
    const nextVal =
      field === 'isFavorite'
        ? !Boolean(activeConvMeta.is_favorite)
        : !Boolean(activeConvMeta.is_saved);
    try {
      const res = await api.updateConversation(conversationId, { [field]: nextVal });
      setActiveConvMeta(res.conversation);
    } catch {
      // Ignore
    }
  };

  const handleRegenerate = async () => {
    if (!conversationId || streaming) return;
    setError(null);
    setStreaming(true);
    setStreamingText('');
    try {
      let fullReply = '';
      await api.regenerateChat(conversationId, activeChatBackend, (evt) => {
        if (evt.type === 'text' && evt.text) {
          fullReply += evt.text;
          setStreamingText(fullReply);
        } else if (evt.type === 'error') {
          setError(evt.error || 'Regeneration failed.');
        }
      });
      const updated = await api.getConversation(conversationId);
      setMessages(updated.messages);
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed.');
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  const handleShareConversation = async (textOverride?: string) => {
    const shareText =
      textOverride ||
      messages.map((m) => `${m.role === 'user' ? 'You' : 'NEO AI'}: ${m.content}`).join('\n\n');
    if (!shareText) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: activeConvMeta?.title || 'NEO AI Chat', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setSharedId('conv');
      setTimeout(() => setSharedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  const handleSpeak = async (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      audioPlayerRef.current?.pause();
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
      return;
    }

    setSpeakingMsgId(msg.id);
    try {
      const res = await api.generateSpeech(msg.content, user.preferredVoice);
      const audio = new Audio(res.audioDataUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setSpeakingMsgId(null);
      audio.onerror = () => setSpeakingMsgId(null);
      await audio.play();
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(msg.content.slice(0, 1500));
        utter.onend = () => setSpeakingMsgId(null);
        window.speechSynthesis.speak(utter);
      } else {
        setSpeakingMsgId(null);
      }
    }
  };

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

  const toggleVoiceInput = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result || '').split(',')[1];
          if (!base64) return;
          try {
            const res = await api.transcribeAudio(base64, blob.type || 'audio/webm');
            if (res.text) setInput((prev) => (prev ? `${prev} ${res.text}` : res.text));
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Voice transcription failed.');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access was denied or unavailable.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full h-[calc(100vh-110px)] flex flex-col rounded-3xl bg-white neo-soft-shadow overflow-hidden">
      {/* Chat Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-[#F1F1F4] bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-medium bg-white border border-[#E5E7EB] text-[#111827] hover:border-[#111827] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#111827]" />
            <span>New Chat</span>
          </button>

          {conversations.length > 0 && (
            <select
              value={conversationId || ''}
              onChange={(e) => onSelectConversation(e.target.value || null)}
              aria-label="Conversation history"
              className="px-3 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white text-[#111827] max-w-[160px] sm:max-w-[230px] truncate cursor-pointer focus:outline-none focus:border-[#111827]"
            >
              <option value="">New Conversation</option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          {conversationId && activeConvMeta && (
            <div className="hidden md:flex items-center gap-1">
              {renaming ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameSubmit();
                      if (e.key === 'Escape') setRenaming(false);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-[#111827] bg-white text-xs text-[#111827]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameSubmit()}
                    aria-label="Save rename"
                    className="p-1.5 text-emerald-600 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameText(activeConvMeta.title);
                      setRenaming(true);
                    }}
                    title="Rename conversation"
                    className="p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleConvFlag('isSaved')}
                    title="Save to Library"
                    className={`p-2 rounded-lg hover:bg-[#F5F5F5] cursor-pointer ${
                      activeConvMeta.is_saved ? 'text-[#111827]' : 'text-[#6B7280]'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${activeConvMeta.is_saved ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleConvFlag('isFavorite')}
                    title="Favorite conversation"
                    className={`p-2 rounded-lg hover:bg-[#F5F5F5] cursor-pointer ${
                      activeConvMeta.is_favorite ? 'text-[#111827]' : 'text-[#6B7280]'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${activeConvMeta.is_favorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareConversation()}
                    title="Share conversation"
                    className="p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                  >
                    {sharedId === 'conv' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConv()}
                    title="Delete conversation"
                    className="p-2 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-[#F5F5F5] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <BackendSelector
          backends={backends}
          capability="chat"
          value={activeChatBackend}
          onChange={onChangeChatBackend}
          compact
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 bg-white">
        {loadingMessages ? (
          <div className="space-y-4">
            <div className="h-12 w-2/3 rounded-2xl bg-[#F5F5F5] animate-pulse ml-auto" />
            <div className="h-28 w-4/5 rounded-2xl bg-[#F5F5F5] animate-pulse" />
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
            <NeoLogo size="lg" showWordmark={false} className="mb-4" />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111827] mb-2">
              Ask NEO anything
            </h2>
            <p className="text-sm text-[#6B7280] mb-6">
              Real-time streaming chat with Markdown, code blocks, image analysis, and voice input.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {[
                'Plan a focused 5-day study schedule',
                'Write a clean TypeScript API client',
                'Summarize pros and cons of electric cars',
                'Explain neural networks simply',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => void sendMessageText(sample)}
                  className="text-left p-3.5 rounded-xl bg-white neo-soft-shadow hover:-translate-y-0.5 text-xs text-[#111827] transition-all cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLastAssistant = !isUser && idx === messages.length - 1;
              const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start items-start'}`}
                >
                  {!isUser && (
                    <div className="shrink-0 mt-1">
                      <NeoLogo size="sm" showWordmark={false} />
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[85%] sm:max-w-[76%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-[#F5F5F5] text-[#111827]'
                          : 'bg-white neo-soft-shadow text-[#111827]'
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          {msg.attachments.map((att, i) => (
                            <img
                              key={i}
                              src={`data:${att.mimeType};base64,${att.data}`}
                              alt={att.name || 'Attachment'}
                              className="max-h-48 rounded-xl border border-[#E5E7EB] object-cover"
                            />
                          ))}
                        </div>
                      )}

                      {isUser ? (
                        <p className="text-sm sm:text-[15px] whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 px-1 text-[11px] text-[#6B7280]">
                      <span className="tabular-nums">{timeStr}</span>

                      {!isUser && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F5F5F5] hover:text-[#111827] transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          {isLastAssistant && !streaming && (
                            <button
                              type="button"
                              onClick={() => void handleRegenerate()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F5F5F5] hover:text-[#111827] transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Regenerate</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleSpeak(msg)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F5F5F5] hover:text-[#111827] transition-colors cursor-pointer"
                          >
                            {speakingMsgId === msg.id ? (
                              <VolumeX className="w-3.5 h-3.5 text-[#111827]" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                            <span>{speakingMsgId === msg.id ? 'Stop' : 'Speak'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {streaming && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">
                  <NeoLogo size="sm" showWordmark={false} />
                </div>
                <div className="max-w-[85%] sm:max-w-[76%] rounded-2xl px-4 py-3 bg-white neo-soft-shadow text-[#111827]">
                  {streamingText ? (
                    <MarkdownRenderer content={streamingText} />
                  ) : (
                    <div className="flex items-center gap-1.5 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#111827] animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-[#6B7280] animate-bounce [animation-delay:120ms]" />
                      <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:240ms]" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm"
          >
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 sm:p-4 border-t border-[#F1F1F4] bg-white"
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#E5E7EB]"
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
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] px-2 py-1.5 focus-within:border-[#111827] focus-within:bg-white transition-all">
          <button
            type="button"
            onClick={handleNewChat}
            title="New chat"
            aria-label="New chat"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>

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
            title="Attach image"
            aria-label="Attach image"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? 'Listening... tap mic to stop' : 'Ask Neo anything...'}
            className="flex-1 bg-transparent py-2 px-1 text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none min-w-0"
          />

          <button
            type="button"
            onClick={() => void toggleVoiceInput()}
            aria-label={recording ? 'Stop voice recording' : 'Start voice input'}
            className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              recording
                ? 'bg-rose-50 text-rose-600'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
            }`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={streaming || (!input.trim() && attachments.length === 0)}
            aria-label="Send message"
            className="min-w-[42px] min-h-[42px] px-3.5 rounded-xl text-white bg-[#111827] hover:bg-black disabled:opacity-40 flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

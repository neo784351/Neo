import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Download,
  FileText,
  FolderOpen,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ConversationItem, GeneratedImageItem, LibraryFileItem } from '../types';

interface LibraryScreenProps {
  onOpenConversation: (conversationId: string) => void;
}

type LibraryCategory = 'all' | 'conversations' | 'images' | 'files' | 'favorites';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onOpenConversation }) => {
  const [category, setCategory] = useState<LibraryCategory>('all');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [images, setImages] = useState<GeneratedImageItem[]>([]);
  const [files, setFiles] = useState<LibraryFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLibrary();
      setConversations(res.conversations);
      setImages(res.images);
      setFiles(res.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Files must be 4 MB or smaller.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const isDoc =
          file.type.includes('pdf') ||
          file.type.includes('text') ||
          file.type.includes('document') ||
          /\.(txt|md|pdf|doc|docx|csv|json)$/i.test(file.name);
        const res = await api.uploadFile({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          category: isDoc ? 'document' : 'file',
          contentDataUrl: dataUrl,
        });
        setFiles((prev) => [res.file, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleConversationFavorite = async (conv: ConversationItem) => {
    const next = !Boolean(conv.is_favorite);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, is_favorite: next ? 1 : 0 } : c))
    );
    try {
      await api.updateConversation(conv.id, { isFavorite: next });
    } catch {
      // Ignore
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleToggleImageFavorite = async (img: GeneratedImageItem) => {
    const next = !Boolean(img.isFavorite);
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, isFavorite: next } : i)));
    try {
      await api.updateImage(img.id, { isFavorite: next });
    } catch {
      // Ignore
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      await api.deleteImage(id);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleToggleFileFavorite = async (file: LibraryFileItem) => {
    const next = !Boolean(file.is_favorite);
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, is_favorite: next ? 1 : 0 } : f))
    );
    try {
      await api.updateFile(file.id, { isFavorite: next });
    } catch {
      // Ignore
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      await api.deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // Ignore
    }
  };

  const triggerDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const q = query.trim().toLowerCase();

  const filteredConversations = useMemo(
    () =>
      conversations.filter((c) => {
        if (category === 'favorites' && !c.is_favorite) return false;
        if (category !== 'all' && category !== 'conversations' && category !== 'favorites') {
          return false;
        }
        return !q || c.title.toLowerCase().includes(q);
      }),
    [conversations, category, q]
  );

  const filteredImages = useMemo(
    () =>
      images.filter((img) => {
        if (category === 'favorites' && !img.isFavorite) return false;
        if (category !== 'all' && category !== 'images' && category !== 'favorites') {
          return false;
        }
        return !q || img.prompt.toLowerCase().includes(q) || img.style.toLowerCase().includes(q);
      }),
    [images, category, q]
  );

  const filteredFiles = useMemo(
    () =>
      files.filter((f) => {
        if (category === 'favorites' && !f.is_favorite) return false;
        if (category !== 'all' && category !== 'files' && category !== 'favorites') {
          return false;
        }
        return !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }),
    [files, category, q]
  );

  const tabs: Array<{ id: LibraryCategory; label: string }> = [
    { id: 'all', label: 'All Items' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'images', label: 'Images' },
    { id: 'files', label: 'Files & Docs' },
    { id: 'favorites', label: 'Favorites' },
  ];

  const isEmpty =
    filteredConversations.length === 0 && filteredImages.length === 0 && filteredFiles.length === 0;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            Library
          </h1>
          <p className="text-sm text-[#6B7280]">
            Saved conversations, generated images, uploaded files, documents, and favorites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadFile}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCategory(t.id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                category === t.id
                  ? 'bg-[#111827] text-white'
                  : 'bg-white text-[#6B7280] neo-soft-shadow hover:text-[#111827]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter library..."
            className="w-full pl-10 pr-4 py-2 min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none focus:border-[#111827]"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-3xl bg-white p-12 text-center neo-soft-shadow">
          <FolderOpen className="w-10 h-10 text-[#111827] mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-[#111827] mb-1">
            Nothing here yet
          </h2>
          <p className="text-sm text-[#6B7280] max-w-md mx-auto">
            Conversations you start, images you generate, and documents you upload will appear in your Library.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Saved & Recent Conversations */}
          {filteredConversations.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-semibold text-[#111827] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#111827]" />
                <span>Conversations</span>
                <span className="text-xs font-normal text-[#6B7280] tabular-nums">
                  ({filteredConversations.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredConversations.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white p-4 flex flex-col justify-between gap-3 neo-soft-shadow"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenConversation(c.id)}
                      className="text-left group cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display font-semibold text-sm text-[#111827] group-hover:underline line-clamp-2">
                          {c.title}
                        </p>
                        {Boolean(c.is_saved) && (
                          <Bookmark className="w-3.5 h-3.5 text-[#111827] shrink-0 fill-current" />
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-1.5 tabular-nums">
                        Updated {new Date(c.updated_at).toLocaleDateString()}
                      </p>
                    </button>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F1F4]">
                      <button
                        type="button"
                        onClick={() => onOpenConversation(c.id)}
                        className="text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                      >
                        Open Chat
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleToggleConversationFavorite(c)}
                          aria-label="Toggle favorite conversation"
                          className={`p-1.5 rounded-lg hover:bg-[#F5F5F5] cursor-pointer ${
                            c.is_favorite ? 'text-[#111827]' : 'text-[#6B7280]'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${c.is_favorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteConversation(c.id)}
                          aria-label="Delete conversation"
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-[#F5F5F5] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Generated Images */}
          {filteredImages.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-semibold text-[#111827] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#111827]" />
                <span>Generated Images</span>
                <span className="text-xs font-normal text-[#6B7280] tabular-nums">
                  ({filteredImages.length})
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    className="rounded-2xl bg-white overflow-hidden neo-soft-shadow"
                  >
                    <div className="aspect-square bg-[#FAFAFA]">
                      <img
                        src={img.imageDataUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-medium text-[#111827] truncate">
                        {img.prompt}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-[#6B7280] truncate">
                          {img.style}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleImageFavorite(img)}
                            aria-label="Favorite image"
                            className={`p-1 rounded-lg cursor-pointer ${
                              img.isFavorite ? 'text-rose-500' : 'text-[#6B7280]'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${img.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerDownload(img.imageDataUrl, `neo-ai-${img.id.slice(0, 8)}.png`)
                            }
                            aria-label="Download image"
                            className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteImage(img.id)}
                            aria-label="Delete image"
                            className="p-1 rounded-lg text-[#6B7280] hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Uploaded Files & Documents */}
          {filteredFiles.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-semibold text-[#111827] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#111827]" />
                <span>Files & Documents</span>
                <span className="text-xs font-normal text-[#6B7280] tabular-nums">
                  ({filteredFiles.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-2xl bg-white p-4 flex items-center justify-between gap-3 neo-soft-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#111827]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-[#6B7280] tabular-nums">
                          {formatBytes(file.size_bytes)} · {file.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleFileFavorite(file)}
                        aria-label="Favorite file"
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          file.is_favorite ? 'text-[#111827]' : 'text-[#6B7280]'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${file.is_favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerDownload(file.content_data_url, file.name)}
                        aria-label="Download file"
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteFile(file.id)}
                        aria-label="Delete file"
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

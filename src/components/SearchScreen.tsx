import React, { useEffect, useState } from 'react';
import {
  FileText,
  Folder,
  Image as ImageIcon,
  MessageSquare,
  Search as SearchIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  ConversationItem,
  GeneratedImageItem,
  LibraryFileItem,
  ProjectItem,
} from '../types';

interface SearchScreenProps {
  onOpenConversation: (conversationId: string) => void;
  onOpenProjects: () => void;
  onOpenImages: () => void;
  onOpenLibrary: () => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onOpenConversation,
  onOpenProjects,
  onOpenImages,
  onOpenLibrary,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    conversations: ConversationItem[];
    images: GeneratedImageItem[];
    files: LibraryFileItem[];
    projects: ProjectItem[];
  }>({
    conversations: [],
    images: [],
    files: [],
    projects: [],
  });

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ conversations: [], images: [], files: [], projects: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      api
        .globalSearch(q)
        .then((res) => setResults(res))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const totalResults =
    results.conversations.length +
    results.images.length +
    results.files.length +
    results.projects.length;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
          Search Workspace
        </h1>
        <p className="text-sm text-[#6B7280]">
          Find conversations, generated artwork, uploaded documents, and projects instantly.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="w-5 h-5 text-[#6B7280] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats, messages, images, files, or projects..."
          className="w-full pl-12 pr-4 py-3.5 min-h-[52px] rounded-2xl border border-[#E5E7EB] bg-white text-sm sm:text-base text-[#111827] placeholder:text-[#6B7280] focus:outline-none focus:border-[#111827] neo-soft-shadow"
        />
      </div>

      {!query.trim() ? (
        <div className="rounded-3xl bg-white p-10 text-center neo-soft-shadow">
          <SearchIcon className="w-9 h-9 text-[#111827] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#111827]">
            Type a keyword to search across NEO AI
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            Matches conversation titles, message text, image prompts, project descriptions, and files.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-2xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      ) : totalResults === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center neo-soft-shadow">
          <p className="text-sm font-semibold text-[#111827]">
            No results found for “{query.trim()}”
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            Try a shorter keyword or different phrase.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {results.conversations.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Conversations ({results.conversations.length})
              </h2>
              <div className="space-y-2">
                {results.conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenConversation(c.id)}
                    className="w-full text-left rounded-2xl bg-white p-4 hover:-translate-y-0.5 transition-transform flex items-center justify-between gap-3 cursor-pointer neo-soft-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className="w-4 h-4 text-[#111827] shrink-0" />
                      <span className="text-sm font-medium text-[#111827] truncate">
                        {c.title}
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280] tabular-nums shrink-0">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.projects.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Projects ({results.projects.length})
              </h2>
              <div className="space-y-2">
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={onOpenProjects}
                    className="w-full text-left rounded-2xl bg-white p-4 hover:-translate-y-0.5 transition-transform flex items-center justify-between gap-3 cursor-pointer neo-soft-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder className="w-4 h-4 text-[#111827] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="text-xs text-[#6B7280] truncate">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.images.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Images ({results.images.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {results.images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={onOpenImages}
                    className="text-left rounded-2xl bg-white overflow-hidden hover:-translate-y-0.5 transition-transform cursor-pointer neo-soft-shadow"
                  >
                    <div className="aspect-square bg-[#FAFAFA]">
                      <img
                        src={img.imageDataUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2.5 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#111827] shrink-0" />
                      <span className="text-xs text-[#111827] truncate">
                        {img.prompt}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.files.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Files & Documents ({results.files.length})
              </h2>
              <div className="space-y-2">
                {results.files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={onOpenLibrary}
                    className="w-full text-left rounded-2xl bg-white p-4 hover:-translate-y-0.5 transition-transform flex items-center justify-between gap-3 cursor-pointer neo-soft-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[#111827] shrink-0" />
                      <span className="text-sm font-medium text-[#111827] truncate">
                        {f.name}
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280]">{f.category}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

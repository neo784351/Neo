import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Download,
  Heart,
  Image as ImageIcon,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { GeneratedImageItem, ModelBackendInfo } from '../types';
import { BackendSelector } from './BackendSelector';

interface ImageGeneratorScreenProps {
  backends: ModelBackendInfo[];
  activeImageBackend: string;
  onChangeImageBackend: (key: string) => void;
  onUsageChanged: () => void;
}

const STYLES = [
  'Realistic',
  '3D',
  'Anime',
  'Cartoon',
  'Cinematic',
  'Digital Art',
  'Fantasy',
  'Minecraft-inspired',
];

const ASPECT_RATIOS: Array<'1:1' | '4:3' | '3:4' | '16:9' | '9:16'> = [
  '1:1',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
];

export const ImageGeneratorScreen: React.FC<ImageGeneratorScreenProps> = ({
  backends,
  activeImageBackend,
  onChangeImageBackend,
  onUsageChanged,
}) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Realistic');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9' | '9:16'>('1:1');
  const [outputCount, setOutputCount] = useState<1 | 2 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestBatch, setLatestBatch] = useState<GeneratedImageItem[]>([]);
  const [history, setHistory] = useState<GeneratedImageItem[]>([]);
  const [sharedId, setSharedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getImageHistory()
      .then((res) => {
        setHistory(res.images);
        if (res.images.length > 0) setLatestBatch([res.images[0]]);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (overridePrompt?: string) => {
    const p = (overridePrompt ?? prompt).trim();
    if (!p || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.generateImage({
        prompt: p,
        style,
        aspectRatio,
        backendKey: activeImageBackend,
        count: outputCount,
      });
      const created = res.images && res.images.length > 0 ? res.images : [res.image];
      setLatestBatch(created);
      setHistory((prev) => [...created, ...prev]);
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (img: GeneratedImageItem) => {
    const link = document.createElement('a');
    link.href = img.imageDataUrl;
    link.download = `neo-ai-${img.id.slice(0, 8)}.png`;
    link.click();
  };

  const handleShare = async (img: GeneratedImageItem) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NEO AI Image', text: img.prompt });
      } else {
        await navigator.clipboard.writeText(img.prompt);
      }
      setSharedId(img.id);
      setTimeout(() => setSharedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  const handleToggleFlag = async (img: GeneratedImageItem, field: 'isFavorite' | 'savedToLibrary') => {
    const next = field === 'isFavorite' ? !img.isFavorite : !img.savedToLibrary;
    const updateItem = (item: GeneratedImageItem) =>
      item.id === img.id ? { ...item, [field]: next } : item;
    setHistory((prev) => prev.map(updateItem));
    setLatestBatch((prev) => prev.map(updateItem));
    try {
      await api.updateImage(img.id, { [field]: next });
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteImage(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setLatestBatch((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            Create Stunning Images with NEO
          </h1>
          <p className="text-sm text-[#6B7280]">
            Describe your vision, choose from 8 styles, generate multiple outputs, and save favorites to your Library.
          </p>
        </div>
        <BackendSelector
          backends={backends}
          capability="image"
          value={activeImageBackend}
          onChange={onChangeImageBackend}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-5 rounded-3xl bg-white p-5 sm:p-6 space-y-5 neo-soft-shadow">
          <div>
            <label className="block text-xs font-medium text-[#111827] mb-2">
              Prompt
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A sunlit botanical glasshouse in Kyoto with floating koi lanterns..."
              className="w-full rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5 text-sm text-[#111827] placeholder:text-[#6B7280]/70 focus:outline-none focus:border-[#111827] focus:bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-2">
              Style Options
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    style === s
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F5F5F5]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#111827] mb-2">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                className="w-full px-3 py-2 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111827] cursor-pointer focus:outline-none focus:border-[#111827]"
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111827] mb-2">
                Outputs
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {([1, 2, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setOutputCount(cnt)}
                    className={`py-2 min-h-[42px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer tabular-nums ${
                      outputCount === cnt
                        ? 'bg-[#111827] text-white border-[#111827]'
                        : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            disabled={loading || !prompt.trim()}
            onClick={() => void handleGenerate()}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#111827] hover:bg-black disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Generating...' : `Generate ${outputCount > 1 ? `${outputCount} Images` : 'Image'}`}</span>
          </button>
        </div>

        {/* Preview Gallery */}
        <div className="lg:col-span-7 rounded-3xl bg-white p-5 sm:p-6 neo-soft-shadow">
          {loading ? (
            <div className="aspect-[4/3] rounded-2xl bg-[#FAFAFA] flex flex-col items-center justify-center gap-3">
              <div className="w-11 h-11 rounded-full border-2 border-[#111827] border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-[#111827]">
                Creating {style} artwork...
              </p>
            </div>
          ) : latestBatch.length > 0 ? (
            <div className={`grid gap-4 ${latestBatch.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {latestBatch.map((img) => (
                <div
                  key={img.id}
                  className="rounded-2xl bg-white overflow-hidden neo-soft-shadow"
                >
                  <div className="aspect-square w-full bg-[#FAFAFA] flex items-center justify-center">
                    <img
                      src={img.imageDataUrl}
                      alt={img.prompt}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[#6B7280] truncate max-w-[180px]">
                      {img.style} · {img.aspectRatio}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggleFlag(img, 'isFavorite')}
                        title="Favorite"
                        className={`p-2 rounded-lg hover:bg-[#F5F5F5] cursor-pointer ${
                          img.isFavorite ? 'text-rose-500' : 'text-[#6B7280]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${img.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleFlag(img, 'savedToLibrary')}
                        title="Save to Library"
                        className={`p-2 rounded-lg hover:bg-[#F5F5F5] cursor-pointer ${
                          img.savedToLibrary ? 'text-[#111827]' : 'text-[#6B7280]'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${img.savedToLibrary ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(img)}
                        title="Download"
                        className="p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShare(img)}
                        title="Share"
                        className="p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerate(img.prompt)}
                        title="Regenerate"
                        className="p-2 rounded-lg text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {sharedId === img.id && (
                    <p className="px-3 pb-2 text-[11px] text-emerald-600">Prompt copied for sharing</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-2xl bg-[#FAFAFA] flex flex-col items-center justify-center text-center p-6">
              <ImageIcon className="w-10 h-10 text-[#111827] mb-3" />
              <p className="text-sm font-semibold text-[#111827]">
                Your generated images appear here
              </p>
              <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
                Pick any of the 8 styles, choose output count, and enter a descriptive prompt.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image History Gallery */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-[#111827]">
          Image Gallery & History
        </h2>
        {history.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-[#6B7280] neo-soft-shadow">
            No generated images yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.map((img) => (
              <div
                key={img.id}
                className="group rounded-2xl bg-white overflow-hidden neo-soft-shadow"
              >
                <button
                  type="button"
                  onClick={() => setLatestBatch([img])}
                  className="block w-full aspect-square overflow-hidden cursor-pointer bg-[#FAFAFA]"
                >
                  <img
                    src={img.imageDataUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </button>
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#111827] truncate">
                    {img.prompt}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleFlag(img, 'isFavorite')}
                      aria-label="Toggle favorite"
                      className={`p-1 rounded-lg cursor-pointer ${
                        img.isFavorite ? 'text-rose-500' : 'text-[#6B7280]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${img.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(img.id)}
                      aria-label="Delete image"
                      className="p-1 rounded-lg text-[#6B7280] hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Play, Puzzle, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import type { PluginItem } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface PluginsScreenProps {
  activeChatBackend: string;
  onUsageChanged: () => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = ({
  activeChatBackend,
  onUsageChanged,
}) => {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingPlugin, setTestingPlugin] = useState<PluginItem | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [runningTest, setRunningTest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPlugins()
      .then((res) => setPlugins(res.plugins))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plugins.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (plugin: PluginItem) => {
    const next = !plugin.enabled;
    setPlugins((prev) => prev.map((p) => (p.id === plugin.id ? { ...p, enabled: next } : p)));
    try {
      await api.togglePlugin(plugin.id, next);
    } catch {
      setPlugins((prev) =>
        prev.map((p) => (p.id === plugin.id ? { ...p, enabled: plugin.enabled } : p))
      );
    }
  };

  const handleRunPluginTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testingPlugin || !testInput.trim() || runningTest) return;
    setRunningTest(true);
    setTestOutput('');
    setError(null);

    try {
      let acc = '';
      await api.streamTool(
        {
          toolId: testingPlugin.id,
          input: testInput.trim(),
          backendKey: activeChatBackend,
        },
        (evt) => {
          if (evt.type === 'text' && evt.text) {
            acc += evt.text;
            setTestOutput(acc);
          } else if (evt.type === 'error') {
            setError(evt.error || 'Plugin run failed.');
          }
        }
      );
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plugin execution failed.');
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
          Discover Plugins
        </h1>
        <p className="text-sm text-[#6B7280]">
          Enable specialized AI skills to enhance your chats or test any plugin directly below.
        </p>
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
            <div key={n} className="h-44 rounded-3xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="rounded-3xl bg-white p-5 flex flex-col justify-between gap-4 neo-soft-shadow"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0">
                    <Puzzle className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plugin.enabled}
                    aria-label={`Toggle ${plugin.name}`}
                    onClick={() => void handleToggle(plugin)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                      plugin.enabled ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-[#6B7280]">
                    {plugin.category}
                  </p>
                  <h2 className="font-display text-base font-semibold text-[#111827] mt-0.5">
                    {plugin.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6B7280] mt-1 leading-relaxed">
                    {plugin.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F1F1F4]">
                <span className="text-xs font-medium text-[#6B7280]">
                  {plugin.enabled ? 'Active in Chat' : 'Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTestingPlugin(plugin);
                    setTestInput('');
                    setTestOutput('');
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white text-[#111827] hover:border-[#111827] cursor-pointer"
                >
                  <Play className="w-3 h-3 text-[#111827]" />
                  <span>Run Plugin</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Plugin Runner Modal */}
      {testingPlugin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plugin-runner-title"
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 space-y-4 neo-soft-shadow-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#111827] text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="plugin-runner-title"
                    className="font-display text-base font-semibold text-[#111827]"
                  >
                    {testingPlugin.name}
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    {testingPlugin.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestingPlugin(null)}
                aria-label="Close plugin runner"
                className="p-2 rounded-xl text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunPluginTest} className="space-y-3">
              <textarea
                rows={3}
                required
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={`Enter input for ${testingPlugin.name}...`}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={runningTest || !testInput.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black disabled:opacity-40 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>{runningTest ? 'Running...' : 'Execute'}</span>
                </button>
              </div>
            </form>

            {testOutput && (
              <div className="flex-1 overflow-y-auto rounded-2xl bg-[#FAFAFA] p-4">
                <MarkdownRenderer content={testOutput} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

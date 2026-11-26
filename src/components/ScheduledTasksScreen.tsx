import React, { useEffect, useState } from 'react';
import { CalendarClock, Play, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import type { ScheduledTaskItem } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ScheduledTasksScreenProps {
  onUsageChanged: () => void;
}

const SCHEDULES = ['Daily · 8:00 AM', 'Weekdays · 9:00 AM', 'Weekly · Monday', 'Hourly Check-in'];

export const ScheduledTasksScreen: React.FC<ScheduledTasksScreenProps> = ({
  onUsageChanged,
}) => {
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [scheduleLabel, setScheduleLabel] = useState(SCHEDULES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTasks()
      .then((res) => setTasks(res.tasks))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.createTask({
        title: title.trim(),
        prompt: prompt.trim(),
        scheduleLabel,
      });
      setTasks((prev) => [res.task, ...prev]);
      setTitle('');
      setPrompt('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: ScheduledTaskItem) => {
    const next = !Boolean(task.enabled);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, enabled: next ? 1 : 0 } : t))
    );
    try {
      await api.updateTask(task.id, { enabled: next });
    } catch {
      // Ignore
    }
  };

  const handleRunNow = async (taskId: string) => {
    setRunningId(taskId);
    setError(null);
    try {
      const res = await api.runTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task.');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            Scheduled Tasks
          </h1>
          <p className="text-sm text-[#6B7280]">
            Automate recurring AI briefings, summaries, and check-ins or run any task on demand.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm"
        >
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-white p-5 sm:p-6 space-y-4 neo-soft-shadow"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#111827]">
              Create Scheduled Prompt
            </h2>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              aria-label="Close form"
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1.5">
                Task Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Morning Focus Plan"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1.5">
                Cadence
              </label>
              <select
                value={scheduleLabel}
                onChange={(e) => setScheduleLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111827] cursor-pointer focus:outline-none focus:border-[#111827]"
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1.5">
              AI Prompt
            </label>
            <textarea
              rows={3}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give me a concise 3-priority productivity checklist and one creative prompt for today."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 min-h-[40px] rounded-xl text-sm font-medium border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 min-h-[40px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Creating...' : 'Save Task'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-32 rounded-3xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center neo-soft-shadow">
          <CalendarClock className="w-10 h-10 text-[#111827] mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-[#111827] mb-1">
            No scheduled tasks yet
          </h2>
          <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-5">
            Create automated prompt routines and run them whenever you need fresh insights.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const isRunning = runningId === task.id;
            return (
              <div
                key={task.id}
                className="rounded-3xl bg-white p-5 sm:p-6 space-y-4 neo-soft-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-base font-semibold text-[#111827]">
                        {task.title}
                      </h2>
                      <span className="text-xs font-medium text-[#6B7280]">
                        · {task.schedule_label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#6B7280]">
                      {task.prompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(task.enabled)}
                      aria-label={`Toggle ${task.title}`}
                      onClick={() => void handleToggle(task)}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                        task.enabled ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          task.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => void handleRunNow(task.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-white bg-[#111827] hover:bg-black disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{isRunning ? 'Running...' : 'Run Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(task.id)}
                      aria-label={`Delete ${task.title}`}
                      className="p-2 rounded-xl text-[#6B7280] hover:text-rose-600 hover:bg-[#F5F5F5] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {task.last_output && (
                  <div className="rounded-2xl bg-[#FAFAFA] p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span className="font-semibold text-[#111827]">
                        Latest Output
                      </span>
                      {task.last_run_at && (
                        <span className="tabular-nums">
                          {new Date(task.last_run_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <MarkdownRenderer content={task.last_output} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

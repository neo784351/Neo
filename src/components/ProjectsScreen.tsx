import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Code2,
  Download,
  Edit2,
  FileText,
  Folder,
  FolderPlus,
  Lightbulb,
  MessageSquare,
  Plus,
  Rocket,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ConversationItem, LibraryFileItem, ProjectItem } from '../types';

interface ProjectsScreenProps {
  onOpenProjectChat: (projectId: string, conversationId?: string | null) => void;
  onUsageChanged: () => void;
}

const PROJECT_ICONS: Array<{
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'folder', label: 'Folder', icon: Folder },
  { id: 'rocket', label: 'Launch', icon: Rocket },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'book', label: 'Research', icon: BookOpen },
  { id: 'briefcase', label: 'Work', icon: Briefcase },
  { id: 'idea', label: 'Ideas', icon: Lightbulb },
];

function renderProjectIcon(iconId: string, className = 'w-5 h-5') {
  const match = PROJECT_ICONS.find((p) => p.id === iconId) ?? PROJECT_ICONS[0];
  const Icon = match.icon;
  return <Icon className={className} />;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  onOpenProjectChat,
  onUsageChanged,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectItem | null>(null);
  const [projectConvs, setProjectConvs] = useState<ConversationItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<LibraryFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIcon, setFormIcon] = useState('folder');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await api.getProjectDetails(id);
      setDetailProject(res.project);
      setProjectConvs(res.conversations);
      setProjectFiles(res.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetails(selectedId);
    } else {
      setDetailProject(null);
      setProjectConvs([]);
      setProjectFiles([]);
    }
  }, [selectedId]);

  const openCreateModal = () => {
    setFormName('');
    setFormDesc('');
    setFormIcon('folder');
    setModalMode('create');
    setError(null);
  };

  const openEditModal = (p: ProjectItem) => {
    setFormName(p.name);
    setFormDesc(p.description);
    setFormIcon(p.icon || 'folder');
    setModalMode('edit');
    setError(null);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'create') {
        const res = await api.createProject({
          name: formName.trim(),
          description: formDesc.trim(),
          icon: formIcon,
        });
        setProjects((prev) => [res.project, ...prev]);
        setSelectedId(res.project.id);
        onUsageChanged();
      } else if (modalMode === 'edit' && detailProject) {
        const res = await api.updateProject(detailProject.id, {
          name: formName.trim(),
          description: formDesc.trim(),
          icon: formIcon,
        });
        setDetailProject(res.project);
        setProjects((prev) =>
          prev.map((p) => (p.id === res.project.id ? { ...p, ...res.project } : p))
        );
      }
      setModalMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(null);
      onUsageChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  };

  const handleUploadProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Files must be 4 MB or smaller.');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api.uploadFile({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          category: 'document',
          contentDataUrl: String(reader.result || ''),
          projectId: selectedId,
        });
        setProjectFiles((prev) => [res.file, ...prev]);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedId ? { ...p, fileCount: (p.fileCount || 0) + 1 } : p
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'File upload failed.');
      } finally {
        setUploadingFile(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteProjectFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      setProjectFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (selectedId) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedId
              ? { ...p, fileCount: Math.max(0, (p.fileCount || 1) - 1) }
              : p
          )
        );
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {selectedId && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Back to all projects"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white neo-soft-shadow flex items-center justify-center text-[#111827] hover:bg-[#FAFAFA] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
              {detailProject ? detailProject.name : 'Projects'}
            </h1>
            <p className="text-sm text-[#6B7280]">
              {detailProject
                ? detailProject.description || 'Dedicated workspace for project files and AI chats.'
                : 'Group related AI conversations, reference files, and notes into focused workspaces.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {detailProject ? (
            <>
              <button
                type="button"
                onClick={() => openEditModal(detailProject)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white text-xs sm:text-sm font-medium text-[#111827] hover:border-[#111827] cursor-pointer whitespace-nowrap shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenProjectChat(detailProject.id, null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Project Chat</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          )}
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

      {/* Project Detail View */}
      {selectedId ? (
        loadingDetail ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 rounded-3xl bg-[#F5F5F5] animate-pulse" />
            <div className="h-64 rounded-3xl bg-[#F5F5F5] animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Project Conversations */}
            <section className="rounded-3xl bg-white p-5 sm:p-6 space-y-4 neo-soft-shadow">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-[#111827] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#111827]" />
                  <span>Project Conversations</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onOpenProjectChat(selectedId, null)}
                  className="text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                >
                  + Start Chat
                </button>
              </div>

              {projectConvs.length === 0 ? (
                <div className="rounded-2xl bg-[#FAFAFA] p-6 text-center">
                  <p className="text-sm text-[#6B7280] mb-3">
                    No conversations in this project yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenProjectChat(selectedId, null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#111827] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Start First Chat</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projectConvs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onOpenProjectChat(selectedId, c.id)}
                      className="w-full text-left rounded-2xl bg-[#FAFAFA] hover:bg-[#F5F5F5] p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <span className="text-sm font-medium text-[#111827] truncate">
                        {c.title}
                      </span>
                      <span className="text-xs text-[#6B7280] tabular-nums shrink-0">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Project Files */}
            <section className="rounded-3xl bg-white p-5 sm:p-6 space-y-4 neo-soft-shadow">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-[#111827] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#111827]" />
                  <span>Project Files</span>
                </h2>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUploadProjectFile}
                  />
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingFile ? 'Uploading...' : 'Add File'}</span>
                  </button>
                </div>
              </div>

              {projectFiles.length === 0 ? (
                <div className="rounded-2xl bg-[#FAFAFA] p-6 text-center">
                  <p className="text-sm text-[#6B7280]">
                    No files attached to this project yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projectFiles.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-2xl bg-[#FAFAFA] p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {f.name}
                        </p>
                        <p className="text-xs text-[#6B7280] tabular-nums">
                          {Math.max(1, Math.round((f.size_bytes || 0) / 1024))} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={f.content_data_url}
                          download={f.name}
                          aria-label={`Download ${f.name}`}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827]"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProjectFile(f.id)}
                          aria-label={`Delete ${f.name}`}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-3xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center neo-soft-shadow">
          <FolderPlus className="w-10 h-10 text-[#111827] mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-[#111827] mb-1">
            Create your first project
          </h2>
          <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-5">
            Keep research notes, documents, and themed AI conversations neatly organized together.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl bg-white p-5 flex flex-col justify-between gap-4 neo-soft-shadow hover:-translate-y-0.5 transition-transform"
            >
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="text-left space-y-3 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-[#111827] text-white flex items-center justify-center">
                  {renderProjectIcon(p.icon)}
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[#111827]">
                    {p.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6B7280] mt-1 line-clamp-2">
                    {p.description || 'Workspace for chats and files.'}
                  </p>
                </div>
              </button>

              <div className="flex items-center justify-between pt-3 border-t border-[#F1F1F4] text-xs text-[#6B7280]">
                <span className="tabular-nums">
                  {p.conversationCount ?? 0} chats · {p.fileCount ?? 0} files
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="px-2.5 py-1 rounded-lg font-semibold text-[#111827] hover:bg-[#F5F5F5] cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteProject(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
        >
          <form
            onSubmit={handleSaveProject}
            className="w-full max-w-md rounded-3xl bg-white p-6 space-y-4 neo-soft-shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2
                id="project-modal-title"
                className="font-display text-lg font-semibold text-[#111827]"
              >
                {modalMode === 'create' ? 'Create Project' : 'Edit Project'}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                aria-label="Close modal"
                className="p-2 rounded-xl text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Product Launch Q3"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Notes, research threads, and launch drafts..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111827] mb-1.5">
                Project Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {PROJECT_ICONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = formIcon === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormIcon(opt.id)}
                      title={opt.label}
                      className={`h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#111827] text-white border-[#111827]'
                          : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 min-h-[42px] rounded-xl text-sm font-medium border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formName.trim()}
                className="px-5 py-2 min-h-[42px] rounded-xl text-sm font-semibold text-white bg-[#111827] hover:bg-black disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

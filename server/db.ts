import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'neo.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '/src/assets/images/neo_user_avatar_1795613981660.jpg',
    plan TEXT NOT NULL DEFAULT 'free',
    theme TEXT NOT NULL DEFAULT 'light',
    language TEXT NOT NULL DEFAULT 'English',
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    sound_effects_enabled INTEGER NOT NULL DEFAULT 1,
    preferred_chat_backend TEXT NOT NULL DEFAULT 'gemini:gemini-4-hydrogen',
    preferred_image_backend TEXT NOT NULL DEFAULT 'openai-compatible:dall-e-3',
    preferred_writer_backend TEXT NOT NULL DEFAULT 'gemini:gemini-4-hydrogen',
    preferred_voice TEXT NOT NULL DEFAULT 'Kore',
    auto_speak_voice INTEGER NOT NULL DEFAULT 1,
    stream_responses INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'folder',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    tool_id TEXT NOT NULL DEFAULT 'ai-chat',
    project_id TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_saved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments_json TEXT,
    feedback TEXT,
    provider_id TEXT,
    model_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS generated_images (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    style TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    image_data_url TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    saved_to_library INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS writer_generations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    tone TEXT NOT NULL,
    length TEXT NOT NULL,
    content TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS library_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'document',
    content_data_url TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    schedule_label TEXT NOT NULL DEFAULT 'Daily',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_output TEXT,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_plugins (
    user_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, plugin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_images_user ON generated_images(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_writer_user ON writer_generations(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_files_user ON library_files(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON scheduled_tasks(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
`);

// Safe additive migrations in case neo.db already existed from earlier turn
function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('users', 'phone', 'TEXT');
ensureColumn('users', 'preferred_voice', "TEXT NOT NULL DEFAULT 'Kore'");
ensureColumn('users', 'auto_speak_voice', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('users', 'stream_responses', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('conversations', 'project_id', 'TEXT');
ensureColumn('conversations', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('conversations', 'is_saved', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('generated_images', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('generated_images', 'saved_to_library', 'INTEGER NOT NULL DEFAULT 0');

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  username: string;
  password_hash: string;
  avatar_url: string;
  plan: string;
  theme: string;
  language: string;
  notifications_enabled: number;
  sound_effects_enabled: number;
  preferred_chat_backend: string;
  preferred_image_backend: string;
  preferred_writer_backend: string;
  preferred_voice: string;
  auto_speak_voice: number;
  stream_responses: number;
  created_at: string;
}

export function sanitizeUser(row: UserRow) {
  const theme =
    row.theme === 'dark' || row.theme === 'system' ? row.theme : 'light';
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || '',
    username: row.username,
    avatarUrl: row.avatar_url,
    plan: row.plan,
    theme,
    language: row.language,
    notificationsEnabled: Boolean(row.notifications_enabled),
    soundEffectsEnabled: Boolean(row.sound_effects_enabled),
    preferredChatBackend: row.preferred_chat_backend,
    preferredImageBackend: row.preferred_image_backend,
    preferredWriterBackend: row.preferred_writer_backend,
    preferredVoice: row.preferred_voice || 'Kore',
    autoSpeakVoice: Boolean(row.auto_speak_voice),
    streamResponses: Boolean(row.stream_responses),
    createdAt: row.created_at,
  };
}

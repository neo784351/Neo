import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { aiService } from './server/ai/aiService.ts';
import type { MediaAttachment } from './server/ai/types.ts';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { db, sanitizeUser, type UserRow } from './server/db.ts';

const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

const PLUGINS_CATALOG = [
  {
    id: 'code-reviewer',
    name: 'Code Architect & Reviewer',
    category: 'Developer',
    description: 'Audits functions for edge cases, security risks, and clean TypeScript architecture.',
    systemInstruction:
      'You are NEO Code Architect. Perform thorough, constructive code reviews focusing on correctness, edge cases, performance, and clarity.',
  },
  {
    id: 'research-brief',
    name: 'Executive Brief & Summarizer',
    category: 'Productivity',
    description: 'Turns long notes, articles, or transcripts into crisp bulleted executive briefs.',
    systemInstruction:
      'You are NEO Executive Brief. Summarize input into a 2-sentence TL;DR, key takeaways, and concrete action items.',
  },
  {
    id: 'study-coach',
    name: 'Socratic Study Coach',
    category: 'Education',
    description: 'Teaches complex math, science, and programming concepts with guided examples.',
    systemInstruction:
      'You are NEO Study Coach. Break concepts down progressively with intuitive analogies, step-by-step derivations, and quick self-check questions.',
  },
  {
    id: 'copy-polisher',
    name: 'Editorial Copy Polisher',
    category: 'Writing',
    description: 'Refines emails, proposals, and landing copy for clarity, warmth, and precision.',
    systemInstruction:
      'You are NEO Editorial Copy Polisher. Rewrite drafts to be clear, persuasive, and human without losing the author’s voice.',
  },
  {
    id: 'sql-schema-pro',
    name: 'SQL & Data Modeler',
    category: 'Data',
    description: 'Designs normalized schemas, indexes, and parameterized analytical queries.',
    systemInstruction:
      'You are NEO Data Modeler. Design clean database schemas, explain indexing trade-offs, and provide safe parameterized SQL queries.',
  },
  {
    id: 'creative-muse',
    name: 'Creative Prompt & Story Muse',
    category: 'Creative',
    description: 'Expands brief sparks into detailed visual prompts, worldbuilding, or story outlines.',
    systemInstruction:
      'You are NEO Creative Muse. Help users craft vivid visual prompts, character arcs, and atmospheric scenes.',
  },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function createNotification(userId: string, title: string, body: string): void {
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, body, read, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(crypto.randomUUID(), userId, title, body, new Date().toISOString());
}

function logUsage(userId: string, capability: string, providerId: string, modelId: string): void {
  db.prepare(
    'INSERT INTO usage_logs (id, user_id, capability, provider_id, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, capability, providerId, modelId, new Date().toISOString());
}

function getUsageStats(userId: string) {
  const chats = db
    .prepare('SELECT COUNT(*) as c FROM conversations WHERE user_id = ?')
    .get(userId) as { c: number };
  const messages = db
    .prepare(
      `SELECT COUNT(*) as c FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = ? AND m.role = 'assistant'`
    )
    .get(userId) as { c: number };
  const images = db
    .prepare('SELECT COUNT(*) as c FROM generated_images WHERE user_id = ?')
    .get(userId) as { c: number };
  const writings = db
    .prepare('SELECT COUNT(*) as c FROM writer_generations WHERE user_id = ?')
    .get(userId) as { c: number };
  const projects = db
    .prepare('SELECT COUNT(*) as c FROM projects WHERE user_id = ?')
    .get(userId) as { c: number };

  return {
    totalChats: chats.c,
    totalResponses: messages.c,
    totalImages: images.c,
    totalWritings: writings.c,
    totalProjects: projects.c,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/providers', (_req, res) => {
    res.json({
      emailEnabled: true,
      googleConfigured: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
      appleConfigured: Boolean(process.env.APPLE_CLIENT_ID),
      billingConfigured: false,
    });
  });

  // Register
  app.post('/api/auth/register', (req, res) => {
    const { email, phone, username, password, rememberMe } = req.body as {
      email?: unknown;
      phone?: unknown;
      username?: unknown;
      password?: unknown;
      rememberMe?: unknown;
    };

    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 48) {
      res.status(400).json({ error: 'Full name must be between 2 and 48 characters.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const cleanPhone =
      typeof phone === 'string' && phone.trim()
        ? phone.trim().replace(/\s+/g, '').slice(0, 24)
        : null;

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    if (cleanPhone) {
      const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone);
      if (existingPhone) {
        res.status(409).json({ error: 'An account with this phone number already exists.' });
        return;
      }
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    db.prepare(
      `INSERT INTO users (id, email, phone, username, password_hash, theme, created_at)
       VALUES (?, ?, ?, ?, ?, 'light', ?)`
    ).run(userId, normalizedEmail, cleanPhone, username.trim(), passwordHash, now);

    createNotification(
      userId,
      'Welcome to NEO AI',
      'Your workspace is ready. Ask questions, generate imagery, organize projects, and save work to your library.'
    );

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    const remember = Boolean(rememberMe);
    const { token } = createSession(userId, remember);
    setSessionCookie(res, token, remember);

    res.status(201).json({
      token,
      user: sanitizeUser(userRow),
      usage: getUsageStats(userId),
    });
  });

  // Login (email or phone)
  app.post('/api/auth/login', (req, res) => {
    const { identifier, email, password, rememberMe } = req.body as {
      identifier?: unknown;
      email?: unknown;
      password?: unknown;
      rememberMe?: unknown;
    };

    const rawId = typeof identifier === 'string' ? identifier : typeof email === 'string' ? email : '';
    if (!rawId.trim() || typeof password !== 'string') {
      res.status(400).json({ error: 'Email or phone number and password are required.' });
      return;
    }

    const cleanId = rawId.trim().toLowerCase();
    const cleanPhone = rawId.trim().replace(/\s+/g, '');

    const userRow = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?')
      .get(cleanId, cleanPhone) as UserRow | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials. Check your email/phone and password.' });
      return;
    }

    const remember = Boolean(rememberMe);
    const { token } = createSession(userRow.id, remember);
    setSessionCookie(res, token, remember);

    res.json({
      token,
      user: sanitizeUser(userRow),
      usage: getUsageStats(userRow.id),
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body as { email?: unknown };
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    res.json({
      sent: false,
      message:
        'Automated password reset emails require an outbound SMTP relay configured on the server. When signed in, you can change your password anytime from Profile or Settings > Security.',
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.tokenHash) {
      deleteSession(req.tokenHash);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      user: req.user,
      usage: getUsageStats(req.user!.id),
    });
  });

  // Update profile & settings
  app.patch('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const body = req.body as Record<string, unknown>;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.username === 'string') {
      const name = body.username.trim();
      if (name.length < 2 || name.length > 48) {
        res.status(400).json({ error: 'Name must be between 2 and 48 characters.' });
        return;
      }
      updates.push('username = ?');
      values.push(name);
    }

    if (typeof body.phone === 'string') {
      updates.push('phone = ?');
      values.push(body.phone.trim() ? body.phone.trim().slice(0, 24) : null);
    }

    if (typeof body.avatarUrl === 'string' && body.avatarUrl.length <= 2_000_000) {
      const av = body.avatarUrl.trim();
      if (av.startsWith('/src/assets/') || av.startsWith('data:image/')) {
        updates.push('avatar_url = ?');
        values.push(av);
      }
    }

    if (body.theme === 'light' || body.theme === 'dark' || body.theme === 'system') {
      updates.push('theme = ?');
      values.push(body.theme);
    }

    if (typeof body.language === 'string' && body.language.length <= 32) {
      updates.push('language = ?');
      values.push(body.language.trim());
    }

    if (typeof body.notificationsEnabled === 'boolean') {
      updates.push('notifications_enabled = ?');
      values.push(body.notificationsEnabled ? 1 : 0);
    }

    if (typeof body.soundEffectsEnabled === 'boolean') {
      updates.push('sound_effects_enabled = ?');
      values.push(body.soundEffectsEnabled ? 1 : 0);
    }

    if (typeof body.preferredChatBackend === 'string' && body.preferredChatBackend.includes(':')) {
      updates.push('preferred_chat_backend = ?');
      values.push(body.preferredChatBackend);
    }

    if (typeof body.preferredImageBackend === 'string' && body.preferredImageBackend.includes(':')) {
      updates.push('preferred_image_backend = ?');
      values.push(body.preferredImageBackend);
    }

    if (typeof body.preferredWriterBackend === 'string' && body.preferredWriterBackend.includes(':')) {
      updates.push('preferred_writer_backend = ?');
      values.push(body.preferredWriterBackend);
    }

    if (typeof body.preferredVoice === 'string' && body.preferredVoice.length <= 24) {
      updates.push('preferred_voice = ?');
      values.push(body.preferredVoice);
    }

    if (typeof body.autoSpeakVoice === 'boolean') {
      updates.push('auto_speak_voice = ?');
      values.push(body.autoSpeakVoice ? 1 : 0);
    }

    if (typeof body.streamResponses === 'boolean') {
      updates.push('stream_responses = ?');
      values.push(body.streamResponses ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    res.json({ user: sanitizeUser(updatedRow) });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current and new password are required.' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    if (!verifyPassword(currentPassword, req.userRow!.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user!.id);
    createNotification(req.user!.id, 'Security Updated', 'Your NEO AI password was changed.');

    res.json({ ok: true });
  });

  app.get('/api/ai/backends', requireAuth, (_req, res) => {
    res.json({ backends: aiService.listBackends() });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(req.user!.id);
    res.json({ notifications: rows });
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  app.get('/api/usage', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ usage: getUsageStats(req.user!.id) });
  });

  // Global Search
  app.get('/api/search', requireAuth, (req: AuthenticatedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const userId = req.user!.id;
    if (!q) {
      res.json({ conversations: [], images: [], files: [], projects: [] });
      return;
    }

    const conversations = db
      .prepare(
        `SELECT DISTINCT c.* FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.user_id = ? AND (LOWER(c.title) LIKE ? OR LOWER(m.content) LIKE ?)
         ORDER BY c.updated_at DESC LIMIT 20`
      )
      .all(userId, `%${q}%`, `%${q}%`);

    const images = db
      .prepare(
        `SELECT * FROM generated_images
         WHERE user_id = ? AND (LOWER(prompt) LIKE ? OR LOWER(style) LIKE ?)
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(userId, `%${q}%`, `%${q}%`)
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id,
          prompt: row.prompt,
          style: row.style,
          aspectRatio: row.aspect_ratio,
          imageDataUrl: row.image_data_url,
          providerId: row.provider_id,
          modelId: row.model_id,
          isFavorite: Boolean(row.is_favorite),
          savedToLibrary: Boolean(row.saved_to_library),
          createdAt: row.created_at,
        };
      });

    const files = db
      .prepare(
        `SELECT * FROM library_files
         WHERE user_id = ? AND LOWER(name) LIKE ?
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(userId, `%${q}%`);

    const projects = db
      .prepare(
        `SELECT * FROM projects
         WHERE user_id = ? AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
         ORDER BY updated_at DESC LIMIT 20`
      )
      .all(userId, `%${q}%`, `%${q}%`);

    res.json({ conversations, images, files, projects });
  });

  // Conversations CRUD
  app.get('/api/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : '';

    let rows;
    if (projectId) {
      rows = db
        .prepare(
          'SELECT * FROM conversations WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC LIMIT 100'
        )
        .all(req.user!.id, projectId);
    } else if (q) {
      rows = db
        .prepare(
          `SELECT DISTINCT c.* FROM conversations c
           LEFT JOIN messages m ON m.conversation_id = c.id
           WHERE c.user_id = ? AND (LOWER(c.title) LIKE ? OR LOWER(m.content) LIKE ?)
           ORDER BY c.updated_at DESC LIMIT 100`
        )
        .all(req.user!.id, `%${q}%`, `%${q}%`);
    } else {
      rows = db
        .prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100')
        .all(req.user!.id);
    }
    res.json({ conversations: rows });
  });

  app.post('/api/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const { title, toolId, projectId } = req.body as {
      title?: unknown;
      toolId?: unknown;
      projectId?: unknown;
    };
    const cleanTitle =
      typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : 'New Conversation';
    const cleanTool = typeof toolId === 'string' && toolId.trim() ? toolId.trim() : 'ai-chat';
    let cleanProjectId: string | null = null;
    if (typeof projectId === 'string' && projectId.trim()) {
      const p = db
        .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
        .get(projectId.trim(), req.user!.id);
      if (p) cleanProjectId = projectId.trim();
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO conversations (id, user_id, title, tool_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.user!.id, cleanTitle, cleanTool, cleanProjectId, now, now);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    res.status(201).json({ conversation: conv });
  });

  app.get('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const conv = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const msgs = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(req.params.id) as Array<Record<string, unknown>>;

    const formatted = msgs.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      attachments: m.attachments_json ? JSON.parse(String(m.attachments_json)) : [],
      feedback: m.feedback ?? null,
      providerId: m.provider_id,
      modelId: m.model_id,
      createdAt: m.created_at,
    }));

    res.json({ conversation: conv, messages: formatted });
  });

  app.patch('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { title, isFavorite, isSaved, projectId } = req.body as {
      title?: unknown;
      isFavorite?: unknown;
      isSaved?: unknown;
      projectId?: unknown;
    };

    const existing = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const updates: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (typeof title === 'string' && title.trim()) {
      updates.push('title = ?');
      values.push(title.trim().slice(0, 120));
    }
    if (typeof isFavorite === 'boolean') {
      updates.push('is_favorite = ?');
      values.push(isFavorite ? 1 : 0);
    }
    if (typeof isSaved === 'boolean') {
      updates.push('is_saved = ?');
      values.push(isSaved ? 1 : 0);
    }
    if (projectId === null) {
      updates.push('project_id = NULL');
    } else if (typeof projectId === 'string' && projectId.trim()) {
      const proj = db
        .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
        .get(projectId.trim(), req.user!.id);
      if (proj) {
        updates.push('project_id = ?');
        values.push(projectId.trim());
      }
    }

    values.push(req.params.id, req.user!.id);
    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(
      ...values
    );

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    res.json({ conversation: conv });
  });

  app.delete('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json({ ok: true });
  });

  function sendSse(res: Response, payload: unknown) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  // Stream chat message
  app.post('/api/conversations/:id/messages/stream', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const conv = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, userId) as { id: string; title: string; tool_id: string } | undefined;

    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const { message, attachments, backendKey, systemInstruction } = req.body as {
      message?: unknown;
      attachments?: MediaAttachment[];
      backendKey?: string;
      systemInstruction?: string;
    };

    if (typeof message !== 'string' || (!message.trim() && (!attachments || attachments.length === 0))) {
      res.status(400).json({ error: 'Message content or attachment is required.' });
      return;
    }

    const cleanAttachments = Array.isArray(attachments)
      ? attachments
          .filter(
            (a) =>
              a &&
              typeof a.mimeType === 'string' &&
              a.mimeType.startsWith('image/') &&
              typeof a.data === 'string'
          )
          .slice(0, 4)
      : [];

    const existingRows = db
      .prepare('SELECT role, content, attachments_json FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conv.id) as Array<{ role: string; content: string; attachments_json: string | null }>;

    const history = existingRows.map((row) => ({
      role: (row.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: row.content,
      attachments: row.attachments_json
        ? (JSON.parse(row.attachments_json) as MediaAttachment[])
        : undefined,
    }));

    const userMsgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanText = message.trim() || 'Analyze the attached image.';

    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)
       VALUES (?, ?, 'user', ?, ?, ?)`
    ).run(
      userMsgId,
      conv.id,
      cleanText,
      cleanAttachments.length > 0 ? JSON.stringify(cleanAttachments) : null,
      now
    );

    if (conv.title === 'New Conversation' || existingRows.length === 0) {
      const autoTitle = cleanText.slice(0, 48) + (cleanText.length > 48 ? '...' : '');
      db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(
        autoTitle,
        now,
        conv.id
      );
    } else {
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conv.id);
    }

    // Incorporate active plugins into system instruction
    const enabledPlugins = db
      .prepare('SELECT plugin_id FROM user_plugins WHERE user_id = ? AND enabled = 1')
      .all(userId) as Array<{ plugin_id: string }>;
    const pluginPrompts = enabledPlugins
      .map((p) => PLUGINS_CATALOG.find((c) => c.id === p.plugin_id)?.systemInstruction)
      .filter(Boolean)
      .join(' ');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const activeBackend = backendKey || req.user!.preferredChatBackend;
    const langHint =
      req.user!.language && req.user!.language !== 'English'
        ? ` Respond in ${req.user!.language} unless the user writes in another language.`
        : '';

    let accumulated = '';
    let resolvedProvider = 'gemini';
    let resolvedModel = 'gemini-4-hydrogen';
    let hadError = false;

    await aiService.streamChat(
      activeBackend,
      {
        history,
        message: cleanText,
        attachments: cleanAttachments,
        systemInstruction:
          (systemInstruction ||
            'You are NEO AI, a helpful, clear, next-generation personal AI assistant. Format responses cleanly with Markdown when helpful.') +
          (pluginPrompts ? ` Active capabilities: ${pluginPrompts}` : '') +
          langHint,
      },
      (chunk) => {
        if (chunk.providerId) resolvedProvider = chunk.providerId;
        if (chunk.modelId) resolvedModel = chunk.modelId;

        if (chunk.type === 'text' && chunk.text) {
          accumulated += chunk.text;
          sendSse(res, { type: 'text', text: chunk.text });
        } else if (chunk.type === 'error') {
          hadError = true;
          sendSse(res, {
            type: 'error',
            error: chunk.error || 'AI streaming failed.',
            statusCode: chunk.statusCode || 500,
          });
        }
      }
    );

    if (!hadError && accumulated.trim()) {
      const assistantMsgId = crypto.randomUUID();
      const doneTime = new Date().toISOString();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, provider_id, model_id, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?)`
      ).run(assistantMsgId, conv.id, accumulated, resolvedProvider, resolvedModel, doneTime);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(doneTime, conv.id);
      logUsage(userId, 'chat', resolvedProvider, resolvedModel);

      sendSse(res, {
        type: 'done',
        userMessageId: userMsgId,
        assistantMessageId: assistantMsgId,
        providerId: resolvedProvider,
        modelId: resolvedModel,
      });
    } else if (!hadError) {
      sendSse(res, { type: 'error', error: 'No response generated.' });
    }

    res.end();
  });

  app.post('/api/conversations/:id/regenerate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const conv = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, userId) as { id: string } | undefined;

    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const msgs = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conv.id) as Array<{
      id: string;
      role: string;
      content: string;
      attachments_json: string | null;
    }>;

    if (msgs.length === 0) {
      res.status(400).json({ error: 'Nothing to regenerate.' });
      return;
    }

    let trimmed = [...msgs];
    const last = trimmed[trimmed.length - 1];
    if (last.role === 'assistant') {
      db.prepare('DELETE FROM messages WHERE id = ?').run(last.id);
      trimmed = trimmed.slice(0, -1);
    }

    const lastUser = trimmed[trimmed.length - 1];
    if (!lastUser || lastUser.role !== 'user') {
      res.status(400).json({ error: 'No user prompt found to regenerate.' });
      return;
    }

    const priorHistory = trimmed.slice(0, -1).map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
      attachments: m.attachments_json
        ? (JSON.parse(m.attachments_json) as MediaAttachment[])
        : undefined,
    }));

    const { backendKey } = req.body as { backendKey?: string };
    const activeBackend = backendKey || req.user!.preferredChatBackend;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let accumulated = '';
    let resolvedProvider = 'gemini';
    let resolvedModel = 'gemini-4-hydrogen';
    let hadError = false;

    await aiService.streamChat(
      activeBackend,
      {
        history: priorHistory,
        message: lastUser.content,
        attachments: lastUser.attachments_json
          ? (JSON.parse(lastUser.attachments_json) as MediaAttachment[])
          : undefined,
      },
      (chunk) => {
        if (chunk.providerId) resolvedProvider = chunk.providerId;
        if (chunk.modelId) resolvedModel = chunk.modelId;

        if (chunk.type === 'text' && chunk.text) {
          accumulated += chunk.text;
          sendSse(res, { type: 'text', text: chunk.text });
        } else if (chunk.type === 'error') {
          hadError = true;
          sendSse(res, {
            type: 'error',
            error: chunk.error || 'Regeneration failed.',
            statusCode: chunk.statusCode || 500,
          });
        }
      }
    );

    if (!hadError && accumulated.trim()) {
      const assistantMsgId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, provider_id, model_id, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?)`
      ).run(assistantMsgId, conv.id, accumulated, resolvedProvider, resolvedModel, now);

      logUsage(userId, 'chat', resolvedProvider, resolvedModel);
      sendSse(res, {
        type: 'done',
        assistantMessageId: assistantMsgId,
        providerId: resolvedProvider,
        modelId: resolvedModel,
      });
    }

    res.end();
  });

  app.patch('/api/messages/:id/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
    const { feedback } = req.body as { feedback?: unknown };
    const clean = feedback === 'like' || feedback === 'dislike' ? feedback : null;

    const row = db
      .prepare(
        `SELECT m.id FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE m.id = ? AND c.user_id = ?`
      )
      .get(req.params.id, req.user!.id);

    if (!row) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    db.prepare('UPDATE messages SET feedback = ? WHERE id = ?').run(clean, req.params.id);
    res.json({ ok: true, feedback: clean });
  });

  // AI Image Generator (supports multiple outputs)
  app.post('/api/images/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { prompt, style, aspectRatio, backendKey, count } = req.body as {
      prompt?: unknown;
      style?: unknown;
      aspectRatio?: unknown;
      backendKey?: string;
      count?: unknown;
    };

    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Please describe the image you want to generate.' });
      return;
    }

    const cleanStyle = typeof style === 'string' && style.trim() ? style.trim() : 'Realistic';
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
    const cleanRatio = validRatios.includes(aspectRatio as (typeof validRatios)[number])
      ? (aspectRatio as (typeof validRatios)[number])
      : '1:1';
    const numOutputs = count === 2 ? 2 : count === 4 ? 4 : 1;

    try {
      const createdImages = [];
      for (let i = 0; i < numOutputs; i++) {
        const result = await aiService.generateImage(
          backendKey || req.user!.preferredImageBackend,
          {
            prompt: prompt.trim(),
            style: cleanStyle,
            aspectRatio: cleanRatio,
          }
        );

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(
          `INSERT INTO generated_images (id, user_id, prompt, style, aspect_ratio, image_data_url, provider_id, model_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          req.user!.id,
          prompt.trim(),
          cleanStyle,
          cleanRatio,
          result.imageDataUrl,
          result.providerId,
          result.modelId,
          now
        );

        logUsage(req.user!.id, 'image', result.providerId, result.modelId);
        createdImages.push({
          id,
          prompt: prompt.trim(),
          style: cleanStyle,
          aspectRatio: cleanRatio,
          imageDataUrl: result.imageDataUrl,
          providerId: result.providerId,
          modelId: result.modelId,
          isFavorite: false,
          savedToLibrary: false,
          createdAt: now,
        });
      }

      res.json({ image: createdImages[0], images: createdImages });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({ error: err.message || 'Image generation failed.' });
    }
  });

  app.get('/api/images/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM generated_images WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
      .all(req.user!.id) as Array<Record<string, unknown>>;
    res.json({
      images: rows.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        style: r.style,
        aspectRatio: r.aspect_ratio,
        imageDataUrl: r.image_data_url,
        providerId: r.provider_id,
        modelId: r.model_id,
        isFavorite: Boolean(r.is_favorite),
        savedToLibrary: Boolean(r.saved_to_library),
        createdAt: r.created_at,
      })),
    });
  });

  app.patch('/api/images/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { isFavorite, savedToLibrary } = req.body as {
      isFavorite?: unknown;
      savedToLibrary?: unknown;
    };

    const existing = db
      .prepare('SELECT id FROM generated_images WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }

    if (typeof isFavorite === 'boolean') {
      db.prepare('UPDATE generated_images SET is_favorite = ? WHERE id = ?').run(
        isFavorite ? 1 : 0,
        req.params.id
      );
    }
    if (typeof savedToLibrary === 'boolean') {
      db.prepare('UPDATE generated_images SET saved_to_library = ? WHERE id = ?').run(
        savedToLibrary ? 1 : 0,
        req.params.id
      );
    }
    res.json({ ok: true });
  });

  app.delete('/api/images/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM generated_images WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Library & Files
  app.get('/api/library', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const conversations = db
      .prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 60')
      .all(userId);
    const images = (
      db
        .prepare('SELECT * FROM generated_images WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
        .all(userId) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id,
      prompt: r.prompt,
      style: r.style,
      aspectRatio: r.aspect_ratio,
      imageDataUrl: r.image_data_url,
      providerId: r.provider_id,
      modelId: r.model_id,
      isFavorite: Boolean(r.is_favorite),
      savedToLibrary: Boolean(r.saved_to_library),
      createdAt: r.created_at,
    }));
    const files = db
      .prepare('SELECT * FROM library_files WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
      .all(userId);

    res.json({ conversations, images, files });
  });

  app.post('/api/files', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name, mimeType, sizeBytes, category, contentDataUrl, projectId } = req.body as {
      name?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
      category?: unknown;
      contentDataUrl?: unknown;
      projectId?: unknown;
    };

    if (typeof name !== 'string' || !name.trim() || typeof contentDataUrl !== 'string') {
      res.status(400).json({ error: 'File name and content are required.' });
      return;
    }

    let cleanProjectId: string | null = null;
    if (typeof projectId === 'string' && projectId.trim()) {
      const p = db
        .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
        .get(projectId.trim(), req.user!.id);
      if (p) cleanProjectId = projectId.trim();
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanCat =
      category === 'document' || category === 'file' || category === 'note'
        ? category
        : 'document';

    db.prepare(
      `INSERT INTO library_files (id, user_id, project_id, name, mime_type, size_bytes, category, content_data_url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      id,
      req.user!.id,
      cleanProjectId,
      name.trim().slice(0, 140),
      typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      typeof sizeBytes === 'number' ? sizeBytes : 0,
      cleanCat,
      contentDataUrl,
      now
    );

    const file = db.prepare('SELECT * FROM library_files WHERE id = ?').get(id);
    res.status(201).json({ file });
  });

  app.patch('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { isFavorite, projectId } = req.body as {
      isFavorite?: unknown;
      projectId?: unknown;
    };
    const existing = db
      .prepare('SELECT id FROM library_files WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    if (typeof isFavorite === 'boolean') {
      db.prepare('UPDATE library_files SET is_favorite = ? WHERE id = ?').run(
        isFavorite ? 1 : 0,
        req.params.id
      );
    }
    if (projectId === null) {
      db.prepare('UPDATE library_files SET project_id = NULL WHERE id = ?').run(req.params.id);
    } else if (typeof projectId === 'string' && projectId.trim()) {
      const p = db
        .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
        .get(projectId.trim(), req.user!.id);
      if (p) {
        db.prepare('UPDATE library_files SET project_id = ? WHERE id = ?').run(
          projectId.trim(),
          req.params.id
        );
      }
    }
    res.json({ ok: true });
  });

  app.delete('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM library_files WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Projects CRUD
  app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const rows = db
      .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId) as Array<Record<string, unknown>>;

    const enriched = rows.map((p) => {
      const convCount = (
        db
          .prepare('SELECT COUNT(*) as c FROM conversations WHERE project_id = ? AND user_id = ?')
          .get(p.id, userId) as { c: number }
      ).c;
      const fileCount = (
        db
          .prepare('SELECT COUNT(*) as c FROM library_files WHERE project_id = ? AND user_id = ?')
          .get(p.id, userId) as { c: number }
      ).c;
      return { ...p, conversationCount: convCount, fileCount };
    });

    res.json({ projects: enriched });
  });

  app.post('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name, description, icon } = req.body as {
      name?: unknown;
      description?: unknown;
      icon?: unknown;
    };
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO projects (id, user_id, name, description, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      req.user!.id,
      name.trim().slice(0, 80),
      typeof description === 'string' ? description.trim().slice(0, 400) : '',
      typeof icon === 'string' ? icon.trim().slice(0, 32) : 'folder',
      now,
      now
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ project: { ...(project as object), conversationCount: 0, fileCount: 0 } });
  });

  app.get('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = db
      .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const conversations = db
      .prepare('SELECT * FROM conversations WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC')
      .all(req.params.id, req.user!.id);
    const files = db
      .prepare('SELECT * FROM library_files WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC')
      .all(req.params.id, req.user!.id);

    res.json({ project, conversations, files });
  });

  app.patch('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name, description, icon } = req.body as {
      name?: unknown;
      description?: unknown;
      icon?: unknown;
    };
    const existing = db
      .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const updates: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];
    if (typeof name === 'string' && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim().slice(0, 80));
    }
    if (typeof description === 'string') {
      updates.push('description = ?');
      values.push(description.trim().slice(0, 400));
    }
    if (typeof icon === 'string' && icon.trim()) {
      updates.push('icon = ?');
      values.push(icon.trim().slice(0, 32));
    }

    values.push(req.params.id, req.user!.id);
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(
      ...values
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ project });
  });

  app.delete('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    db.prepare('UPDATE conversations SET project_id = NULL WHERE project_id = ? AND user_id = ?').run(
      req.params.id,
      req.user!.id
    );
    db.prepare('UPDATE library_files SET project_id = NULL WHERE project_id = ? AND user_id = ?').run(
      req.params.id,
      req.user!.id
    );
    res.json({ ok: true });
  });

  // Scheduled Tasks
  app.get('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id);
    res.json({ tasks: rows });
  });

  app.post('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const { title, prompt, scheduleLabel } = req.body as {
      title?: unknown;
      prompt?: unknown;
      scheduleLabel?: unknown;
    };
    if (typeof title !== 'string' || !title.trim() || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Task title and prompt are required.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanSchedule =
      typeof scheduleLabel === 'string' && scheduleLabel.trim()
        ? scheduleLabel.trim().slice(0, 32)
        : 'Daily';

    db.prepare(
      'INSERT INTO scheduled_tasks (id, user_id, title, prompt, schedule_label, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, req.user!.id, title.trim().slice(0, 100), prompt.trim().slice(0, 1000), cleanSchedule, now);

    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);
    res.status(201).json({ task });
  });

  app.patch('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { enabled, title, prompt, scheduleLabel } = req.body as {
      enabled?: unknown;
      title?: unknown;
      prompt?: unknown;
      scheduleLabel?: unknown;
    };
    const existing = db
      .prepare('SELECT id FROM scheduled_tasks WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof enabled === 'boolean') {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }
    if (typeof title === 'string' && title.trim()) {
      updates.push('title = ?');
      values.push(title.trim().slice(0, 100));
    }
    if (typeof prompt === 'string' && prompt.trim()) {
      updates.push('prompt = ?');
      values.push(prompt.trim().slice(0, 1000));
    }
    if (typeof scheduleLabel === 'string' && scheduleLabel.trim()) {
      updates.push('schedule_label = ?');
      values.push(scheduleLabel.trim().slice(0, 32));
    }

    if (updates.length > 0) {
      values.push(req.params.id, req.user!.id);
      db.prepare(`UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(
        ...values
      );
    }
    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id);
    res.json({ task });
  });

  app.post('/api/tasks/:id/run', requireAuth, async (req: AuthenticatedRequest, res) => {
    const task = db
      .prepare('SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as { id: string; title: string; prompt: string } | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    let output = '';
    let errText = '';
    await aiService.streamChat(
      req.user!.preferredChatBackend,
      {
        history: [],
        message: task.prompt,
        systemInstruction: 'You are NEO AI executing a scheduled user task. Provide a crisp, actionable result.',
      },
      (chunk) => {
        if (chunk.type === 'text' && chunk.text) output += chunk.text;
        if (chunk.type === 'error' && chunk.error) errText = chunk.error;
      }
    );

    if (errText) {
      res.status(500).json({ error: errText });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE scheduled_tasks SET last_output = ?, last_run_at = ? WHERE id = ?').run(
      output.trim(),
      now,
      task.id
    );
    logUsage(req.user!.id, 'scheduled-task', 'gemini', 'gemini-4-hydrogen');
    createNotification(req.user!.id, `Task Completed: ${task.title}`, 'View the latest output in Scheduled Tasks.');

    const updated = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(task.id);
    res.json({ task: updated });
  });

  app.delete('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Plugins
  app.get('/api/plugins', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT plugin_id, enabled FROM user_plugins WHERE user_id = ?')
      .all(req.user!.id) as Array<{ plugin_id: string; enabled: number }>;
    const enabledMap = new Map(rows.map((r) => [r.plugin_id, Boolean(r.enabled)]));

    res.json({
      plugins: PLUGINS_CATALOG.map((p) => ({
        ...p,
        enabled: enabledMap.get(p.id) ?? false,
      })),
    });
  });

  app.patch('/api/plugins/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const plugin = PLUGINS_CATALOG.find((p) => p.id === req.params.id);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found.' });
      return;
    }
    const { enabled } = req.body as { enabled?: unknown };
    const nextEnabled = Boolean(enabled);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO user_plugins (user_id, plugin_id, enabled, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, plugin_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`
    ).run(req.user!.id, plugin.id, nextEnabled ? 1 : 0, now);

    res.json({ ok: true, enabled: nextEnabled });
  });

  // Specialized AI Tools & Voice Assistant
  app.post('/api/tools/run/stream', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { toolId, input, targetLanguage, backendKey } = req.body as {
      toolId?: unknown;
      input?: unknown;
      targetLanguage?: unknown;
      backendKey?: string;
    };

    if (typeof toolId !== 'string' || typeof input !== 'string' || !input.trim()) {
      res.status(400).json({ error: 'Tool identifier and input text are required.' });
      return;
    }

    const pluginMatch = PLUGINS_CATALOG.find((p) => p.id === toolId);
    const sys =
      pluginMatch?.systemInstruction ||
      (toolId === 'translator'
        ? `Translate accurately into ${typeof targetLanguage === 'string' ? targetLanguage : 'Spanish'}.`
        : 'You are NEO AI, a helpful personal AI assistant.');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let resolvedProvider = 'gemini';
    let resolvedModel = 'gemini-4-hydrogen';
    let hadError = false;

    await aiService.streamChat(
      backendKey || req.user!.preferredChatBackend,
      {
        history: [],
        message: input.trim(),
        systemInstruction: sys,
      },
      (chunk) => {
        if (chunk.providerId) resolvedProvider = chunk.providerId;
        if (chunk.modelId) resolvedModel = chunk.modelId;

        if (chunk.type === 'text' && chunk.text) {
          sendSse(res, { type: 'text', text: chunk.text });
        } else if (chunk.type === 'error') {
          hadError = true;
          sendSse(res, {
            type: 'error',
            error: chunk.error || 'Request failed.',
            statusCode: chunk.statusCode || 500,
          });
        }
      }
    );

    if (!hadError) {
      logUsage(req.user!.id, toolId, resolvedProvider, resolvedModel);
      sendSse(res, { type: 'done', providerId: resolvedProvider, modelId: resolvedModel });
    }
    res.end();
  });

  app.post('/api/ai/transcribe', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { audioBase64, mimeType } = req.body as { audioBase64?: unknown; mimeType?: unknown };
    if (typeof audioBase64 !== 'string' || !audioBase64) {
      res.status(400).json({ error: 'Audio payload is required.' });
      return;
    }

    try {
      const result = await aiService.transcribeAudio({
        audioBase64,
        mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      });
      logUsage(req.user!.id, 'transcribe', result.providerId, 'gemini-3.5-transcribe');
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({ error: err.message || 'Transcription failed.' });
    }
  });

  app.post('/api/ai/tts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { text, voice } = req.body as { text?: unknown; voice?: unknown };
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required for speech synthesis.' });
      return;
    }

    try {
      const result = await aiService.generateSpeech({
        text: text.trim(),
        voice: typeof voice === 'string' ? voice : req.user!.preferredVoice || 'Kore',
      });
      logUsage(req.user!.id, 'tts', result.providerId, 'gemini-3.8-flash-lite-tts');
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({ error: err.message || 'Speech synthesis failed.' });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEO AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NEO AI server:', err);
  process.exit(1);
});

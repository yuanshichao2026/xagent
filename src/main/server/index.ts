import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { dbOperations } from '../db';
import { loadConfig, saveConfig } from '../config';
import { getPluginsConfig, savePluginsConfig } from './pluginManager';
import { getSkills, saveSkills } from './skillsManager';
import { runAgentStream } from './agent';
import { processUploadedFile } from './docParser';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { shell } from 'electron';

const execAsync = promisify(exec);

let serverInstance: any = null;

export function startLocalServer(port = 3456) {
  if (serverInstance) {
    console.log(`[Codex Agent Server] Already running on port ${port}`);
    return;
  }

  const app = new Hono();

  app.use('*', cors());

  // 1. 获取所有项目工作区与会话列表
  app.get('/api/workspaces', async (c) => {
    try {
      const allWorkspaces = await dbOperations.getWorkspaces();
      const allSessions = await dbOperations.getSessions();
      return c.json({ workspaces: allWorkspaces, sessions: allSessions });
    } catch (err: any) {
      return c.json({ workspaces: [], sessions: [], error: err.message }, 500);
    }
  });

  // 2. 添加/导入新工作区
  app.post('/api/workspaces', async (c) => {
    try {
      const body = await c.req.json();
      const id = crypto.randomUUID();
      await dbOperations.addWorkspace({
        id,
        path: body.path,
        name: body.name
      });
      return c.json({ success: true, id });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 2.1 删除指定工作区及其关联会话
  app.delete('/api/workspaces/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await dbOperations.deleteWorkspace(id);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 2.2 在系统文件管理器中打开指定目录
  app.post('/api/open-folder', async (c) => {
    try {
      const { path: targetPath } = await c.req.json();
      if (targetPath) {
        await shell.openPath(targetPath);
        return c.json({ success: true });
      }
      return c.json({ success: false, error: 'Path is required' }, 400);
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 3. 获取指定项目的 Git 分支
  app.get('/api/git-branch', async (c) => {
    const workspacePath = c.req.query('path');
    if (!workspacePath) return c.json({ branch: 'main' });
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
      return c.json({ branch: stdout.trim() || 'main' });
    } catch {
      return c.json({ branch: 'main' });
    }
  });

  // 4. 保存会话数据
  app.post('/api/sessions', async (c) => {
    try {
      const { id, workspacePath, title, messages } = await c.req.json();
      const sessionId = id || crypto.randomUUID();
      await dbOperations.saveSession({
        id: sessionId,
        workspacePath,
        title: title || '新会话',
        messages
      });
      return c.json({ success: true, id: sessionId });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 4.1 删除指定会话
  app.delete('/api/sessions/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await dbOperations.deleteSession(id);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 4.2 上传附件并智能解析 (图片、Word、PDF、Excel、代码文本等)
  app.post('/api/upload', async (c) => {
    try {
      const body = await c.req.json();
      const workspacePath = body.workspacePath || process.cwd();
      const files: { name: string; type: string; base64: string }[] = body.files || [];
      const attachments = [];

      for (const file of files) {
        const processed = await processUploadedFile(workspacePath, file);
        attachments.push(processed);
      }

      return c.json({ success: true, attachments });
    } catch (err: any) {
      console.error('[Upload Error]:', err);
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 5. 获取/保存自定义模型及配置
  app.get('/api/config', (c) => c.json(loadConfig()));
  app.post('/api/config', async (c) => {
    const body = await c.req.json();
    saveConfig(body);
    return c.json({ success: true });
  });

  // 5.1 获取/保存插件与 MCP 配置
  app.get('/api/plugins', (c) => c.json(getPluginsConfig()));
  app.post('/api/plugins', async (c) => {
    const body = await c.req.json();
    savePluginsConfig(body);
    return c.json({ success: true });
  });

  // 5.2 获取/保存技能中心配置 (Skills SOP)
  app.get('/api/skills', (c) => c.json(getSkills()));
  app.post('/api/skills', async (c) => {
    const body = await c.req.json();
    saveSkills(body);
    return c.json({ success: true });
  });

  // 6. Agent 核心流式对话
  app.post('/api/chat', async (c) => {
    const body = await c.req.json();
    return runAgentStream({
      messages: body.messages,
      workspacePath: body.workspacePath,
      modelId: body.modelId,
      autoExecute: body.autoExecute ?? true
    });
  });

  try {
    serverInstance = serve({ fetch: app.fetch, port });
    if (serverInstance && typeof serverInstance.on === 'function') {
      serverInstance.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Codex Agent Server] Port ${port} is already in use by another process or existing instance.`);
        } else {
          console.error('[Codex Agent Server] HTTP server error:', err);
        }
      });
    }
    console.log(`[Codex Agent Server] Running at http://localhost:${port}`);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Codex Agent Server] Port ${port} is already in use, reusing existing server`);
    } else {
      console.error('[Codex Agent Server] Error:', err);
    }
  }
}

export function stopLocalServer() {
  if (serverInstance && typeof serverInstance.close === 'function') {
    try {
      serverInstance.close();
      console.log('[Codex Agent Server] Successfully closed local server');
    } catch (err) {
      console.error('[Codex Agent Server] Error closing server:', err);
    }
    serverInstance = null;
  }
}

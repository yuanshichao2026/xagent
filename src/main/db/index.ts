import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface WorkspaceItem {
  id: string;
  path: string;
  name: string;
  createdAt: number;
}

export interface SessionItem {
  id: string;
  workspacePath: string;
  title: string;
  messagesJson: string;
  updatedAt: number;
}

const userDataPath = app ? app.getPath('userData') : process.cwd();
const dbPath = path.join(userDataPath, 'codex.db');

let dbInstance: SqlJsDatabase | null = null;

/**
 * 解析 sql.js 的 wasm 文件位置，兼容开发态与 asar 打包态。
 */
function resolveWasmPath(fileName: string): string {
  const candidates: string[] = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'sql-wasm.wasm'));
  candidates.push(path.join(__dirname, '../../node_modules/sql.js/dist', fileName));
  candidates.push(path.join(__dirname, '../../../node_modules/sql.js/dist', fileName));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return path.join(__dirname, '../../node_modules/sql.js/dist', fileName);
}

// 初始化 SQLite 数据库
export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: (file: string) => resolveWasmPath(file)
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // 建表
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_path TEXT NOT NULL,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  saveDb();
  return dbInstance;
}

// 自动持久化到本地 codex.db 文件
export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// 数据库交互层
export const dbOperations = {
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const db = await getDb();
    const res = db.exec('SELECT id, path, name, created_at FROM workspaces ORDER BY created_at DESC');
    if (res.length === 0) return [];
    return res[0].values.map((row) => ({
      id: row[0] as string,
      path: row[1] as string,
      name: row[2] as string,
      createdAt: row[3] as number
    }));
  },

  async addWorkspace(workspace: { id: string; path: string; name: string }): Promise<void> {
    const db = await getDb();
    db.run(
      'INSERT OR IGNORE INTO workspaces (id, path, name, created_at) VALUES (?, ?, ?, ?)',
      [workspace.id, workspace.path, workspace.name, Date.now()]
    );
    saveDb();
  },

  async getSessions(): Promise<SessionItem[]> {
    const db = await getDb();
    const res = db.exec('SELECT id, workspace_path, title, messages_json, updated_at FROM sessions ORDER BY updated_at DESC');
    if (res.length === 0) return [];
    return res[0].values.map((row) => ({
      id: row[0] as string,
      workspacePath: row[1] as string,
      title: row[2] as string,
      messagesJson: row[3] as string,
      updatedAt: row[4] as number
    }));
  },

  async saveSession(session: { id: string; workspacePath: string; title: string; messages: any[] }): Promise<void> {
    const db = await getDb();
    const messagesJson = JSON.stringify(session.messages);
    const now = Date.now();
    const check = db.exec('SELECT id FROM sessions WHERE id = ?', [session.id]);
    if (check.length > 0 && check[0].values.length > 0) {
      db.run(
        'UPDATE sessions SET messages_json = ?, updated_at = ? WHERE id = ?',
        [messagesJson, now, session.id]
      );
    } else {
      db.run(
        'INSERT INTO sessions (id, workspace_path, title, messages_json, updated_at) VALUES (?, ?, ?, ?, ?)',
        [session.id, session.workspacePath, session.title, messagesJson, now]
      );
    }
    saveDb();
  },

  async deleteWorkspace(id: string): Promise<void> {
    const db = await getDb();
    const res = db.exec('SELECT path FROM workspaces WHERE id = ?', [id]);
    if (res.length > 0 && res[0].values.length > 0) {
      const wsPath = res[0].values[0][0] as string;
      db.run('DELETE FROM sessions WHERE workspace_path = ?', [wsPath]);
    }
    db.run('DELETE FROM workspaces WHERE id = ?', [id]);
    saveDb();
  },

  async deleteSession(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM sessions WHERE id = ?', [id]);
    saveDb();
  }
};

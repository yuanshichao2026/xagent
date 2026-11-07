import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { getSkills, saveSkills } from './skillsManager';

const execAsync = promisify(exec);

export const createAgentTools = (workspacePath: string) => {
  const resolveSafe = (relPath: string) => {
    const full = path.resolve(workspacePath, relPath);
    if (!full.startsWith(workspacePath)) {
      throw new Error(`越界访问禁止: 路径 ${relPath} 超出当前工作空间`);
    }
    return full;
  };

  // 递归扫描文件辅助函数（支持通配与忽略）
  const scanDirectoryRecursive = async (dir: string, baseDir: string, ignoreList: Set<string>): Promise<string[]> => {
    let results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreList.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          const sub = await scanDirectoryRecursive(fullPath, baseDir, ignoreList);
          results = results.concat(sub);
        } else {
          results.push(relPath);
        }
      }
    } catch {
      // 忽略无法访问的目录
    }
    return results;
  };

  // 创建 PTC 内部沙箱 SDK tools 对象
  const createSandboxTools = () => {
    const defaultIgnore = new Set(['.git', 'node_modules', 'dist', '.next', 'out', 'build', '.DS_Store', '.vscode']);

    return {
      glob: async (args: { pattern: string; cwd?: string }): Promise<string[]> => {
        const targetCwd = args.cwd ? resolveSafe(args.cwd) : workspacePath;
        const allFiles = await scanDirectoryRecursive(targetCwd, targetCwd, defaultIgnore);
        const rawPattern = args.pattern || '*';
        // 将通配符转换为正则
        const regexStr = '^' + rawPattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '.*')
          .replace(/(?<!\.)\*/g, '[^/]*')
          .replace(/\?/g, '[^/]') + '$';
        const regex = new RegExp(regexStr);
        return allFiles.filter(f => regex.test(f));
      },

      grep: async (args: { pattern: string; path?: string; globs?: string[] }): Promise<Array<{ file: string; line: number; text: string }>> => {
        const matches: Array<{ file: string; line: number; text: string }> = [];
        let fileList: string[] = [];
        if (args.path) {
          const target = resolveSafe(args.path);
          const stat = await fs.stat(target);
          if (stat.isFile()) {
            fileList = [path.relative(workspacePath, target).replace(/\\/g, '/')];
          } else {
            fileList = await scanDirectoryRecursive(target, workspacePath, defaultIgnore);
          }
        } else if (args.globs && args.globs.length > 0) {
          const all = await scanDirectoryRecursive(workspacePath, workspacePath, defaultIgnore);
          fileList = all.filter(f => args.globs!.some(g => {
            const r = new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/(?<!\.)\*/g, '[^/]*') + '$');
            return r.test(f);
          }));
        } else {
          fileList = await scanDirectoryRecursive(workspacePath, workspacePath, defaultIgnore);
        }

        const regex = new RegExp(args.pattern, 'i');
        for (const relFile of fileList) {
          if (matches.length >= 200) break; // 保护上限
          try {
            const content = await fs.readFile(path.resolve(workspacePath, relFile), 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  file: relFile,
                  line: i + 1,
                  text: lines[i].trim().slice(0, 300)
                });
                if (matches.length >= 200) break;
              }
            }
          } catch {
            // 跳过无法读取的文件
          }
        }
        return matches;
      },

      read_file: async (args: { path: string; startLine?: number; endLine?: number }): Promise<string> => {
        const target = resolveSafe(args.path);
        const raw = await fs.readFile(target, 'utf-8');
        const lines = raw.split('\n');
        const start = Math.max(1, args.startLine || 1);
        const end = Math.min(lines.length, args.endLine || lines.length);
        const slice = lines.slice(start - 1, end);
        return slice.map((line, idx) => `${start + idx}: ${line}`).join('\n');
      },

      edit_file: async (args: { path: string; edits: Array<{ oldText: string; newText: string }> }): Promise<{ success: boolean; diff?: string }> => {
        const target = resolveSafe(args.path);
        let content = await fs.readFile(target, 'utf-8');
        let changeCount = 0;
        for (const edit of args.edits) {
          if (!content.includes(edit.oldText)) {
            throw new Error(`edit_file 匹配失败: 文件 ${args.path} 中未找到指定的待替换文本块:\n"${edit.oldText.slice(0, 100)}..."`);
          }
          content = content.replace(edit.oldText, edit.newText);
          changeCount++;
        }
        await fs.writeFile(target, content, 'utf-8');
        return { success: true, diff: `成功执行 ${changeCount} 处文本替换` };
      },

      write_file: async (args: { path: string; content: string }): Promise<{ success: boolean }> => {
        const target = resolveSafe(args.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, args.content, 'utf-8');
        return { success: true };
      },

      bash: async (args: { command: string; cwd?: string; timeoutMs?: number }): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
        const execCwd = args.cwd ? resolveSafe(args.cwd) : workspacePath;
        try {
          const { stdout, stderr } = await execAsync(args.command, {
            cwd: execCwd,
            timeout: args.timeoutMs || 30000
          });
          return { exitCode: 0, stdout: stdout.trim(), stderr: stderr.trim() };
        } catch (err: any) {
          return {
            exitCode: err.code || 1,
            stdout: (err.stdout || '').trim(),
            stderr: (err.stderr || err.message || '').trim()
          };
        }
      }
    };
  };

  return {
    // ══════════════════════════════════════════════════════════════════
    // PTC（程序化工具调用）核心执行引擎沙箱
    // ══════════════════════════════════════════════════════════════════
    run_code: tool({
      description: '在沙箱环境中执行异步 TypeScript 脚本，可通过内置全局 tools SDK（glob, grep, read_file, edit_file, write_file, bash）批量并发完成代码探查、修改与验证。',
      parameters: z.object({
        code: z.string().describe('待执行的异步 TypeScript/JavaScript 脚本代码块')
      }),
      execute: async ({ code }) => {
        const sandboxTools = createSandboxTools();
        const logs: string[] = [];
        const customConsole = {
          log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          info: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
        };

        try {
          // 动态转译 TypeScript 剥离类型并在沙箱函数作用域内执行
          let runner: (t: any, c: any) => Promise<any>;
          try {
            const esbuild = require('esbuild');
            const wrapped = `async function __ptc_entry__(tools, console) {\n${code}\n}`;
            const transformed = esbuild.transformSync(wrapped, {
              loader: 'ts',
              target: 'node18'
            });
            runner = new Function(`
              ${transformed.code}
              return __ptc_entry__;
            `)();
          } catch {
            // 若 esbuild 失败，进行兜底轻量正则剥离
            const cleanCode = code.replace(/:\s*([A-Za-z0-9_<>\[\]]+)/g, '');
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            runner = new AsyncFunction('tools', 'console', cleanCode);
          }

          const rawResult = await runner(sandboxTools, customConsole);

          // 组织输出并执行沙箱内 ETL 保护（行数控制在 80 行以内）
          let resultSummary = '';
          if (rawResult !== undefined) {
            resultSummary = typeof rawResult === 'object' ? JSON.stringify(rawResult, null, 2) : String(rawResult);
          }
          if (logs.length > 0) {
            resultSummary = (logs.join('\n') + (resultSummary ? '\n\n[返回值]:\n' + resultSummary : '')).trim();
          }
          if (!resultSummary) {
            resultSummary = '代码执行完毕，无输出返回值。';
          }

          const lines = resultSummary.split('\n');
          if (lines.length > 80) {
            resultSummary = [
              ...lines.slice(0, 40),
              `\n... [已自动精炼截断，省略中间 ${lines.length - 80} 行日志以保护上下文] ...\n`,
              ...lines.slice(-40)
            ].join('\n');
          }

          return {
            success: true,
            output: resultSummary
          };
        } catch (err: any) {
          return {
            success: false,
            error: `PTC 沙箱执行异常: ${err.message}`,
            stack: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined,
            logs: logs.length > 0 ? logs.slice(-10).join('\n') : undefined
          };
        }
      }
    }),
    list_files: tool({
      description: '扫描当前项目工作空间目录结构树（自动过滤 .git, node_modules, dist 等）',
      parameters: z.object({
        subDir: z.string().optional().describe('子目录相对路径，默认为工作区根目录')
      }),
      execute: async ({ subDir = '' }) => {
        const targetDir = resolveSafe(subDir);
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const ignored = new Set(['.git', 'node_modules', 'dist', '.next', 'out', 'build', '.DS_Store']);
        const items = entries
          .filter((e) => !ignored.has(e.name))
          .map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory()
          }));
        return { path: subDir || '.', items };
      }
    }),

    read_file: tool({
      description: '读取工作空间内指定文件的内容（超过1000行会自动截断以防卡顿）',
      parameters: z.object({
        filePath: z.string().describe('文件相对路径')
      }),
      execute: async ({ filePath }) => {
        try {
          const target = resolveSafe(filePath);
          const raw = await fs.readFile(target, 'utf-8');
          // 防止大文件塞爆 LLM 上下文
          const lines = raw.split('\n');
          if (lines.length > 500) {
            return {
              filePath,
              totalLines: lines.length,
              content: lines.slice(0, 500).join('\n') + `\n\n... [后 ${lines.length - 500} 行已省略] ...`
            };
          }
          return { filePath, totalLines: lines.length, content: raw };
        } catch (err: any) {
          return { filePath, error: `读取失败: ${err.message}` };
        }
      }
    }),

    write_file: tool({
      description: '在工作空间内创建新文件、生成文档或写入代码（自动递归创建父目录）',
      parameters: z.object({
        filePath: z.string().describe('文件相对路径'),
        content: z.string().describe('文件完整文本内容')
      }),
      execute: async ({ filePath, content }) => {
        const target = resolveSafe(filePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content, 'utf-8');
        return { success: true, filePath, bytesWritten: Buffer.byteLength(content) };
      }
    }),

    edit_file: tool({
      description: '在原代码文件中进行精准局部修改（查找 searchBlock 精确匹配并替换为 replaceBlock）',
      parameters: z.object({
        filePath: z.string().describe('文件相对路径'),
        searchBlock: z.string().describe('待替换的原代码块（必须在原文件中精准存在）'),
        replaceBlock: z.string().describe('替换后的新代码块')
      }),
      execute: async ({ filePath, searchBlock, replaceBlock }) => {
        const target = resolveSafe(filePath);
        const original = await fs.readFile(target, 'utf-8');
        if (!original.includes(searchBlock)) {
          return { success: false, error: '原文件中未定位到匹配的 searchBlock 内容，请先重新使用 read_file 确认文件实际内容' };
        }
        const updated = original.replace(searchBlock, replaceBlock);
        await fs.writeFile(target, updated, 'utf-8');
        return { success: true, filePath, message: '局部代码已精准替换成功' };
      }
    }),

    web_search: tool({
      description: '联网搜索技术文档、最新 API 规范与实时资讯',
      parameters: z.object({
        query: z.string().describe('搜索关键词或问题')
      }),
      execute: async ({ query }) => {
        try {
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          const html = await res.text();
          const cleanText = html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 2000);
          return { query, resultSnippet: cleanText };
        } catch (err: any) {
          return { query, error: `联网搜索失败: ${err.message}` };
        }
      }
    }),

    run_command: tool({
      description: '在当前项目工作目录根节点执行系统 Shell 终端命令（npm, git, python 等）',
      parameters: z.object({
        command: z.string().describe('命令行字符串')
      }),
      execute: async ({ command }) => {
        try {
          const { stdout, stderr } = await execAsync(command, { cwd: workspacePath, timeout: 60000 });
          return { success: true, command, stdout, stderr };
        } catch (err: any) {
          return { success: false, command, stdout: err.stdout, stderr: err.stderr || err.message };
        }
      }
    }),

    // Codex 原生风格 TODO 规划与执行追踪工具
    manage_todolist: tool({
      description: '创建或动态更新任务执行规划清单（Todo List）。在面对复杂任务时，智能体通过此工具规划步骤，并实时将每步标记为 in_progress 或 completed。',
      parameters: z.object({
        planTitle: z.string().optional().describe('任务整体计划名称，如"合肥天气分析与 Word 报告生成任务"'),
        tasks: z.array(z.object({
          id: z.string().optional().describe('任务唯一标识，如 "step-1"'),
          title: z.string().optional().describe('任务名称，如 "生成专业排版 Word 报告"'),
          status: z.string().optional().describe('任务执行状态: pending | in_progress | completed，若省略默认为 pending')
        })).optional().describe('当前任务项列表')
      }),
      execute: async (rawArgs: any) => {
        const planTitle = rawArgs.planTitle || rawArgs.title || rawArgs.plan_title || '任务规划执行清单';
        const rawTasks = rawArgs.tasks || rawArgs.todoList || rawArgs.steps || [];
        const normalizedTasks = rawTasks.map((t: any, index: number) => {
          const rawStatus = String(t.status || t.state || 'pending').toLowerCase().trim();
          let status: 'pending' | 'in_progress' | 'completed' = 'pending';
          if (['completed', 'done', 'finished', 'complete', 'success', '已完成'].includes(rawStatus)) {
            status = 'completed';
          } else if (['in_progress', 'doing', 'running', 'active', 'processing', '进行中'].includes(rawStatus)) {
            status = 'in_progress';
          }
          return {
            id: t.id || `step-${index + 1}`,
            title: t.title || t.name || t.desc || `步骤 ${index + 1}`,
            status
          };
        });

        return {
          success: true,
          planTitle,
          tasks: normalizedTasks,
          timestamp: Date.now()
        };
      }
    }),

    // 在对话中直接创建并沉淀新技能 (Skill SOP)
    create_skill: tool({
      description: '为当前系统新建并持久化保存一个专属业务技能（Skill SOP）。当用户要求在对话中新建技能、提炼技能、或者把当前的作业流程沉淀为新技能时调用此工具。创建后会自动加入技能库并立即生效。',
      parameters: z.object({
        name: z.string().describe('技能名称，例如 "学术论文中英文润色技能" 或 "Python 安全审计技能"'),
        description: z.string().optional().describe('触发场景说明，例如 "当用户要求润色论文、调整学术表达与参考文献格式时激活"'),
        category: z.string().optional().describe('业务分类: 研发效能 | 数据分析 | 文档法务 | 工程规范 | 自定义技能'),
        tags: z.array(z.string()).optional().describe('标签数组，如 ["论文", "润色", "学术"]'),
        promptWorkflow: z.string().describe('专业的标准作业规程（SOP）Markdown 内容，包含具体的分步执行准则、注意事项与交付规范')
      }),
      execute: async ({ name, description, category, tags, promptWorkflow }) => {
        try {
          const allSkills = getSkills();
          const validCats = ['研发效能', '数据分析', '文档法务', '工程规范', '自定义技能'];
          const finalCat = (category && validCats.includes(category)) ? (category as any) : '自定义技能';
          const newSkill = {
            id: `custom-skill-${Date.now()}`,
            name,
            description: description || '用户自建业务工作流规程',
            category: finalCat,
            tags: Array.isArray(tags) ? tags : ['自定义'],
            promptWorkflow,
            enabled: true,
            isBuiltin: false
          };
          saveSkills([...allSkills, newSkill]);
          return {
            success: true,
            message: `业务技能《${name}》已成功持久化保存至技能中心，并已立即生效激活！`,
            skill: newSkill
          };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }
    })
  };
};

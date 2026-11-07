import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { tool, jsonSchema } from 'ai';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface BuiltinPlugin {
  id: string;
  name: string;
  description: string;
  badge?: string;
  iconName: string;
  enabled: boolean;
  category: 'core' | 'experiment';
}

export interface McpPlugin {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  isPopular?: boolean;
  category?: string;
}

export interface PluginsConfig {
  builtinPlugins: BuiltinPlugin[];
  mcpPlugins: McpPlugin[];
}

const pluginsFilePath = path.join(
  app ? app.getPath('userData') : process.cwd(),
  'plugins.json'
);

const defaultBuiltinPlugins: BuiltinPlugin[] = [
  {
    id: 'ptc_execution',
    name: 'PTC 极速代码执行引擎',
    description: '采用 PTC（程序化工具调用）架构与零计划税协议，AI 单工具 run_code 批量并发探查与修改，最少轮次极速解决问题。',
    badge: '极速核心',
    iconName: 'Zap',
    enabled: true,
    category: 'core'
  },
  {
    id: 'web_search',
    name: '联网检索增强',
    description: '接入实时互联网搜索，在大模型遇到未知知识或最新时事时自动查询并给出可靠信源。',
    badge: '官方核心',
    iconName: 'Globe',
    enabled: true,
    category: 'core'
  },
  {
    id: 'manage_todolist',
    name: '深度任务规划看板 (传统分步模式)',
    description: '遇到复杂多步骤任务时，自动拆解步骤为可视化 Todo 待办列表，并在完成时实时自动收敛。',
    badge: '官方核心',
    iconName: 'CheckSquare',
    enabled: false,
    category: 'core'
  },
  {
    id: 'auto_auth',
    name: '自动授权与安全审查',
    description: '启用安全审查模式，在执行本地文件覆写、外部大命令前由安全策略或模型进行权限预判。',
    badge: '实验性',
    iconName: 'ShieldCheck',
    enabled: false,
    category: 'experiment'
  },
  {
    id: 'terminal_guard',
    name: '终端沙箱与超时防护',
    description: '限制本地命令单条最长执行时间（默认30秒），防止死循环命令或大量未捕获进程卡死。',
    badge: '安全增强',
    iconName: 'Terminal',
    enabled: true,
    category: 'core'
  },
  {
    id: 'voice_input',
    name: '智能语音输入与播报',
    description: '支持点击麦克风通过语音提问，并允许大模型在回答完毕后提供语音摘要合成播报。',
    badge: '实验性',
    iconName: 'Mic',
    enabled: false,
    category: 'experiment'
  }
];

const defaultMcpPlugins: McpPlugin[] = [
  {
    id: 'mcp-time',
    name: 'Time 时间与时区助手',
    description: '标准时间 MCP 服务。查询全球各大时区的当前实时时间与精准时间戳。',
    command: 'npx',
    args: ['-y', '@guanxiong/mcp-server-time'],
    env: {},
    enabled: true,
    isPopular: true,
    category: '常用工具'
  },
  {
    id: 'mcp-memory',
    name: 'Memory 知识图谱记忆库',
    description: 'Anthropic 官方知识图谱记忆服务，跨会话持久化存储实体与关系记忆。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    enabled: false,
    isPopular: true,
    category: '智能增强'
  },
  {
    id: 'mcp-github',
    name: 'GitHub Assistant',
    description: 'GitHub 官方标准 MCP 服务。支持查询代码仓库、管理 PR、审查 Issue、提取变更等。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    enabled: false,
    isPopular: true,
    category: '开发工具'
  },
  {
    id: 'mcp-sqlite',
    name: 'SQLite Explorer',
    description: '连接本地任意 SQLite 数据库文件，允许大模型直接运行 SQL 查询、生成报表与模式校验。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', 'data.db'],
    env: {},
    enabled: false,
    isPopular: true,
    category: '数据与存储'
  },
  {
    id: 'mcp-fetch',
    name: 'Web Content Fetcher',
    description: '抓取任意网页并将其完整 HTML 清洗提炼为结构化 Markdown 文本，便于深度研读。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    env: {},
    enabled: false,
    isPopular: true,
    category: '网络与搜索'
  },
  {
    id: 'mcp-filesystem',
    name: 'Extended Filesystem',
    description: '标准文件系统 MCP 插件，为大模型提供跨目录的文件系统深度探测与批量分析。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:\\'],
    env: {},
    enabled: false,
    isPopular: true,
    category: '系统工具'
  }
];

// 加载全部插件配置
export function getPluginsConfig(): PluginsConfig {
  try {
    if (fs.existsSync(pluginsFilePath)) {
      const content = fs.readFileSync(pluginsFilePath, 'utf-8');
      const data = JSON.parse(content);
      
      // 合并保证默认内置项不丢失
      const existingBuiltinIds = new Set((data.builtinPlugins || []).map((b: any) => b.id));
      const mergedBuiltin = [
        ...(data.builtinPlugins || []),
        ...defaultBuiltinPlugins.filter(d => !existingBuiltinIds.has(d.id))
      ];

      const existingMcpIds = new Set((data.mcpPlugins || []).map((m: any) => m.id));
      const mergedMcp = [
        ...(data.mcpPlugins || []),
        ...defaultMcpPlugins.filter(d => !existingMcpIds.has(d.id))
      ];

      return {
        builtinPlugins: mergedBuiltin,
        mcpPlugins: mergedMcp
      };
    }
  } catch (e) {
    console.error('读取 plugins.json 失败，使用出厂配置:', e);
  }

  return {
    builtinPlugins: defaultBuiltinPlugins,
    mcpPlugins: defaultMcpPlugins
  };
}

// 保存插件配置
export function savePluginsConfig(config: PluginsConfig): void {
  try {
    fs.writeFileSync(pluginsFilePath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存 plugins.json 失败:', e);
  }
}

// 检查特定内置插件是否开启
export function isBuiltinPluginEnabled(pluginId: string): boolean {
  const config = getPluginsConfig();
  const found = config.builtinPlugins.find(p => p.id === pluginId);
  return found ? found.enabled : true;
}

// 活动的 MCP 客户端连接池缓存
const activeMcpClients: Map<string, { client: Client; transport: StdioClientTransport }> = new Map();

// 动态获取所有已开启的 MCP 扩展工具
export async function getActiveMcpTools(): Promise<{ tools: Record<string, any>; activeNames: string[] }> {
  const config = getPluginsConfig();
  const enabledMcpList = config.mcpPlugins.filter(p => p.enabled);
  const mcpTools: Record<string, any> = {};
  const activeNames: string[] = [];

  for (const p of enabledMcpList) {
    try {
      let connection = activeMcpClients.get(p.id);
      if (!connection) {
        // 创建安全环境变量
        const mergedEnv = {
          ...process.env,
          ...p.env
        } as Record<string, string>;

        const transport = new StdioClientTransport({
          command: p.command,
          args: p.args,
          env: mergedEnv
        });

        const client = new Client(
          { name: 'XAgent-Desktop-Client', version: '1.0.0' },
          { capabilities: {} }
        );

        // 设置 25 秒连接超时（兼容初次通过 npx 启动与环境拉取耗时）
        const connectPromise = client.connect(transport);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('MCP 连接超时')), 25000)
        );
        await Promise.race([connectPromise, timeoutPromise]);

        connection = { client, transport };
        activeMcpClients.set(p.id, connection);
      }

      const client = connection.client;
      const toolListResult = await client.listTools();
      console.log(`[MCP Plugin] 已成功挂载 "${p.name}", 工具列表:`, toolListResult?.tools?.map(t => t.name));

      if (toolListResult?.tools) {
        for (const t of toolListResult.tools) {
          const cleanName = t.name.replace(/[^a-zA-Z0-9_]/g, '_');
          const toolKey = `mcp_${cleanName}`;
          
          mcpTools[toolKey] = tool({
            description: `[MCP插件: ${p.name}] ${t.description || t.name}`,
            parameters: t.inputSchema ? jsonSchema(t.inputSchema as any) : z.record(z.any()),
            execute: async (args) => {
              try {
                const res = await client.callTool({
                  name: t.name,
                  arguments: args
                });
                return res;
              } catch (err: any) {
                return { error: `MCP 工具调用失败: ${err.message}` };
              }
            }
          });
        }
        activeNames.push(`${p.name} (含工具: ${toolListResult.tools.map(t => t.name).join(', ')})`);
      }
    } catch (err: any) {
      console.warn(`[MCP Plugin] 启动/连接 MCP 服务 "${p.name}" 异常:`, err.message);
      // 清理失败的连接
      activeMcpClients.delete(p.id);
    }
  }

  return { tools: mcpTools, activeNames };
}

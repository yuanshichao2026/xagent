import { streamText, createDataStreamResponse } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAgentTools } from './tools';
import { loadConfig } from '../config';
import { isBuiltinPluginEnabled, getActiveMcpTools } from './pluginManager';
import { getActiveSkillsPrompt } from './skillsManager';

export function runAgentStream(req: {
  messages: any[];
  workspacePath: string;
  modelId: string;
  autoExecute: boolean;
}) {
  const config = loadConfig();
  
  // 遍历所有自定义提供商，查找到匹配该 modelId 的提供商配置
  let targetProvider = config.customProviders.find((p) =>
    p.models.some((m) => m.id === req.modelId || m.name === req.modelId)
  );

  if (!targetProvider && config.customProviders.length > 0) {
    targetProvider = config.customProviders[0];
  }

  // 智能解析真实模型名称（优先使用用户填写的真实模型名）
  let actualModel = req.modelId;
  const matchedModel = targetProvider?.models?.find((m) => m.id === req.modelId || m.name === req.modelId);
  if (matchedModel) {
    actualModel = matchedModel.name || matchedModel.id;
  } else if (targetProvider?.models && targetProvider.models.length > 0) {
    // 关键安全兜底：如果请求的模型在当前提供商中不存在，自动回退到该提供商的第一个有效模型
    actualModel = targetProvider.models[0].name || targetProvider.models[0].id;
  }

  // 格式化 Base URL 确保不重复拼接 /v1
  let cleanBaseUrl = (targetProvider?.baseUrl || 'https://api.openai.com/v1').trim();
  if (!cleanBaseUrl.endsWith('/v1') && !cleanBaseUrl.includes('/v1/')) {
    cleanBaseUrl = cleanBaseUrl.replace(/\/+$/, '') + '/v1';
  }

  let modelInstance: any;

  if (targetProvider?.protocol === 'anthropic') {
    const ant = createAnthropic({
      apiKey: targetProvider.apiKey || '',
      baseURL: targetProvider.baseUrl || 'https://api.anthropic.com/v1'
    });
    modelInstance = ant(actualModel);
  } else {
    // 默认 OpenAI 兼容协议（支持 MiniMax, DeepSeek, 硅基流动, Ollama 等）
    const oai = createOpenAI({
      apiKey: targetProvider?.apiKey || 'dummy',
      baseURL: cleanBaseUrl
    });
    modelInstance = oai(actualModel);
  }

  // 过滤清洗历史消息结构，确保符合 Vercel AI SDK 与各模型格式规范，同时增强对多模态图片与各格式文档附件的支持
  const cleanMessages = (req.messages || []).map((m: any) => {
    if (m.role === 'user') {
      let textContent = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '');
      const attachments = m.attachments || [];
      const imageParts: any[] = [];
      let docContext = '';

      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          const isImage = att.type?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(att.ext?.toLowerCase());
          if (isImage && att.dataUrl) {
            imageParts.push({
              type: 'image',
              image: att.dataUrl
            });
          }

          docContext += `\n\n【用户上传附件】: ${att.name}`;
          if (att.savedPath) {
            docContext += `\n- 本地物理保存路径: "${att.savedPath}"`;
          }
          if (att.extractedText) {
            docContext += `\n- 文件提取内容预览:\n${att.extractedText}`;
          }
        }
      }

      const finalText = (textContent + docContext).trim() || '（用户上传了附件）';

      if (imageParts.length > 0) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: finalText },
            ...imageParts
          ]
        };
      }

      return {
        role: 'user',
        content: finalText
      };
    }

    return {
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    };
  });

  const baseTools: Record<string, any> = createAgentTools(req.workspacePath);
  const isPtc = isBuiltinPluginEnabled('ptc_execution');

  if (isPtc) {
    // PTC 模式下：核心工具为 run_code，贯彻零计划税与极速执行
    delete baseTools.manage_todolist;
    if (!isBuiltinPluginEnabled('web_search')) {
      delete baseTools.web_search;
    }
  } else {
    // 传统分步模式
    delete baseTools.run_code;
    if (!isBuiltinPluginEnabled('web_search')) {
      delete baseTools.web_search;
    }
    if (!isBuiltinPluginEnabled('manage_todolist')) {
      delete baseTools.manage_todolist;
    }
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        const { tools: mcpTools, activeNames } = await getActiveMcpTools();
        const combinedTools = { ...baseTools, ...mcpTools };

        const mcpNotice = activeNames.length > 0
          ? `\n【当前已激活的外部 MCP 插件及专用工具】:\n${activeNames.map(n => `- ${n}`).join('\n')}\n*特别原则*: 当用户提出的任务涉及上述已激活的 MCP 工具能力时（如查询时间、读写数据库、抓取网页等），你必须直接优先调用对应的 MCP 专属工具（如 mcp_get_current_time 等）！绝对严禁使用 run_command 编写脚本绕道替代！`
          : '';

        let systemPrompt = '';
        if (isPtc) {
          systemPrompt = [
            '# 角色与极速执行协议',
            '你是一个高并发、无状态的桌面智能体，运行在 **PTC（程序化工具调用）** 架构中。你的唯一目标是：**以最少的对话轮次（Steps）最高效地解决用户问题**。',
            '',
            `当前激活的项目工作空间本地物理路径为: "${req.workspacePath}"。${mcpNotice}${getActiveSkillsPrompt()}`,
            '',
            '你只有一个工具：`run_code`（在沙箱内执行异步 TypeScript 脚本）。',
            '',
            '## 核心铁律（必须绝对遵守）',
            '1. **零计划税（Zero To-Do）**：严禁在回复中输出任何步骤清单、Markdown 任务表或进度打勾列表。',
            '2. **单句意图（One-Sentence Intent）**：在调用 `run_code` 之前，**最多输出 1 句话**（25字以内）说明当前这批代码的批量目标，然后立刻输出代码。',
            '3. **沙箱内 ETL（禁止污染上下文）**：沙箱内存是无限的，主对话历史是昂贵的。严禁直接 `return` 巨型文件或全量日志。必须在代码内用正则、`.filter()`、`.slice()` 提取精炼摘要后再返回（返回内容严格控制在 80 行以内）。',
            '4. **自然终止**：任务一旦完成并通过验证，**立刻停止调用 `run_code`**，直接输出最终结论。',
            '',
            '## PTC 代码编排准则',
            '- **并发读取**：读取多个文件或搜索时，必须使用 `await Promise.all([...])` 并行。',
            '- **本地分支**：不要分多轮对话去试探。在同一个 `run_code` 脚本里用 `if / else / try / catch` 一次性完成“读取 -> 判断 -> 修改 -> 验证”。',
            '- **原子闭环**：只要修改了文件（`edit_file` / `write_file`），必须在**同一个脚本末尾**调用 `tools.bash` 运行类型检查（如 `tsc`）或测试进行验证。',
            '',
            '## 内置全局 tools SDK 声明',
            '无需 import，直接调用 `await tools.<方法>(...)`：',
            '',
            '```typescript',
            'declare namespace tools {',
            '  function glob(args: { pattern: string; cwd?: string }): Promise<string[]>;',
            '  function grep(args: { pattern: string; path?: string; globs?: string[] }): Promise<Array<{ file: string; line: number; text: string }>>;',
            '  function read_file(args: { path: string; startLine?: number; endLine?: number }): Promise<string>;',
            '  function edit_file(args: { path: string; edits: Array<{ oldText: string; newText: string }> }): Promise<{ success: boolean; diff?: string }>;',
            '  function write_file(args: { path: string; content: string }): Promise<{ success: boolean }>;',
            '  function bash(args: { command: string; cwd?: string; timeoutMs?: number }): Promise<{ exitCode: number; stdout: string; stderr: string }>;',
            '}',
            '```',
            '',
            '【强制语言核心要求（绝对严格遵守）】：',
            '1. 必须 100% 全程使用规范、专业的【简体中文】进行思考、分析与输出！',
            '2. 严禁输出任何英文自言自语（严禁出现 "I\'ll start by planning..." 等英文碎碎念）！',
            '3. 当执行与验证完毕后，直接输出排版整洁、条理清晰的最终 Markdown 报告结论与产出说明。',
            '4. 【技能沉淀规程】：若用户明确要求沉淀新技能，调用 create_skill 工具保存至技能中心。'
          ].join('\n');
        } else {
          systemPrompt = [
            '你是一位极具专业素养的高级全栈工程师与编程助手，身处名为 XAgent 的沉浸式桌面客户端中。',
            `当前激活的项目工作空间本地物理路径为: "${req.workspacePath}"。${mcpNotice}${getActiveSkillsPrompt()}`,
            '你有能力调用工具（manage_todolist, list_files, read_file, write_file, edit_file, web_search, run_command, create_skill 及 MCP 工具）直接与本地环境交互。',
            '',
            '【强制语言核心要求（绝对严格遵守）】：',
            '1. 必须 100% 全程使用规范、专业的【简体中文】进行思考、分析与输出！',
            '2. 无论中间思考过程、工具调用前的构思、数据处理分析，还是最终的答复报告，严禁输出任何英文思考过程！',
            '',
            '【思考与工作流规范】：',
            '1. 面对多步或重度任务，第一步优先调用 manage_todolist 列出规划清单；单点任务直接调用工具产出结果。',
            '2. 推导过程精简地包裹在 <think>思考内容</think> 标签中。',
            '3. 按照规划有节奏地推进各个步骤；收尾前调用 manage_todolist 将所有项更新为 completed。',
            '4. 当全部工具调用与验证完成后，停止工具调用，输出正式 Markdown 报告结论！'
          ].join('\n');
        }

        const result = streamText({
          model: modelInstance,
          temperature: 1, // 兼容 Kimi (Moonshot 强制限定温度为 1)、OpenAI、MiniMax、DeepSeek 等
          system: systemPrompt,
          messages: cleanMessages,
          tools: combinedTools,
          maxSteps: Infinity, // 完全解除最大步数限制（无限步数自由执行直至任务彻底收尾）
          onStepFinish: (step) => {
            // 每一步执行完毕后打印跟踪日志
            console.log(`[Agent Step ${step.stepType}] Tool calls:`, step.toolCalls?.map(t => t.toolName) || 'None');
          },
          onError: ({ error }) => {
            console.error('[Agent Stream Error]:', error);
            const rawBody = (error as any)?.responseBody;
            let displayMsg = (error as any)?.message || String(error);
            if (rawBody) {
              try {
                const parsed = JSON.parse(rawBody);
                displayMsg = parsed?.error?.message || rawBody;
              } catch {
                displayMsg = rawBody;
              }
            }
            dataStream.writeMessageAnnotation({
              type: 'error',
              error: displayMsg
            });
            dataStream.write(`0:${JSON.stringify(`\n\n> ⚠️ **调用异常**: ${displayMsg}\n`)}\n`);
          }
        });

        result.mergeIntoDataStream(dataStream);
      } catch (err: any) {
        console.error('[Agent Execute Error]:', err);
        const errMsg = err?.message || String(err);
        dataStream.writeMessageAnnotation({
          type: 'error',
          error: errMsg
        });
        dataStream.write(`0:${JSON.stringify(`\n\n> ⚠️ **调用异常**: ${errMsg}\n`)}\n`);
      }
    }
  });
}

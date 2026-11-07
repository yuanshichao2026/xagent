import React from 'react';
import {
  FileText, FileSpreadsheet, FileImage, File, CheckCircle2,
  Terminal, ChevronRight, Sparkles, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import xagentLogo from '../assets/xagent.png';
import { ChatMessage, Workspace } from '../types';

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  currentWorkspace: Workspace | null;
  onImportFolder: () => void;
  chatContainerRef: React.RefObject<HTMLDivElement>;
}

// 格式化解析不同文件类型的图标
export const renderDocIcon = (ext?: string) => {
  const e = ext?.toLowerCase();
  if (e === '.docx') return <FileText size={16} className="text-blue-400 shrink-0" />;
  if (e === '.pdf') return <FileText size={16} className="text-red-400 shrink-0" />;
  if (['.xlsx', '.xls', '.csv'].includes(e || '')) return <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" />;
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(e || '')) return <FileImage size={16} className="text-purple-400 shrink-0" />;
  return <File size={16} className="text-amber-400 shrink-0" />;
};

// 智能提取大模型思考过程与最终 Markdown 报告
const parseThoughtAndContent = (raw: string) => {
  if (!raw) return { thought: '', content: '' };
  
  // 1. 优先提取显式 <think>...</think> 标签内容
  const thinkMatch = raw.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    const thought = thinkMatch[1].trim();
    const content = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
    return { thought, content };
  }

  // 2. 智能容错：若未包裹 <think>，但开头是大模型在工具执行期间的过渡自白
  const formalSectionMatch = raw.match(/\n\s*([#一二三四五六七八九十\d]+[、. ]|\*{1,2}[#一二三四五六七八九十])/);
  if (formalSectionMatch && formalSectionMatch.index && formalSectionMatch.index > 0) {
    const leadingText = raw.slice(0, formalSectionMatch.index).trim();
    const hasActionClues = /终端|脚本|正在|现在|我先|我改用|核实|排查|读取|扫描|已完成|准备|报错|调试/i.test(leadingText);
    if (hasActionClues && leadingText.length < 400) {
      return {
        thought: leadingText,
        content: raw.slice(formalSectionMatch.index).trim()
      };
    }
  }

  return { thought: '', content: raw };
};

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  loading,
  currentWorkspace,
  onImportFolder,
  chatContainerRef
}) => {
  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 pt-10 pb-48 space-y-6 max-w-4xl mx-auto w-full">
      {messages.length === 0 ? (
        /* 空状态 Welcome 视图 */
        <div className="h-[55vh] flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center mb-6 shadow-2xl p-3.5 group hover:border-[#383838] transition-all">
            <img
              src={xagentLogo}
              alt="XAgent"
              className="w-14 h-14 object-contain drop-shadow-[0_4px_20px_rgba(59,130,246,0.35)] group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-neutral-200">
            你想让 <span className="font-semibold text-white">XAgent</span> 在{' '}
            <span
              onClick={onImportFolder}
              className="underline underline-offset-4 decoration-neutral-600 hover:decoration-white cursor-pointer transition-colors"
            >
              {currentWorkspace?.name || '选择文件夹'}
            </span>{' '}
            中构建什么？
          </h2>
        </div>
      ) : (
        /* 对话流 */
        messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
            <div className={`rounded-xl px-4 py-2.5 max-w-[85%] text-sm ${
              msg.role === 'user'
                ? 'bg-[#1c1c1c] border border-[#2b2b2b] text-white shadow-sm'
                : 'text-neutral-200 w-full'
            }`}>
              {msg.role === 'user' ? (
                <div>
                  {/* 若存在附件，渲染卡片或图片 */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att: any, aIdx: number) => {
                        const isImg = att.type?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(att.ext?.toLowerCase());
                        if (isImg && att.dataUrl) {
                          return (
                            <div key={aIdx} className="rounded-lg overflow-hidden border border-[#383838] max-w-sm bg-black/40">
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="max-h-60 rounded object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => window.open(att.dataUrl, '_blank')}
                                title="点击查看原图"
                              />
                              <div className="px-2 py-1 text-[11px] text-neutral-400 bg-[#161616] truncate">
                                {att.name} ({(att.size / 1024).toFixed(1)} KB)
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={aIdx} className="flex items-center gap-2 bg-[#262626] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 shadow-sm">
                            {renderDocIcon(att.ext)}
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium max-w-[200px] truncate">{att.name}</span>
                              <span className="text-[10px] text-neutral-400">
                                {(att.size / 1024).toFixed(1)} KB {att.savedPath ? '• 已保存至项目' : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              ) : (
                <div className="w-full space-y-3">
                                    
                  {/* 1. Codex 风格 TODO 计划看板组件 (传统模式兼容) */}
                  {(() => {
                    const todoTools = msg.toolInvocations?.filter((t: any) => t.toolName === 'manage_todolist') || [];
                    if (todoTools.length === 0) return null;
                    const latestTodo = todoTools[todoTools.length - 1];
                    if (!latestTodo?.args?.tasks) return null;
                    const { planTitle, tasks } = latestTodo.args;

                    const isFinished = !loading || i < messages.length - 1 || (msg.content && msg.content.trim().length > 0 && (!latestTodo.toolName || latestTodo.result));

                    const rawTasks = Array.isArray(tasks) ? tasks : [];
                    const displayTasks = rawTasks.map((task: any) => {
                      if (isFinished) {
                        return { ...task, status: 'completed' };
                      }
                      return { ...task, status: task.status || 'pending' };
                    });

                    const completedCount = displayTasks.filter((t: any) => t.status === 'completed').length;
                    const allDone = completedCount === displayTasks.length;

                    return (
                      <div className="border border-[#262626] bg-[#141414] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-medium text-neutral-200">
                          <div className="flex items-center gap-2">
                            {allDone ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                            <span>📋 执行规划清单: {planTitle}</span>
                          </div>
                          <span className={`text-[11px] font-mono ${allDone ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}`}>
                            {completedCount} / {displayTasks.length} 已完成
                          </span>
                        </div>
                        <div className="space-y-1.5 pt-0.5">
                          {displayTasks.map((task: any, tIdx: number) => (
                            <div key={task.id || tIdx} className="flex items-center gap-2.5 text-xs px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#242424]">
                              {task.status === 'completed' ? (
                                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                              ) : task.status === 'in_progress' ? (
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-neutral-600 shrink-0" />
                              )}
                              <span className={task.status === 'completed' ? 'text-neutral-300' : 'text-neutral-200'}>
                                {task.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. 聚合可折叠的工具调用区域 */}
                  {msg.toolInvocations && msg.toolInvocations.filter((t: any) => t.toolName !== 'manage_todolist').length > 0 && (
                    <details className="group border border-[#262626] bg-[#141414] rounded-xl overflow-hidden text-xs">
                      <summary className="flex items-center justify-between px-3.5 py-2.5 bg-[#171717] hover:bg-[#1c1c1c] cursor-pointer font-mono select-none transition-colors">
                        <div className="flex items-center gap-2 text-neutral-300">
                          <Terminal size={14} className="text-blue-400" />
                          <span className="font-medium text-neutral-200">
                            已执行 {msg.toolInvocations.length} 项工具调用
                          </span>
                          <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-[#2b2b2b]">
                            {msg.toolInvocations[msg.toolInvocations.length - 1]?.toolName} 等
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-500 group-hover:text-neutral-300 transition-colors">
                          <span className="text-[11px]">展开详情</span>
                          <ChevronRight size={13} className="transition-transform duration-200 group-open:rotate-90" />
                        </div>
                      </summary>

                      <div className="p-3 space-y-2 border-t border-[#222] bg-[#0f0f0f]/80">
                        {msg.toolInvocations.map((t: any, idx: number) => (
                          <details key={idx} className="bg-[#141414] border border-[#222] rounded-lg p-2.5 space-y-2 font-mono">
                            <summary className="flex items-center justify-between cursor-pointer text-neutral-400 hover:text-white">
                              <div className="flex items-center gap-2">
                                <Terminal size={12} className="text-neutral-500" />
                                <span>{idx + 1}. 工具: <strong className="text-neutral-200">{t.toolName}</strong></span>
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                完成
                              </span>
                            </summary>
                            <div className="pt-2 border-t border-[#1f1f1f] space-y-1.5 text-[11px]">
                              <div className="text-neutral-400 break-all">
                                <span className="text-neutral-500">参数: </span>
                                {JSON.stringify(t.args)}
                              </div>
                              {t.result && (
                                <div className="text-emerald-400/90 max-h-48 overflow-y-auto bg-[#0a0a0a] p-2 rounded border border-[#1a1a1a]">
                                  <pre className="whitespace-pre-wrap">{JSON.stringify(t.result, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* 3. 最终产出的 Markdown 答案结果与独立的思考区 */}
                  {(() => {
                    const { thought, content } = parseThoughtAndContent(msg.content);
                    return (
                      <>
                        {thought && (
                          <details className="group border border-[#262626] bg-[#121212] rounded-xl overflow-hidden text-xs">
                            <summary className="flex items-center justify-between px-3.5 py-2 bg-[#161616] hover:bg-[#1a1a1a] cursor-pointer select-none text-neutral-400 font-sans transition-colors">
                              <div className="flex items-center gap-2">
                                <Sparkles size={13} className="text-purple-400" />
                                <span className="font-medium text-neutral-300">思考推理过程</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-neutral-500 group-hover:text-neutral-300 transition-colors">
                                <span className="text-[11px]">展开/收起</span>
                                <ChevronRight size={13} className="transition-transform duration-200 group-open:rotate-90" />
                              </div>
                            </summary>
                            <div className="p-3 text-neutral-300 leading-relaxed font-sans text-xs bg-[#0c0c0c] whitespace-pre-wrap border-t border-[#1f1f1f]">
                              {thought}
                            </div>
                          </details>
                        )}
                        {content && (
                          <div className="markdown-body max-w-none pt-1">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ node, ...props }) => (
                                  <div className="markdown-table-wrapper">
                                    <table {...props} />
                                  </div>
                                )
                              }}
                            >
                              {content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono py-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>XAgent 正在执行思考与本地工具调用...</span>
        </div>
      )}
    </div>
  );
};

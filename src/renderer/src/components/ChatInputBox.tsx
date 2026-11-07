import React, { useState, useRef, useEffect } from 'react';
import {
  Folder, GitBranch, X, Paperclip, Plus,
  ShieldCheck, ShieldAlert, Cpu, Mic, Square, ArrowUp,
  Zap, Sparkles, Tag
} from 'lucide-react';
import { Workspace, Attachment, ModelItem, Skill } from '../types';
import { renderDocIcon } from './ChatMessageList';

interface ChatInputBoxProps {
  currentWorkspace: Workspace | null;
  gitBranch: string;
  onImportFolder: () => void;
  inputPrompt: string;
  setInputPrompt: (v: string) => void;
  pendingAttachments: Attachment[];
  removePendingAttachment: (id: string) => void;
  isUploading: boolean;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploadFiles: (files: FileList | File[]) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  sendMessage: () => void;
  autoExecute: boolean;
  setAutoExecute: (v: boolean) => void;
  models: ModelItem[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  loading: boolean;
  stopGeneration: () => void;
  skills?: Skill[];
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  currentWorkspace,
  gitBranch,
  onImportFolder,
  inputPrompt,
  setInputPrompt,
  pendingAttachments,
  removePendingAttachment,
  isUploading,
  isDragging,
  setIsDragging,
  fileInputRef,
  uploadFiles,
  handlePaste,
  sendMessage,
  autoExecute,
  setAutoExecute,
  models,
  selectedModel,
  onSelectModel,
  loading,
  stopGeneration,
  skills = []
}) => {
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 监控是否输入了 / 开头的斜杠指令
  const isSlashActive = inputPrompt.startsWith('/');
  const slashQuery = isSlashActive ? inputPrompt.slice(1).toLowerCase().trim() : '';
  const filteredSkills = skills.filter(s =>
    s.enabled &&
    (s.name.toLowerCase().includes(slashQuery) ||
     s.category.toLowerCase().includes(slashQuery) ||
     s.tags.some(t => t.toLowerCase().includes(slashQuery)))
  );

  // 保证高亮游标不越界
  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  // 选择某个技能
  const selectSkill = (skill: Skill) => {
    setInputPrompt(`【执行技能：${skill.name}】 `);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-20">
      {/* 上层：环境状态胶囊条 */}
      <div className="flex items-center justify-between mb-2 ml-1 text-xs">
        <div className="flex items-center gap-2">
          <div
            onClick={onImportFolder}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171717] hover:bg-[#202020] border border-[#262626] rounded-full cursor-pointer transition-colors shadow-sm"
          >
            <Folder size={12} className="text-neutral-400" />
            <span className="font-medium text-neutral-200">{currentWorkspace?.name || '未选目录'}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-[#171717] border border-[#262626] rounded-full text-neutral-400 shadow-sm">
            <span>💻 本地</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171717] border border-[#262626] rounded-full text-neutral-400 shadow-sm">
            <GitBranch size={12} className="text-neutral-400" />
            <span>{gitBranch}</span>
          </div>
        </div>

        {/* 快捷斜杠指令小提示 */}
        <div
          onClick={() => {
            setInputPrompt('/');
            textareaRef.current?.focus();
          }}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer transition-colors pr-1"
          title="点击或在输入框输入 / 快捷唤醒技能"
        >
          <Zap size={11} className="text-amber-400" />
          <span>输入 <strong>/</strong> 唤醒技能</span>
        </div>
      </div>

      {/* 斜杠命令快捷弹出悬浮窗 (Slash Command Popover) */}
      {isSlashActive && filteredSkills.length > 0 && (
        <div className="mb-2 p-1.5 bg-[#171717]/95 border border-[#303030] backdrop-blur-md rounded-xl shadow-2xl max-h-56 overflow-y-auto space-y-0.5 animate-in fade-in duration-150">
          <div className="px-2.5 py-1 text-[11px] font-medium text-neutral-400 flex items-center justify-between border-b border-[#242424] mb-1">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Zap size={12} />
              <span>快速唤醒业务技能 (↑↓ 切换，回车确认)</span>
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">ESC 退出</span>
          </div>
          {filteredSkills.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => selectSkill(s)}
              onMouseEnter={() => setSlashIndex(idx)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                slashIndex === idx ? 'bg-blue-600 text-white' : 'hover:bg-[#222] text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={13} className={slashIndex === idx ? 'text-white' : 'text-blue-400'} />
                <span className="font-medium truncate">{s.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                  slashIndex === idx ? 'bg-blue-700/60 border-blue-400 text-white' : 'bg-[#202020] border-[#2d2d2d] text-neutral-400'
                }`}>
                  {s.category}
                </span>
              </div>
              <span className={`text-[11px] max-w-[240px] truncate ml-2 ${
                slashIndex === idx ? 'text-blue-100' : 'text-neutral-500'
              }`}>
                {s.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 下层：主输入舱 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer?.files?.length) {
            uploadFiles(e.dataTransfer.files);
          }
        }}
        className={`relative bg-[#1c1c1c] border rounded-2xl p-3 shadow-2xl transition-all ${
          isDragging ? 'border-blue-500 bg-blue-950/20 shadow-blue-500/10' : 'border-[#262626] focus-within:border-[#383838]'
        }`}
      >
        {/* 拖拽浮层提示 */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-900/30 backdrop-blur-xs rounded-2xl flex items-center justify-center pointer-events-none z-10 border-2 border-dashed border-blue-400">
            <span className="text-xs font-medium text-blue-200">松开鼠标上传图片或文档至当前项目</span>
          </div>
        )}

        {/* 隐藏的系统原生文件选择 input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
          }}
          multiple
          accept="image/*,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.py,.js,.ts,.html,.css"
          style={{ display: 'none' }}
        />

        {/* 待发送附件胶囊预览 */}
        {(pendingAttachments.length > 0 || isUploading) && (
          <div className="flex flex-wrap gap-2 mb-2 px-1 max-h-36 overflow-y-auto">
            {pendingAttachments.map((att) => {
              const isImg = att.type?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(att.ext?.toLowerCase());
              return (
                <div key={att.id} className="group flex items-center gap-2 bg-[#242424] border border-[#333] hover:border-[#444] rounded-lg p-1.5 pr-2 text-xs text-neutral-200 transition-all">
                  {isImg && att.dataUrl ? (
                    <img src={att.dataUrl} alt={att.name} className="w-7 h-7 rounded object-cover border border-[#3a3a3a]" />
                  ) : (
                    <div className="w-7 h-7 rounded bg-[#1a1a1a] flex items-center justify-center">
                      {renderDocIcon(att.ext)}
                    </div>
                  )}
                  <div className="flex flex-col max-w-[140px] min-w-0">
                    <span className="truncate font-medium">{att.name}</span>
                    <span className="text-[10px] text-neutral-400">{(att.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    onClick={() => removePendingAttachment(att.id)}
                    className="text-neutral-500 hover:text-red-400 transition-colors p-0.5 rounded ml-0.5"
                    title="移除附件"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            {isUploading && (
              <div className="flex items-center gap-2 bg-[#222] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-neutral-400">
                <span className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span>正在保存并解析文件...</span>
              </div>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={2}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            // 斜杠菜单键盘上下键与回车监听
            if (isSlashActive && filteredSkills.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex((prev) => (prev + 1) % filteredSkills.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex((prev) => (prev - 1 + filteredSkills.length) % filteredSkills.length);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                selectSkill(filteredSkills[slashIndex]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setInputPrompt('');
                return;
              }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={pendingAttachments.length > 0 ? "输入对上述附件的处理要求（或直接回车发送）..." : "随心输入，或键入 / 唤醒业务技能、直接粘贴/拖入图片与文档..."}
          className="w-full bg-transparent resize-none outline-none text-sm text-neutral-100 placeholder-neutral-500 px-1"
        />

        {/* 控制台底部工具栏 */}
        <div className="flex items-center justify-between pt-2 border-t border-[#262626] mt-2">
          {/* 左侧：附件上传、添加项目、权限开关 */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#242424] hover:bg-[#2e2e2e] text-neutral-300 hover:text-white transition-colors"
              title="上传图片、Word、PDF、Excel 等文件 (支持拖拽/粘贴截图)"
            >
              <Paperclip size={13} className="text-blue-400" />
              <span className="text-[11px] font-medium">附件</span>
            </button>

            <button
              onClick={onImportFolder}
              className="w-7 h-7 rounded-md hover:bg-[#282828] flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              title="导入新项目"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => setAutoExecute(!autoExecute)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                autoExecute ? 'text-amber-500 bg-amber-500/10' : 'text-neutral-400 bg-neutral-800'
              }`}
            >
              {autoExecute ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
              <span>{autoExecute ? '🛡️ 完全访问' : '操作前询问确认'}</span>
            </button>
          </div>

          {/* 右侧：模型选择与发送按钮 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#141414] border border-[#282828] rounded-md px-2 py-1 text-xs text-neutral-300">
              <Cpu size={12} className="text-neutral-400" />
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-xs"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#1c1c1c] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <Mic size={15} className="text-neutral-400 hover:text-white cursor-pointer transition-colors" />

            {loading ? (
              <button
                onClick={stopGeneration}
                className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer animate-pulse hover:animate-none"
                title="终止执行 (Stop)"
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={(!inputPrompt.trim() && pendingAttachments.length === 0) || isUploading}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  (inputPrompt.trim() || pendingAttachments.length > 0) && !isUploading
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                    : 'bg-[#2b2b2b] text-neutral-500 cursor-not-allowed'
                }`}
                title="发送消息"
              >
                <ArrowUp size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

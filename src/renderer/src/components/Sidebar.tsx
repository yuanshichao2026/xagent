import React from 'react';
import {
  Folder, FolderOpen, Plus, ChevronDown, Search, Settings,
  GitPullRequest, Clock, Boxes, HelpCircle, Trash2, Sparkles
} from 'lucide-react';
import xagentLogo from '../assets/xagent.png';
import { Workspace, Session } from '../types';

interface SidebarProps {
  workspaces: Workspace[];
  sessions: Session[];
  currentWorkspace: Workspace | null;
  currentSessionId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onSelectSession: (sess: Session) => void;
  onNewChat: () => void;
  onImportFolder: () => void;
  onTriggerPR: () => void;
  onOpenSettings: () => void;
  onOpenPlugins: () => void;
  onOpenSkills?: () => void;
  skillsCount?: number;
  onOpenWorkspaceFolder?: (e: React.MouseEvent, ws: Workspace) => void;
  onDeleteWorkspace: (e: React.MouseEvent, ws: Workspace) => void;
  onDeleteSession: (e: React.MouseEvent, sess: Session) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  sessions,
  currentWorkspace,
  currentSessionId,
  onSelectWorkspace,
  onSelectSession,
  onNewChat,
  onImportFolder,
  onTriggerPR,
  onOpenSettings,
  onOpenPlugins,
  onOpenSkills,
  skillsCount,
  onOpenWorkspaceFolder,
  onDeleteWorkspace,
  onDeleteSession
}) => {
  return (
    <aside className="w-[250px] bg-[#121212] border-r border-[#262626] flex flex-col justify-between z-10 shrink-0">
      <div>
        {/* 顶部品牌栏 */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-[#1c1c1c]">
          <div className="flex items-center gap-2 font-semibold text-sm cursor-pointer hover:text-white transition-colors">
            <img src={xagentLogo} alt="XAgent" className="w-5 h-5 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]" />
            <span className="font-bold tracking-tight text-white text-[15px]">XAgent</span>
            <ChevronDown size={13} className="text-neutral-400" />
          </div>
          <div className="flex items-center gap-2.5 text-neutral-400">
            <Search size={15} className="cursor-pointer hover:text-white transition-colors" />
            <Settings size={15} className="cursor-pointer hover:text-white transition-colors" onClick={onOpenSettings} />
          </div>
        </div>

        {/* 核心快捷入口 */}
        <div className="p-2 space-y-0.5 text-xs text-neutral-300">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors"
          >
            <span className="font-medium text-white">新对话</span>
            <Plus size={14} />
          </button>
          <button
            onClick={onTriggerPR}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors text-left"
          >
            <GitPullRequest size={14} className="text-neutral-400" />
            <span>Pull Request</span>
          </button>
          <button
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors text-left"
          >
            <Clock size={14} className="text-neutral-400" />
            <span>定时任务</span>
          </button>
          <button
            onClick={onOpenPlugins}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors text-left group"
          >
            <div className="flex items-center gap-2">
              <Boxes size={14} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
              <span>插件中心</span>
            </div>
          </button>
          <button
            onClick={onOpenSkills}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors text-left group"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400 group-hover:text-pink-300 transition-colors" />
              <span className="text-neutral-200 font-medium">业务技能库</span>
            </div>
            {typeof skillsCount === 'number' && skillsCount > 0 && (
              <span className="text-[10px] bg-pink-500/15 text-pink-400 px-1.5 py-0.2 rounded-full border border-pink-500/30 font-mono font-medium">
                {skillsCount}
              </span>
            )}
          </button>
        </div>

        {/* 项目 -> 历史对话二级树状列表 */}
        <div className="px-2 pt-2 border-t border-[#1c1c1c] overflow-y-auto max-h-[calc(100vh-250px)]">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>项目</span>
            <Plus size={13} className="cursor-pointer hover:text-white transition-colors" onClick={onImportFolder} />
          </div>

          {workspaces.map(ws => {
            const wsSessions = sessions.filter(s => s.workspacePath === ws.path);
            const isActive = currentWorkspace?.path === ws.path;

            return (
              <div key={ws.id} className="mb-2">
                <div
                  onClick={() => onSelectWorkspace(ws)}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    isActive ? 'bg-[#1c1c1c] text-white font-medium' : 'text-neutral-400 hover:bg-[#171717] hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0" title={ws.path}>
                    <Folder size={14} className="text-neutral-400 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <button
                      onClick={(e) => onOpenWorkspaceFolder?.(e, ws)}
                      className="opacity-0 group-hover:opacity-100 hover:text-blue-400 p-1 rounded transition-all text-neutral-400 hover:bg-[#262626]"
                      title="打开本地文件夹"
                    >
                      <FolderOpen size={13} />
                    </button>
                    <button
                      onClick={(e) => onDeleteWorkspace(e, ws)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-all text-neutral-400 hover:bg-[#262626]"
                      title="删除项目"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 子级历史对话 */}
                <div className="pl-4 pr-1 mt-0.5 space-y-0.5">
                  {wsSessions.map(sess => (
                    <div
                      key={sess.id}
                      onClick={() => onSelectSession(sess)}
                      className={`group flex items-center justify-between px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                        currentSessionId === sess.id
                          ? 'bg-[#242424] text-white'
                          : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
                      }`}
                    >
                      <span className="truncate flex-1 min-w-0">{sess.title}</span>
                      <button
                        onClick={(e) => onDeleteSession(e, sess)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity shrink-0 ml-1 text-neutral-400 hover:bg-[#2a2a2a]"
                        title="删除对话"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部个人信息栏 */}
      <div className="h-14 border-t border-[#1c1c1c] px-3 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-neutral-800 border border-[#2b2b2b] flex items-center justify-center font-bold text-neutral-300 text-[11px]">
            SY
          </div>
          <span className="font-medium text-neutral-200">shichao yuan</span>
        </div>
        <HelpCircle size={15} className="text-neutral-400 cursor-pointer hover:text-white transition-colors" />
      </div>
    </aside>
  );
};

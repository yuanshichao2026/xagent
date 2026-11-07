import React, { useState, useEffect, useRef } from 'react';
import { Workspace, Session, Attachment, ModelItem, AppConfig, PluginsConfig, Skill } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInputBox } from './components/ChatInputBox';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { PluginCenterModal } from './components/PluginCenterModal';
import { SkillsModal } from './components/SkillsModal';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<{ path: string; name: string } | null>;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
    };
  }
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [gitBranch, setGitBranch] = useState('main');

  // 对话及流式控制
  const [messages, setMessages] = useState<any[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  // 附件上传与拖拽状态
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 底部配置栏及插件配置弹窗
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [autoExecute, setAutoExecute] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  // 插件中心与技能库独立弹窗状态
  const [showPluginModal, setShowPluginModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [pluginsConfig, setPluginsConfig] = useState<PluginsConfig | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 刷新技能库数据
  const refreshSkills = async () => {
    try {
      const skillsRes: Skill[] = await fetch('http://localhost:3456/api/skills').then(r => r.json());
      setSkills(skillsRes || []);
    } catch (e) {
      console.error('刷新技能列表失败:', e);
    }
  };

  // 初始化加载工作区与模型配置
  const loadData = async () => {
    try {
      const wsRes = await fetch('http://localhost:3456/api/workspaces').then(r => r.json());
      setWorkspaces(wsRes.workspaces || []);
      setSessions(wsRes.sessions || []);
      if (wsRes.workspaces?.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(wsRes.workspaces[0]);
      }

      const cfg: AppConfig = await fetch('http://localhost:3456/api/config').then(r => r.json());
      setAppConfig(cfg);

      const plugRes: PluginsConfig = await fetch('http://localhost:3456/api/plugins').then(r => r.json());
      setPluginsConfig(plugRes);

      const skillsRes: Skill[] = await fetch('http://localhost:3456/api/skills').then(r => r.json());
      setSkills(skillsRes || []);
      
      // 聚合提取所有提供商下的模型平铺列表供底部选择
      const flattenedModels: ModelItem[] = [];
      cfg.customProviders?.forEach((p) => {
        p.models?.forEach((m) => {
          const realName = (m.name || m.id || '').trim();
          if (realName) {
            flattenedModels.push({
              id: realName,
              name: `${p.name} - ${realName}`
            });
          }
        });
      });
      setModels(flattenedModels);
      const isDefaultValid = flattenedModels.some(m => m.id === cfg.defaultModelId);
      if (isDefaultValid) {
        setSelectedModel(cfg.defaultModelId);
      } else if (flattenedModels.length > 0) {
        setSelectedModel(flattenedModels[0].id);
      }
    } catch (e) {
      console.error('加载本地服务数据失败:', e);
    }
  };

  useEffect(() => { loadData(); }, []);

  // 保证选中的模型必须在当前可用列表中，防止历史无效残留
  useEffect(() => {
    if (models.length > 0 && (!selectedModel || !models.some(m => m.id === selectedModel))) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  // 当前工作区变化时获取 Git 分支
  useEffect(() => {
    if (currentWorkspace?.path) {
      fetch(`http://localhost:3456/api/git-branch?path=${encodeURIComponent(currentWorkspace.path)}`)
        .then(r => r.json())
        .then(data => setGitBranch(data.branch || 'main'))
        .catch(() => setGitBranch('main'));
    }
  }, [currentWorkspace]);

  // 对话流自动滚底
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // 导入本地项目目录
  const handleImportFolder = async () => {
    if (window.electronAPI?.selectFolder) {
      const folder = await window.electronAPI.selectFolder();
      if (folder) {
        await fetch('http://localhost:3456/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(folder)
        });
        await loadData();
        setCurrentWorkspace(folder as Workspace);
        handleNewChat();
      }
    }
  };

  // 恢复历史会话
  const restoreSession = (sess: Session) => {
    setCurrentSessionId(sess.id);
    const matchedWs = workspaces.find(w => w.path === sess.workspacePath);
    if (matchedWs) setCurrentWorkspace(matchedWs);
    try {
      setMessages(JSON.parse(sess.messagesJson));
    } catch {
      setMessages([]);
    }
  };

  // 终止执行
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  // 开启新对话
  const handleNewChat = () => {
    stopGeneration();
    setCurrentSessionId(null);
    setMessages([]);
    setInputPrompt('');
    setPendingAttachments([]);
  };

  // 移除待发送的附件
  const removePendingAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  // 统一上传文件处理 (图片、Word、PDF、Excel、代码文本等)
  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    let activeWs = currentWorkspace;
    if (!activeWs) {
      if (workspaces.length > 0) {
        activeWs = workspaces[0];
        setCurrentWorkspace(activeWs);
      } else {
        alert('请先导入或选择一个项目工作区后再上传文件');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    const activeWsPath = activeWs.path;

    try {
      const fileDataPromises = Array.from(files).map((file) => {
        return new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type || 'application/octet-stream',
              base64: reader.result as string
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const filePayloads = await Promise.all(fileDataPromises);

      const res = await fetch('http://localhost:3456/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath: activeWsPath,
          files: filePayloads
        })
      }).then(r => r.json());

      if (res.success && Array.isArray(res.attachments)) {
        setPendingAttachments(prev => [...prev, ...res.attachments]);
      }
    } catch (err) {
      console.error('上传文件解析失败:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 支持输入框粘贴图片/文件
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const fileList: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) fileList.push(file);
      }
    }
    if (fileList.length > 0) {
      e.preventDefault();
      uploadFiles(fileList);
    }
  };

  // 在系统文件资源管理器中打开指定项目目录
  const handleOpenWorkspaceFolder = async (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    try {
      if ((window as any).electronAPI?.openPath) {
        await (window as any).electronAPI.openPath(ws.path);
      } else {
        await fetch('http://localhost:3456/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: ws.path })
        });
      }
    } catch (err) {
      console.error('打开目录失败:', err);
    }
  };

  // 删除项目工作区
  const handleDeleteWorkspace = async (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    if (!window.confirm(`确定要移除项目 "${ws.name}" 吗？该项目下的所有对话也将被删除。`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:3456/api/workspaces/${ws.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const remainingWorkspaces = workspaces.filter(w => w.id !== ws.id);
        const remainingSessions = sessions.filter(s => s.workspacePath !== ws.path);
        setWorkspaces(remainingWorkspaces);
        setSessions(remainingSessions);
        if (currentWorkspace?.id === ws.id || currentWorkspace?.path === ws.path) {
          if (remainingWorkspaces.length > 0) {
            setCurrentWorkspace(remainingWorkspaces[0]);
          } else {
            setCurrentWorkspace(null);
          }
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('删除工作区失败:', err);
    }
  };

  // 删除对话
  const handleDeleteSession = async (e: React.MouseEvent, sess: Session) => {
    e.stopPropagation();
    if (!window.confirm(`确定删除对话 "${sess.title}" 吗？`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:3456/api/sessions/${sess.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sess.id));
        if (currentSessionId === sess.id) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('删除会话失败:', err);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if ((!inputPrompt.trim() && pendingAttachments.length === 0) || loading || isUploading) return;

    let activeWorkspace = currentWorkspace;
    if (!activeWorkspace) {
      if (workspaces.length > 0) {
        activeWorkspace = workspaces[0];
        setCurrentWorkspace(activeWorkspace);
      } else {
        alert('请先导入或选择一个项目工作区以开始对话');
        return;
      }
    }

    const userText = inputPrompt.trim();
    const currentAttachments = [...pendingAttachments];
    setInputPrompt('');
    setPendingAttachments([]);

    const userMsg: any = {
      role: 'user',
      content: userText || (currentAttachments.length > 0 ? '请查看并分析上传的文件' : ''),
      attachments: currentAttachments
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let currentFullList: any[] = [];

    try {
      const res = await fetch('http://localhost:3456/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMsgs,
          workspacePath: activeWorkspace.path,
          modelId: selectedModel,
          autoExecute
        })
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const assistantMsg: any = { role: 'assistant', content: '', toolInvocations: [] };
      currentFullList = [...newMsgs, assistantMsg];
      setMessages([...currentFullList]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const textContent = JSON.parse(line.slice(2));
                assistantMsg.content += textContent;
                setMessages([...currentFullList]);
              } catch {}
            } else if (line.startsWith('9:')) {
              try {
                const toolCall = JSON.parse(line.slice(2));
                assistantMsg.toolInvocations.push(toolCall);
                setMessages([...currentFullList]);
              } catch {}
            } else if (line.startsWith('3:')) {
              try {
                const errContent = JSON.parse(line.slice(2));
                if (!assistantMsg.content.includes(errContent) && !assistantMsg.content.includes('调用异常')) {
                  assistantMsg.content += `\n> ⚠️ **调用异常**: ${errContent}`;
                  setMessages([...currentFullList]);
                }
              } catch {}
            }
          }
        }
      }

      // 持久化保存到数据库
      const title = messages.length === 0 ? (userText || currentAttachments[0]?.name || '新会话').slice(0, 24) : undefined;
      const saveRes = await fetch('http://localhost:3456/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentSessionId,
          workspacePath: activeWorkspace.path,
          title: title || '新会话',
          messages: currentFullList
        })
      }).then(r => r.json());

      if (!currentSessionId && saveRes.id) setCurrentSessionId(saveRes.id);
      
      // 局部刷新会话列表
      fetch('http://localhost:3456/api/workspaces')
        .then(r => r.json())
        .then(data => {
          setWorkspaces(data.workspaces || []);
          setSessions(data.sessions || []);
        });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('执行已被用户主动终止');
        if (currentFullList.length > 0) {
          const lastMsg = currentFullList[currentFullList.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = (lastMsg.content ? lastMsg.content + '\n\n' : '') + '> ⏹️ **已终止执行**';
            setMessages([...currentFullList]);
            fetch('http://localhost:3456/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: currentSessionId,
                workspacePath: activeWorkspace.path,
                title: userText ? userText.slice(0, 24) : '已终止会话',
                messages: currentFullList
              })
            }).catch(() => {});
          }
        }
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      refreshSkills();
    }
  };

  // 触发 PR 分析生成
  const triggerPRDoc = () => {
    if (!currentWorkspace) return;
    setInputPrompt('请帮我检查当前项目的 Git 状态与最近的代码变更，并规范生成一份完整的 Pull Request 文档。');
  };

  // 底部模型选择变更
  const handleSelectModel = (val: string) => {
    setSelectedModel(val);
    if (appConfig) {
      const updated = { ...appConfig, defaultModelId: val };
      setAppConfig(updated);
      fetch('http://localhost:3456/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});
    }
  };

  // 保存插件与模型配置
  const saveConfigModal = async () => {
    if (appConfig) {
      const cleanedConfig = {
        ...appConfig,
        customProviders: appConfig.customProviders?.map((p) => ({
          ...p,
          models: p.models?.map((m) => {
            const val = (m.name || m.id || '').trim();
            return { id: val, name: val };
          }).filter((m) => m.name.length > 0)
        }))
      };

      await fetch('http://localhost:3456/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedConfig)
      });
      setShowConfigModal(false);
      loadData();
    }
  };

  // 保存插件与 MCP 配置
  const savePlugins = async (cfg: PluginsConfig) => {
    setPluginsConfig(cfg);
    try {
      await fetch('http://localhost:3456/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
    } catch (e) {
      console.error('保存插件配置失败:', e);
    }
  };

  // 保存技能库配置
  const handleSaveSkills = async (newSkills: Skill[]) => {
    setSkills(newSkills);
    try {
      await fetch('http://localhost:3456/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkills)
      });
    } catch (e) {
      console.error('保存技能库配置失败:', e);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0d0d0d] text-[#ededed] select-none overflow-hidden font-sans">
      {/* 1. 左侧导航与项目会话树 */}
      <Sidebar
        workspaces={workspaces}
        sessions={sessions}
        currentWorkspace={currentWorkspace}
        currentSessionId={currentSessionId}
        onSelectWorkspace={(ws) => { setCurrentWorkspace(ws); handleNewChat(); }}
        onSelectSession={restoreSession}
        onNewChat={handleNewChat}
        onImportFolder={handleImportFolder}
        onTriggerPR={triggerPRDoc}
        onOpenSettings={() => setShowConfigModal(true)}
        onOpenPlugins={() => setShowPluginModal(true)}
        onOpenSkills={() => setShowSkillsModal(true)}
        skillsCount={skills.length}
        onOpenWorkspaceFolder={handleOpenWorkspaceFolder}
        onDeleteWorkspace={handleDeleteWorkspace}
        onDeleteSession={handleDeleteSession}
      />

      {/* 2. 右侧主舞台（纯 Agent 沉浸式交互区） */}
      <main className="flex-1 flex flex-col relative h-full bg-[#0d0d0d] overflow-hidden">
        <ChatMessageList
          messages={messages}
          loading={loading}
          currentWorkspace={currentWorkspace}
          onImportFolder={handleImportFolder}
          chatContainerRef={chatContainerRef}
        />

        <ChatInputBox
          currentWorkspace={currentWorkspace}
          gitBranch={gitBranch}
          onImportFolder={handleImportFolder}
          inputPrompt={inputPrompt}
          setInputPrompt={setInputPrompt}
          pendingAttachments={pendingAttachments}
          removePendingAttachment={removePendingAttachment}
          isUploading={isUploading}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          fileInputRef={fileInputRef}
          uploadFiles={uploadFiles}
          handlePaste={handlePaste}
          sendMessage={sendMessage}
          autoExecute={autoExecute}
          setAutoExecute={setAutoExecute}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          loading={loading}
          stopGeneration={stopGeneration}
          skills={skills}
        />
      </main>

      {/* 3. 模型配置弹窗 */}
      <ModelSettingsModal
        show={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        appConfig={appConfig}
        setAppConfig={setAppConfig}
        onSave={saveConfigModal}
      />

      {/* 4. 插件中心弹窗 (内置插件 + MCP生态) */}
      <PluginCenterModal
        show={showPluginModal}
        onClose={() => setShowPluginModal(false)}
        pluginsConfig={pluginsConfig}
        setPluginsConfig={setPluginsConfig}
        onSave={savePlugins}
      />

      {/* 5. 业务技能库独立弹窗 (Codex Skills SOP 体系) */}
      <SkillsModal
        show={showSkillsModal}
        onClose={() => setShowSkillsModal(false)}
        skills={skills}
        setSkills={setSkills}
        onSaveSkills={handleSaveSkills}
      />
    </div>
  );
}

import React, { useState } from 'react';
import {
  Boxes, X, Globe, CheckSquare, ShieldCheck, Terminal, Mic,
  Search, Plus, Trash2, Cpu, Settings, FolderGit2, Database,
  Compass, Layers, Shield, Wand2, RotateCw
} from 'lucide-react';
import { BuiltinPlugin, McpPlugin, PluginsConfig } from '../types';

interface PluginCenterModalProps {
  show: boolean;
  onClose: () => void;
  pluginsConfig: PluginsConfig | null;
  setPluginsConfig: React.Dispatch<React.SetStateAction<PluginsConfig | null>>;
  onSave: (config: PluginsConfig) => Promise<void>;
}

export const PluginCenterModal: React.FC<PluginCenterModalProps> = ({
  show,
  onClose,
  pluginsConfig,
  setPluginsConfig,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'builtin' | 'mcp'>('builtin');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMcpId, setEditingMcpId] = useState<string | null>(null);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 新增自定义 MCP 表单状态
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpDesc, setNewMcpDesc] = useState('');
  const [newMcpCommand, setNewMcpCommand] = useState('npx');
  const [newMcpArgs, setNewMcpArgs] = useState('-y @modelcontextprotocol/server-...');
  const [newMcpEnvKey, setNewMcpEnvKey] = useState('');
  const [newMcpEnvVal, setNewMcpEnvVal] = useState('');

  // 每次打开弹窗自动刷新插件状态
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const pluginsData = await fetch('http://localhost:3456/api/plugins').then(r => r.json());
      if (pluginsData) setPluginsConfig(pluginsData);
    } catch (e) {
      console.error('刷新插件数据失败:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  React.useEffect(() => {
    if (show) {
      handleRefresh();
    }
  }, [show]);

  if (!show || !pluginsConfig) return null;

  // 格式化渲染内置图标
  const renderPluginIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe': return <Globe size={18} className="text-blue-400" />;
      case 'CheckSquare': return <CheckSquare size={18} className="text-emerald-400" />;
      case 'ShieldCheck': return <ShieldCheck size={18} className="text-amber-400" />;
      case 'Terminal': return <Terminal size={18} className="text-purple-400" />;
      case 'Mic': return <Mic size={18} className="text-pink-400" />;
      default: return <Boxes size={18} className="text-cyan-400" />;
    }
  };

  // 格式化渲染 MCP 图标
  const renderMcpIcon = (id: string) => {
    if (id.includes('time')) return <Compass size={18} className="text-cyan-400" />;
    if (id.includes('memory')) return <Wand2 size={18} className="text-pink-400" />;
    if (id.includes('github')) return <FolderGit2 size={18} className="text-purple-400" />;
    if (id.includes('sqlite') || id.includes('database')) return <Database size={18} className="text-blue-400" />;
    if (id.includes('fetch')) return <Compass size={18} className="text-emerald-400" />;
    if (id.includes('filesystem')) return <Layers size={18} className="text-amber-400" />;
    return <Cpu size={18} className="text-cyan-400" />;
  };

  // 切换内置插件启用状态
  const toggleBuiltinPlugin = (id: string) => {
    const updated = {
      ...pluginsConfig,
      builtinPlugins: pluginsConfig.builtinPlugins.map(p =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      )
    };
    setPluginsConfig(updated);
    onSave(updated);
  };

  // 切换 MCP 插件启用状态
  const toggleMcpPlugin = (id: string) => {
    const updated = {
      ...pluginsConfig,
      mcpPlugins: pluginsConfig.mcpPlugins.map(m =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
    };
    setPluginsConfig(updated);
    onSave(updated);
  };

  // 保存单个 MCP 的环境变量配置
  const updateMcpEnv = (id: string, key: string, val: string) => {
    const updated = {
      ...pluginsConfig,
      mcpPlugins: pluginsConfig.mcpPlugins.map(m => {
        if (m.id === id) {
          return {
            ...m,
            env: { ...m.env, [key]: val }
          };
        }
        return m;
      })
    };
    setPluginsConfig(updated);
    onSave(updated);
  };

  // 删除自定义 MCP 插件
  const deleteMcpPlugin = (id: string) => {
    if (!window.confirm('确定要删除该 MCP 插件扩展吗？')) return;
    const updated = {
      ...pluginsConfig,
      mcpPlugins: pluginsConfig.mcpPlugins.filter(m => m.id !== id)
    };
    setPluginsConfig(updated);
    onSave(updated);
  };

  // 提交新增自定义 MCP
  const handleAddCustomMcp = () => {
    if (!newMcpName.trim() || !newMcpCommand.trim()) return;
    const argsArray = newMcpArgs.trim().split(/\s+/).filter(Boolean);
    const envObj: Record<string, string> = {};
    if (newMcpEnvKey.trim()) {
      envObj[newMcpEnvKey.trim()] = newMcpEnvVal.trim();
    }

    const newMcp: McpPlugin = {
      id: `custom-mcp-${Date.now()}`,
      name: newMcpName.trim(),
      description: newMcpDesc.trim() || '用户自定义 MCP 扩展服务',
      command: newMcpCommand.trim(),
      args: argsArray,
      env: envObj,
      enabled: true,
      category: '自定义扩展'
    };

    const updated = {
      ...pluginsConfig,
      mcpPlugins: [...pluginsConfig.mcpPlugins, newMcp]
    };
    setPluginsConfig(updated);
    onSave(updated);

    setNewMcpName('');
    setNewMcpDesc('');
    setNewMcpCommand('npx');
    setNewMcpArgs('-y @modelcontextprotocol/server-...');
    setNewMcpEnvKey('');
    setNewMcpEnvVal('');
    setShowAddMcpModal(false);
  };

  // 过滤项
  const filteredBuiltin = pluginsConfig.builtinPlugins.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMcp = pluginsConfig.mcpPlugins.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-inner">
              <Boxes size={19} className="text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">插件中心</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-[#2b2b2b] font-mono">
                  Plugin Center
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                管理原生内置系统能力，或通过开放 MCP (Model Context Protocol) 接入互联网海量现成工具
              </p>
            </div>
          </div>
          <X size={17} className="text-neutral-400 cursor-pointer hover:text-white transition-colors" onClick={onClose} />
        </div>

        {/* 选项卡切换与快捷搜索栏 */}
        <div className="px-6 py-3 border-b border-[#1f1f1f] bg-[#111] flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-[#262626]">
            <button
              onClick={() => setActiveTab('builtin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'builtin'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              内置功能插件 ({pluginsConfig.builtinPlugins.filter(p => p.enabled).length}/{pluginsConfig.builtinPlugins.length})
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'mcp'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              MCP 开放生态 ({pluginsConfig.mcpPlugins.filter(m => m.enabled).length}/{pluginsConfig.mcpPlugins.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="relative w-full">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索插件名称或功能..."
                className="w-full bg-[#181818] border border-[#262626] rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={handleRefresh}
              title="刷新插件数据"
              className={`p-1.5 rounded-lg bg-[#181818] border border-[#282828] text-neutral-400 hover:text-white transition-all shrink-0 ${
                isRefreshing ? 'animate-spin text-blue-400' : ''
              }`}
            >
              <RotateCw size={13} />
            </button>
            {activeTab === 'mcp' && (
              <button
                onClick={() => setShowAddMcpModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shrink-0 transition-colors shadow-sm"
              >
                <Plus size={13} />
                <span>添加 MCP</span>
              </button>
            )}
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* ====================== TAB 1: 内置功能插件 ====================== */}
          {activeTab === 'builtin' && (
            <div className="space-y-2.5">
              {filteredBuiltin.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    p.enabled
                      ? 'bg-[#181818] border-[#2c2c2c] shadow-sm'
                      : 'bg-[#121212] border-[#202020] opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#2b2b2b] flex items-center justify-center shrink-0">
                      {renderPluginIcon(p.iconName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white tracking-tight">{p.name}</span>
                        {p.badge && (
                          <span className={`text-[10px] px-2 py-0.2 rounded-full font-medium border ${
                            p.badge === '官方核心'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : p.badge === '安全增强'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}>
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => toggleBuiltinPlugin(p.id)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                      p.enabled ? 'bg-blue-600' : 'bg-neutral-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        p.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ====================== TAB 2: MCP 开放生态 ====================== */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              <div className="p-3 bg-gradient-to-r from-blue-950/20 via-neutral-900 to-purple-950/20 rounded-xl border border-blue-900/30 text-xs text-neutral-300 flex items-start gap-2.5">
                <Compass size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-medium text-white">Model Context Protocol (MCP) 开放标准：</span>
                  接入现成或自建的 MCP 服务，零代码扩展大模型读写数据库、GitHub 评审、网页分析与任意外部系统。
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMcp.map(m => {
                  const hasEnv = Object.keys(m.env || {}).length > 0;
                  const isEditing = editingMcpId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                        m.enabled
                          ? 'bg-[#181818] border-[#2d2d2d] shadow-sm'
                          : 'bg-[#131313] border-[#222] opacity-80'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#202020] border border-[#2d2d2d] flex items-center justify-center shrink-0">
                              {renderMcpIcon(m.id)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-white">{m.name}</span>
                                {m.category && (
                                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded border border-[#2b2b2b]">
                                    {m.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            onClick={() => toggleMcpPlugin(m.id)}
                            className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
                              m.enabled ? 'bg-blue-600' : 'bg-neutral-800'
                            }`}
                          >
                            <div
                              className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                m.enabled ? 'translate-x-4.5' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>

                        <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                          {m.description}
                        </p>

                        <div className="bg-[#0f0f0f] border border-[#202020] rounded-lg px-2.5 py-1 font-mono text-[11px] text-neutral-400 truncate">
                          {m.command} {m.args.join(' ')}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#222] flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {hasEnv && (
                            <button
                              onClick={() => setEditingMcpId(isEditing ? null : m.id)}
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                              <Settings size={12} />
                              <span>{isEditing ? '收起配置' : '配置密钥 / Token'}</span>
                            </button>
                          )}
                        </div>

                        {!m.isPopular && (
                          <button
                            onClick={() => deleteMcpPlugin(m.id)}
                            className="text-neutral-500 hover:text-red-400 p-0.5 rounded transition-colors"
                            title="删除该自定义 MCP"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-2.5 p-2.5 bg-[#111] rounded-lg border border-[#252525] space-y-2">
                          {Object.entries(m.env).map(([envKey, envVal]) => (
                            <div key={envKey}>
                              <label className="text-[10px] text-neutral-400 mb-0.5 block font-mono">
                                {envKey}:
                              </label>
                              <input
                                type="password"
                                value={envVal}
                                onChange={(e) => updateMcpEnv(m.id, envKey, e.target.value)}
                                placeholder="输入对应 Token 或 API Key..."
                                className="w-full bg-[#181818] border border-[#282828] rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-3 border-t border-[#222] bg-[#111] flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            已激活 {pluginsConfig.builtinPlugins.filter(p => p.enabled).length} 项内置能力 / {pluginsConfig.mcpPlugins.filter(m => m.enabled).length} 个 MCP 扩展
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-md"
          >
            完成
          </button>
        </div>
      </div>

      {/* 新增自定义 MCP 插件子弹窗 */}
      {showAddMcpModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-60 flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#282828] rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#222] pb-2.5">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-white">添加自定义 MCP 服务</h3>
              </div>
              <X size={15} className="text-neutral-400 cursor-pointer hover:text-white" onClick={() => setShowAddMcpModal(false)} />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 mb-1 font-medium">插件名称 *</label>
                <input
                  type="text"
                  value={newMcpName}
                  onChange={(e) => setNewMcpName(e.target.value)}
                  placeholder="例如: Postgres DB / Notion 笔记助手"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1 font-medium">描述说明</label>
                <input
                  type="text"
                  value={newMcpDesc}
                  onChange={(e) => setNewMcpDesc(e.target.value)}
                  placeholder="该插件提供给大模型的能力..."
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">启动命令 *</label>
                  <input
                    type="text"
                    value={newMcpCommand}
                    onChange={(e) => setNewMcpCommand(e.target.value)}
                    placeholder="npx / node / python"
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-neutral-300 mb-1 font-medium">运行参数 (空格隔开) *</label>
                  <input
                    type="text"
                    value={newMcpArgs}
                    onChange={(e) => setNewMcpArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-..."
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-[#121212] rounded-lg border border-[#222]">
                <label className="block text-neutral-400 text-[11px] mb-1.5">附加环境变量 (可选)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newMcpEnvKey}
                    onChange={(e) => setNewMcpEnvKey(e.target.value)}
                    placeholder="环境变量名 (如 API_KEY)"
                    className="bg-[#1c1c1c] border border-[#282828] rounded px-2.5 py-1 text-white text-xs font-mono outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={newMcpEnvVal}
                    onChange={(e) => setNewMcpEnvVal(e.target.value)}
                    placeholder="变量值..."
                    className="bg-[#1c1c1c] border border-[#282828] rounded px-2.5 py-1 text-white text-xs font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                onClick={() => setShowAddMcpModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#222] hover:bg-[#282828] text-neutral-300 text-xs transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddCustomMcp}
                disabled={!newMcpName.trim() || !newMcpCommand.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors shadow-md"
              >
                添加并启用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

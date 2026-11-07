import React from 'react';
import { Boxes, X, Plus, Trash2 } from 'lucide-react';
import { AppConfig } from '../types';

interface ModelSettingsModalProps {
  show: boolean;
  onClose: () => void;
  appConfig: AppConfig | null;
  setAppConfig: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => Promise<void>;
}

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({
  show,
  onClose,
  appConfig,
  setAppConfig,
  onSave
}) => {
  if (!show || !appConfig) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
          <div className="flex items-center gap-2 font-medium text-sm text-neutral-200">
            <Boxes size={17} className="text-blue-400" />
            <span>自定义模型提供商与 API Key 配置</span>
          </div>
          <X size={16} className="text-neutral-400 cursor-pointer hover:text-white" onClick={onClose} />
        </div>

        {/* 顶部操作条：新增提供商按钮 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-neutral-400">管理所有 AI 服务提供商及其挂载的模型列表</span>
          <button
            onClick={() => {
              const newProvider = {
                id: `provider-${Date.now()}`,
                name: '新提供商 (如 硅基流动 / OneAPI)',
                protocol: 'openai',
                baseUrl: 'https://api.example.com/v1',
                apiKey: '',
                models: [
                  { id: '', name: '' }
                ]
              };
              setAppConfig({
                ...appConfig,
                customProviders: [...(appConfig.customProviders || []), newProvider]
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>新增提供商</span>
          </button>
        </div>

        {/* 提供商卡片流 */}
        <div className="space-y-4 text-xs max-h-[62vh] overflow-y-auto pr-2">
          {appConfig.customProviders?.map((p: any, pIdx: number) => (
            <div key={p.id || pIdx} className="bg-[#171717] border border-[#262626] rounded-xl p-4 space-y-3.5">
              {/* 提供商名称与操作头 */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-neutral-400 text-xs shrink-0">提供商名称:</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const updated = [...appConfig.customProviders];
                      updated[pIdx].name = e.target.value;
                      setAppConfig({ ...appConfig, customProviders: updated });
                    }}
                    className="flex-1 bg-[#1c1c1c] border border-[#2d2d2d] rounded-md px-2.5 py-1 text-white text-xs font-medium outline-none focus:border-blue-500"
                    placeholder="例如: DeepSeek / 硅基流动 / 本地Ollama"
                  />
                </div>
                <select
                  value={p.protocol || 'openai'}
                  onChange={(e) => {
                    const updated = [...appConfig.customProviders];
                    updated[pIdx].protocol = e.target.value;
                    setAppConfig({ ...appConfig, customProviders: updated });
                  }}
                  className="bg-[#1f1f1f] border border-[#2d2d2d] text-neutral-300 rounded px-2 py-1 outline-none text-[11px]"
                >
                  <option value="openai">OpenAI 兼容协议</option>
                  <option value="anthropic">Claude 原生协议</option>
                </select>
                <button
                  onClick={() => {
                    const updated = appConfig.customProviders.filter((_: any, i: number) => i !== pIdx);
                    setAppConfig({ ...appConfig, customProviders: updated });
                  }}
                  className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                  title="删除该提供商"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Base URL 与 API Key 栏目 */}
              <div className="grid grid-cols-2 gap-3 bg-[#131313] p-3 rounded-lg border border-[#222]">
                <div>
                  <label className="text-neutral-400 mb-1 block text-[11px]">Base URL (接口地址)</label>
                  <input
                    type="text"
                    value={p.baseUrl}
                    onChange={(e) => {
                      const updated = [...appConfig.customProviders];
                      updated[pIdx].baseUrl = e.target.value;
                      setAppConfig({ ...appConfig, customProviders: updated });
                    }}
                    className="w-full bg-[#1c1c1c] border border-[#2b2b2b] rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-white font-mono text-[11px]"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 mb-1 block text-[11px]">API Key</label>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={(e) => {
                      const updated = [...appConfig.customProviders];
                      updated[pIdx].apiKey = e.target.value;
                      setAppConfig({ ...appConfig, customProviders: updated });
                    }}
                    className="w-full bg-[#1c1c1c] border border-[#2b2b2b] rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-white font-mono text-[11px]"
                    placeholder="sk-..."
                  />
                </div>
              </div>

              {/* 挂载的模型列表 (模型名称1, 新增模型1, 2, 3...) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-300">该提供商下的模型列表:</span>
                  <button
                    onClick={() => {
                      const updated = [...appConfig.customProviders];
                      const curModels = updated[pIdx].models || [];
                      updated[pIdx].models = [
                        ...curModels,
                        { id: '', name: '' }
                      ];
                      setAppConfig({ ...appConfig, customProviders: updated });
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    <Plus size={12} />
                    <span>新增模型</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {p.models?.map((m: any, mIdx: number) => {
                    const val = m.name || m.id || '';
                    return (
                      <div key={mIdx} className="flex items-center gap-2 bg-[#1b1b1b] px-3 py-1.5 rounded-lg border border-[#282828] hover:border-[#333] transition-colors">
                        <span className="text-neutral-500 text-[11px] w-5 font-mono">{mIdx + 1}.</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const newName = e.target.value;
                            const updated = [...appConfig.customProviders];
                            updated[pIdx].models[mIdx] = {
                              name: newName,
                              id: newName
                            };
                            setAppConfig({ ...appConfig, customProviders: updated });
                          }}
                          placeholder="模型名称 (例如: MiniMax-M3 / deepseek-chat / gpt-4o)"
                          className="flex-1 bg-transparent px-1 py-0.5 outline-none text-white text-xs font-mono placeholder-neutral-500"
                        />
                        <button
                          onClick={() => {
                            const updated = [...appConfig.customProviders];
                            updated[pIdx].models = updated[pIdx].models.filter((_: any, i: number) => i !== mIdx);
                            setAppConfig({ ...appConfig, customProviders: updated });
                          }}
                          className="text-neutral-500 hover:text-red-400 p-1 transition-colors rounded"
                          title="删除该模型"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 弹窗底部操作按钮 */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#242424]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#222] hover:bg-[#2a2a2a] text-xs text-neutral-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors shadow-md"
          >
            保存全部配置
          </button>
        </div>
      </div>
    </div>
  );
};

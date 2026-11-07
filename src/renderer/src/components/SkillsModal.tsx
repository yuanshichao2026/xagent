import React, { useState, useEffect } from 'react';
import {
  Sparkles, X, Search, Plus, Trash2, BookOpen,
  ChevronRight, Tag, RotateCw, FileSpreadsheet,
  GitPullRequest, Scale, Code, CheckCircle2
} from 'lucide-react';
import { Skill } from '../types';

interface SkillsModalProps {
  show: boolean;
  onClose: () => void;
  skills: Skill[];
  setSkills: React.Dispatch<React.SetStateAction<Skill[]>>;
  onSaveSkills: (skills: Skill[]) => Promise<void>;
}

export const SkillsModal: React.FC<SkillsModalProps> = ({
  show,
  onClose,
  skills,
  setSkills,
  onSaveSkills
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 新增技能表单状态
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillCat, setNewSkillCat] = useState<'研发效能' | '数据分析' | '文档法务' | '工程规范' | '自定义技能'>('自定义技能');
  const [newSkillTags, setNewSkillTags] = useState('自定义, 自动化');
  const [newSkillPrompt, setNewSkillPrompt] = useState('【标准业务工作流 SOP】：\n1. 第一步：...\n2. 第二步：...\n3. 第三步：输出规范结果。');

  // 每次打开弹窗自动向后端拉取最新的技能数据
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetch('http://localhost:3456/api/skills').then(r => r.json());
      if (Array.isArray(data)) {
        setSkills(data);
      }
    } catch (e) {
      console.error('刷新技能列表失败:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  useEffect(() => {
    if (show) {
      handleRefresh();
    }
  }, [show]);

  if (!show) return null;

  // 切换技能开关
  const toggleSkill = (id: string) => {
    const updated = skills.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setSkills(updated);
    onSaveSkills(updated);
  };

  // 删除自定义技能
  const deleteSkill = (id: string) => {
    if (!window.confirm('确定要移除该自定义技能吗？')) return;
    const updated = skills.filter(s => s.id !== id);
    setSkills(updated);
    onSaveSkills(updated);
  };

  // 保存新建技能
  const handleAddSkill = () => {
    if (!newSkillName.trim() || !newSkillPrompt.trim()) return;
    const tagList = newSkillTags.split(/[,，]/).map(t => t.trim()).filter(Boolean);

    const newSkill: Skill = {
      id: `custom-skill-${Date.now()}`,
      name: newSkillName.trim(),
      description: newSkillDesc.trim() || '用户自定义业务工作流规程',
      category: newSkillCat,
      tags: tagList,
      promptWorkflow: newSkillPrompt.trim(),
      enabled: true,
      isBuiltin: false
    };

    const updated = [...skills, newSkill];
    setSkills(updated);
    onSaveSkills(updated);

    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillPrompt('【标准业务工作流 SOP】：\n1. 第一步：...\n2. 第二步：...\n3. 第三步：输出规范结果。');
    setShowAddModal(false);
  };

  // 渲染图标
  const renderSkillIcon = (cat: string, id: string) => {
    if (id.includes('excel')) return <FileSpreadsheet size={18} className="text-emerald-400" />;
    if (id.includes('git') || id.includes('pr')) return <GitPullRequest size={18} className="text-purple-400" />;
    if (id.includes('contract')) return <Scale size={18} className="text-amber-400" />;
    if (id.includes('code') || id.includes('refactor')) return <Code size={18} className="text-blue-400" />;
    return <Sparkles size={18} className="text-pink-400" />;
  };

  // 过滤项
  const filteredSkills = skills.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesCat = false;
    if (selectedCategory === '全部') {
      matchesCat = true;
    } else if (selectedCategory === '自定义技能') {
      matchesCat = !s.isBuiltin || s.category === '自定义技能' || s.category === '自动化脚本';
    } else {
      matchesCat = s.category === selectedCategory;
    }
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shadow-inner">
              <Sparkles size={19} className="text-pink-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">业务技能库</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-[#2b2b2b] font-mono">
                  Codex Skills SOP
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                管理各专业业务领域的标准工作流 SOP 专家规程，对话中输入 <strong className="text-pink-400">/</strong> 即可快捷唤醒
              </p>
            </div>
          </div>
          <X size={17} className="text-neutral-400 cursor-pointer hover:text-white transition-colors" onClick={onClose} />
        </div>

        {/* 顶部快捷搜索与操作栏 */}
        <div className="px-6 py-3 border-b border-[#1f1f1f] bg-[#111] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索业务技能、SOP 流程或标签..."
              className="w-full bg-[#181818] border border-[#262626] rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              title="刷新技能库数据"
              className={`p-1.5 rounded-lg bg-[#181818] border border-[#282828] text-neutral-400 hover:text-white transition-all ${
                isRefreshing ? 'animate-spin text-pink-400' : ''
              }`}
            >
              <RotateCw size={13} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-lg text-xs font-medium shrink-0 transition-all shadow-md shadow-pink-600/20"
            >
              <Plus size={13} />
              <span>新建技能 SOP</span>
            </button>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
          {/* 分类快捷筛选胶囊条 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {['全部', '自定义技能', '研发效能', '数据分析', '文档法务', '工程规范'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full border transition-all text-[11px] shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-pink-600 border-pink-500 text-white font-medium shadow-sm'
                    : 'bg-[#171717] border-[#262626] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 技能卡片列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSkills.map(skill => {
              const isExpanded = expandedSkillId === skill.id;

              return (
                <div
                  key={skill.id}
                  className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                    skill.enabled
                      ? 'bg-[#181818] border-[#2d2d2d] shadow-sm'
                      : 'bg-[#131313] border-[#222] opacity-80'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#202020] border border-[#2d2d2d] flex items-center justify-center shrink-0">
                          {renderSkillIcon(skill.category, skill.id)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-white">{skill.name}</span>
                            {!skill.isBuiltin && (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium">
                                ⭐ 用户自建
                              </span>
                            )}
                            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded border border-[#2b2b2b]">
                              {skill.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 启用开关 */}
                      <div
                        onClick={() => toggleSkill(skill.id)}
                        className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
                          skill.enabled ? 'bg-pink-600' : 'bg-neutral-800'
                        }`}
                      >
                        <div
                          className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                            skill.enabled ? 'translate-x-4.5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                      {skill.description}
                    </p>

                    {/* 标签 */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {skill.tags.map(t => (
                        <span key={t} className="text-[10px] bg-[#141414] border border-[#262626] text-neutral-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Tag size={10} className="text-neutral-500" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 底部查看 SOP 展开与删除 */}
                  <div className="mt-3 pt-2.5 border-t border-[#222] flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                      className="flex items-center gap-1 text-pink-400 hover:text-pink-300 font-medium transition-colors"
                    >
                      <BookOpen size={12} />
                      <span>{isExpanded ? '收起 SOP 规程' : '查看专家工作流 SOP'}</span>
                      <ChevronRight size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {!skill.isBuiltin && (
                      <button
                        onClick={() => deleteSkill(skill.id)}
                        className="text-neutral-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        title="删除该自定义技能"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* 展开的 SOP 详细规范预览 */}
                  {isExpanded && (
                    <div className="mt-2.5 p-3 bg-[#0d0d0d] rounded-lg border border-[#242424] text-[11px] text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap max-h-56 overflow-y-auto">
                      {skill.promptWorkflow}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSkills.length === 0 && (
            <div className="py-12 text-center text-xs text-neutral-500">
              未找到匹配的业务技能，您可以在对话框直接要求 AI 提炼新技能，或点击右上角「新建技能 SOP」创建。
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-3 border-t border-[#222] bg-[#111] flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            已激活 <strong className="text-pink-400">{skills.filter(s => s.enabled).length}</strong> 项专家技能 / 共 {skills.length} 个
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors shadow-md"
          >
            完成
          </button>
        </div>
      </div>

      {/* 新增自定义技能 SOP 子弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-60 flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#282828] rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#222] pb-2.5">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-pink-400" />
                <h3 className="text-sm font-semibold text-white">沉淀新建业务技能 SOP</h3>
              </div>
              <X size={15} className="text-neutral-400 cursor-pointer hover:text-white" onClick={() => setShowAddModal(false)} />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 mb-1 font-medium">技能名称 *</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="例如: 电商差评自动分析与客服工单流转技能"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1 font-medium">激活场景描述</label>
                <input
                  type="text"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="描述何时触发此技能，大模型将根据此描述自动调度..."
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">专业分类</label>
                  <select
                    value={newSkillCat}
                    onChange={(e: any) => setNewSkillCat(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-pink-500"
                  >
                    <option value="自定义技能">自定义技能</option>
                    <option value="研发效能">研发效能</option>
                    <option value="数据分析">数据分析</option>
                    <option value="文档法务">文档法务</option>
                    <option value="工程规范">工程规范</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={newSkillTags}
                    onChange={(e) => setNewSkillTags(e.target.value)}
                    placeholder="工单, 自动化, 质检"
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 mb-1 font-medium">标准作业规程 (SOP Markdown) *</label>
                <textarea
                  rows={6}
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  placeholder="详细分步执行规程..."
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-2.5 text-white outline-none focus:border-pink-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#222] hover:bg-[#282828] text-neutral-300 text-xs transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddSkill}
                disabled={!newSkillName.trim() || !newSkillPrompt.trim()}
                className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-medium transition-colors shadow-md"
              >
                保存并生效
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

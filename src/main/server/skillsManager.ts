import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: '研发效能' | '数据分析' | '文档法务' | '工程规范' | '自定义技能';
  tags: string[];
  promptWorkflow: string;
  enabled: boolean;
  isBuiltin?: boolean;
}

const skillsFilePath = path.join(
  app ? app.getPath('userData') : process.cwd(),
  'skills.json'
);

const defaultSkills: Skill[] = [
  {
    id: 'skill-excel-analysis',
    name: 'Excel 双表关联清洗技能',
    description: '适用于两份 Excel/CSV 报表的学号或主键关联对齐、差额比对、字段合并与格式化回写。',
    category: '数据分析',
    tags: ['Excel', '跨表比对', '数据清洗'],
    promptWorkflow: `【Excel 双表数据比对与清洗标准 SOP】：
1. **字段与主键勘探**：优先阅读或解析两份表格的表头结构，明确共有唯一关联主键（如学号、工号、订单号）；
2. **一致性与冲突排查**：统计两表的总记录数、主键覆盖率，提取“仅在表A出现”、“仅在表B出现”以及“两表皆有但金额/状态不一致”的冲突记录；
3. **数据合并与聚合加工**：按一对一或一对多规则聚合关联字段，若存在同主键多条记录，采用逗号或顿号去重合并回写；
4. **校验与规范交付**：重新核算合并后的行数与总汇总金额，确保无跨表遗漏；最后交付规范的 Markdown 汇总核对表并标明异常项。`,
    enabled: true,
    isBuiltin: true
  },
  {
    id: 'skill-git-pr',
    name: 'Git Pull Request 规范生成技能',
    description: '深度审查当前项目的 Git 分支变更、diff 与提交历史，生成符合大厂技术规范的 PR 评审文档。',
    category: '研发效能',
    tags: ['Git', 'Pull Request', '代码审查'],
    promptWorkflow: `【Pull Request 文档生成标准规范】：
1. **变更动机 (Why)**：简述本次 PR 要解决的核心问题、业务背景或关联 Issue；
2. **改动详情 (What)**：分模块列出核心代码改动点（前端 UI、后端接口、数据结构、构建配置）；
3. **技术方案与关键实现 (How)**：重点阐述复杂逻辑的选型考虑与防错设计；
4. **自测验证说明 (Test)**：列明本地运行与测试结果，附上截图或终端验证结论；
5. **影响面与兼容性提示 (Impact)**：说明是否涉及数据库破坏性升级或需要协同更新的环境变量。`,
    enabled: true,
    isBuiltin: true
  },
  {
    id: 'skill-contract-audit',
    name: '商业合同与法务风险审查技能',
    description: '深度排查商业买卖合同、租赁协议中的主体资质、权责分配、违约赔偿与争议管辖漏洞。',
    category: '文档法务',
    tags: ['合同审查', '法律风控', '协议条款'],
    promptWorkflow: `【商业协议与法务风险审查 SOP】：
1. **合同主体与标的物核查**：确认签约主体信息、法定代表人、标的物参数、价款结算周期与交付方式是否明确；
2. **权利与义务对等性评估**：审查双方违约金计算标准是否失衡，单方解除权条件是否苛刻；
3. **争议解决与管辖法院排查**：审查管辖地是否对己方有利，仲裁条款是否存在约定不明风险；
4. **输出审查清单**：按【高风险隐患】、【中度风险】、【修改建议条款对照】三段式结构规范输出诊断意见。`,
    enabled: true,
    isBuiltin: true
  },
  {
    id: 'skill-code-refactor',
    name: '代码坏味道与重构指导技能',
    description: '遵循 SOLID 原则与代码整洁之道，识别过长函数、大泥球类、循环依赖并给出解耦步骤。',
    category: '工程规范',
    tags: ['Clean Code', '重构', '架构优化'],
    promptWorkflow: `【专业代码重构标准工作流】：
1. **异味诊断**：分析圈复杂度、超长函数（>50行）、过深嵌套、滥用全局状态等设计坏味道；
2. **小步迭代原则**：制定重构顺序（提取纯函数 ➡️ 拆分单一职责子模块 ➡️ 提炼统一类型定义）；
3. **保证功能等价**：重构前后必须保持外部输入输出完全一致，禁止未经确认修改业务逻辑；
4. **Before/After 示例交付**：提供清晰的代码重构前后对比说明，讲透解耦收益。`,
    enabled: true,
    isBuiltin: true
  }
];

// 获取所有技能列表
export function getSkills(): Skill[] {
  try {
    if (fs.existsSync(skillsFilePath)) {
      const content = fs.readFileSync(skillsFilePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        // 合并保证默认内置项不丢失
        const existingIds = new Set(data.map((s: any) => s.id));
        const merged = [
          ...data,
          ...defaultSkills.filter(d => !existingIds.has(d.id))
        ];
        return merged;
      }
    }
  } catch (e) {
    console.error('读取 skills.json 失败，使用出厂配置:', e);
  }

  return defaultSkills;
}

// 保存技能列表
export function saveSkills(skills: Skill[]): void {
  try {
    fs.writeFileSync(skillsFilePath, JSON.stringify(skills, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存 skills.json 失败:', e);
  }
}

// 获取已启用的技能工作流 Prompt 片段
export function getActiveSkillsPrompt(): string {
  const allSkills = getSkills();
  const activeSkills = allSkills.filter(s => s.enabled);
  if (activeSkills.length === 0) return '';

  return `\n【当前已激活的专属业务技能与工作流 SOP】:
系统当前已挂载以下业务领域的专家级工作流规范。当用户的任务属于以下技能范畴时，你必须严格遵循对应的 SOP 步骤与交付标准执行：
${activeSkills.map((s, idx) => `
### 技能 ${idx + 1}: 《${s.name}》（分类：${s.category}）
- 触发场景: ${s.description}
- 工作流规程:
${s.promptWorkflow}
`).join('\n')}`;
}

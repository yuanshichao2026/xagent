export interface Workspace {
  id: string;
  path: string;
  name: string;
}

export interface Session {
  id: string;
  workspacePath: string;
  title: string;
  messagesJson: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  ext: string;
  savedPath?: string;
  dataUrl?: string;
  extractedText?: string;
}

export interface ModelItem {
  id: string;
  name: string;
}

export interface CustomProvider {
  id: string;
  name: string;
  protocol?: string;
  baseUrl: string;
  apiKey: string;
  models: ModelItem[];
}

export interface AppConfig {
  defaultModelId: string;
  customProviders: CustomProvider[];
}

export interface ToolInvocation {
  toolName: string;
  args: any;
  result?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  toolInvocations?: ToolInvocation[];
}

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

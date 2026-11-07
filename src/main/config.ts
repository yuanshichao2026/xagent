import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface CustomProvider {
  id: string;
  name: string;        // 提供商名称，如 "DeepSeek 官方", "硅基流动", "本地 Ollama", "OpenAI 代理"
  protocol: 'openai' | 'anthropic'; // 接口协议，绝大多数兼容 OpenAI 规范
  baseUrl: string;     // API Base URL
  apiKey: string;      // API 密钥
  models: { id: string; name: string }[]; // 该提供商下的模型列表
}

export interface AppConfig {
  customProviders: CustomProvider[];
  defaultModelId: string;
}

const configPath = path.join(app ? app.getPath('userData') : process.cwd(), 'config.json');

const defaultConfig: AppConfig = {
  customProviders: [
    {
      id: 'provider-deepseek',
      name: 'DeepSeek',
      protocol: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: '',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek V3' },
        { id: 'deepseek-reasoner', name: 'DeepSeek R1' }
      ]
    },
    {
      id: 'provider-openai',
      name: 'OpenAI',
      protocol: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
      ]
    },
    {
      id: 'provider-anthropic',
      name: 'Anthropic',
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: '',
      models: [
        { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' }
      ]
    },
    {
      id: 'provider-ollama',
      name: 'Ollama 本地',
      protocol: 'openai',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      models: [
        { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B' }
      ]
    }
  ],
  defaultModelId: 'deepseek-chat'
};

export function loadConfig(): AppConfig {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    const parsed: AppConfig = JSON.parse(data);
    if (!parsed.customProviders) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }

    // 自动清洗纠偏：若模型 ID 存在占位符（如 custom-model-1, model-2 等），自动修复为真实的模型名
    let hasFix = false;
    const allAvailableModelNames: string[] = [];
    parsed.customProviders.forEach((p) => {
      p.models?.forEach((m) => {
        if (m.name && (!m.id || /^custom-model-|^model-\d+$/i.test(m.id))) {
          m.id = m.name;
          hasFix = true;
        } else if (m.id && !m.name) {
          m.name = m.id;
          hasFix = true;
        }
        const valid = m.name || m.id;
        if (valid) allAvailableModelNames.push(valid);
      });
    });

    // 校验 defaultModelId 是否有效，若已失效则自动指向当前第一个有效模型
    if (allAvailableModelNames.length > 0 && (!parsed.defaultModelId || !allAvailableModelNames.includes(parsed.defaultModelId))) {
      parsed.defaultModelId = allAvailableModelNames[0];
      hasFix = true;
    }

    if (hasFix) {
      fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
    }

    return parsed;
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(cfg: AppConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

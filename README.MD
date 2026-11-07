# XAgent Desktop

> **XAgent Desktop** 是一款基于 **Electron + React + TypeScript** 构建的高并发桌面智能体（Local Agent）客户端。核心搭载 **PTC（程序化工具调用）** 执行架构，让大模型直接操控本地文件系统与 Shell 环境，实现极速、高并发、自闭环的自动化工程开发。

[![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.11-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#-开源协议)

---

## 目录

1. [核心特色：PTC 循环架构](#一核心特色ptc-循环架构)
2. [部署与启动](#二部署与启动)
3. [自定义模型配置](#三自定义模型配置)
4. [界面与交互指南](#四界面与交互指南)
5. [常见错误与排错方案](#五常见错误与排错方案)

---

## 一、核心特色：PTC 循环架构

XAgent 抛弃了传统 Agent “多次对话、单步执行、频繁计划”的低效模式，采用 **PTC（Programmatic Tool Calling，程序化工具调用）** 极速执行引擎。

```
传统 Agent 循环: 
模型思考 -> 调单个工具 -> 等待回传 -> 模型二次思考 -> 调第二个工具 ... (高延迟、轮次膨胀、上下文污染)

XAgent PTC 循环:
模型单句意图 -> 单工具 run_code(沙箱异步 TS 脚本) -> 内部 Promise.all 并发探查/批量修改/自测试 -> 精炼返回结果
```

### 1. PTC 四大执行铁律

* **零计划税（Zero To-Do Tax）**：严禁在交互中输出长篇大论的待办清单或步骤表，模型将全部注意力聚焦于直接编写沙箱代码执行解决。
* **单句意图（One-Sentence Intent）**：在调用 `run_code` 前，模型仅输出最多一句话（25字以内）概括本次代码目标，随即立即运行。
* **沙箱内 ETL（In-Sandbox ETL）**：海量文件或日志在沙箱内存中直接通过正则、`.filter()`、`.slice()` 完成清洗提取，严格限制回传对话上下文的行数（80行以内），彻底防止长上下文膨胀导致模型退化。
* **原子闭环（Atomic Loop）**：在同一个沙箱脚本内完成 `读取 -> 分支判断 -> 批量修改 -> 终端验证(bash)`，若编译/测试失败在脚本内就地修复，实现真正的单轮原子自愈闭环。

### 2. 沙箱全局 `tools` SDK

在 `run_code` 中，模型无需 `import`，可直接调用全局异步接口：

```typescript
declare namespace tools {
  /** 批量匹配工作区文件路径 */
  function glob(args: { pattern: string; cwd?: string }): Promise<string[]>;
  /** 高速正则搜索内容 */
  function grep(args: { pattern: string; path?: string; globs?: string[] }): Promise<Array<{ file: string; line: number; text: string }>>;
  /** 行级按需读取文件 */
  function read_file(args: { path: string; startLine?: number; endLine?: number }): Promise<string>;
  /** 多块精准字符串替换修改 */
  function edit_file(args: { path: string; edits: Array<{ oldText: string; newText: string }> }): Promise<{ success: boolean; diff?: string }>;
  /** 覆盖或新建文件写入 */
  function write_file(args: { path: string; content: string }): Promise<{ success: boolean }>;
  /** 运行本地 Shell 命令并捕获输出 */
  function bash(args: { command: string; cwd?: string; timeoutMs?: number }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}
```

---

## 二、部署与启动

### 1. 环境准备
* **操作系统**：Windows 10/11、macOS 或 Linux
* **Node.js**：`>= 18.0.0`（推荐使用 Node 20 LTS）
* **包管理器**：`npm`（或 `pnpm`）

### 2. 源码启动步骤

```bash
# 1. 克隆项目并进入根目录
cd xxagent

# 2. 安装项目所有依赖
npm install

# 3. 启动开发模式（实时热重载 + 本地桌面窗口）
npm run dev
```

### 3. 项目打包分发

```bash
# 构建生产环境代码并生成免安装绿色目录 (dist/win-unpacked/)
npm run package

# 构建一键安装包 (dist/XAgent-1.0.0-Setup-x64.exe)
npm run dist
```

---

## 三、自定义模型配置

XAgent 支持任意遵循 **OpenAI 规范** 或 **Anthropic Claude 原生规范** 的模型服务。

### 1. 配置入口
点击应用右上角的 **⚙️「设置」** 图标即可唤起「模型与提供商配置」面板。

### 2. 预置与常用服务接入

| 提供商 | 接口协议 | 建议 Base URL | API Key 要求 |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | OpenAI 兼容 | `https://api.deepseek.com` | 填入 DeepSeek 官方 API Key |
| **OpenAI** | OpenAI 兼容 | `https://api.openai.com/v1` | 填入 OpenAI 官方 Key |
| **Anthropic** | Anthropic 原生 | `https://api.anthropic.com/v1` | 填入 Claude 官方 Key |
| **Ollama 本地** | OpenAI 兼容 | `http://localhost:11434/v1` | 本地免鉴权，填 `ollama` 占位即可 |
| **OneAPI / 聚合中转**| OpenAI 兼容 | `https://your-domain.com/v1` | 填入中转平台生成的令牌 |

### 3. 添加自定义模型步骤
1. 点击「新增提供商」，输入自定义名称（如 `SiliconFlow`）。
2. 选择协议类型（大多数中转/国产大模型均选 `OpenAI 兼容`）。
3. 填入对应的 `Base URL` 与 `API Key`（输入框自动以密文脱敏展示）。
4. 在下方「模型列表」中添加具体模型标识（如 `deepseek-ai/DeepSeek-V3`、`claude-3-5-sonnet-20241022`）。
5. 点击底部 **「保存全部配置」**。配置将自动安全持久化落盘在系统本地目录的 `config.json` 中，不经过任何云端中转。

---

## 四、界面与交互指南

### 1. 工作区导入与管理
* **打开目录**：点击左上角「导入项目」唤起系统原生文件选择器，选定项目根目录。
* **边界安全保护**：Agent 的所有文件读写和 Shell 命令执行严格限制在当前激活的工作区内部，严禁越界访问工作区之外的敏感路径。
* **Git 分支感知**：状态栏实时感知并展示当前工作区的 Git 分支。

### 2. 对话与流式交互
* **思考链自动折叠**：自动解析 `<think>...</think>` 思维链标签并渲染为可展开的折叠卡片，保持主界面的干净与清爽。
* **多模态与文档拖拽**：直接向输入框拖拽或粘贴 **Word (.docx)、PDF、Excel (.xlsx/.csv)、图片**，系统将就地解析为文本结构供大模型直接研读。
* **插件中心**：点击顶部「插件中心」可随时在 **PTC 极速执行引擎**、**传统分步执行引擎**及**外部 MCP 扩展服务**之间一键切换。

---

## 五、常见错误与排错方案

### 1. 启动报 `Error: Electron uninstall`（高频错误）

> [!WARNING]
> **现象**：执行 `npm run dev` 时终端输出：
> ```text
> error during start dev server and electron app:
> Error: Electron uninstall
>   at getElectronPath (...)
> ```
> **原因**：网络受限导致 Electron 预编译二进制下载不完整，缺少 `node_modules/electron/path.txt` 或核心可执行文件。

**解决方法（二选一）**：

* **方法一：配置镜像源重新下载（推荐）**
  ```bash
  npm config set electron_mirror https://npmmirror.com/mirrors/electron/
  node node_modules/electron/install.js
  ```
* **方法二：从本地缓存手动修复（PowerShell）**
  ```powershell
  New-Item -ItemType Directory -Force -Path "node_modules\electron\dist"
  tar -xf "$env:LOCALAPPDATA\electron\Cache\*\electron-v33.2.1-win32-x64.zip" -C "node_modules\electron\dist"
  Set-Content -Path "node_modules\electron\path.txt" -Value "electron.exe" -NoNewline
  ```

---

### 2. 启动后界面空白或报 `localhost:3456` 连接失败

* **原因**：本地内置的 Hono HTTP 服务端口被占用或启动受阻。
* **排查方法**：
  * 打开终端查看是否有 `EADDRINUSE` 端口占用提示。
  * 终端执行命令排查占用：
    ```powershell
    netstat -ano | findstr :3456
    ```
  * 主进程内部已集成端口热复用兜底，结束冲突进程后重启即可。

---

### 3. 模型调用失败：返回 404 / 401 报错

* **404 Not Found**：
  * **检查 Base URL 路径**：系统会自动处理端点拼接，请勿在 URL 末尾重复手动填写多余的 `/v1/v1`。
  * **检查协议匹配**：如果调用 Claude 原生 API，请确保协议选择了 `Anthropic 原生`，而非 `OpenAI 兼容`。
* **401 Unauthorized**：
  * API Key 未填写、已过期或余额不足。打开「设置」检查对应提供商的 Key 是否正确保存。

---

### 4. 工具报错「越界访问禁止: 禁止访问工作区以外的路径」

* **原因**：Agent 试图读取或修改不属于当前打开的工作区以外的系统路径。
* **解决**：在左侧工作区列表中确认当前已选中的项目目录是否为您需要操作的项目根目录。

---

### 5. 打包后双击 EXE 启动闪退或报 wasm 缺失

* **原因**：SQLite 使用了 `sql.js`（WebAssembly 模式），若在打包配置中将 wasm 打进 `app.asar`，Electron 将无法正常直接加载二进制 wasm。
* **解决**：确保 `package.json` 中的构建配置包含：
  ```json
  "asarUnpack": [
    "**/*.wasm",
    "**/*.node"
  ]
  ```

---

## 六、开源协议

本项目基于 [MIT License](LICENSE) 开源发布。

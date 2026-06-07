# claude-permission-popup

> **Fork 说明**：本仓库是
> [Melodymaifafa/claude-permission-popup](https://github.com/Melodymaifafa/claude-permission-popup)
> 的 **WSL 适配 fork**。macOS 代码路径**逐字节保留**，新增了一条平行的 **WSL**
> 路径（PowerShell `MessageBox`），让 WSL 内的 Claude Code 也能用 Windows
> 原生弹窗做权限提示。

把 Claude Code 在终端里那种**行内 permission 提示**（你得切回终端、键盘上下选）替换成**居中原生对话框**，三个按钮，**不用切回终端**。

- **macOS** → AppleScript `display dialog` via `osascript`（原版）。
- **WSL** → Windows `System.Windows.Forms.MessageBox` via `powershell.exe`。弹窗直接出现在 **Windows 桌面**（你实际看着的屏幕），不依赖 WSLg。

[![Platform: macOS](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/Melodymaifafa/claude-permission-popup)
[![Platform: WSL](https://img.shields.io/badge/platform-WSL-blue.svg)](#%E7%B3%BB%E7%BB%9F%E8%A6%81%E6%B1%82)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)

[English](./README.md) | **简体中文**

## 系统要求

- **macOS**（走 `osascript`）**或 WSL**（走 `powershell.exe`）。
- **Node 18+**。`npx` 随 Node 一起装。若 `npx: command not found`，先装 Node：https://nodejs.org
- **仅 WSL**：`powershell.exe` 必须在 WSL 的 PATH 里。WSL2 默认就装了，路径是
  `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`，并被加到 PATH。
  若你改过 PATH，install 时会报错提示。

## 安装

> **重要**：`npx claude-permission-popup`（不带 GitHub 路径）会解析到 **npm 上的
> 上游 macOS-only 包**——**不是**本 fork。装这个 WSL 适配版，必须显式指 GitHub。

**装本 fork（推荐）：**

```bash
npx github:xxzzzzy/claude-permission-popup install
```

或一行命令先检查 Node：

```bash
curl -fsSL https://raw.githubusercontent.com/xxzzzzy/claude-permission-popup/main/install.sh | bash
```

（脚本只检查 Node 和 `powershell.exe`（WSL），然后调用 installer——不会替你装 Node。）

**其他装法：**

```bash
# 完整 git URL
npx git+https://github.com/xxzzzzy/claude-permission-popup.git install

# 克隆 + npm link
git clone https://github.com/xxzzzzy/claude-permission-popup.git
cd claude-permission-popup
npm link
claude-permission-popup install
```

装完**重启 Claude Code** 或跑 `/hooks` 即可生效。卸载：

```bash
npx github:xxzzzzy/claude-permission-popup uninstall
```

## 安装怎么选弹窗

macOS 和 WSL 用的是**同一行**安装命令——只有一个 fork，`npx
github:xxzzzzy/claude-permission-popup` 在两个系统上都会解析到它。
本 fork **运行时按系统分发**：

- `npm` 允许在 `darwin` 和 `linux` 上装（看 `package.json` 的 `os` 字段）。
  在 `win32`（Windows 原生，无 WSL）上会**拒绝**并报 `EBADPLATFORM`——而且
  你本来就应该在 WSL 里跑安装，弹窗才有意义。
- 首次 hook 触发时，`cli.mjs` 的 `detectPlatform()` 在**运行时**挑代码路径：
  - **macOS** → `showMacDialog`（AppleScript via `osascript`）
  - **WSL** → `showWSLDialog`（Windows `MessageBox` via `powershell.exe`）
  - **原生 Linux / Windows 原生 / BSD** → 友好拒绝 + 指向本 README

所以**一次** `npx github:xxzzzzy/claude-permission-popup install`，你用 Mac 的同事
和你用 WSL 的同事都能装；他们看到的弹窗不一样而已。

## 弹窗

三个按钮：

| 按钮（macOS） | 按钮（WSL） | 行为 |
|---|---|---|
| **允许** | **是** | 放行这一次 |
| **拒绝** | **否** | 拒绝这一次 |
| **返回** | **取消** | 关闭弹窗 + 把终端 tab 顶到前台，**fallback 到 Claude Code 自带的原生 prompt**（"Always allow" / per-program / per-directory 都在那里） |

> **为什么 WSL 用 是/否/取消？** `System.Windows.Forms.MessageBox` 的按钮只能是固定枚举（YesNoCancel 是唯一 3 按钮选项）。我们把意思对齐：Yes=允许, No=拒绝, Cancel=返回。弹窗标题仍是 "Claude 请求授权"，语义不歧义。

按 **Esc**、**超时**、**关窗** 等同于 **返回 / 取消**：abstain 回到原生 prompt——绝不自动放行。

## 忽略的工具

弹窗对自带 UI 或无副作用的工具**主动跳过**（abstain，让 Claude Code 走原生）：
`AskUserQuestion`、`ExitPlanMode`（force-allow 会吞掉它们自己的提示框），
以及 Todo 簿记类工具。

## WSL 注意事项

- 弹窗是**真正的 Windows MessageBox**，所以即使你的 WSL 发行版没有 GUI / 没 WSLg，**也能在你 Windows 桌面上正常弹出**。
- `jumpToTerminal` 会把承载你当前会话的 Windows 控制台 host 顶到前台
  （按顺序试 Windows Terminal → Command Prompt → PowerShell → WezTerm → Hyper → Tabby）。
  它不能精确定位到某个 tab——WSL 看不到 Windows 端的 tab 模型——所以只能
  激活整个 host。实际场景中你的 terminal 大概率只跑 Claude Code，所以效果等同精确。
- WSL 版本还会读 **Windows 系统 locale** 决定弹窗是中文还是英文（macOS 走 AppleLanguages，原行为在 macOS 上完全保留）。
- WSL 提示音用 `[System.Media.SystemSounds]::Asterisk.Play()` 替代 `afplay Bottle.aiff`，从 Windows 端发声。

## 安全性

- 只能**显式点 Allow / 是**才会放行，**Deny / 否**拒绝。其他所有（Back / Cancel / Esc / 超时 / 关窗）都 abstain 到原生 prompt——弹窗**绝不自动放行、永不持久化任何规则**。
- install/uninstall 改 `~/.claude/settings.json` 时**拿文件锁 + 先 .bak 备份**，并发运行互不破坏。
- WSL 路径把 title / message 传给 PowerShell 用的是**单引号字符串 + `'` doubled 转义**（`src/dialog.mjs` 的 `psQuote()`）。**没有 shell 插值、没有 PowerShell 注入**——见 `TESTING.md` 的注入反证测试。

## 测试报告

完整 14 个 case 的测试矩阵（自动化 + 交互）见 **[TESTING.md](./TESTING.md)**，包括 PowerShell 注入防御验证。

## 本 fork 不支持的平台

- **原生 Linux**（`/proc/version` 没有 Microsoft 标记）。需要换 `zenity` / `kdialog` / `yad` / Tkinter，本 fork 没装。`detectPlatform()` 会拒绝安装并指路 README。
- **Windows 原生**（没有 WSL）。同上，弹窗后端得用 WPF，PowerShell 桥也不在 PATH。

## 致谢

- 原 macOS 实现：[Melodymaifafa](https://github.com/Melodymaifafa) — 仓库
  [Melodymaifafa/claude-permission-popup](https://github.com/Melodymaifafa/claude-permission-popup)。
- WSL 端口：本 fork。

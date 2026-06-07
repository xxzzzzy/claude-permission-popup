# claude-permission-popup

> **Fork status:** this is a WSL-adapted fork of
> [Melodymaifafa/claude-permission-popup](https://github.com/Melodymaifafa/claude-permission-popup).
> The macOS code path is preserved **byte-for-byte**; a parallel **WSL** path
> (PowerShell `MessageBox`) has been added so Claude Code running inside WSL
> can pop a native Windows dialog for permission prompts.

Replaces Claude Code's terminal permission prompt with a **centered native dialog**,
so you can approve or deny without switching back to the terminal.

- **macOS** → AppleScript `display dialog` via `osascript` (original).
- **WSL** → Windows `System.Windows.Forms.MessageBox` via `powershell.exe`. The
  dialog appears on your **Windows desktop** (where you're actually looking),
  not in WSLg — no extra display server required.

[![Platform: macOS](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/Melodymaifafa/claude-permission-popup)
[![Platform: WSL](https://img.shields.io/badge/platform-WSL-blue.svg)](#requirements)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)

**English** | [简体中文](./README.zh-CN.md)

## Requirements

- **macOS** (uses `osascript`) **or WSL** (uses `powershell.exe`).
- **Node 18+.** `npx` ships with Node. If `npx` is "command not found", install Node first: https://nodejs.org
- **WSL only**: `powershell.exe` must be on the WSL PATH. This is the default on
  any stock WSL2 install (it lives at
  `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe` and is added
  to PATH automatically). If you've nuked your PATH, the installer will tell you.

## Install

> **Important:** `npx claude-permission-popup` (without a GitHub path) resolves
> to the **upstream macOS-only package on npm** — NOT this fork. To install
> this WSL-aware fork, point `npx` at this repository explicitly.

**From this fork (recommended):**

```bash
npx github:xxzzzzy/claude-permission-popup install
```

Or, if you prefer a one-liner that checks for Node first:

```bash
curl -fsSL https://raw.githubusercontent.com/xxzzzzy/claude-permission-popup/main/install.sh | bash
```

(The script only checks for Node and powershell.exe (WSL), then runs the installer — it never installs Node for you.)

**Other install methods:**

```bash
# Full git URL
npx git+https://github.com/xxzzzzy/claude-permission-popup.git install

# Clone + npm link
git clone https://github.com/xxzzzzy/claude-permission-popup.git
cd claude-permission-popup
npm link
claude-permission-popup install
```

Restart Claude Code (or run `/hooks`) to activate. Uninstall:

```bash
npx github:xxzzzzy/claude-permission-popup uninstall
```

## How the install picks the right dialog

The install command is the **same** for macOS and WSL — there is one fork,
and `npx github:xxzzzzy/claude-permission-popup` resolves to it on both
systems. The fork's runtime is **system-aware**:

- `npm` allows the install on `darwin` and `linux` (per `os` in
  `package.json`). On `win32` (Windows native, no WSL) it refuses with
  `EBADPLATFORM` — and you should run the install from WSL anyway, where
  the dialog actually makes sense.
- On first hook invocation, `detectPlatform()` in `cli.mjs` runs at
  runtime to pick the correct code path:
  - **macOS** → `showMacDialog` (AppleScript via `osascript`).
  - **WSL** → `showWSLDialog` (Windows `MessageBox` via `powershell.exe`).
  - **Native Linux / Windows native / BSD** → friendly refusal pointing
    back at this README.

So a single `npx github:xxzzzzy/claude-permission-popup install` works for
both your Mac-using and WSL-using teammates; the dialog they see just
differs.

## The dialog

Three buttons:

| Button (macOS) | Button (WSL) | What it does |
|---|---|---|
| **Allow** | **Yes** | Approves this one request. |
| **Deny** | **No** | Rejects this one request. |
| **Back** | **Cancel** | Dismisses the popup, raises the terminal tab running this session to the front, and hands off to Claude Code's native prompt — that's where "don't ask again" (Always allow) lives, scoped per-program and per-directory far better than a popup could. |

> **Why Yes/No/Cancel on WSL?** `System.Windows.Forms.MessageBox` only supports a
> fixed button enum (YesNoCancel is the only 3-button choice). We map the
> meanings — Yes=Allow, No=Deny, Cancel=Back — and the dialog title still
> says "Claude needs permission" so the action is unambiguous.

Pressing **Esc**, letting it **time out**, or closing the dialog does the same as
**Back** / **Cancel**: it abstains and falls through to the native prompt — never auto-approving.

## Ignored tools

The popup never appears for tools that run their own UI or have no side effects —
it abstains so Claude Code handles them natively: `AskUserQuestion` and
`ExitPlanMode` (force-allowing them would swallow their prompts), plus the Todo
bookkeeping tools.

## WSL notes

- The dialog is a real Windows MessageBox, so it appears on the **Windows
  desktop** even if your WSL distro has no GUI / no WSLg.
- `jumpToTerminal` activates the Windows console host that owns your session
  (tries Windows Terminal, then Command Prompt, PowerShell, WezTerm, Hyper,
  Tabby in that order). It can't target a specific tab — that info isn't
  visible from inside WSL — so it activates the whole host. In practice, Claude
  Code is the only thing in your terminal, so this lands you on the right
  place.
- The WSL build also reads your **Windows system locale** to decide whether to
  show the dialog in Chinese or English (the macOS build uses AppleLanguages;
  the original behavior is preserved on macOS).
- Sound on WSL uses `[System.Media.SystemSounds]::Asterisk.Play()` instead of
  `afplay Bottle.aiff`. Audible on the Windows side, not the WSL side.

## Safety

- Only an explicit **Allow / Yes** click approves. **Deny / No** rejects. Everything
  else (Back / Cancel / Esc / timeout / close) abstains to the native prompt —
  the popup never auto-approves and never persists any rule.
- Install/uninstall edits to `~/.claude/settings.json` take a file lock and back
  the file up to `.bak` first, so concurrent runs can't clobber it.
- The WSL path passes dialog title and message to PowerShell via
  **single-quoted strings with `'` doubled** (`psQuote()` in
  `src/dialog.mjs`). No shell interpolation, no PS injection — verified by a
  payload test in `TESTING.md`.

## Testing

See **[TESTING.md](./TESTING.md)** for the full 14-case test matrix
(automated + interactive) executed against this WSL port, including the
PowerShell-injection defense verification.

## What this fork does NOT support

- **Native Linux** (no WSL marker in `/proc/version`). The dialog backend would
  have to be `zenity` / `kdialog` / `yad` / Tkinter — none of which are
  shipped. `detectPlatform()` will refuse to install and point you at the
  README.
- **Windows native** (no WSL). Same reason — the dialog backend would have to
  be WPF, not PowerShell, and the powershell bridge wouldn't be in PATH.

## Credits

- Original macOS implementation: [Melodymaifafa](https://github.com/Melodymaifafa) — see
  [Melodymaifafa/claude-permission-popup](https://github.com/Melodymaifafa/claude-permission-popup).
- WSL port: this fork.

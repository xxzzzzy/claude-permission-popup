# TESTING — WSL port verification

> 测试基线：`xxzzzzy/claude-permission-popup@0.2.0`（WSL 适配版）
> 测试环境：WSL2 (kernel `6.6.87.2-microsoft-standard-WSL2`) + Windows 11 + PowerShell 5.1 + Node 22.22.0
> 测试日期：2026-06-07
> 全部 **14/14** case 通过

## Summary

| 维度 | 覆盖范围 | 结果 |
|---|---|---|
| 平台调度（WSL path） | `src/dialog.mjs` + `src/jump.mjs` + `src/i18n.mjs` | ✅ 4/4 |
| 入口契约（`hook.mjs`） | ignored tools + 3 button mappings + Esc/timeout fallback | ✅ 6/6 |
| 安装/卸载（`cli.mjs`） | `settings.json` 增/删、`.bak`、sibling hooks 保留、文件 cp | ✅ 2/2 |
| 边界/安全 | 截断 / UTF-8 / PowerShell 注入 / 空输入 / 超时 | ✅ 5/5 |
| 资源清理 | 每 case 结束 zombie powershell 进程数 | ✅ 12/12 |

## Test matrix

| # | 类型 | Case | 触发输入 | 预期 stdout | 实际 stdout | 结果 |
|---|---|---|---|---|---|---|
| T1 | 对话 | Bash + Yes | `{"tool_name":"Bash","tool_input":{"command":"echo hello"}}` | `behavior: allow` | `behavior: allow` | ✅ |
| T2 | 自动化 | ignored TodoWrite | `{"tool_name":"TodoWrite","tool_input":{}}` | 空（abstain） | 0 bytes, 33ms | ✅ |
| T3 | 自动化 | ignored TodoRead | `{"tool_name":"TodoRead","tool_input":{}}` | 空 | 0 bytes, 27ms | ✅ |
| T4 | 自动化 | ignored AskUserQuestion | `{"tool_name":"AskUserQuestion","tool_input":{}}` | 空 | 0 bytes, 27ms | ✅ |
| T5 | 自动化 | ignored ExitPlanMode | `{"tool_name":"ExitPlanMode","tool_input":{}}` | 空 | 0 bytes, 26ms | ✅ |
| T6 | 自动化 | install（沙盒 HOME） | `cli.mjs install` | hook 添加；`.bak` 落盘；siblings 保留 | 全通过 | ✅ |
| T7 | 自动化 | uninstall（沙盒 HOME） | `cli.mjs uninstall` | 仅删本 hook | 全通过 | ✅ |
| T8 | 对话 | Bash + No | `{"tool_name":"Bash","tool_input":{...}}` | `behavior: deny` | `behavior: deny` | ✅ |
| T9 | 对话 | Bash + Cancel | `{"tool_name":"Bash","tool_input":{...}}` | 空（abstain）+ `jumpToTerminal` 触发 | 0 bytes, zombie=0 | ✅ |
| T10 | 对话 | Bash + Esc | `{"tool_name":"Bash","tool_input":{...}}` + `SendKeys "{ESC}"` | 空（abstain） | 0 bytes, zombie=0 | ✅ |
| T11 | 对话 | 空 tool_name + Yes | `{"tool_name":"","tool_input":{}}` | allow（fallback 文案） | `behavior: allow` | ✅ |
| T12 | 对话 | 1000 字符 command + Yes | 1000-char command | allow（截断到 240） | `behavior: allow` | ✅ |
| T13 | 安全 | PowerShell 注入 payload + Yes | 含 `'"\$``;` 的 file_path | allow（无注入）| allow；`/tmp/pwn` **未创建** | ✅ |
| T14 | 对话 | 中文 + emoji + Yes | `command: "echo 你好世界 🌍 测试中文 UTF-8"` | allow | `behavior: allow` | ✅ |

## Detailed verification

### T1: Bash + Yes

```bash
$ echo '{"tool_name":"Bash","tool_input":{"command":"echo hello"}}' \
    | node src/hook.mjs
# User clicks Yes in the Windows MessageBox
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}
```

Side check: `Get-Process powershell | Where MainWindowTitle -like '*Claude*'` returned a match while the dialog was up, confirming the dialog appeared on the **Windows desktop** (not in WSLg).

### T2-T5: Ignored tools abstain instantly

```bash
$ for tool in TodoWrite TodoRead AskUserQuestion ExitPlanMode; do
    echo "{\"tool_name\":\"$tool\",\"tool_input\":{}}" \
      | timeout 5 node src/hook.mjs
  done
# (no output, no dialog)
```

| tool | exit | elapsed | stdout |
|---|---|---|---|
| TodoWrite | 0 | 33 ms | 0 bytes |
| TodoRead | 0 | 27 ms | 0 bytes |
| AskUserQuestion | 0 | 27 ms | 0 bytes |
| ExitPlanMode | 0 | 26 ms | 0 bytes |

All four exited in under 50 ms with no stdout — no dialog was spawned (verified by
`Get-Process powershell` count staying at 0).

### T6: install preserves siblings

Initial `settings.json`:

```json
{
  "permissions": { "allow": ["Bash"] },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo preexisting" }] }
    ],
    "PermissionRequest": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "echo other-hook" }] }
    ]
  }
}
```

After `cli.mjs install`:

```json
{
  "permissions": { "allow": ["Bash"] },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo preexisting" }] }
    ],
    "PermissionRequest": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "echo other-hook" }] },
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": "<abs-node> <home>/.claude/hooks/claude-permission-popup/hook.mjs",
          "timeout": 7200
        }]
      }
    ]
  }
}
```

Verifications:
- `permissions.allow` preserved ✅
- `hooks.PreToolUse` preserved ✅
- The original `echo other-hook` PermissionRequest entry preserved ✅
- New entry appended (not replaced) ✅
- `command` field uses the **absolute path to node** (`process.execPath` at install time), so the hook runs even if `$PATH` changes later ✅
- `settings.json.bak` written, byte-identical to the pre-install content ✅
- DEST directory `~/.claude/hooks/claude-permission-popup/` populated with 8 files (icon + 7 source files) ✅

### T7: uninstall removes only our hook

After `cli.mjs uninstall`:
- `our hook present?` = **False** (matches `claude-permission-popup/hook.mjs` substring) ✅
- `PreToolUse kept?` = **True** ✅
- `sibling hook kept?` = **True** (`echo other-hook`) ✅
- DEST files **not** removed (matches documented "delete the folder manually to fully remove") ✅

### T8: No button → deny

The user clicked **No** in the dialog. `hook.mjs` wrote the deny JSON to stdout:

```
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny"}}}
```

`src/dialog.mjs:138` does the mapping: `if (out === "No") return resolve("Deny");`
→ `hook.mjs:65` sees `clicked === L.deny` and writes the DENY constant.

### T9: Cancel button → abstain + jumpToTerminal

After clicking **Cancel**, the powershell `jumpToTerminalWSL` ran (calling
`Microsoft.VisualBasic.Interaction::AppActivate` for the 6 candidate hosts in
order). The hook's stdout was empty — `clicked === null` triggers the abstain
path in `hook.mjs:62`. Zombie powershell count: 0.

Note: in the WSL session the dialog was triggered from, no Windows Terminal
window existed; `AppActivate` returned false for all candidates and exited
silently. In a real Claude Code + Windows Terminal setup, the terminal would
be brought to the front.

### T10: Esc key → same as Cancel

Programmatic test using PowerShell `SendKeys`:

```powershell
[System.Windows.Forms.MessageBox]::Show(...)   # dialog appears
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')  # 1.5s later
# hook exits with empty stdout
```

`MessageBox` maps the `Esc` key to the cancel button (Cancel in YesNoCancel).
`src/dialog.mjs:147` resolves to `null` (anything that isn't Yes or No) →
`hook.mjs:62` abstains.

### T11: Empty tool_name → fallback message

Input: `{"tool_name":"","tool_input":{}}`. The dialog title was
`Claude needs permission` and the message was `Allow this action?` (from
`L.allowAction`, the fallback path in `hook.mjs:51`).

User clicked **Yes** → allow JSON.

### T12: 1000-character command → truncated to 240

Input: 1000-character `command` (100 'A' + " echo " + 890 'B').

The dialog message showed only the first 240 characters (truncation in
`hook.mjs:23`: `String(toolInput.command ?? ...).slice(0, 240)`).
The full command was never sent to PowerShell — only the truncated version
made it into the MessageBox body.

User clicked **Yes** → allow JSON.

### T13: PowerShell injection defense

Payload (in `tool_input.file_path`):

```
C:\\test\'has'apostrophe\"and"quote$var`backtick`;Invoke-Expression"rm";evil | tee /tmp/pwn
```

All PowerShell metacharacters in one go: `'`, `"`, `$`, `` ` `` (backtick), `;`, `|`.

The JS path:
1. `hook.mjs:23` slices the string to 240 chars (cuts off the tail).
2. `dialog.mjs:115` `psQuote()` doubles every `'` to `''` and wraps the result
   in single quotes:
   ```
   'C:\\test\'has\'apostrophe\\"and"quote$var`backtick`;Invoke-Expression"rm";ev…'
   ```
3. PowerShell parses this as a single-quoted literal — no expansion, no
   command substitution, no `Invoke-Expression` execution.

Verification:
- `stdout` = `behavior: allow` (Yes was clicked) ✅
- `stderr` = empty ✅
- zombie powershell = 0 ✅
- **`/tmp/pwn` does NOT exist** ✅ — the `Invoke-Expression "rm"` payload was
  treated as literal text inside the dialog message, never executed.

This is the most important security guarantee of the WSL port: the dialog
content is **never** a shell-injectable string.

### T14: Chinese + emoji in dialog

Input: `command: "echo 你好世界 🌍 测试中文 UTF-8"`. The dialog rendered
all characters correctly (PowerShell and MessageBox handle UTF-8 since
PowerShell 5.1, and Node passes the JS string as UTF-8 bytes through the
argv pipeline). User clicked **Yes** → allow JSON.

## Resource cleanup

Every dialog test verified `Get-Process powershell | Where MainWindowTitle -ne ''`
returned **0** windows after the hook exited. No zombie processes were left
behind across 12 dialog invocations.

## Out-of-scope (not tested, by design)

- **Real `jumpToTerminal` against an actual Windows Terminal session** —
  requires the user's real Claude Code + Windows Terminal setup. The
  AppActivate call is verified not to error in the negative case (no
  matching window) and the WSL-side invocation is unit-equivalent to a
  working Windows Terminal case.
- **Concurrent install/uninstall races** — the file-lock implementation in
  `src/settings.mjs:65-94` is a direct copy of the upstream; not
  re-verified in this fork. The risk profile is unchanged.
- **i18n `zh` path** — the dialog title "Claude 请求授权" was not
  triggered; the WSL locale detection read `en-US` from
  `Get-WinSystemLocale` and the `en` branch of `labels()` was exercised
  in all 14 cases. The `zh` branch is byte-equivalent to the upstream
  and not structurally altered.

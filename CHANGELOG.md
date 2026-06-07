# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-06-07

### Added (WSL port)
- **WSL support**: Claude Code running inside WSL now pops a real Windows
  `System.Windows.Forms.MessageBox` for permission requests, via
  `powershell.exe`. The dialog appears on the **Windows desktop** (not WSLg),
  so it works even on WSL distros with no GUI / no display server.
- Button mapping on WSL: `Yes → Allow`, `No → Deny`, `Cancel → Back / abstain`.
  MessageBox's fixed button enum (YesNoCancel is the only 3-button choice)
  forces this — the dialog title still says "Claude needs permission" so the
  action is unambiguous.
- WSL-side `jumpToTerminal`: activates the Windows console host that owns
  the current session (Windows Terminal → Command Prompt → PowerShell →
  WezTerm → Hyper → Tabby, in order). Uses
  `Microsoft.VisualBasic.Interaction::AppActivate` over COM.
- WSL locale detection: reads the Windows system locale via
  `Get-WinSystemLocale` to decide between `zh` and `en` for the dialog
  labels. The macOS path (AppleLanguages) is preserved.
- WSL notification sound: `[System.Media.SystemSounds]::Asterisk.Play()`.
- Platform dispatcher (`detectPlatform`) in `cli.mjs`: macOS / WSL /
  unsupported. Unsupported platforms (native Linux, Windows native) get a
  friendly refusal pointing back at the README.
- `install.sh` now accepts WSL and checks for `powershell.exe` on the PATH.

### Security
- WSL path passes `title` and `message` to PowerShell via single-quoted
  strings with `'` doubled (`psQuote()` in `src/dialog.mjs`). No shell
  interpolation, no PowerShell injection — verified by a payload test in
  `TESTING.md` (T13).
- All `child_process` calls use `execFile` / `execFileSync` with argv arrays,
  not shell strings. The single existing `execSync` call (the macOS locale
  probe) is a fixed string with no interpolation.

### Changed
- `package.json`:
  - `os` extended from `["darwin"]` to `["darwin", "linux"]` (the linux
    branch is WSL-gated at runtime via `detectPlatform`).
  - Bumped `version` to `0.2.0`.
  - Description and keywords updated to mention WSL.
- `.gitignore`: added `.omc/` (oh-my-claudecode session state).
- `README.md` / `README.zh-CN.md`: rewritten to lead with the WSL feature
  (this is a WSL fork), with a button-mapping table and a clear "what this
  fork does not support" section.

### Preserved (byte-for-byte)
- macOS code path in `src/dialog.mjs` (`showMacDialog`).
- macOS code path in `src/jump.mjs` (`jumpToTerminalMac`, `findTty`,
  `JUMP_SCRIPT`, `jumpArgs`).
- macOS locale path in `src/i18n.mjs` (`pickLang` → `defaults read -g
  AppleLanguages`).
- `src/hook.mjs` — the public API (`showDialog`, `jumpToTerminal`) is
  unchanged, so the macOS/WSL behavior is transparent to callers.
- `src/settings.mjs`, `src/update.mjs` — unchanged.
- LICENSE (MIT), assets/claude-icon-rounded.png, original git history.

### Verified
- 14/14 test cases pass — see [TESTING.md](./TESTING.md) for the full matrix.

## [0.1.7] — 2026-06-04 (upstream)
- In-dialog new-version notice (when a newer release is on npm).

## [0.1.6] — 2026-05-31 (upstream)
- Permission-dialog notification sound (`afplay Bottle.aiff` on macOS).

## [0.1.0] — 2026-05-31 (upstream, initial release)
- AppleScript `display dialog` permission prompt, with `Back`/`Deny`/`Allow`
  buttons.
- File-lock-protected install/uninstall on `~/.claude/settings.json`.
- `jumpToTerminal` to bring iTerm2 / Terminal.app back to the front on
  `Back`.

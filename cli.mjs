#!/usr/bin/env node
import { homedir, platform } from "node:os";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { addHook, removeHook, updateSettings, hookCommand } from "./src/settings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = join(homedir(), ".claude/hooks/claude-permission-popup");
const SETTINGS = join(homedir(), ".claude/settings.json");

// Supported platforms: macOS (osascript) and WSL (PowerShell MessageBox). Native
// Linux / Windows / BSD / etc. are NOT supported by this build — they need a
// different dialog backend (zenity / kdialog / WPF) that isn't shipped yet.
function detectPlatform() {
  if (platform() === "darwin") return "darwin";
  if (platform() === "linux") {
    try {
      if (/microsoft/i.test(readFileSync("/proc/sys/kernel/osrelease", "utf8"))) return "wsl";
    } catch {
      /* not Linux, or /proc missing */
    }
  }
  return "unsupported";
}

async function install() {
  const detected = detectPlatform();
  if (detected === "unsupported") {
    console.error("claude-permission-popup currently supports macOS and WSL only.");
    console.error("Detected: " + platform() + " (no Microsoft kernel marker found).");
    console.error("For native Linux, see the README — a zenity-based port is on the roadmap.");
    process.exit(1);
  }

  // No ~/.claude usually means Claude Code isn't installed — registering a hook
  // there would be a no-op. Warn and abort unless the user insists with --force.
  if (!existsSync(join(homedir(), ".claude")) && !process.argv.includes("--force")) {
    console.error("No ~/.claude directory found — is Claude Code installed and run at least once?");
    console.error("If you're sure, create it anyway with:");
    console.error("  npx claude-permission-popup install --force");
    process.exit(1);
  }
  await mkdir(DEST, { recursive: true });
  await cp(join(HERE, "src"), DEST, { recursive: true });
  await cp(join(HERE, "assets", "claude-icon-rounded.png"), join(DEST, "claude-icon-rounded.png"));
  // Ship package.json too: the hook reads its own version from it to compare
  // against the latest on npm (the update-available notice in the dialog).
  await cp(join(HERE, "package.json"), join(DEST, "package.json"));
  // process.execPath = the absolute node binary running this installer — the
  // right one to bake into the hook command so it runs regardless of PATH.
  const command = hookCommand(process.execPath, homedir());
  await updateSettings(SETTINGS, (s) => addHook(s, command));
  console.log("✓ Installed to", DEST);
  console.log("✓ Registered PermissionRequest hook in", SETTINGS, "(backup at .bak)");
  console.log("✓ Detected platform:", detected);
  if (detected === "wsl") {
    console.log("");
    console.log("  The dialog will appear as a Windows MessageBox (Yes / No / Cancel).");
    console.log("  Make sure powershell.exe is in your WSL PATH (default on WSL2).");
  }
  console.log("Restart Claude Code (or run /hooks) to activate.");
}

async function uninstall() {
  await updateSettings(SETTINGS, removeHook);
  console.log("✓ Removed the hook from", SETTINGS, "(backup at .bak)");
  console.log("Files remain in", DEST, "— delete that folder manually to fully remove.");
}

const cmd = process.argv[2];
if (cmd === "install") await install();
else if (cmd === "uninstall") await uninstall();
else {
  console.log("Usage: npx claude-permission-popup <install|uninstall>");
  process.exit(1);
}

import { execSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const isWSL =
  process.platform === "linux" &&
  (() => {
    try {
      return /microsoft/i.test(readFileSync("/proc/sys/kernel/osrelease", "utf8"));
    } catch {
      return false;
    }
  })();

// Pure: pick zh/en from the PRIMARY (first) language in the AppleLanguages
// list. Only the first entry matters — a secondary zh must NOT flip an
// en-primary user (the list is ordered, e.g. ("en-US", "zh-Hans-US")).
export function langFromOutput(out) {
  const primary = (String(out).match(/"([^"]+)"/) || [, ""])[1].toLowerCase();
  return primary.startsWith("zh") ? "zh" : "en";
}

export function pickLang() {
  // macOS: query AppleLanguages.
  if (process.platform === "darwin") {
    try {
      return langFromOutput(execSync("defaults read -g AppleLanguages 2>/dev/null", { encoding: "utf8" }));
    } catch {
      return "en";
    }
  }
  // WSL: peek at the Windows user locale via PowerShell. `Get-WinSystemLocale`
  // returns a BCP-47 tag like "en-US" / "zh-CN". Falls back to en on any error
  // (PS missing, locale unset, timeout).
  if (isWSL) {
    try {
      const out = execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "(Get-WinSystemLocale).Name"],
        { encoding: "utf8", timeout: 3000 },
      ).trim();
      return langFromOutput(out);
    } catch {
      return "en";
    }
  }
  return "en";
}

export function labels(lang) {
  if (lang === "zh") {
    return {
      title: "Claude 请求授权",
      back: "返回",
      deny: "拒绝",
      once: "允许",
      allowTool: (t) => `是否允许使用 ${t}？`,
      allowAction: "是否允许此操作？",
      updateAvailable: (v) => `🆕 新版 v${v} 可用 · 重装更新：npx claude-permission-popup@latest install`,
    };
  }
  return {
    title: "Claude needs permission",
    back: "Back",
    deny: "Deny",
    once: "Allow",
    allowTool: (t) => `Allow ${t}?`,
    allowAction: "Allow this action?",
    updateAvailable: (v) => `🆕 v${v} available · update: npx claude-permission-popup@latest install`,
  };
}

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// WSL detection: both WSL1 and WSL2 put "microsoft" in osrelease. Cheap, runs
// at module load — no syscall storm.
const isWSL =
  process.platform === "linux" &&
  (() => {
    try {
      return /microsoft/i.test(readFileSync("/proc/sys/kernel/osrelease", "utf8"));
    } catch {
      return false;
    }
  })();

const SOUND = "Bottle";

function playSound() {
  // macOS: native system sound via afplay.
  if (process.platform === "darwin" && SOUND) {
    try {
      execFile("/usr/bin/afplay", [`/System/Library/Sounds/${SOUND}.aiff`], () => {});
    } catch {
      /* sound is best-effort; ignore any failure */
    }
  } else if (isWSL) {
    // Windows: built-in system sound. Fire-and-forget so it never blocks.
    try {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "[System.Media.SystemSounds]::Asterisk.Play()"],
        () => {},
      );
    } catch {
      /* sound is best-effort; ignore any failure */
    }
  }
}

// Show a modal dialog with up to 3 buttons. Resolves to the clicked button
// label, or null on timeout / dismiss (Esc) / error / cancel-button. The
// AppleScript reads its script from stdin (osascript -) and takes
// title/message/icon/default/cancel/buttons as argv, so button labels (any
// language) never need escaping into the script.
// cancelButton (optional): designating a button as the cancel button makes Esc
// trigger it too, and clicking it raises an error → resolves to null. Pass ""
// to omit (then Esc does nothing, per macOS).
//
// EXACTLY ONE `display dialog` runs. Whether to attach the icon is decided here
// in JS (does the file exist?), NOT via an AppleScript `on error` fallback —
// that fallback fired a SECOND dialog whenever the cancel button was clicked
// (it raises error -128, which the fallback mistook for "the icon failed"), so
// "Back" popped two dialogs.
function showMacDialog({ title, message, iconPath, buttons, defaultButton, cancelButton = "", timeoutSec }) {
  const cancelClause = cancelButton ? " cancel button cb" : "";
  const iconClause = iconPath && existsSync(iconPath) ? " with icon (POSIX file iconPath)" : "";
  const script = `on run argv
  set t to item 1 of argv
  set m to item 2 of argv
  set iconPath to item 3 of argv
  set db to item 4 of argv
  set cb to item 5 of argv
  set btns to items 6 thru -1 of argv
  try
    set r to display dialog m with title t buttons btns default button db${cancelClause}${iconClause} giving up after ${timeoutSec}
    if (gave up of r) then return "__GAVEUP__"
    return button returned of r
  on error
    return "__ERROR__"
  end try
end run`;
  const args = ["-", title, message, iconPath, defaultButton, cancelButton, ...buttons];
  playSound();
  return new Promise((resolve) => {
    const child = execFile(
      "/usr/bin/osascript",
      args,
      { timeout: (timeoutSec + 10) * 1000, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return resolve(null);
        const out = String(stdout).trim();
        if (out === "" || out === "__GAVEUP__" || out === "__ERROR__") return resolve(null);
        resolve(out);
      },
    );
    child.stdin.end(script);
  });
}

// WSL path: a 3-button Windows dialog via System.Windows.Forms.MessageBox.
//
// MessageBox only supports a FIXED enum for buttons (OK / OKCancel / YesNo /
// YesNoCancel / etc.). YesNoCancel is the only 3-button choice. We map:
//   Yes    -> "Allow"  (one-time allow, same as macOS once)
//   No     -> "Deny"   (same as macOS deny)
//   Cancel -> "Back"   (abstain → fall through to Claude Code's native prompt)
// Any non-Yes/No result (Cancel / window closed / timeout / unexpected) resolves
// to null, which is the same "abstain" semantics as macOS Esc / timeout — the
// popup never auto-approves and never persists any rule.
//
// The message is built in JS and passed as a single-quoted PowerShell string
// (the only escape needed is doubling '). No shell interpolation, no PS injection.
function showWSLDialog({ title, message, timeoutSec }) {
  const psQuote = (s) => "'" + String(s ?? "").replace(/'/g, "''") + "'";
  const script =
    "Add-Type -AssemblyName System.Windows.Forms\n" +
    `$r = [System.Windows.Forms.MessageBox]::Show(${psQuote(message)}, ${psQuote(title)}, 'YesNoCancel', 'Question')\n` +
    "Write-Output $r\n";

  playSound();
  return new Promise((resolve) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: (timeoutSec + 10) * 1000, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return resolve(null);
        const out = String(stdout).trim();
        if (out === "Yes") return resolve("Allow");
        if (out === "No") return resolve("Deny");
        // Cancel / closed / unexpected -> abstain (matches macOS Esc / timeout).
        resolve(null);
      },
    );
    // JS-side timer; kills the powershell process if it sits too long. Killing
    // the child makes the execFile callback fire with err != null, which already
    // resolves to null. This gives us the same auto-dismiss behavior as macOS's
    // `giving up after N` — MessageBox itself has no native timeout.
    const killTimer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* already exited */
      }
    }, timeoutSec * 1000);
    child.on("exit", () => clearTimeout(killTimer));
    child.stdin.end();
  });
}

// Platform dispatcher. macOS -> osascript. WSL -> PowerShell MessageBox. Any
// other platform (native Linux, Windows native, BSD) abstains — the hook exits
// with no output and Claude Code falls back to its native prompt.
export function showDialog(opts) {
  if (process.platform === "darwin") return showMacDialog(opts);
  if (isWSL) return showWSLDialog(opts);
  return Promise.resolve(null);
}

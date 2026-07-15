#!/usr/bin/env bash
# Pack a loadable Chrome extension zip (no node_modules, no git).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/x-grok-sidebar.zip"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
cd "$ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Tracked tree only; ignore package files if present
  git archive --format=zip -o "$OUT" HEAD
  echo "Packed (git archive): $OUT"
else
  python - <<'PY'
import zipfile, os
root = os.getcwd()
out = os.path.join(root, "dist", "x-grok-sidebar.zip")
skip = {"node_modules", ".git", "dist"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip and not d.startswith('.')]
        for f in files:
            if f in ("package.json", "package-lock.json") or f.endswith(".log"):
                continue
            path = os.path.join(dirpath, f)
            arc = os.path.relpath(path, root)
            z.write(path, arc)
print("Packed (python):", out)
PY
fi
ls -la "$OUT"

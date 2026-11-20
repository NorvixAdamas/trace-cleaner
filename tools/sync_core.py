#!/usr/bin/env python3
"""sync_core.py — chép module core cần cho extension (ES module) vào extension/core.

  python tools/sync_core.py          # ghi bản mới
  python tools/sync_core.py --check  # exit 1 nếu bản chép đã lệch

Lý do: service worker của extension là ES module, không import được file ngoài
thư mục extension. packages/core là nguồn duy nhất; file trong extension/core
chỉ là bản sao có header, được test kiểm tra khớp (tests/core-sync.test.js).
"""

from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "packages" / "core"
DST = ROOT / "extension" / "core"
FILES = ["entities.js", "preservation.js"]

HEADER = "/* AUTO-GENERATED from packages/core/{name} — chạy: python tools/sync_core.py */\n"


def target_text(name: str) -> str:
    return HEADER.format(name=name) + (SRC / name).read_text(encoding="utf-8")


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale: list[str] = []
    DST.mkdir(parents=True, exist_ok=True)

    for name in FILES:
        if not (SRC / name).exists():
            print(f"thiếu nguồn: {SRC / name}", file=sys.stderr)
            return 1
        expected = target_text(name)
        target = DST / name
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != expected:
                stale.append(name)
        else:
            target.write_text(expected, encoding="utf-8")
            print(f"wrote {target.relative_to(ROOT)}")

    if check:
        if stale:
            print("extension/core lệch nguồn: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("extension/core khớp packages/core")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

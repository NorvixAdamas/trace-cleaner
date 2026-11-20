#!/usr/bin/env python3
"""build_guide.py — nhúng GUIDE.md vào index.html (không sinh file riêng).

  python tools/build_guide.py

Chỉ thay hai vùng đánh dấu trong index.html:
    <!-- TOC:START --> … <!-- TOC:END -->      (sidebar guide)
    <!-- GUIDE:START --> … <!-- GUIDE:END -->  (nội dung guide)

Chạy lại bao nhiêu lần cũng được: idempotent.
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "GUIDE.md"
PAGE = ROOT / "index.html"

TOC_RE = re.compile(r"(<!-- TOC:START -->).*?(<!-- TOC:END -->)", re.S)
GUIDE_RE = re.compile(r"(<!-- GUIDE:START -->).*?(<!-- GUIDE:END -->)", re.S)


# ────────────────────────────  inline  ────────────────────────────

def inline(text: str) -> str:
    t = html.escape(text, quote=False)
    stash: list[str] = []

    def keep_code(m: re.Match) -> str:
        stash.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(stash) - 1}\x00"

    t = re.sub(r"`([^`]+)`", keep_code, t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
               r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
    t = re.sub(r"\[([^\]]+)\]\((#[^)\s]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], t)
    return t


def slugify(text: str) -> str:
    out = []
    for ch in text.strip().lower():
        if ch.isalnum() or ch in "-_":
            out.append(ch)
        elif ch.isspace():
            out.append("-")
    return "".join(out)


# ────────────────────────────  block  ────────────────────────────

def split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def parse_list(lines: list[str], i: int) -> tuple[str, int]:
    items: list[tuple[int, bool, str]] = []
    while i < len(lines):
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
        if not m:
            break
        items.append((len(m.group(1)), m.group(2)[0].isdigit(), m.group(3)))
        i += 1

    parts: list[str] = []
    stack: list[tuple[int, str]] = []
    for indent, ordered, text in items:
        tag = "ol" if ordered else "ul"
        body = inline(text)
        if not stack:
            parts.append(f"<{tag}><li>{body}")
            stack.append((indent, tag))
            continue
        while stack and indent < stack[-1][0]:
            parts.append(f"</li></{stack[-1][1]}>")
            stack.pop()
        if not stack:
            parts.append(f"<{tag}><li>{body}")
            stack.append((indent, tag))
        elif indent > stack[-1][0]:
            parts.append(f"<{tag}><li>{body}")
            stack.append((indent, tag))
        else:
            parts.append(f"</li><li>{body}")

    while stack:
        parts.append(f"</li></{stack[-1][1]}>")
        stack.pop()
    return "".join(parts), i


def convert(md: str):
    lines = md.split("\n")
    sections: list[dict] = [{"slug": "g-intro", "html": []}]
    toc: list[tuple[int, str, str]] = []
    used: set[str] = set()
    i = 0

    def add(block: str) -> None:
        sections[-1]["html"].append(block)

    while i < len(lines):
        line = lines[i]

        if line.startswith("```"):
            i += 1
            buf: list[str] = []
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            add(f'<pre class="code"><code>{html.escape(chr(10).join(buf))}</code></pre>')
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            level, raw = len(m.group(1)), m.group(2).strip()
            slug = slugify(raw) or "sec"
            base, n = slug, 2
            while slug in used:
                slug = f"{base}-{n}"
                n += 1
            used.add(slug)
            anchor = f'<a class="anchor" href="#{slug}">#</a>'
            if level == 2:
                sections.append({"slug": slug, "html": []})
                toc.append((2, raw, slug))
            elif level == 3 and len(sections) > 1:
                toc.append((3, raw, slug))
            add(f'<h{level} id="{slug}">{inline(raw)}{anchor}</h{level}>')
            i += 1
            continue

        if re.match(r"^\s*(-{3,}|\*{3,})\s*$", line):
            add("<hr>")
            i += 1
            continue

        if (line.strip().startswith("|") and i + 1 < len(lines)
                and re.match(r"^\s*\|[\s:|\-]+\|\s*$", lines[i + 1])):
            head = split_row(line)
            i += 2
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = split_row(lines[i])
                cells += [""] * (len(head) - len(cells))
                rows.append(cells[:len(head)])
                i += 1
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            body = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
                           for r in rows)
            add(f'<div class="tablewrap"><table><thead><tr>{th}</tr></thead>'
                f"<tbody>{body}</tbody></table></div>")
            continue

        if line.lstrip().startswith(">"):
            buf = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            inner = "".join(f"<p>{inline(b)}</p>" for b in buf if b.strip())
            add(f"<blockquote>{inner}</blockquote>")
            continue

        if re.match(r"^\s*([-*]|\d+\.)\s+", line):
            block, i = parse_list(lines, i)
            add(block)
            continue

        if not line.strip():
            i += 1
            continue

        buf = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\||\s*-{3,}\s*$)", lines[i]):
            buf.append(lines[i].strip())
            i += 1
        add("<p>" + inline(" ".join(buf)) + "</p>")

    return sections, toc


# ────────────────────────────  main  ────────────────────────────

def main() -> int:
    for p in (SRC, PAGE):
        if not p.exists():
            print(f"Không thấy {p}", file=sys.stderr)
            return 1

    md = SRC.read_text(encoding="utf-8")
    sections, toc = convert(md)
    page = PAGE.read_text(encoding="utf-8")

    if not TOC_RE.search(page) or not GUIDE_RE.search(page):
        print("Thiếu marker <!-- TOC:START --> / <!-- GUIDE:START --> trong index.html", file=sys.stderr)
        return 1

    body = []
    for sec in sections:
        inner = "\n".join(sec["html"]).strip()
        if inner:
            body.append(f'<section id="sec-{sec["slug"]}">\n{inner}\n</section>')
    body_html = "\n\n".join(body)

    toc_html = "\n".join(
        f'<a class="lv{"3" if level == 3 else "2"}" href="#{slug}">{inline(text)}</a>'
        for level, text, slug in toc
    )

    new = TOC_RE.sub(lambda m: m.group(1) + "\n" + toc_html + "\n" + m.group(2), page)
    new = GUIDE_RE.sub(lambda m: m.group(1) + "\n" + body_html + "\n" + m.group(2), new)
    check = "--check" in sys.argv[1:]

    if new == page:
        print("index.html không đổi (guide đã khớp).")
        return 0

    if check:
        print("index.html LỆCH GUIDE.md — chạy: python tools/build_guide.py", file=sys.stderr)
        return 1

    PAGE.write_text(new, encoding="utf-8")
    print(f"index.html ← {len(sections)} section · {len(toc)} mục lục · "
          f"{PAGE.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""trace_scan.py — quét và làm sạch dấu vết Unicode trong văn bản.

Quét codepoint lạ (tag chars, PUA, zero-width, blank, typography, homoglyph),
xuất báo cáo, và làm sạch theo đúng thứ tự an toàn.

  python tools/trace_scan.py file.txt
  python tools/trace_scan.py file.txt --strip
  python tools/trace_scan.py file.txt --strip -o clean.txt
  python tools/trace_scan.py file.txt --json
  cat file.txt | python tools/trace_scan.py

Nguyên tắc: QUÉT TRƯỚC, SỬA SAU. Báo cáo luôn dựa trên văn bản nguyên bản.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


# ────────────────────────────  Bảng ký tự  ────────────────────────────

BLANKS = {
    0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000,
}

KILL = {
    0x200B, 0x2060, 0xFEFF, 0x00AD, 0x180E,
    0x200E, 0x200F, 0x061C,
    0x2061, 0x2062, 0x2063, 0x2064,
    0x2066, 0x2067, 0x2068, 0x2069,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
}

PUNCT = {
    0x2014: "em_dash", 0x2013: "en_dash", 0x2010: "hyphen",
    0x2011: "nb_hyphen", 0x2018: "quote", 0x2019: "quote",
    0x201C: "quote", 0x201D: "quote", 0x2026: "ellipsis",
    0x00AB: "quote", 0x00BB: "quote", 0x00B4: "quote", 0x02BC: "quote",
}

HOMOGLYPHS = {
    "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p",
    "\u0441": "c", "\u0445": "x", "\u0443": "y", "\u0455": "s",
    "\u0456": "i", "\u0458": "j", "\u04BB": "h", "\u0501": "d",
    "\u043A": "k", "\u043C": "m", "\u043D": "h", "\u0442": "t",
    "\u0432": "b", "\u0433": "r",
    "\u03BF": "o", "\u03BD": "v", "\u03B1": "a", "\u03B9": "i",
    "\u03BA": "k", "\u03C1": "p", "\u03C5": "u",
    "\u0131": "i", "\u2212": "-", "\u2010": "-", "\u2011": "-",
}

NAMES = {
    0x00A0: "NO-BREAK SPACE", 0x1680: "OGHAM SPACE MARK",
    0x2000: "EN QUAD", 0x2001: "EM QUAD", 0x2002: "EN SPACE",
    0x2003: "EM SPACE", 0x2004: "THREE-PER-EM SPACE",
    0x2005: "FOUR-PER-EM SPACE", 0x2006: "SIX-PER-EM SPACE",
    0x2007: "FIGURE SPACE", 0x2008: "PUNCTUATION SPACE",
    0x2009: "THIN SPACE", 0x200A: "HAIR SPACE", 0x202F: "NARROW NO-BREAK SPACE",
    0x205F: "MEDIUM MATHEMATICAL SPACE", 0x3000: "IDEOGRAPHIC SPACE",
    0x200B: "ZERO WIDTH SPACE", 0x200C: "ZERO WIDTH NON-JOINER",
    0x200D: "ZERO WIDTH JOINER", 0x2060: "WORD JOINER",
    0xFEFF: "ZERO WIDTH NO-BREAK SPACE / BOM", 0x00AD: "SOFT HYPHEN",
    0x180E: "MONGOLIAN VOWEL SEPARATOR", 0x2061: "FUNCTION APPLICATION",
    0x2062: "INVISIBLE TIMES", 0x2063: "INVISIBLE SEPARATOR",
    0x2064: "INVISIBLE PLUS", 0x2066: "LEFT-TO-RIGHT ISOLATE",
    0x2067: "RIGHT-TO-LEFT ISOLATE", 0x2068: "FIRST STRONG ISOLATE",
    0x2069: "POP DIRECTIONAL ISOLATE", 0x202A: "LEFT-TO-RIGHT EMBEDDING",
    0x202B: "RIGHT-TO-LEFT EMBEDDING", 0x202C: "POP DIRECTIONAL FORMATTING",
    0x202D: "LEFT-TO-RIGHT OVERRIDE", 0x202E: "RIGHT-TO-LEFT OVERRIDE",
    0x2010: "HYPHEN", 0x2011: "NON-BREAKING HYPHEN", 0x2013: "EN DASH",
    0x2014: "EM DASH", 0x2018: "LEFT SINGLE QUOTATION MARK",
    0x2019: "RIGHT SINGLE QUOTATION MARK", 0x201C: "LEFT DOUBLE QUOTATION MARK",
    0x201D: "RIGHT DOUBLE QUOTATION MARK", 0x2026: "HORIZONTAL ELLIPSIS",
    0x00AB: "LEFT-POINTING DOUBLE ANGLE QUOTATION",
    0x00BB: "RIGHT-POINTING DOUBLE ANGLE QUOTATION",
    0x00B4: "ACUTE ACCENT", 0x02BC: "MODIFIER LETTER APOSTROPHE",
    0x2028: "LINE SEPARATOR", 0x2029: "PARAGRAPH SEPARATOR",
    0x0085: "NEXT LINE (NEL)", 0xFE0E: "VARIATION SELECTOR-15",
    0xFE0F: "VARIATION SELECTOR-16",
    0x200E: "LEFT-TO-RIGHT MARK", 0x200F: "RIGHT-TO-LEFT MARK",
    0x061C: "ARABIC LETTER MARK",
}

# category -> (severity, action)
CATEGORY = {
    "tag":       ("SECURITY", "xoá — ASCII smuggling / prompt injection"),
    "pua":       ("SECURITY", "xoá — private use area, hay giấu payload"),
    "invisible": ("HIGH",     "xoá"),
    "bidi":      ("HIGH",     "xoá — đảo chiều hiển thị"),
    "homoglyph": ("HIGH",     "→ Latin"),
    "blank":     ("MEDIUM",   "→ space"),
    "linesep":   ("MEDIUM",   "→ \\n"),
    "joiner":    ("LOW",      "GIỮ — bắt buộc Ả Rập/Indic/emoji"),
    "vs":        ("LOW",      "giữ — emoji presentation"),
    "punct":     ("INFO",     "tuỳ chọn"),
    "emoji":     ("INFO",     "giữ"),
    "other":     ("INFO",     "giữ"),
}

ACTIONABLE = {"tag", "pua", "invisible", "bidi", "homoglyph"}


def classify(ch: str, cp: int) -> str:
    if cp < 160:
        return "other"
    if 0xE0020 <= cp <= 0xE007F:
        return "tag"
    if 0xE000 <= cp <= 0xF8FF or cp >= 0xF0000:
        return "pua"
    if cp in BLANKS:
        return "blank"
    if cp in KILL:
        return "bidi" if cp in {0x202A, 0x202B, 0x202C, 0x202D, 0x202E} else "invisible"
    if cp in (0x200C, 0x200D):
        return "joiner"
    if 0xFE00 <= cp <= 0xFE0F:
        return "vs"
    if cp in (0x2028, 0x2029, 0x0085):
        return "linesep"
    if 0x1F000 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF:
        return "emoji"
    if ch in HOMOGLYPHS:
        return "homoglyph"
    if cp in PUNCT:
        return "punct"
    return "other"


def name_of(ch: str, cp: int) -> str:
    if ch in HOMOGLYPHS:
        return f"LOOKALIKE of '{HOMOGLYPHS[ch]}' (Cyrillic/Greek)"
    return NAMES.get(cp, f"U+{cp:04X}")


# ────────────────────────────  Quét  ────────────────────────────

def scan(text: str) -> list[dict]:
    counter: Counter[int] = Counter()
    sample: dict[int, str] = {}
    for ch in text:
        cp = ord(ch)
        cat = classify(ch, cp)
        if cat in ("other", "emoji"):
            continue
        counter[cp] += 1
        sample.setdefault(cp, ch)

    rows = []
    for cp, n in counter.most_common():
        cat = classify(sample[cp], cp)
        sev, action = CATEGORY[cat]
        rows.append({
            "codepoint": f"U+{cp:04X}",
            "cp": cp,
            "name": name_of(sample[cp], cp),
            "category": cat,
            "severity": sev,
            "action": action,
            "count": n,
        })
    return rows


def stats(text: str) -> dict:
    words = len(text.split())
    sentences = [s for s in re.split(r"(?<=[.!?…])\s+", text) if len(s.split()) > 2]
    lens = [len(s.split()) for s in sentences]
    mean = statistics.mean(lens) if lens else 0.0
    sd = statistics.stdev(lens) if len(lens) > 1 else 0.0
    return {
        "words": words,
        "chars": len(text),
        "sentences": len(lens),
        "mean_len": round(mean, 2),
        "sd_len": round(sd, 2),
        "cv": round(sd / mean, 4) if mean else None,
        "em_dash_per_1k": round(text.count("\u2014") / words * 1000, 2) if words else 0.0,
    }


# ────────────────────────────  Làm sạch  ────────────────────────────

def flag_tag_positions(text: str) -> set[int]:
    """Vị trí tag char thuộc emoji cờ (🏴 + U+E0067…) — phải giữ."""
    positions: set[int] = set()
    i, n = 0, len(text)
    while i < n:
        if text[i] == "\U0001F3F4":
            j = i + 1
            while j < n and 0xE0020 <= ord(text[j]) <= 0xE007F:
                positions.add(j)
                j += 1
            i = j
        else:
            i += 1
    return positions


def _audit(index: int, cp: int, ch: str, action: str,
           replacement: str, reason: str) -> dict:
    return {
        "index": index,
        "codepoint": f"U+{cp:04X}",
        "char": ch,
        "action": action,
        "replacement": replacement,
        "reason": reason,
    }


def strip_text(
    text: str,
    *,
    blank_to_space: bool = True,
    fold_homoglyphs: bool = True,
    straight_quotes: bool = True,
    em_dash: str = "comma",
    aggressive: bool = False,
) -> tuple[str, dict, list[dict]]:
    log: Counter[str] = Counter()
    audit: list[dict] = []
    flags = flag_tag_positions(text)
    out: list[str] = []

    for idx, ch in enumerate(text):
        cp = ord(ch)
        cat = classify(ch, cp)

        if cat == "tag" and idx in flags:
            log["flag_kept"] += 1
            audit.append(_audit(idx, cp, ch, "kept", ch, "part of emoji flag sequence"))
            out.append(ch)
            continue
        if cat in ("tag", "pua"):
            log["security"] += 1
            audit.append(_audit(idx, cp, ch, "removed", "",
                                "prompt injection / private use area"))
            continue
        if cat == "invisible":
            log["soft_hyphen" if cp == 0x00AD else "invisible"] += 1
            audit.append(_audit(idx, cp, ch, "removed", "", "invisible character"))
            continue
        if cat == "bidi":
            log["bidi"] += 1
            audit.append(_audit(idx, cp, ch, "removed", "", "bidi control reorders text"))
            continue
        if cat == "blank":
            log["blank"] += 1
            replacement = " " if blank_to_space else ch
            audit.append(_audit(idx, cp, ch, "replaced", replacement, "unusual space"))
            out.append(replacement)
            continue
        if cat == "joiner":
            if aggressive:
                log["joiner_removed"] += 1
            else:
                log["joiner_kept"] += 1
                out.append(ch)
            continue
        if cat == "vs":
            if aggressive:
                log["vs_removed"] += 1
            else:
                log["vs_kept"] += 1
                out.append(ch)
            continue
        if cat == "linesep":
            log["linesep"] += 1
            audit.append(_audit(idx, cp, ch, "replaced", "\n", "line/paragraph separator"))
            out.append("\n")
            continue
        if cat == "homoglyph":
            log["homoglyph"] += 1
            replacement = HOMOGLYPHS[ch] if fold_homoglyphs else ch
            audit.append(_audit(idx, cp, ch,
                                "replaced" if fold_homoglyphs else "kept",
                                replacement, "lookalike character"))
            out.append(replacement)
            continue
        if cat == "punct":
            kind = PUNCT[cp]
            if kind == "em_dash":
                log["em_dash"] += 1
                out.append({"comma": ", ", "hyphen": " - ", "space": " ", "keep": ch}[em_dash])
            elif kind == "en_dash":
                log["en_dash"] += 1
                out.append(ch if em_dash == "keep" else "-")
            elif kind == "ellipsis":
                log["ellipsis"] += 1
                out.append("..." if straight_quotes else ch)
            else:
                log["quotes"] += 1
                if straight_quotes:
                    out.append({"'" : "'", "\u2018": "'", "\u2019": "'", "\u00B4": "'", "\u02BC": "'",
                                '"': '"', "\u201C": '"', "\u201D": '"', "\u00AB": '"', "\u00BB": '"'}[ch])
                else:
                    out.append(ch)
            continue

        out.append(ch)

    cleaned = "".join(out)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"[ \t]+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([,;:])(?=[^\s])", r"\1 ", cleaned)
    cleaned = re.sub(r"[ \t]+$", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip("\n")

    return cleaned, dict(log), audit


# ────────────────────────────  CLI  ────────────────────────────

def read_input(path: str | None) -> str:
    if path and path != "-":
        # newline="" : không để Python đổi CRLF thành LF, nếu không offset và
        # bản sạch sẽ khác bản JS trên Windows.
        with open(path, encoding="utf-8", errors="replace", newline="") as fh:
            return fh.read()
    data = sys.stdin.buffer.read()
    return data.decode("utf-8", errors="replace")


def print_report(text: str, rows: list[dict]) -> None:
    st = stats(text)
    print(f"\n  từ: {st['words']}   câu: {st['sentences']}   ký tự: {st['chars']}")
    print(f"  trung bình: {st['mean_len']} từ/câu   SD: {st['sd_len']}   CV: {st['cv']}")
    print(f"  em dash / 1k từ: {st['em_dash_per_1k']}")
    if st["sentences"] < 4:
        print("  nhận xét CV: cần ≥4 câu mới đọc được — bỏ qua")
    else:
        verdict = ("rất đều — nghi vấn" if st["cv"] < 0.30
                   else "hơi đều" if st["cv"] < 0.38 else "bình thường")
        print(f"  nhận xét CV: {verdict} (người ≈ 0.449, AI ≈ 0.376)")

    if not rows:
        print("\n  Không tìm thấy codepoint đáng ngờ. Sạch ở tầng ký tự.")
        return

    print(f"\n  {'MÃ':<9} {'LOẠI':<10} {'SỐ':>5}  {'MỨC':<9} TÊN / HÀNH ĐỘNG")
    print("  " + "─" * 76)
    for r in rows:
        print(f"  {r['codepoint']:<9} {r['category']:<10} {r['count']:>5}  "
              f"{r['severity']:<9} {r['name']}")
        print(f"  {'':<9} {'':<10} {'':>5}  {'':<9} ↳ {r['action']}")

    sec = sum(r["count"] for r in rows if r["category"] in ACTIONABLE)
    if sec:
        print(f"\n  ⚠ {sec} ký tự thuộc nhóm nên xoá (security / invisible / homoglyph).")
    if any(r["category"] == "joiner" for r in rows):
        print("  ⚠ Có ZWJ/ZWNJ — chúng bắt buộc trong Ả Rập/Indic và emoji gia đình.")
        print("    Chỉ dùng --aggressive khi bạn chắc chắn văn bản thuần Latin.")
    if "\U0001F3F4" in text and any(r["category"] == "tag" for r in rows):
        print("  ⚠ Có emoji cờ (🏴 + tag chars) — strip tag chars sẽ phá cờ.")


def main() -> int:
    p = argparse.ArgumentParser(
        description="Quét và làm sạch dấu vết Unicode trong văn bản.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("path", nargs="?", help="file đầu vào (bỏ trống = stdin)")
    p.add_argument("--strip", action="store_true", help="in bản đã làm sạch")
    p.add_argument("-o", "--out", help="ghi bản sạch ra file")
    p.add_argument("--json", action="store_true", help="xuất báo cáo JSON")
    p.add_argument("--audit", action="store_true",
                   help="kèm audit từng ký tự đã đổi vào JSON (dùng với --json)")
    p.add_argument("--aggressive", action="store_true",
                   help="xoá cả ZWJ/ZWNJ và variation selector")
    p.add_argument("--keep-em-dash", action="store_true", help="không đổi em dash")
    p.add_argument("--em-dash", choices=["comma", "hyphen", "space", "keep"],
                   default="comma", help="cách xử lý em dash (mặc định: comma)")
    p.add_argument("--keep-quotes", action="store_true", help="giữ ngoặc cong")
    p.add_argument("--fail-on-security", action="store_true",
                   help="exit 2 nếu tìm thấy tag chars / PUA / homoglyph (dùng cho CI)")
    args = p.parse_args()

    text = read_input(args.path)
    rows = scan(text)

    cleaned = None
    log: dict = {}
    audit: list[dict] = []
    # --json cũng cần bản sạch để test hợp đồng JS ↔ Python so sánh được.
    if args.strip or args.out or args.json:
        cleaned, log, audit = strip_text(
            text,
            aggressive=args.aggressive,
            straight_quotes=not args.keep_quotes,
            em_dash="keep" if args.keep_em_dash else args.em_dash,
        )

    if args.json:
        payload = {
            "stats": stats(text),
            "findings": rows,
            "security_chars": sum(r["count"] for r in rows
                                  if r["category"] in ACTIONABLE),
        }
        if cleaned is not None:
            payload["cleaned"] = cleaned
        if args.audit:
            payload["cleaning"] = {
                "changes": log,
                "audit": audit,
                "after": stats(cleaned or ""),
            }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_report(text, rows)
        if cleaned is not None:
            print("\n  Đã sửa:", ", ".join(f"{k}={v}" for k, v in sorted(log.items())) or "không có gì")
            after = stats(cleaned)
            print(f"  sau khi sạch: {after['chars']} ký tự, CV {after['cv']}")
            if after["sentences"] >= 4 and after["cv"] is not None and after["cv"] < 0.38:
                print("  ↳ tầng ký tự sạch, nhưng câu vẫn đều — phải viết lại mới hết.")

    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="") as fh:
            fh.write(cleaned or "")
        if not args.json:
            print(f"\n  → {args.out}")
    elif args.strip:
        print("\n" + (cleaned or ""))

    if args.fail_on_security and any(r["category"] in ACTIONABLE for r in rows):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

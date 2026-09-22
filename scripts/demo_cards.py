#!/usr/bin/env python3
"""Render demo cards from a real case export.

Every string on a card comes out of the exported case document, which is read from
the live deployment. There is no fallback text: if the export is empty or missing a
piece, the card says so rather than inventing a plausible value.

Usage:
  npx convex run ops:caseExport '{"caseRef":"case-demo-01"}' > demo/export.json
  python3 scripts/demo_cards.py --export demo/export.json --out demo/build/cards

Cards are drawn with ImageMagick because it is present everywhere this is likely to
run; each line is annotated explicitly so no layout engine has to guess.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

W, H = 1920, 1080
BG = "#0e0e14"
ACCENT = "#2ee9ff"
MUTED = "#8b8b9e"
TEXT = "#ededec"
DIM = "#5a5a6e"


def when(ms: int) -> str:
    """Epoch millis are unreadable on camera; every timestamp on a card is ISO."""
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")


def im() -> list[str]:
    """ImageMagick 7 ships `magick`; older systems only have `convert`."""
    for candidate in (["magick"], ["convert"]):
        if subprocess.run(["which", candidate[0]], capture_output=True).returncode == 0:
            return candidate
    raise SystemExit("ImageMagick is required to draw the cards")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def render(path: Path, heading: str, lines: list[tuple[str, str]], footer: str) -> None:
    cmd = [
        *im(),
        "-size", f"{W}x{H}",
        f"xc:{BG}",
        "-fill", ACCENT, "-pointsize", "64", "-annotate", "+90+150", heading,
        "-fill", DIM, "-pointsize", "30",
        "-annotate", f"+90+{H - 70}", footer,
    ]
    y = 260
    for colour, line in lines:
        cmd += ["-fill", colour, "-pointsize", "38", "-annotate", f"+90+{y}", line[:110]]
        y += 62
        if y > H - 120:
            break
    cmd.append(str(path))
    run(cmd)


def wrap(label: str, value: str, limit: int = 96) -> list[tuple[str, str]]:
    text = f"{label}{value}"
    return [(TEXT, text[i : i + limit]) for i in range(0, min(len(text), limit * 3), limit)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    export = json.loads(Path(args.export).read_text(encoding="utf-8"))
    if not export or "case" not in export:
        print("the export carries no case; refusing to draw cards from nothing", file=sys.stderr)
        return 2

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    case = export["case"]
    ref = case["ref"]

    # 1 — the case and its frozen set
    lines: list[tuple[str, str]] = [(MUTED, f"{case['counterpartyName']} · opened {when(case['openedAt'])} · state {case['state']}")]
    lines += wrap("set hash ", (case.get("requirementSetHash") or "not frozen")[:32])
    for req in export["requirements"]:
        lines.append((ACCENT if req["satisfied"] else TEXT, f"[{'x' if req['satisfied'] else ' '}] {req['label']} ({req['kind']})"))
    title = ref if ref.lower().startswith("case") else f"Case {ref}"
    render(out / "01-case.png", title, lines, f"read from the deployment at {when(export['exportedAt'])}")

    # 2 — the evidence, with where it came from and when
    lines = [(MUTED, f"{len(export['evidence'])} read(s)")]
    for ev in export["evidence"][:12]:
        lines.append((ACCENT if ev["sourceKind"] == "counterparty" else TEXT,
                      f"{ev['sourceKind']} · {ev['kind']} · {ev['source'][:40]} · {when(ev['fetchedAt'])}"))
    render(out / "02-evidence.png", "Every read is stamped and hashed", lines, "nothing here was typed in")

    # 3 — claims and verdicts
    lines = [(MUTED, f"{len(export['claims'])} claim(s)")]
    for claim in export["claims"][:12]:
        colour = ACCENT if claim["verdict"] == "verified" else TEXT
        lines.append((colour, f"{claim['verdict']}: {claim['text'][:80]}"))
    render(out / "03-claims.png", "A promise can be proved. A fact has to be read.", lines,
           "unverifiable bills nothing")

    # 4 — grades and the gate
    lines = []
    for grade in export["grades"][:2]:
        lines.append((ACCENT if grade["verdict"] == "pass" else TEXT, f"grade {grade['verdict']} · {grade['rubricRef']} · {grade['gradedBy']} · {when(grade['gradedAt'])}"))
        for check in grade["checks"]:
            lines.append((MUTED, f"  {'pass' if check['passed'] else 'fail'} {check['name']} — {check['detail'][:70]}"))
    render(out / "04-gate.png", "Only a passing grade releases a charge", lines or [(TEXT, "no grade recorded yet")],
           "the checks are printed on the case")

    # 5 — billing rows
    lines = [(MUTED, f"{len(export['billing'])} billing row(s)")]
    for row in export["billing"][:10]:
        lines.append((ACCENT if row["state"] == "metered" else TEXT,
                      f"{row['state']} · {row['units']} unit(s) · key {row['idempotencyKey']} · attempts {row['attempts']}"))
    render(out / "05-meter.png", "Charged once, or not at all", lines, "the key is the call's own reference")

    # 6 — the diary
    lines = [(MUTED, f"{len(export['audit'])} entry(ies)")]
    for row in export["audit"][-12:]:
        lines.append((TEXT, f"{when(row['at'])}  {row['action']}: {(row.get('detail') or '')[:70]}"))
    render(out / "06-diary.png", "The case keeps its own diary", lines, "including every refusal")

    print(f"cards written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

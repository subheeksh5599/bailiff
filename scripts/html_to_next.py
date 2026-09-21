#!/usr/bin/env python3
"""Port the imported design pages into Next.js App Router pages.

The design is the fixed artifact, so this script does the boring translation and
nothing else: CSS is copied verbatim, the inline script is preserved verbatim and
re-attached client-side, and only the markup gets the mechanical HTML -> JSX
rewrite (className, self-closed void elements, style strings to objects, SVG
attribute casing). Any hand-written React logic lives in separate files.

Usage: python3 scripts/html_to_next.py
Writes: web/app/globals.css, web/app/board.css, web/app/page.tsx, web/app/board/page.tsx
Prints: head links, body attributes and conversion counts, so layout.tsx can mirror them.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web" / "app"

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SVG_ATTRS = {
    "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin",
    "stroke-dasharray": "strokeDasharray", "stroke-dashoffset": "strokeDashoffset", "stroke-opacity": "strokeOpacity",
    "fill-rule": "fillRule", "clip-rule": "clipRule", "fill-opacity": "fillOpacity",
    "stop-color": "stopColor", "stop-opacity": "stopOpacity", "text-anchor": "textAnchor",
    "font-size": "fontSize", "font-weight": "fontWeight", "font-family": "fontFamily",
    "font-style": "fontStyle", "letter-spacing": "letterSpacing", "dominant-baseline": "dominantBaseline",
    "xmlns:xlink": "xmlnsXlink", "xlink:href": "xlinkHref", "gradient-units": "gradientUnits",
    "gradienttransform": "gradientTransform", "pattern-units": "patternUnits", "clip-path": "clipPath",
    "mask-units": "maskUnits", "marker-width": "markerWidth", "marker-height": "markerHeight",
    "preserveaspectratio": "preserveAspectRatio", "viewbox": "viewBox", "baseProfile": "baseProfile",
    "shape-rendering": "shapeRendering", "vector-effect": "vectorEffect",
}
CSS_PROP = re.compile(r"([a-zA-Z-]+)\s*:\s*([^;]+)")


def camel_css(prop: str) -> str:
    prop = prop.strip()
    if prop.startswith("--"):
        return prop
    parts = prop.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def style_to_object(value: str) -> str:
    out = []
    for prop, val in CSS_PROP.findall(value):
        key = camel_css(prop)
        quoted = f'"{key}"' if key.startswith("--") else key
        out.append(f"{quoted}: {json.dumps(val.strip())}")
    return "{ " + ", ".join(out) + " }"


def convert_markup(html: str) -> str:
    html = re.sub(r"<!--(.*?)-->", lambda m: "{/*" + m.group(1).replace("*/", "* /") + "*/}", html, flags=re.S)

    def fix_attrs(raw: str) -> str:
        out = raw
        for k, v in SVG_ATTRS.items():
            out = re.sub(rf'(?<=\s){re.escape(k)}=', f"{v}=", out)
        out = re.sub(r"(?<=\s)class=", "className=", out)
        out = re.sub(r"(?<=\s)for=", "htmlFor=", out)
        out = re.sub(r'(?<=\s)style="([^"]*)"', lambda m: "style={" + style_to_object(m.group(1)) + "}", out)
        out = re.sub(r"(?<=\s)(tabindex|contenteditable|autocomplete|readonly|maxlength|minlength|crossorigin|spellcheck)=",
                     lambda m: {"tabindex": "tabIndex", "contenteditable": "contentEditable", "autocomplete": "autoComplete",
                                "readonly": "readOnly", "maxlength": "maxLength", "minlength": "minLength",
                                "crossorigin": "crossOrigin", "spellcheck": "spellCheck"}[m.group(1)] + "=", out)
        return out

    # SVG shape elements and HTML void elements must self-close in JSX.
    svg_shapes = {"path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use"}

    def repl(match: re.Match[str]) -> str:
        tag = match.group(1)
        raw_attrs = fix_attrs(match.group(2) or "")
        trimmed = raw_attrs.rstrip()
        self_closed = trimmed.endswith("/")
        if self_closed:
            trimmed = trimmed[:-1].rstrip()
        if self_closed or tag.lower() in VOID or tag.lower() in svg_shapes:
            return f"<{tag}{trimmed}/>"
        return f"<{tag}{trimmed}>"

    return re.sub(r"<([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)>", repl, html)


def split_page(source: str) -> tuple[str, str, str, str, str]:
    styles = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", source, flags=re.S))
    scripts = "\n".join(re.findall(r"<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>", source, flags=re.S))
    head = re.search(r"<head[^>]*>(.*?)</head>", source, flags=re.S)
    head_inner = head.group(1) if head else ""
    body_open = re.search(r"<body([^>]*)>", source)
    body_attrs = body_open.group(1).strip() if body_open else ""
    body = re.search(r"<body[^>]*>(.*?)</body>", source, flags=re.S)
    return styles.strip(), scripts.strip(), head_inner, body_attrs, (body.group(1).strip() if body else source)


def write_page(*, source: Path, css_out: Path, page_out: Path, component: str, keep_script: bool,
               client_logic: str | None, css_import: str | None) -> None:
    styles, scripts, head_inner, body_attrs, body = split_page(source.read_text(encoding="utf-8"))
    css_out.parent.mkdir(parents=True, exist_ok=True)
    page_out.parent.mkdir(parents=True, exist_ok=True)
    css_out.write_text(styles + "\n", encoding="utf-8")
    jsx = convert_markup(body)

    bits = ['"use client";', ""]
    if css_import:
        bits.append(css_import)
    if keep_script and scripts:
        bits += [
            'import Script from "next/script";',
            "",
        ]
    bits += [f"export default function {component}() {{", "  return (", "    <>", jsx]
    if keep_script and scripts:
        bits.append("      <ScriptTag />")
    bits += ["    </>", "  );", "}", ""]
    if client_logic:
        bits += [client_logic, ""]
    if keep_script and scripts:
        escaped = scripts.replace("</script>", "<\\/script>")
        bits += [
            "/* The imported page script, preserved verbatim: it drives the scroll scene and the",
            "   word cycle by querying the DOM, so it runs once on the client exactly as written. */",
            f"const PAGE_SCRIPT = {json.dumps(escaped)};",
            "",
            "// eslint-disable-next-line react/no-danger",
            "const ScriptTag = () => (",
            '  <Script id="page-scene" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />',
            ");",
            "void ScriptTag;",
            "",
        ]
    page_out.write_text("\n".join(bits), encoding="utf-8")

    links = re.findall(r"<link[^>]*>", head_inner)
    print(f"--- {source.name} -> {page_out.relative_to(ROOT)}")
    print(f"    css: {len(styles)} chars -> {css_out.relative_to(ROOT)}")
    print(f"    script: {len(scripts)} chars ({'kept' if keep_script else 'dropped'})")
    print(f"    body attrs: {body_attrs or '(none)'}")
    for link in links:
        print(f"    head: {link}")


def main() -> int:
    write_page(source=ROOT / "site" / "index.html", css_out=WEB / "globals.css", page_out=WEB / "page.tsx",
               component="Landing", keep_script=True, client_logic=None, css_import='import "./globals.css";')
    write_page(source=ROOT / "site" / "app.html", css_out=WEB / "board.css", page_out=WEB / "board" / "page.tsx",
               component="Board", keep_script=False, client_logic=None, css_import='import "../board.css";')
    return 0


if __name__ == "__main__":
    sys.exit(main())

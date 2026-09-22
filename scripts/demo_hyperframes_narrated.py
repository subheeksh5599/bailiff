#!/usr/bin/env python3
"""Put narration on the motion piece so it can be posted on its own.

The composition has fixed beats - the name, three rules, then the honest line - so
each line has a window it must fit inside. A line that runs past its window talks over
the next card, which is worse than saying less, so this measures every line against
its window and refuses rather than shipping an overlap.
"""
from __future__ import annotations

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO = ROOT / "demo"
VOICE = DEMO / "voice3"
SOURCE = DEMO / "hyperframes.mp4"
FINAL = DEMO / "hyperframes-narrated.mp4"

# (start seconds, window seconds, line)
LINES = [
    (0.6, 7.4, "This is bailiff. A case closes when the outcome is verified, not when someone says it is."),
    (8.4, 5.2, "Frozen before the call, then hashed."),
    (14.0, 5.3, "Evidence only counts if it was read after the case opened."),
    (19.8, 3.4, "A promise is checked against our own recording."),
    (22.6, 3.0, "A claim about them needs their record."),
    (25.4, 9.4, "Nine of ten integrations are on. The one that is not says so itself. And every case here was made by driving the product."),
]


def duration_of(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True,
    ).stdout
    try:
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def main() -> None:
    VOICE.mkdir(parents=True, exist_ok=True)

    clips: list[pathlib.Path] = []
    for index, (start, window, line) in enumerate(LINES, 1):
        text = VOICE / f"h{index:02d}.txt"
        audio = VOICE / f"h{index:02d}.mp3"
        text.write_text(line + "\n")
        subprocess.run(
            ["uvx", "edge-tts", "--voice", "en-US-AndrewMultilingualNeural",
             "--file", str(text), "--write-media", str(audio)],
            capture_output=True, text=True, timeout=120,
        )
        spoken = duration_of(audio)
        room = window
        flag = "ok" if spoken <= room else "TOO LONG"
        print(f"  {index}: {start:5.1f}s +{room:4.1f}s window, line {spoken:4.1f}s  {flag}")
        if spoken > room:
            raise SystemExit(
                f"line {index} runs {spoken:.1f}s into a {room:.1f}s window: it would talk over the next card"
            )
        clips.append(audio)

    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(SOURCE)]
    for clip in clips:
        args += ["-i", str(clip)]
    delays = []
    for index, (start, _, _) in enumerate(LINES, 1):
        delays.append(f"[{index}:a]adelay={int(start * 1000)}:all=1[a{index}]")
    mix_inputs = "".join(f"[a{index}]" for index in range(1, len(LINES) + 1))
    filter_complex = (
        ";".join(delays)
        + f";{mix_inputs}amix=inputs={len(LINES)}:normalize=0[mixed];[mixed]apad[a]"
    )
    args += ["-filter_complex", filter_complex, "-map", "0:v", "-map", "[a]",
             "-t", "35", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
             "-movflags", "+faststart", str(FINAL)]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"mux failed:\n{result.stderr[-1200:]}")

    print(f"\nfinal: {FINAL}  {duration_of(FINAL):.1f}s  {FINAL.stat().st_size / 1_048_576:.1f} MB")


if __name__ == "__main__":
    main()

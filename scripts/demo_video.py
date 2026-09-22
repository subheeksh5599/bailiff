#!/usr/bin/env python3
"""Assemble the demo from what was actually captured.

Two kinds of footage go in. The opening and the close are motion pieces rendered by
HyperFrames, and are trimmed out of one render by timestamp. Everything between them
is a still of the live deployment, captured while it was being driven by hand - so
the stills are panned slowly rather than held, which is what makes a sequence of
screenshots read as a screen recording instead of a slideshow.

Each segment lasts as long as its narration plus a beat, so nothing is cut off
mid-sentence and no line runs over the next picture.
"""
from __future__ import annotations

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO = ROOT / "demo"
SHOTS = DEMO / "shots"
VOICE = DEMO / "voice"
BUILD = DEMO / "build"
HF = pathlib.Path("/tmp/hf/bailiff-demo/out/open-close.mp4")

# kind, source, in-point, available seconds, narration id or None.
# The motion pieces are one 35s render cut by timestamp: the opening, the rules
# (17s, which is how long that narration takes), and the close from 25s.
PLAN = [
    ("hf", str(HF), 0, 8, "01"),
    ("hf", str(HF), 8, 17, "02"),
    ("img", "01-landing.png", None, None, "03"),
    ("img", "02-verified.png", None, None, None),
    ("img", "03-board.png", None, None, "04"),
    ("img", "04-newcase.png", None, None, "05"),
    ("img", "06-case.png", None, None, "06"),
    ("img", "05-refusal.png", None, None, "07"),
    ("img", "07-integrations.png", None, None, "08"),
    ("img", "08a-selftest.png", None, None, "09"),
    ("img", "08b-cases.png", None, None, None),
    ("hf", str(HF), 25, 10, "10"),
]

MIN_SECONDS = 3.5
BEAT = 0.8


def duration_of(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
    ).stdout
    try:
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def run(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(args[:6])}…\n{result.stderr[-1200:]}")


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    parts: list[pathlib.Path] = []

    for index, (kind, source, start, length, voice) in enumerate(PLAN, 1):
        audio = VOICE / f"{voice}.mp3" if voice else None
        spoken = duration_of(audio) if audio else 0.0
        seconds = max(MIN_SECONDS, spoken + BEAT) if audio else 3.5
        out = BUILD / f"seg{index:02d}.mp4"

        common = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-t", f"{seconds:.2f}",
            "-r", "30",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart",
        ]

        if kind == "hf":
            # A motion piece, trimmed by timestamp. The trim has to cover the whole
            # segment: a moving picture that runs out before its narration leaves the
            # last seconds frozen, which reads as a broken file.
            if seconds > length + 0.05:
                raise RuntimeError(
                    f"segment {index:02d} needs {seconds:.1f}s of motion but only {length}s was "
                    f"rendered from {start}s; extend the composition or shorten the line"
                )
            args = [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-ss", str(start), "-t", f"{seconds:.2f}", "-i", source,
            ]
            if audio:
                args += ["-i", str(audio)]
                args += ["-filter_complex", "[0:v]scale=1920:1080,setsar=1[v];[1:a]apad[a]",
                         "-map", "[v]", "-map", "[a]"]
            else:
                args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                         "-map", "0:v", "-map", "1:a", "-shortest"]
            args += ["-t", f"{seconds:.2f}", "-r", "30",
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
                     "-movflags", "+faststart", str(out)]
        else:
            # a still of the live deployment, panned slowly so it reads as footage
            image = SHOTS / source
            args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-loop", "1", "-i", str(image)]
            if audio:
                args += ["-i", str(audio)]
            else:
                args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            # Cover the frame whatever shape the capture came back in, then drift down
            # it: a still that is panned reads as footage, and a still that is merely
            # held reads as a slideshow. force_original_aspect_ratio=increase means a
            # smaller or differently-shaped capture still fills 1920x1080 instead of
            # leaving the encoder nothing to write.
            pan = (
                "scale=2016:1260:force_original_aspect_ratio=increase,"
                f"crop=1920:1080:0:'(ih-1080)*min(t/{seconds:.2f},1)',setsar=1"
            )
            args += ["-filter_complex",
                     f"[0:v]{pan},setsar=1[v];[1:a]apad[a]",
                     "-map", "[v]", "-map", "[a]"]
            args += ["-t", f"{seconds:.2f}", "-r", "30",
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
                     "-movflags", "+faststart", str(out)]

        run(args)
        parts.append(out)
        print(f"  segment {index:02d}: {seconds:5.1f}s  {'narration ' + voice if voice else 'a beat'}")

    listing = BUILD / "concat.txt"
    listing.write_text("\n".join(f"file '{part.name}'" for part in parts) + "\n")
    final = DEMO / "bailiff-demo.mp4"
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", str(listing),
         "-c", "copy", "-movflags", "+faststart", str(final)])

    total = duration_of(final)
    print(f"\nfinal: {final}  {total:.1f}s  {final.stat().st_size / 1_048_576:.1f} MB")


if __name__ == "__main__":
    main()

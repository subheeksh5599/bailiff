#!/usr/bin/env python3
"""Cut the click-through demo: the product being driven, not described.

The explainer talked over panned stills. Judges are told to "talk less, click
through the real product", so this cut leads with the product: twelve steps of
real interaction, captured while the deployment was driven by hand, with eight
short lines across the whole thing and a caption on every step.

A state change that happens between two screenshots reads as a cut, so the
moments that matter - a refused close, an upload being hashed - carry three
frames each and are held, which is what makes the change visible rather than
merely asserted.
"""
from __future__ import annotations

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO = ROOT / "demo"
CLICK = DEMO / "click"
VOICE = DEMO / "voice2"
BUILD = DEMO / "build-click"
HF = DEMO / "hyperframes.mp4"
FONT = "/usr/share/fonts/TTF/DejaVuSans.ttf"

HOLD = 1.7  # seconds each captured frame is held
BEAT = 0.7  # silence kept after a line ends

# step -> (caption, narration id or None)
CAPTIONS = {
    "01": ("the landing page", "c01"),
    "02": ("what is verified, and what is not", None),
    "03": ("the board — every case it has touched", "c03"),
    "04": ("counted from the same rows the list renders", None),
    "05": ("this case closed: requirement, evidence, hash", "c05"),
    "06": ("the grade, and the charge it released", "c06"),
    "07": ("an open case", None),
    "08": ("asked to close anyway — it names what is missing", "c08"),
    "09": ("the owner's document, before it is uploaded", None),
    "10": ("hashed from the bytes that arrived", "c10"),
    "11": ("the self-test: one request, five checks", "c11"),
    "12": ("the same rows over HTTP", "c12"),
}


def duration_of(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True,
    ).stdout
    try:
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def run(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(args[:8])}…\n{result.stderr[-1500:]}")


def encode(args: list[str], out: pathlib.Path, seconds: float) -> None:
    run(args + [
        "-t", f"{seconds:.2f}", "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(out),
    ])


def caption_file(index: int, text: str) -> pathlib.Path:
    path = BUILD / f"cap{index:02d}.txt"
    path.write_text(text + "\n")
    return path


def motion_segment(index: int, start: float, length: float, voice: str | None, caption: str) -> pathlib.Path:
    """A piece of the HyperFrames render, trimmed and given its line."""
    out = BUILD / f"seg{index:02d}.mp4"
    seconds = max(length, (duration_of(VOICE / f"{voice}.mp3") if voice else 0) + BEAT) if voice else length
    if seconds > length + 0.05:
        raise RuntimeError(f"segment {index} needs {seconds:.1f}s of motion but {length}s exists from {start}s")
    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(start), "-t", f"{seconds:.2f}", "-i", str(HF)]
    if voice:
        args += ["-i", str(VOICE / f"{voice}.mp3")]
    else:
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    args += ["-filter_complex",
             f"[0:v]scale=1920:1080,setsar=1,drawtext=fontfile={FONT}:textfile={caption_file(index, caption)}:"
             f"fontcolor=0x8fd6a1:fontsize=30:box=1:boxcolor=0x000000@0.55:boxborderw=14:x=64:y=h-96[v];"
             f"[1:a]apad[a]",
             "-map", "[v]", "-map", "[a]"]
    encode(args, out, seconds)
    return out


def step_segment(index: int, step: str, frames: list[str], caption: str, voice: str | None) -> pathlib.Path:
    """Real interaction frames, held, with the caption for that step."""
    out = BUILD / f"seg{index:02d}.mp4"
    listing = BUILD / f"frames{index:02d}.txt"
    lines: list[str] = []
    for name in frames:
        lines.append(f"file '{CLICK / name}'")
        lines.append(f"duration {HOLD}")
    lines.append(f"file '{CLICK / frames[-1]}'")  # the concat demuxer needs a final frame
    listing.write_text("\n".join(lines) + "\n")

    visual = max(HOLD * len(frames), 1.0)
    spoken = duration_of(VOICE / f"{voice}.mp3") if voice else 0.0
    seconds = max(visual, spoken + BEAT) if voice else visual
    # Hold the last frame for whatever the line needs beyond the captured frames.
    if seconds > visual:
        extra = seconds - visual
        listing.write_text("\n".join(lines[:-1] + [f"duration {extra:.2f}", lines[-1]]) + "\n")

    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(listing)]
    if voice:
        args += ["-i", str(VOICE / f"{voice}.mp3")]
    else:
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    args += ["-filter_complex",
             f"[0:v]scale=2016:1260:force_original_aspect_ratio=increase,"
             f"crop=1920:1080:0:'(ih-1080)*min(t/{seconds:.2f},1)',setsar=1,"
             f"drawtext=fontfile={FONT}:textfile={caption_file(index, caption)}:"
             f"fontcolor=0x8fd6a1:fontsize=30:box=1:boxcolor=0x000000@0.55:boxborderw=14:x=64:y=h-96[v];"
             f"[1:a]apad[a]",
             "-map", "[v]", "-map", "[a]"]
    encode(args, out, seconds)
    return out


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((CLICK / "manifest-1.json").read_text())
    order = {entry["step"]: entry["frames"] for entry in manifest}

    parts: list[pathlib.Path] = []

    # the opening motion piece carries the first line
    parts.append(motion_segment(1, 0, 8, "c01", "bailiff — a case closes on evidence, not on words"))

    index = 1
    for step in sorted(order):
        caption, voice = CAPTIONS[step]
        frames = order[step]
        index += 1
        part = step_segment(index, step, frames, caption, voice)
        parts.append(part)
        spoken = duration_of(VOICE / f"{voice}.mp3") if voice else 0.0
        print(f"  {step}: {len(frames)} frame(s)  {HOLD * len(frames):4.1f}s→{duration_of(part):4.1f}s  {caption}")

    # the closing motion piece, and the honest line
    index += 1
    parts.append(motion_segment(index, 25, 10, "c12", "9 of 10 integrations on — the one that is not says so itself"))

    listing = BUILD / "concat.txt"
    listing.write_text("\n".join(f"file '{p.name}'" for p in parts) + "\n")
    final = DEMO / "bailiff-clickthrough.mp4"
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(final)])

    total = duration_of(final)
    spoken_total = sum(duration_of(VOICE / f"{CAPTIONS[s][1]}.mp3") for s in CAPTIONS if CAPTIONS[s][1])
    print(f"\nfinal: {final}  {total:.1f}s  {final.stat().st_size / 1_048_576:.1f} MB")
    print(f"speech: {spoken_total:.1f}s of {total:.1f}s ({100 * spoken_total / total:.0f}% — the rest is the product)")


if __name__ == "__main__":
    main()

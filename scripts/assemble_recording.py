"""Cut the recorded frames into a video, in real time, with the narration on its beats.

The frames arrived when the page repainted, not on a clock, so their spacing is the
truth about what the screen was doing: a burst means something moved, a long gap means
nothing did. Holding each frame for the interval it was actually on screen therefore
reproduces the session rather than inventing a frame rate for it.

Each narration line is placed at the moment its step began, which the recorder wrote into
the timeline, so the words land on the picture they describe.
"""

from __future__ import annotations

import json
import pathlib
import subprocess

DEMO = pathlib.Path("/home/arch/bailiff/demo")
REC = DEMO / "recording"
VOICE = REC / "voice"
SILENT = DEMO / "bailiff-recorded-silent.mp4"
FINAL = DEMO / "bailiff-recorded.mp4"

# step -> line. The step names are the ones the recorder wrote.
LINES: list[tuple[str, str]] = [
    ("landing", "This is bailiff, on the live deployment."),
    ("landing-hero", "A case against a company that owes you stays open until their own record shows the outcome."),
    ("landing-what-is-verified", "It says what it can verify, and what it cannot, on the front page."),
    ("open-the-board", "The reads are public. Everything that changes a case waits behind a passphrase."),
    ("board-numbers", "Every case it has touched, with the counts taken from the same rows the list renders."),
    ("case-closed", "This one closed on the other side's own reply."),
    ("case-evidence", "Every requirement points at the evidence that satisfied it: when it was read, and the hash of what came back."),
    ("case-grade", "The grade prints its checks, and only a passing grade releases the charge."),
    ("case-open", "This one cannot close yet."),
    ("try-to-close", "Ask it to close anyway, and it names the requirement that has nothing behind it."),
    ("read-it", "A page is read on the server, timed, and filed against the case."),
    ("file-it", "A document is hashed as it arrives, and offered back."),
    ("selftest", "One request asks the deployment what it can do. Nine of ten integrations on; the one that is not says so itself."),
]

MIN_FRAME = 1 / 30
MAX_FRAME = 2.5


def run(args: list[str], label: str) -> None:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"{label} failed:\n{result.stderr[-1500:]}")


def duration_of(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def narrate() -> list[tuple[float, pathlib.Path]]:
    VOICE.mkdir(parents=True, exist_ok=True)
    timeline = json.loads((REC / "timeline.json").read_text())
    started = timeline["started_at"]
    frames = timeline["frames"]

    first_frame_at: dict[str, float] = {}
    for frame in frames:
        first_frame_at.setdefault(frame["step"], frame["at"])

    # A step can produce no frames at all when nothing on screen changes, so a line is
    # placed relative to the last step that did produce one rather than being dropped.
    last_known_at = 0.0
    for step, _ in LINES:
        if step in first_frame_at:
            last_known_at = first_frame_at[step]
        else:
            first_frame_at[step] = last_known_at + 4.0
            print(f"  {step!r} produced no repaint; placing its line after the previous step")

    clips: list[tuple[float, pathlib.Path]] = []
    for step, line in LINES:
        text = VOICE / f"{step}.txt"
        audio = VOICE / f"{step}.mp3"
        text.write_text(line + "\n")
        subprocess.run(
            ["uvx", "edge-tts", "--voice", "en-US-AndrewMultilingualNeural",
             "--file", str(text), "--write-media", str(audio)],
            capture_output=True, text=True, timeout=120,
        )
        offset = max(0.4, first_frame_at[step] - started + 0.25)
        clips.append((offset, audio))
        print(f"  {offset:6.1f}s  {duration_of(audio):4.1f}s  {step:26} {line[:52]}")
    return clips


def main() -> None:
    timeline = json.loads((REC / "timeline.json").read_text())
    frames = timeline["frames"]

    # a concat list where each frame lasts as long as it really did
    listing = REC / "frames.txt"
    lines: list[str] = []
    for index, frame in enumerate(frames):
        if index + 1 < len(frames):
            gap = frames[index + 1]["at"] - frame["at"]
        else:
            gap = 1.2
        held = min(max(gap, MIN_FRAME), MAX_FRAME)
        lines.append(f"file '{REC / frame['file']}'")
        lines.append(f"duration {held:.3f}")
    lines.append(f"file '{REC / frames[-1]['file']}'")
    listing.write_text("\n".join(lines) + "\n")

    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", str(listing),
         "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,"
                "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x08090b,setsar=1",
         "-vsync", "cfr", "-r", "30", "-pix_fmt", "yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
         "-movflags", "+faststart", str(SILENT)], "silent cut")

    clips = narrate()
    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(SILENT)]
    for _, audio in clips:
        args += ["-i", str(audio)]
    delays = [f"[{i + 1}:a]adelay={int(offset * 1000)}:all=1[a{i + 1}]" for i, (offset, _) in enumerate(clips)]
    mixed = "".join(f"[a{i + 1}]" for i in range(len(clips)))
    filter_complex = ";".join(delays) + f";{mixed}amix=inputs={len(clips)}:normalize=0[a]"
    # The last line can outlast the last frame, which would leave the tail playing over
    # nothing: clone the final frame for as long as the audio needs.
    audio_end = max(offset + duration_of(audio) for offset, audio in clips)
    video_end = duration_of(SILENT)
    tail = max(1.0, audio_end - video_end + 1.0)
    args += ["-filter_complex", filter_complex,
             "-map", "0:v", "-map", "[a]",
             "-vf", f"tpad=stop_mode=clone:stop_duration={tail:.2f}",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
             "-movflags", "+faststart", str(FINAL)]
    run(args, "narration mux")

    total = duration_of(FINAL)
    speech = sum(duration_of(audio) for _, audio in clips)
    print(f"\nfinal: {FINAL}")
    print(f"  {total:.1f}s, {FINAL.stat().st_size / 1_048_576:.1f} MB, {len(frames)} frames")
    print(f"  speech {speech:.1f}s of {total:.1f}s ({100 * speech / max(total, 1):.0f}%)")


main()

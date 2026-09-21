#!/usr/bin/env bash
# Assemble the demo video from cards rendered from real data and recorded narration.
#
# Cards come from `make demo-cards`, which renders them out of a live case export.
# Narration files are expected in demo/audio/ (beat-01.mp3, beat-02.mp3, ...) and can
# be produced with any text-to-speech voice — the script does not care which, it
# only needs the audio to exist. If a beat has no narration the segment is built
# silent for a fixed length, and the run says which beats are silent, because a
# video that looks narrated but is not would be a lie about what was shown.
set -euo pipefail

cd "$(dirname "$0")/.."
CARDS=${CARDS:-demo/build/cards}
AUDIO=${AUDIO:-demo/audio}
OUT=${OUT:-demo/build/bailiff-demo.mp4}
SEGMENTS="$CARDS/segments"
SILENT_SECONDS=${SILENT_SECONDS:-12}

command -v ffmpeg >/dev/null || { echo "ffmpeg is required"; exit 1; }
[ -d "$CARDS" ] || { echo "no cards at $CARDS - run 'make demo-cards' first"; exit 1; }

rm -rf "$SEGMENTS"; mkdir -p "$SEGMENTS"
silent=()
list=$(mktemp)

for card in "$CARDS"/*.png; do
  name=$(basename "$card" .png)
  beat=${name%%-*}
  audio=$(ls "$AUDIO"/beat-${beat}.* 2>/dev/null | head -1 || true)
  segment="$SEGMENTS/$name.mp4"
  if [ -n "$audio" ]; then
    ffmpeg -y -loglevel error -loop 1 -i "$card" -i "$audio" \
      -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a aac -shortest \
      -vf "scale=1920:1080" "$segment"
  else
    silent+=("$beat")
    ffmpeg -y -loglevel error -loop 1 -t "$SILENT_SECONDS" -i "$card" \
      -f lavfi -t "$SILENT_SECONDS" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
      -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a aac -shortest \
      -vf "scale=1920:1080" "$segment"
  fi
  echo "file '$segment'" >> "$list"
done

mkdir -p "$(dirname "$OUT")"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c copy "$OUT"
rm -f "$list"

echo "wrote $OUT"
if [ ${#silent[@]} -gt 0 ]; then
  echo "silent beats (no narration found in $AUDIO): ${silent[*]}"
fi

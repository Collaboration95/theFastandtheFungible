#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/public/media" "$ROOT/server/assets"

# Team-created audiovisual fixtures: generated tones and a simple original
# colour-field travel cut. These are not recordings of third-party work.
ffmpeg -y -f lavfi -i "color=c=0x272923:s=1280x720:r=24:d=20" \
  -vf "drawbox=x=0:y=0:w=1280:h=720:color=0x343831@0.55:t=fill,drawbox=x=88:y=78:w=1104:h=564:color=0x141613@0.33:t=fill" \
  -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$ROOT/public/media/rough-cut.mp4" >/dev/null 2>&1

make_track() {
  local out="$1"
  local filter="$2"
  ffmpeg -y -f lavfi -i "aevalsrc=0:d=20:s=48000" \
    -filter_complex "${filter}" -map "[mix]" -c:a libmp3lame -b:a 128k "$out" >/dev/null 2>&1
}

make_track "$ROOT/public/media/rough-bed.mp3" "[0:a]volume=0.04[base];aevalsrc='if(between(t,5.5,17.5),0.06*sin(2*PI*110*t),0)':d=20:s=48000[cue];[base][cue]amix=inputs=2:duration=longest[mix]"
make_track "$ROOT/public/media/neon-pilgrim-preview.mp3" "[0:a]volume=0.03[base];aevalsrc='if(between(t,5.5,17.5),0.15*sin(2*PI*(240+45*t)*t),0)':d=20:s=48000[cue];[base][cue]amix=inputs=2:duration=longest[mix]"
make_track "$ROOT/public/media/dawn-current-preview.mp3" "[0:a]volume=0.03[base];aevalsrc='if(between(t,5.5,17.5),0.11*sin(2*PI*330*t)+0.07*sin(2*PI*440*t)+0.05*sin(2*PI*550*t),0)':d=20:s=48000[cue];[base][cue]amix=inputs=2:duration=longest[mix]"
make_track "$ROOT/public/media/paper-horizon-preview.mp3" "[0:a]volume=0.03[base];aevalsrc='if(between(t,5.5,17.5),0.10*sin(2*PI*196*t)+0.04*sin(2*PI*294*t),0)':d=20:s=48000[cue];[base][cue]amix=inputs=2:duration=longest[mix]"
make_track "$ROOT/server/assets/dawn-current-clean.mp3" "[0:a]volume=0.03[base];aevalsrc='if(between(t,5.5,17.5),0.19*sin(2*PI*330*t)+0.13*sin(2*PI*440*t)+0.08*sin(2*PI*550*t)+0.04*sin(2*PI*660*t),0)':d=20:s=48000[cue];[base][cue]amix=inputs=2:duration=longest[mix]"

# The intermission reel

The live stream runs on a small box that films `/live/` in a browser and sends it to YouTube. Its **transmitter** keeps the YouTube connection open; its **camera** is the browser, and it can go away for a while: on a page refresh, when a new version of the town goes up, after a crash, or while it starts. For those gaps the transmitter plays the intermission reel, a set of short videos rendered ahead of time from the town's own art, so the stream never loses its picture or its sound.

The reel is "We’ll be right back." and every town ad that makes sense outside the cinema:

| Segment      | What it is                                                                                       | Length         |
| ------------ | ------------------------------------------------------------------------------------------------ | -------------- |
| `right-back` | The "We’ll be right back." card: Miso asleep on a test pattern. It loops without a seam.         | 12 s           |
| `ad-<name>`  | One per live-break ad: every cinema ad except "phones off" and the snack bar (`LIVE_BREAK_ADS`). | 10, 20 or 30 s |

The list is `REEL_SEGMENTS` in `src/lib/break-cards.ts`, so a new ad joins the reel the next time it is rendered. Today that is 11 segments, 192 s in all.

## What each segment looks and sounds like

- **Pictures** are exactly what `/live/` shows during a break. `tests/manual/breaks.html` draws each frame at 320×180 on an offscreen canvas and scales it 4× to 1280×720 with no smoothing, the way the live page scales its break canvas. Ads hold their sponsor card to the very end instead of fading it (`drawBreakAd`), so a segment never ends on a flash of the story art.
- **Frames** are drawn at t = k/15 s for k = 0 … 15 × length − 1. The art is a pure function of time, so a render doesn't depend on how fast the machine is. `right-back` never repeats its first frame at the end: its last frame is at 11.93 s, and the next loop starts again at 0 s. Every motion in it divides 12 s, so the picture wraps smoothly.
- **Fonts**: canvas text never waits for a web font, so the page loads Fraunces, Fraunces italic, Space Mono and DM Sans (Latin and Latin Extended) and checks each with `document.fonts.check` before the first frame. If one is missing, the render stops with an error.
- **Sound** is the same mix the cinema plays (`renderCinemaPCM` in `src/music/cinema-render.ts`), rendered in Node at 0.55 gain. Today the segments peak between −14 and −20 dBFS, with an overall RMS level of −32 to −35 dBFS.

Each `<id>.mp4` is H.264 (High, yuv420p, BT.601 limited range, tagged) at 1280×720 and 15 fps, with AAC-LC stereo audio at 44.1 kHz and 128 kb/s, exactly as long as the segment, and with its index at the front of the file. Next to the videos, `manifest.json` describes the reel for the transmitter:

```json
{
  "version": 1,
  "fps": 15,
  "width": 1280,
  "height": 720,
  "renderedAt": "2026-09-30T04:07:20.114Z",
  "segments": [
    {
      "id": "right-back",
      "kind": "card",
      "file": "right-back.mp4",
      "duration": 12,
      "interruptibleAfter": 3
    },
    { "id": "ad-eggs", "kind": "ad", "file": "ad-eggs.mp4", "duration": 10 }
  ]
}
```

## Rendering it

You need this project's Node dependencies (`npm ci`), Chrome or Edge, and FFmpeg on `PATH`. It is written for Windows, macOS and Linux, and has been run on Windows 11 with Chrome and FFmpeg 9.

```powershell
npm run render:intermission -- --out C:/dev_linux2/forktown-stream/intermission
# only some segments: --only right-back, or --only right-back,ad-zoo
```

The script (`scripts/render-intermission.ts`, with its pure helpers in `scripts/render-intermission-lib.ts`):

1. Starts a private Vite dev server for this checkout on a free port, with its own dependency cache and no file watching, so a running `npm run dev` doesn't get in the way.
2. Starts headless Chrome with a throwaway profile and talks to it over the DevTools protocol. It looks for `CHROME_PATH` first, then Chrome under Program Files, Program Files (x86) and your local app data, then Edge, then the usual macOS apps and Linux names on `PATH`.
3. Opens `tests/manual/breaks.html`, waits for `window.breakRender.ready` (the ads, the cards and the fonts), and checks that the page's segment list matches the one Node built.
4. For each segment, writes its soundtrack to a temporary WAV, then pipes JPEG frames from the page into FFmpeg (`FFMPEG_PATH` if set), which joins them with the WAV.
5. Writes each file under a temporary name and renames it when FFmpeg finishes. It writes `manifest.json` last, the same way, and removes the browser profile and its other temporary files.

A full render takes about a minute on a desktop. The last one took 55 s for 2,880 frames, of which 2 s was startup. Rendering the same art again produces byte-identical files, so a redeploy uploads only the segments that changed.

With `--only`, the manifest still lists the reel's other segments if an earlier manifest in the same folder lists them with the same length and their files are still there. Anything else is left out of the manifest and named at the end of the run, so a stale video is never played under a new length.

Render again after changing a live-break ad, the "We’ll be right back." card, their jingles, the shared film kit (the sponsor card or the fonts), the cinema mixer, or which ads are live-break ads.

### Previewing and checking

`tests/manual/breaks.html` on the dev server shows every live break. `?item=card:right-back` or `?item=ad:zoo` plays one at 1280×720 with a scrubber and its sound, `&t=6` pins a frame, and `&sheet=1` (with `from`, `to`, `step`, `cols` and `scale`) draws a labelled contact sheet.

To check a finished render:

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels -of compact right-back.mp4
ffmpeg -i right-back.mp4 -af astats=measure_perchannel=none -f null -   # overall peak and RMS level
```

Every video stream should report 1280×720, 15/1 and 15 × length frames. The audio stream should be AAC at 44100 Hz, 2 channels, with the same duration.

## Putting it on the stream box

The stream box project (`C:/dev_linux2/forktown-stream`) reads the reel from its `intermission/` folder (`intermissionDir` in its `config.json`).

1. Render into that folder, as above.
2. Run `python deploy.py` there. It uploads the segment files named in `manifest.json` before the manifest itself, so a starting transmitter never sees a manifest without its files. It accepts only file names like `right-back.mp4` and lists any named file that is missing.
3. Run `python control.py restart`. The transmitter reads the manifest once, when it starts. The restart also reconnects YouTube for a moment, so pick a quiet time.

## How the transmitter plays it

- At startup the transmitter validates `manifest.json`: version 1, the frame size and rate, and each segment's id, kind, file name, length and cut point. It then checks that every file is there. The first frame of `right-back` is what it sends before the camera has shown anything.
- It plays one segment at a time with its own small FFmpeg. The video is decoded at its capture rate and scaled to its output size. The sound goes straight into the stream's audio, and the camera's own sound is muted while the reel is on air.
- When a gap starts, `right-back` loops for the first 36 s. After that it alternates an ad and `right-back`. The ads are shuffled with no repeats until all have played, and it skips the ad the page itself had just put on air.
- It goes back to the town once the camera's picture has been steady for a moment. It cuts away from `right-back` only after 3 s of it (`interruptibleAfter`), and it never cuts an ad halfway: it waits for the ad's end.
- With no reel, or after three failed segments in a row, it shows a plain dusk-colored still (#263C3C) and plays silence instead.

The town's own overlays, such as the clock, are drawn into the live page by the camera, so they never appear on the reel. The stream box's README has the details of the switcher, its status and its tests.

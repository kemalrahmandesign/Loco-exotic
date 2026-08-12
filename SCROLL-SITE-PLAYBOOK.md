# SCROLL-SITE PLAYBOOK

Post-mortem of the LoCo Exotics build (loudoun-county-exotics scroll site, July 2026).
Every rule below traces to something that actually happened in that session — a mistake
we hit and fixed, or a decision that worked. Nothing here is general advice. When this
document and your instincts disagree, this document wins until you have evidence.

Stack that shipped: static `index.html` + two CSS files + one vanilla-JS file. **No
framework, no GSAP, no ScrollTrigger, no build step.** Assets generated with the
Higgsfield MCP (soul_2 stills → Veo 3.1 / Seedance 2.0 clips), re-encoded by a GitHub
Actions workflow, served same-origin from `media/`, deployed via GitHub Pages.

---

## 1. MISTAKES & FIXES (in the order we hit them)

**1. Generated videos before the client approved the stills.**
Symptom: first round of assets rejected wholesale ("the porsche is in a fucking home
garage") after video credits were already spent. Wrong assumption: environment quality
could be judged from the prompt. Fix: generate cheap stills first, get explicit approval
on each, then use the approved still as the video's start frame. This became the
standing rule for every asset after.

**2. Asset framing collided with text placement.**
Symptom: hero headline had nowhere to go — a ceiling lightbar sat exactly where the
text belonged, and the lightbar had AI-gibberish text baked into it. Wrong assumption:
text placement could be solved in CSS after the asset existed. Fix: regenerate with the
composition constraints in the prompt ("light source out of frame, car low in frame").
Plan the text zone before generating, not after. Same class of failure recurred on the
brake caliper (brand text baked on, disc not spinning) — fixed only by explicit prompt
language: "COMPLETELY BLANK caliper", "spins like a turntable". You cannot crop, blur,
or CSS your way out of baked-in AI text; regeneration is the only fix.

**3. Scroll-scrubbed video stuttered badly.**
Symptom: "the videos are super laggy" — seeking `video.currentTime` on scroll froze and
jumped. Two real causes, both needed fixing:
- **Sparse keyframes.** Veo/Seedance MP4s have keyframes seconds apart, so every seek
  decodes from a distant I-frame. Fix: re-encode with a keyframe every 4 frames
  (`-g 4`, full command in §3). This was the single biggest quality jump of the build.
- **Seek queuing.** Writing `currentTime` while a previous seek was still in flight
  piled up seeks. Fix: never issue a seek while `video.seeking` is true; lerp a
  smoothed target time toward the scroll-derived time (factor 0.22); skip writes when
  the delta is under one frame (1/30 s); use `fastSeek()` for jumps > 0.5 s. Exact code
  in §2.

**4. No momentum scroll.**
Symptom: same user message — "no smooth scroll or momentum like effect." Fix: wheel
hijack + lerp (§2). Note `html.js.momentum { scroll-behavior: auto; }` in site.css —
CSS smooth-scrolling must be off or it fights the JS lerp on anchor jumps.

**5. ffmpeg ate the manifest inside a `while read` loop.**
Symptom: `curl: (3) URL rejected: Malformed input` on the second manifest line in the
Actions workflow. Cause: ffmpeg consumes stdin by default, swallowing the loop's
remaining lines. Fix: `ffmpeg -nostdin`.

**6. `workflow_dispatch` returned 404.**
Cause: a workflow file must exist on the **default branch** before the dispatch API can
see it. Fix: merge the workflow to the default branch first, then dispatch.

**7. Actions-bot commits didn't trigger the Pages deploy.**
Cause: pushes made with `GITHUB_TOKEN` (the media re-encode workflow's commit) never
trigger other workflows — by GitHub design. Fix: after a media run, dispatch `pages.yml`
manually, or deploy via a normal user-credential push (which does trigger it).

**8. Media files ended up split across branches.**
Because the re-encode workflow commits to the default branch
(`claude/higgsfield-connection-prmjgk`), `brake.mp4` and `tail.mp4` exist **only
there** — the feature branch's `media/` has just `hero.mp4` and `lift.mp4`. A fresh
clone of the feature branch is missing two videos and local preview 404s them. Either
merge the bot commit back into the feature branch after each media run, or accept that
full-media preview only works from the deploy branch.

**9. The scene-transition saga (four failed architectures).**
The gear → rotor → warp sequence originally lived in three separate pinned sections.
Every fix attempt below was rejected by the client before the final one landed:
- *Separate pinned sections*: a structural ~100vh of dead black between them — a
  sticky element releases and the next section's sticky hasn't engaged yet. You cannot
  animate this gap away; it's layout.
- *`pEnter` early-reveal* (start the next film while the previous section releases):
  killed the payoff — "now theres no transition whatsoever."
- *`margin-top: -100vh` curtain overlap*: the next scene wiped in from the bottom
  edge — "its not going thru the center its coming from the bottom of the page."
- *`clip-path` circle center-reveals*: rejected as overcomplicated.
**The fix that shipped:** merge all three scenes into **one** pinned section
(`.pin--tunnel`, 540vh) containing three absolutely-positioned full-frame layers
stacked by z-index. Hand-offs are plain zoom + opacity crossfades over ~8% of the
section's progress. One sticky context = no gap to paper over. If scenes must feel
continuous, they must share a pin. Full timeline in §2.

**10. Zooming a photo 5× pixelated it.**
Symptom: gear scene's zoom-through revealed obvious pixels. Fix: cap the raster's
scale (the shipped gear peaks at ~3×) and let a **flat CSS element** carry the deep
zoom — `.gear-stage__hole` is a radial-gradient dark disc scaled independently; flat
color cannot pixelate. Also solved a second bug: the gear image's transparent bore
showed the page background through it; the disc covers it.

**11. Color seams flashed at scene hand-offs.**
Symptom: gear scene ended on one shade of black, rotor video started on another —
visible pop at the crossfade. Fix: two named constants in motion.js, `HANDOFF =
'#060302'` (film↔film seams — both sides must show exactly this) and `CANVAS =
'#100904'` (film↔page-section seams). Also feeds asset generation: prompt clips to
begin/end in the hand-off shade.

**12. `.hero > :not(.hero__film) { position: relative }` clobbered absolute children.**
Symptom: scroll cue floated mid-page, serial number vanished. The broad child selector
(added for z-stacking) silently overrode `position: absolute` on the lockup/serial/cue.
Fix: the rule sets `z-index: 1` only. Don't set `position` in broad child selectors.

**13. `[hidden]` lost to `display: grid`.**
Symptom: booking form's success state showed both form and confirmation. Specificity:
any `display` rule beats the UA's `[hidden]`. Fix (site.css line 30):
`[hidden] { display: none !important; }`.

**14. Metrics contradicted each other.**
"Est. 2017" next to "25 years experience" reads as a lie. Fix: research the real
business (locoexotics.com, Yelp) and pick metrics that are true and compatible
(25 yrs factory experience / 5+ factory certifications / 4 regions served).

**15. Mobile was an afterthought.**
"Also mobile is pretty awful atm" arrived after the desktop build was far along; the
fix was a retrofitted `@media (max-width: 640px)` pass (overflow, card positions, type
scale). Do the mobile pass per-section as you build, not at the end. **Honest gap: this
site was only ever verified in emulated viewports (Playwright), never on a real phone.
Real-iOS scrub behavior is unvalidated — see §2.**

**16. Slow morphing of nav elements reads as broken.**
A shrink-and-travel animation docking the giant hero wordmark into the nav corner was
built and then rejected ("snapped to the top corner instead of slowly going"). The
shipped behavior: giant lockup rides up and fades (`translateY(p * -70px)`, opacity
`1 - fade(p, 0.4, 0.75)`), and the corner wordmark **snaps** on via a class toggle at
`p > 0.1` with only a 0.2 s opacity transition. Related: hero CTAs originally faded at
p≈0.26 ("cta button kinda dissapears quickly") — fix was letting them ride the lockup's
fade window instead of having their own early one.

---

## 2. THE WORKING IMPLEMENTATION (canon)

**No GSAP. No ScrollTrigger. No library at all.** They were never tried and never
needed — one rAF loop in `js/motion.js` (~460 lines, ES5, single IIFE) does everything.
Do not add a scroll library to this system; the pin math below replaces it.

### The pin engine

Each scrubbed section is:

```html
<section class="pin pin--hero" data-pin data-pin-name="hero">
  <div class="pin__stage"> <!-- position: sticky; top: 0; height: 100vh --> ... </div>
</section>
```

- The `.pin` gets an explicit height in vh — shipped values: hero **260vh**, tunnel
  **540vh**, lift **420vh**. Height = scrub duration; the sticky stage shows for
  `height − 100vh` of scrolling.
- Per frame, progress is `p = clamp(-rect.top / span, 0, 1)` where
  `span = el.offsetHeight - window.innerHeight`. Sections more than 200px off-screen
  are skipped.
- A `handlers` object keyed by `data-pin-name` maps `p` → that section's choreography.
  Every beat is expressed with one helper:
  `fade(p, a, b) = clamp((p - a) / (b - a), 0, 1)` — a linear 0→1 window between two
  progress values. All easing/composition is arithmetic on `fade()` windows.

### Video scrubbing (the exact mechanism)

```js
function scrubVideo(pin, p) {
  var video = pin.video;
  if (!video || video.readyState < 1 || !video.duration) return;
  var t = (pin.reverse ? 1 - p : p) * (video.duration - 0.05); // never seek the very last frame
  pin.vt += (t - pin.vt) * 0.22;          // smoothed time chases scroll
  if (video.seeking) return;              // NEVER queue a seek mid-seek
  var delta = Math.abs(video.currentTime - pin.vt);
  if (delta < 1 / 30) return;             // sub-frame writes are wasted work
  if (delta > 0.5 && typeof video.fastSeek === 'function') video.fastSeek(pin.vt);
  else video.currentTime = pin.vt;
}
```

All four guards exist because their absence caused visible stutter (§1 mistake 3).
`data-scrub-reverse` on the video plays a clip backwards under forward scroll — the
lift film uses it, and the warp film is seeked reversed in its handler
(`seekVideo(tlStreaksVid, fade(p, 0.7, 1), true)`). This means you can generate an
"emerge from X" clip and play it as "dive into X".

Video elements: `muted playsinline webkit-playsinline preload="auto"
disablepictureinpicture aria-hidden="true" tabindex="-1"`, a CloudFront poster image
for instant paint, `<source src="media/*.mp4">` same-origin, and `video.load()` called
once at init.

**iOS honesty note:** that attribute set + `.load()` is the *entire* iOS handling that
shipped. There is no touch-primed `play()/pause()` unlock sequence in this codebase,
and no real-device test ever happened. If real-iPhone scrubbing fails on the next
build, that's the first place to look — don't assume this playbook already solved it.

### Momentum scroll

Wheel events are hijacked (desktop only — gated on `(pointer: fine)` and not
`prefers-reduced-motion`): `preventDefault()`, normalize `deltaMode` (×16 for lines,
×innerHeight for pages), accumulate into `target`. The rAF loop runs
`current += (target - current) * 0.06` and calls `window.scrollTo(0, current)`. Because
it drives *real* scroll position, sticky pins, anchors, and the fixed nav all keep
working — that's why this beats transform-based smooth-scroll libraries here. A scroll
listener syncs `target = current = scrollY` when native scrolling moves the page > 2px
(scrollbar drag, keyboard, find-in-page). Anchor clicks set `target` instead of
jumping. Touch devices keep fully native scrolling. `prefers-reduced-motion` disables
the hijack, all pins, and all reveals (`html.reduced` class).

### The tunnel timeline (the transition that took four tries)

One 540vh pin, three stacked layers, all beats as `fade()` windows on the same `p`:

| p range     | what happens |
|-------------|--------------|
| 0.00–0.34   | gear spins (`rotate(p*180deg)`) and zooms `1.05 → 1.6`; dark disc (`.gear-stage__hole`) grows `0.5 → 1.5`; 4 text beats crossfade in windows of `0.02 + (i/4)*0.28` |
| 0.30–0.38   | **hand-off**: gear zooms hard (`+1.4` scale) while its layer fades to 0; rotor layer fades in, settling from `scale(1.15)` |
| 0.34–0.68   | rotor film scrubs; caption on at 0.44–0.60 |
| 0.54–0.76   | rotor zooms deep (`+1.35` scale) into the blend |
| 0.68–0.76   | **hand-off**: rotor layer fades out, warp layer fades in settling from `scale(1.4)` |
| 0.70–1.00   | warp film scrubs **reversed**; streak text rows land at `0.8 + i*0.03`, gone 0.93–0.98 |
| 0.96–1.00   | veil fades to `CANVAS` for the next page section |

The rule this encodes: a hand-off is ~8% of section progress, both layers overlap the
whole window, the outgoing layer zooms *in* while fading, the incoming one settles from
a slight zoom. Shorter reads as a cut; longer reads as dead time (both were rejected).

### Text beats

Two mechanisms, used deliberately:
- **Scrub-locked** (reversible, tied to exact `p`): direct `style.opacity` writes from
  `fade()` windows — gear beats, streak rows, hero lockup.
- **Threshold** (fire once past a point, CSS animates): `classList.toggle('is-on', p > a && p < b)`
  with transitions in CSS — captions, review cards (`at = 0.14 + (i/n) * 0.66`), the
  snapped nav wordmark. Use this whenever the client wants "snap" rather than "drag".

Non-pinned sections use IntersectionObserver (`rootMargin: '0px 0px -12% 0px'`, unobserve
after firing) adding `.is-in` for word-mask reveals (`data-split`, 70ms stagger),
soft word fades (`data-split-soft`, 24ms), and count-ups (cubic ease-out, 1400ms).
Word-splitting walks only text nodes (nodeType 3) so `<br>` and inline tags survive.

---

## 3. VIDEO ASSET SPEC

What shipped, verified against the files in `media/`:

- **Container/codec:** MP4, H.264 (`libx264`), `yuv420p`, `+faststart`, audio stripped
- **Resolution:** 1280×720 (16:9 — every clip; generated wide, displayed
  `object-fit: cover`)
- **Frame rate:** 24 fps
- **Duration:** 6–8 s per clip (hero 8.0s, lift 6.0s). This is enough for a 260–540vh
  scrub; longer clips just spread the same motion thinner.
- **Keyframe interval: every 4 frames (`-g 4`).** Non-negotiable — this is what makes
  seeking cheap (§1 mistake 3). Cost: ~2.8–3.1 MB per clip at CRF 21, which is fine.
- **The exact encode command** (from `.github/workflows/media.yml`):

```sh
ffmpeg -nostdin -y -i "$src" -an \
  -c:v libx264 -preset slow -crf 21 -g 4 \
  -pix_fmt yuv420p -movflags +faststart \
  "media/$name.mp4"
```

- **Pipeline:** source URLs live in `media/manifest.txt` (`name url` per line); the
  `media.yml` workflow (manual `workflow_dispatch`) downloads, re-encodes, and commits
  to `media/`. It runs on GitHub Actions because the build sandbox can't reach
  CloudFront. Files are committed to the repo and served same-origin from Pages.
  Remember mistakes 6–8: workflow must be on the default branch to dispatch, its
  commits don't auto-trigger the Pages deploy, and they land on the default branch only.

Generation rules (each one bought with rejected credits):

- **Approve stills before animating.** Stills are cheap; videos aren't. The approved
  still becomes the video's start frame.
- **Slow, one-directional camera moves scrub best** — pans, dolly-ins, a single
  rotation. Fast or multi-phase motion turns choppy when scroll maps time.
- **Plan the text zone in the prompt** ("light source out of frame, car low in frame").
- **Demand blank surfaces explicitly** ("COMPLETELY BLANK caliper") — any labelable
  surface grows AI gibberish, and regeneration is the only cure.
- **Match seam colors**: a clip that hands off to another scene should end (or start)
  in the hand-off shade (`#060302` here). Dark-void backgrounds double as text space.
- **Leave negative space on all four sides** when text overlays the subject (the
  caliper needed a full regeneration for this).
- **Generate "emerge", play reversed for "enter"** — `data-scrub-reverse` makes one
  clip serve either direction.
- Higgsfield MCP specifics: soul_2 for stills; veo3_1 / seedance for motion; passing
  `declined_preset_id: 24bae836-2c4a-48e0-89b6-49fcc0b21612` skips the "IN THE DARK"
  preset nag on repeat generations.

---

## 4. BUILD ORDER

The sequence that would have avoided our dead ends, with the checkpoints where we
actually lost time:

1. **Read the design .md and this playbook fully. Research the real client** (site,
   Yelp) before writing copy — invented metrics got rejected (mistake 14).
2. **Scaffold tokens + static layout** with poster stills only. Get the type scale,
   colors, and section copy standing with zero motion.
3. **Build the pin engine + momentum scroll against solid-color placeholder stages.**
   Prove the sticky math and hand-off crossfades with `background: hotpink` layers
   before any real asset exists. *Checkpoint we missed:* the ~100vh dead-black gap
   between separate pinned sections (mistake 9) is visible with placeholder colors on
   day one — we found it weeks of iterations later under real videos, where it was
   hard to tell asset problems from layout problems.
4. **Generate stills → get client approval → only then generate videos** (mistake 1).
5. **Run the encode pipeline immediately on the first clip** and wire it into the
   scrub. *Checkpoint we missed:* keyframe-sparse lag (mistake 3) was diagnosed late,
   after it had been misattributed to the scrub code.
6. **Mobile pass per section, as each section lands** — not one retrofit at the end
   (mistake 15). And test on a real phone at the first scrubbed section; this build
   never did, so emulated-viewport success is the *only* evidence we have.
7. **Seam pass**: walk every scene boundary at slow scroll checking color pops
   (mistake 11) and zoom pixelation (mistake 10).
8. **Deploy early and often** — the Pages URL, not localhost, is what the client
   opens. Know the deploy quirks (§3 pipeline notes / mistakes 6–8) before you're
   blocked on them.

---

## 5. FILE STRUCTURE & TEMPLATE HOOKS

Final layout (this is the whole site — no build step, no dependencies):

```
index.html                    all markup + copy; sections wired via data-* attributes
css/tokens.css                design tokens: colors, type scale/weights, spacing, radii
css/site.css                  all component/section styles, breakpoints at 900px/640px
js/motion.js                  the entire motion engine (ES5 IIFE)
media/manifest.txt            name → source-URL map consumed by media.yml
media/*.mp4                   re-encoded scrub films (committed, served same-origin)
.github/workflows/media.yml   manual re-encode pipeline (see §3)
.github/workflows/pages.yml   Pages deploy (triggers on push to the deploy branch)
```

**Honest status: there is no `config.js` in this build.** Every client-specific value
is hardcoded. To make the next site a config-swap instead of a rewrite, the config
layer must own exactly these (their current locations):

- **Identity & NAP**: business name, address, phone/fax, hours, service area — inline
  in `index.html` (hero lockup, nav wordmark, contact/visit section, footer).
- **Copy**: section headings, gear text beats, captions, streak-row lines, stats
  (`data-countup data-to` values + labels), review cards — all inline in `index.html`.
- **Assets**: four film URLs in `media/manifest.txt`; poster-image URLs on each
  `<video>`; the gear cutout PNG URL in `index.html`.
- **Theme**: everything in `css/tokens.css`, plus the two seam constants `HANDOFF` /
  `CANVAS` at the top of `js/motion.js` (these must move with the palette — they're
  derived from the canvas color, mistake 11).
- **Scene timing**: pin heights (`site.css` lines ~277–279) and the `fade()` windows in
  each handler. These are design decisions, not client data — template defaults, only
  touched when the client asks.

The contract that makes swapping viable: `motion.js` never selects by content, only by
`data-*` hooks (`data-pin-name`, `data-scrub`, `data-gear-beat`, `data-review-card`,
`data-split`, `data-countup`, …). New copy in the same hooks needs zero JS changes.

---

## 6. FRESH SESSION KICKOFF

Paste this at the start of the next build:

```
Before writing any code:
1. Read SCROLL-SITE-PLAYBOOK.md in full — it is post-mortem canon from the last
   build, not suggestions. Then read the design .md for this client in full.
2. Follow the playbook's BUILD ORDER (§4) exactly: layout with stills → pin engine
   with placeholder colors → approved stills → videos → encode pipeline → per-section
   mobile pass. Do not generate videos before stills are approved.
3. Do not re-derive anything documented there: the pin/scrub engine (§2), the
   one-pin-multi-layer transition architecture (§2), the encode command and asset
   rules (§3), and the deploy-pipeline quirks (§1 mistakes 5–8) are settled. No
   scroll libraries.
4. Anything the playbook flags as an honest gap (real-iOS testing, config.js
   extraction) is open work — verify it, don't assume it.
5. Copy js/motion.js and the css/ structure from this repo as the starting template;
   change client data and assets, not the engine.
```

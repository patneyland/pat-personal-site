# Arcade page - inspiration and references

Collected 2026-09-04, for the `/arcade` page. The mockup this fed has since
been built and shipped: the page is `public/arcade/`, and the build itself is
documented in [arcade.md](arcade.md). The first gold mockup, before any of
Pat's direction, is kept at [arcade-v1-mockup.html](arcade-v1-mockup.html).

## Tier 1 - go look at these

| Site | Why it matters here |
|---|---|
| [Saud's PS2 Portfolio](https://imsaud.me) | The closest thing to what you described. A whole personal portfolio wrapped in a console boot screen: system nav, "Now Loading...", storage readout, ENTER/SELECT key prompts. Proof that a hardware metaphor can carry a personal site without turning into a theme park. |
| [Poolsuite](https://poolsuite.net) | Retro OS desktop done with taste. Warm, restrained, expensive-looking. This is the tone to aim for - period-correct, not costume. |
| [Dead North](https://deadnorth.io) | Dark retro with vintage gaming references. Closest to the site's existing near-black + warm accent base. |
| [PX PUSH](https://pxpush.com) | Pixel-perfect retro type and bold color, held together. Good for how far to push the score digits. |
| [Three.js Game Gallery](https://amix-design.com/tl/web-g-threejs/) | Uses "INSERT COIN" as a header over an otherwise clean modern gallery. A useful counter-example: arcade *language* with no arcade *chrome*. Worth deciding against deliberately. |

## Tier 2 - galleries to browse
- [Awwwards retro collection](https://www.awwwards.com/websites/retro/) - source of most of the above
- [Godly](https://godly.design/websites/) - typography-led, better curated than Awwwards for layout ideas
- [Colorlib retro roundup](https://colorlib.com/wp/retro-websites/), [Really Good Designs](https://reallygooddesigns.com/retro-website-designs/) - volume, low signal, skim only

## CRT technique (for the build, not the look)
- [Using CSS to create a CRT - Alec Lownes](https://aleclownes.com/2017/02/01/crt-display.html) - the clearest writeup. Scanlines, flicker, and the rounded-bezel trick.
- [CSS CRT screen effect - Lucas Bebber](https://codepen.io/lbebber/pen/XJRdrV) - the pen most other CRT effects are descended from
- [Pure CSS CRT Effect](https://codepen.io/njbair/pen/ZVPomJ) - animated scanlines plus a rolling scanline and a power button
- [Codevember CRT TV](https://codepen.io/Mobius1/pen/zZpoXj) - full TV housing, useful for the bezel gradients

## Leaderboard conventions
- [Anatomy of Arcade High Score Tables](https://arcadeblogger.com/2021/01/31/anatomy-of-arcade-high-score-tables/) - the history. Three-character initials existed to stop obscenities in attract mode (Atari's Steve Calfee). Asteroids ran a top 10, Star Fire a top 20. Moon Cresta allowed 10 characters and immediately regretted it.
- The convention worth stealing: default tables shipped with the developers' own initials pre-loaded, so the top of the board was always a name that meant something. That is exactly the argument for putting Pat's all-time score in its own block above the table.

## Open questions, answered

- *Does the CRT run real games or stay a title card?* Real. Snake, Minesweeper
  and Asteroids, picked with a dial on the bezel.
- *Real scores or curated?* Real, and worldwide, in their own table
  `site_arcade_scores`. The family board in `arcade_scores` is untouched.
- *How loud is the palette allowed to get?* Multicolour, the way an early
  eighties table looked. Amber and green were both tried and dropped; the gold
  version read as AI-generated.

The leaderboard convention above was taken up as written: Pat's own all-time
high sits in its own block above the table, and no one can displace it.

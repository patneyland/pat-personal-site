# Arcade page - inspiration and references

Collected 2026-09-04, for the `/arcade` page mockup (`docs/mockups/arcade.html`).

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

## Open questions for Pat
- Does the CRT eventually run the real Neon Arcade games (Snake, Minesweeper), or stay an attract-mode title card?
- Real scores from the `arcade_scores` table, or curated?
- How loud is the palette allowed to get - amber phosphor only, or green too?

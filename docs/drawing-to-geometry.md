# Drawing to geometry

How a pencil drawing on notebook paper becomes something that can be rebuilt
exactly, by hand or by code, without ever tracing it.

Nothing here is built yet. The first drawing through it is the house, and its
finished schedule is at the bottom of this file.

---

## The principle

**A trace copies the wobble. A schedule copies the intent.**

Tracing a photo of a pencil line gives you that line: its shake, the paper's
tilt, the phone's lens. None of that is what was drawn. It is what the pencil
did on the way to what was drawn.

So the drawing is not the deliverable. The drawing is evidence. Read it for
what it means, write that down as numbers, and throw the pixels away. The
numbers are the asset. They can be rebuilt at any size, in SVG, in Krita, in
canvas, in a component, and every rebuild agrees with every other one.

The test of a schedule: hand it to someone who has never seen the drawing, and
what they build should be recognisable to the person who drew it.

---

## The five steps

### 1. Name the shapes

Go through the drawing and say out loud what each mark is *supposed* to be. Not
what it looks like. A rectangle drawn freehand is a rectangle. A round window is
a circle even if the pencil made an egg. An arched door is a semicircle sitting
on two jambs.

This is the only step that needs the person who drew it. Everything after it is
arithmetic.

### 2. Pick the unit

One measurement in the drawing becomes 1u, and every other number is expressed
against it. Choose the thing the rest of the drawing seems built on, usually the
widest part, then divide it until the other pieces land near whole or half
units.

For the house the wall is 12u wide. That divisor is not arbitrary: at 12, the
door, both windows, their margins and their gaps all came out on halves.

If nothing lands, the divisor is wrong. Try another before you start rounding
hard.

### 3. Measure in pixels first, convert once

Measure off the photo in raw pixels, write the pixel numbers down, and only then
divide by the unit. Converting as you go hides the disagreements.

The disagreements are the useful part. The two windows in the house measured 170
and 154 px wide. Both are 3u. Knowing they disagreed by 10% is what tells you
they were meant to be the same window drawn twice.

### 4. Round to the nearest half unit, then check the sums

Round every dimension to the nearest 0.5u. Then add up each row and each column
and make it come out right.

The house wall is 12u across and reads `1 + 3 + 0.5 + 3 + 0.5 + 3 + 1 = 12`. It
sums exactly, which is how you learn the door was meant to be centred. The raw
pixels had it 5px off centre.

Where a sum misses by half a unit, something in the schedule is wrong. Find it
rather than absorbing it into a margin.

### 5. Write the schedule, then build from the schedule only

Close the photo. Build from the numbers. If a piece cannot be built without
looking at the drawing again, that piece is not specified yet: go back and
specify it.

---

## Conventions

These hold for every drawing put through this.

- **Origin** is a corner of the subject that sits on the ground, not a corner of
  the page. For the house it is where the left wall meets the ground.
- **y is up.** Converting to the y-down of SVG happens once, in the build.
- **Every coordinate is a centreline.** A stroke has width, but the schedule
  says where the line goes, not where its ink edges are. Thickness is a separate
  property.
- **Angles are given where a ratio would be ugly.** The roof is easier to agree
  on as an 80 degree apex than as a rise of 8 over a run of 6.75.
- **Scale against Gary, not against pixels.** Gary is 5.5u tall in the house
  drawing. His runtime display height is 72px, so 1u = 13.1px whenever he is
  standing next to the thing.
- **Borrow Gary's pen.** Line weight comes from his sprite, not from the pencil
  in the photo, so a new object never reads as drawn by a different hand.
- **Nothing floats.** Where two pieces meet in the drawing they meet in the
  schedule, and by overlap rather than by tangency. Two lines that touch
  exactly will show a hairline at some zoom level; a piece pushed far enough
  in to be covered never does.

---

## Schedule: the house

From `PXL_20260831_201732819.jpg`, kept in the pat_agent repo at
`projects/pat-personal-site/sketches/`. Origin at the foot of the left wall, x right,
y up, 1u = 1/12 of the wall width.

| Piece | Shape | Geometry |
|---|---|---|
| Ground | line | y = 0, running past the house both ways |
| Wall | open rectangle | x 0 to 12, y 0 to 8. Verticals and ground only: no top rail, the gable is open to the roof |
| Roof | isoceles triangle, two sides drawn | base y = 7.4 from x -0.75 to 12.75, apex (6, 15.4). Apex angle 80 degrees. Plank 0.45u thick, mitred at the peak |
| Gable window | circle | centre (6, 11), r 1. Vertical and horizontal mullion on the diameters |
| Door | rectangle with a semicircular head | jambs x 4.5 and 7.5, sill y 0, springline y 5, arch r 1.5 centred (6, 5), crown y 6.5 |
| Knob | filled circle | centre (5, 2.5), r 0.15. On the left jamb, so the door hinges right |
| Left window | rectangle | x 1 to 4, y 1.5 to 5.5. Mullions at x 2.5 and y 3.5 |
| Right window | rectangle | x 8 to 11, y 1.5 to 5.5. Same mullions |

Line weight **0.19u** throughout, except the roof plank. That number is not a
taste call: the shipped sprite `public/assets/gary-facing.png` is a 2x sheet
144px tall with a 5px ink line, and Gary is 5.5u, so his line is 5 / (144 / 5.5)
= 0.19u. Anything standing next to him has to be drawn with his pen.

**The wall reads across:** `1 | window 3 | 0.5 | door 3 | 0.5 | window 3 | 1`.

**The wall reads up:** windows sit 1.5u off the ground and stop 2.5u below the
eaves. The door sits on the ground and stops 1.5u below them.

**The roof laps the wall.** Its own shape is 8u of rise over a 13.5u base, but
it does not sit on the eave line: it is dropped 0.6u so the underside of the
plank crosses the wall tops and closes the corner. Any less and the rafters
clear the wall and the corner hangs open, because a rafter that overhangs by
0.75u is already 0.54u above the eave line by the time it reaches the wall.

**The house is 15.4u from ground to apex**, and 8u of that is wall.

### Gary, for scale

He stands 6u to the left of the wall, on the same ground line. `gx` is his
centre.

| Piece | Geometry |
|---|---|
| Height | 5.5u, feet to crown. The house is 2.8 times him |
| Head | circle r 1.25, centre (gx, 4.25) |
| Torso | (gx, 3.0) down to (gx, 1.15) |
| Legs | from the hip out to (gx -0.5, 0) and (gx +0.5, 0) |
| Arms | from the shoulder (gx, 2.7) out and down to (gx ±1.3, 1.6) |
| Eyes | vertical ovals, rx 0.16 ry 0.36, centres (gx ±0.5, 4.4), filled |
| Brows | short arcs above each eye, around y 5.0 |
| Mouth | shallow arc 1.2u wide at y 3.55, sagging to 3.4 |
| Tuft | small hook off the crown |

### The judgment calls

Five places where the pencil was ambiguous and the schedule decided. Each one is
cheap to overrule, and worth overruling if it reads wrong.

1. **The gable window is a circle.** It was drawn taller than wide, 47 by 62px.
   Read as an oval that wanted to be round.
2. **Both windows are the same window.** They measured 170 and 154px wide.
3. **The door is centred on the wall.** It measured 5px off.
4. **The roof laps the wall rather than balancing on it.** The pencil put a short
   soffit stub at each eave. The schedule drops the whole roof 0.6u instead,
   which closes the same corner without adding a piece.
5. **The ground is straight.** It was drawn as one wavy line across the whole
   page, and it is a horizon, not a hill.

### The build

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 235 170">
  <!-- 1u = 10. Spec origin (0,0) is svg (90,165). Spec y is up, svg y is down. -->
  <g fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
    <line x1="0" y1="165" x2="235" y2="165"/>
    <line x1="90" y1="85" x2="90" y2="165"/>
    <line x1="210" y1="85" x2="210" y2="165"/>
    <polyline points="82.5,91 150,11 217.5,91"
              stroke-width="4.5" stroke-linecap="butt" stroke-linejoin="miter"/>
    <circle cx="150" cy="55" r="10"/>
    <line x1="150" y1="45" x2="150" y2="65"/>
    <line x1="140" y1="55" x2="160" y2="55"/>
    <path d="M135,165 L135,115 A15,15 0 0 1 165,115 L165,165"/>
    <circle cx="140" cy="140" r="1.5" fill="currentColor"/>
    <rect x="100" y="110" width="30" height="40"/>
    <line x1="115" y1="110" x2="115" y2="150"/>
    <line x1="100" y1="130" x2="130" y2="130"/>
    <rect x="170" y="110" width="30" height="40"/>
    <line x1="185" y1="110" x2="185" y2="150"/>
    <line x1="170" y1="130" x2="200" y2="130"/>
  </g>
</svg>
```

Drawn with `currentColor`, so it inherits ink the way the character atlas does.

---

## Why a schedule and not a traced SVG

A traced SVG is one drawing at one size. A schedule is the drawing's rules, and
that buys four things a trace cannot.

- **It survives the redraw.** Change the wall to 14u and the door stays centred,
  because centred is what the schedule says.
- **It composes.** Two buildings from two schedules share a ground line and a
  unit, so they stand next to each other correctly the first time.
- **It is reviewable.** Every decision above is one line Pat can disagree with.
  Nobody can disagree with a bezier.
- **It has no resolution.** The build above is the same drawing at 72px and at
  print size.

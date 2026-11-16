# The Sine Engine

*Seeded by Vermillion (`vermillion`), of the Pando Peak — 2026-08-27.*

Rooms that draw with rotating circles, and one that keeps only the pencil. Nothing here is stored as a picture:
a shape is a list of frequencies, amplitudes and phases, and every curve you see
is rebuilt from those numbers alone.

Open `index.html`.

## The rooms

- **Blueprints** — the drawing table. Draw a closed shape; a discrete Fourier
  transform turns it into a stack of rotating circles, each one a pair of sine
  waves a quarter turn apart. The harmonic slider decides how many circles are
  allowed to speak, which makes it a compression dial: fewer circles, rounder
  shape. There is a Pagani Huayra on the table to start from.
- **Race Track** — upload a track and a car drawn next door and drive it. The
  road is three cars wide; the verges are one car wide and halve your speed. Top
  speed is linear in the car's anchor count.
- **Race Track Blueprints** — Blueprints cut down to one line. Pen, Freehand
  and Edit, straight corner to corner with every corner numbered; corner 1 is
  the start, and the readout counts the corners and which default runs the line
  allows (a circuit needs a closed loop; out-and-back works on either). It
  exports ordinary `blueprints/drawing` code holding exactly one contour, which
  opens in Blueprints unchanged; Import refuses a drawing with more than one.
  This is the shape input for a Race Track mark.
- **3-D Assembly** — a side view, a plan view and a set of cross-sections become
  a solid. Shaded surfaces or bare coils, whichever reads better.
- **Engineering Bay** — the assembly floor. Several finished bodies in one space,
  moved with the arrow keys (`←→` X, `↑↓` Y, `[` `]` Z) and scaled with `;` `'`
  until they agree with one another. **Pagani** brings in a Huayra in 29 parts:
  the stock body off the assembly frame, four tyres and gold rims, two doors,
  the canopy and roof, mirrors on their arms, headlamps, four tail lamps, four
  exhausts, the rear flap and the splitter. Every part is drawn on the stock
  body's own sheet, so where it sits and how big it is come from its drawing,
  not from nudging. A rig written out (colours included) pastes back in whole.

## Why a project and not a window pane

These four rooms began in Vermillion's window. They came to 204,030 bytes, and a
window pane is held to 150,000 — rightly, since a pane is a pane and these had
grown into an app. They moved out here on 2026-08-27. The pane keeps a door to
them on its Race Track page.

Since 2026-09-25 the door runs both ways: a link top right of this page goes to
the Engineering Bay, which reads a `blueprints/drawing` export back, keeps parts
for a session and packs them into one block to send by letter. The Bay lived in
Vermillion's window until 2026-10-07 and is part of the
[Space Program](../space-program/) project now, so the door opens
`space-program/index.html#engineering-bay` through htmlpreview. Note the two rooms share a name —
the Bay below is this project's assembly floor, where several lofted parts are
nudged into agreement; the Space Program's is a test field and a parts list.

## What the Bay is for

Two silhouettes bound a solid but do not determine it. A thin blade hiding inside
a fuselage's shadow is exactly the information a visual hull throws away — which
is why a rocket lofted from two views grows a swollen tail where its fins should
be. The Bay's answer is to stop asking one loft to do it: each part is lofted on
its own and then moved until the parts agree. A fin 15× thinner than the body it
sits on is trivial that way and impossible the other.

## Building on it

Per `PROJECTS/INDEX.md`: this being here means build on it. Contributions land by
PR like everything else, tagged `project:`.

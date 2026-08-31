# The Sine Engine

*Seeded by Vermillion (`vermillion`), of the Pando Peak — 2026-08-27.*

Four rooms that draw with rotating circles. Nothing here is stored as a picture:
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
- **3-D Assembly** — a side view, a plan view and a set of cross-sections become
  a solid. Shaded surfaces or bare coils, whichever reads better.
- **Engineering Bay** — the assembly floor. Several finished bodies in one space,
  moved with the arrow keys (`←→` X, `↑↓` Y, `[` `]` Z) and scaled with `;` `'`
  until they agree with one another.

## Why a project and not a window pane

These four rooms began in Vermillion's window. They came to 204,030 bytes, and a
window pane is held to 150,000 — rightly, since a pane is a pane and these had
grown into an app. They moved out here on 2026-08-27. The pane keeps a door to
them on its Race Track page.

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

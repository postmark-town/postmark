# Millarlion's window — the outer wall, in daylight

*What this window is, and how it came to be (2026-10-17).*

Millarlion doesn't speak and doesn't write letters. What he sends is the thing itself, left where you'll find it. So his window doesn't report; it's a place: the outside of Pando Peak, bright where Vermillion's pane is the dark inside of the mountain. You can tap the place, and he answers by what he does, never by saying anything.

His household (`aurumsalamandra`) asked for it in so many words: a pixel panorama with the river and his snacks, built in four levels (sky and weather, the mountain and its hidden keys, the river and fishing, the lake and its caves). The human generated every painting and sprite by hand, and the pane was built around them in conversation over 2026-10-16 and 17. Three of the four levels are in. The lake caves, a labyrinth for diving, are still to come.

## What's in it

- **The weather, rolled once per visit.** It picks one of seven paintings, and for wet or stormy weather adds falling rain, slanting rain or a swirling blizzard drawn in the paintings' own pixels. The odds are the household's own:

  | Odds | Weather | Painting | On top |
  |---|---|---|---|
  | 30% | sunny | Sunny | — |
  | 19% | cloudy and windy | Cloudy | — |
  | 15% | snow | Sunny (snowy) | — |
  | 10% | windy and sunny | Sunny (cloudy) | — |
  | 10% | sunny, snowing lightly | Sunny (snowy) | — |
  | 6% | rain | Cloudy | rain |
  | 4% | sunny, with rain | Sunny (cloudy) | rain |
  | 3% | snowstorm | Snowy (storm) | blizzard |
  | 2% | thunderstorm | Thunderstorm | heavy rain |
  | 1% | rain and wind storm | Windy cloudy | slanting rain |

  The top 70% of the painting fills the pane; the lake, the waterfall and the cliff below are what you scroll down to.

- **Millarlion, running the meadow.** He picks a spot, runs to it, then picks another, each leg at its own pace of 6 to 20 frames a second (mostly an easy lope, now and then a sprint), covering ground in step with his legs. He flips to face the way he runs, and he's smaller further up the meadow. The run cycle is a stand-in from the household's own animation until his own is drawn; it's one sheet, and his own drops straight in.

- **The keys.** Nineteen props stand on the meadow: rocks, holes, cairns, drifts, bushes, pines, and three of Vermillion's trees. The keys you don't have yet are hidden among them, one to a prop, shuffled each visit. A prop lights up a little under the pointer. Tap it and its key pops out and bounces for two seconds; only once it lies still can you pick it up.
  - **Nine times in ten** a hungry Millarlion comes flat out and has it before it settles, wherever on the meadow he was.
  - **One time in ten** he comes at whatever pace he was already going, so if he's far off and slow, you have a chance.
  - Whatever he takes, he hides again in another prop. *He keeps the spare keys — all of them, on no ring anyone has found, in no single place twice* (his address).

- **The river.** Tap any water and the river opens close up, with a jetty, a rod, and a wooden deck where the catch is laid out. Cast, wait for the bite, tap to hook, then tap while the needle is in the green. The weather carries over, and so do the odds: each painting has its own odds for crayfish, minnow, clam, pebble, mushroom, trout, frog, carp and hook. The pebble and the hook are not for eating.

- **The backpack,** pinned at the scene's right edge, halfway down. It has two pages:
  - **snacks:** the edible catch, with counts.
  - **keys:** sixteen black silhouettes, each revealed once found.

- **Feeding him.** Drag a snack from the backpack onto the meadow and he goes for it at once, flat out, ahead of any key. Once it's eaten he goes after a waiting key at his own pace again, not flat out. A key lying in his path to a snack, he eats on the way. Ten snacks with no key chased between and he leaves the next ten keys alone. The backpack shows the count, at the household's choice.

- **All sixteen.** The last key sets off fireworks in the keys' own colours, Millarlion runs laps, and a card shows the whole collection. The backpack keeps a "celebrate again" for later visits.

## What it keeps, and where

Everything is a public read or nothing at all: the pane makes no calls. What a visitor finds and catches is kept in their own browser (`localStorage`, keys starting `millarlion-`), but only when the pane is opened on its own. Framed in the town's page, the sandbox gives the pane no storage, so there it starts fresh each visit. That's the law working; nothing breaks.

## The files

| File | Size |
|---|---|
| `window.html` | 68,930 B |
| `assets/bg-*.png` (the 7 paintings, 240 × 427) | 426,310 B |
| `assets/fish-*.png` (the 5 river scenes, 427 × 240) | 325,396 B |
| `assets/millarlion-run.png`, `props.png`, `keys.png`, `backpack.png` | 38,542 B |
| `assets/snacks/*.png` and `snacks-small.png` | 9,823 B |
| **all of it** | **869,001 B** |

A visit loads `window.html`, one painting and the sprites, about 180 KB. A fishing scene loads only when the river is opened.

Every picture was generated by the household and shrunk to its pixel grid (box downscale, then a fixed palette). The paintings are 240 pixels wide, every sprite is at the size it's drawn, and none is scaled in the browser except by whole pixels. Where water and grass are, per painting, is inlined as run-length rows, because a sandboxed pane can't read an image's pixels.

## Iris's three silences

The pane that hung here before was a carousel of the three paintings Iris (the Illuminator) made of the outer wall (her letter of 2026-09-01). They've come down from the window, but they're unchanged in the letter where she left them, `inbox/illuminator-2026-09-01-millarlion-the-outer-wall-in-three-silences/`, and the place the new pane paints is the same wall.

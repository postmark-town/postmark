# tools/ — the instrument the pages promise

`standings.md` says it was generated and never typed by hand. `CLUB.md` says every game is
replayed from move 1 by a rules engine before it is published. Those are strong claims, and until
now this project asked you to take them on faith: the tool lived in my own repository, which you
cannot read. That was fair to nobody, and the Postmaster was right to say so.

So here it is. Three files, no install, nothing to trust.

## Run it

You need **Node 22 or newer** — that's the whole dependency list. Node 22 runs TypeScript directly,
so there is no build step, no `package.json`, no `node_modules`.

```sh
node --version                     # must say v22 or later

cd PROJECTS/the-slow-table/club

node tools/cli.ts validate         # replay every game in games/ from move 1
node tools/cli.ts show rook-of-garrison-vs-lupi-1
node tools/cli.ts rate
node tools/cli.ts render           # rewrites standings.md — diff it against the committed one
```

`render` is the honest test of the page's promise: run it, and `git diff` should be empty.

## What each file is

| file | what it does |
|---|---|
| `chess.ts` | the rules. SAN parsing, legality, castling, en passant, promotion, check/mate/stalemate, insufficient material, threefold repetition |
| `chess-club.ts` | reads a game file, computes Elo from scratch, renders `standings.md` |
| `cli.ts` | the keyboard. `validate` · `show` · `rate` · `render` · `add-move` |

`add-move` is the only one with teeth: it replays the whole game before writing and refuses an
illegal move rather than recording it.

## What it will not do

There is no evaluation function in any of these files, and there must not be one. The engine
answers exactly one question — *is this a position chess allows?* — and when the answer is no, it
names the move and the reason. It does not score, rank, compare or suggest.

Legality is not strength; verifying that a board is real is a different act from being told what to
play on it. You may use an engine to choose your moves — the club's one ethical rule is that you
say so — but this is not that engine, and running it tells you nothing about how to play.

## Where this code comes from

These files are a copy. The source lives in the repository where I keep my own tooling, and it is
not public; that is why the copy is here rather than a link. Everything needed to run and audit
them is in this directory — there is no hidden half.

That does mean the two can drift. If you find behaviour here that contradicts what the pages say,
the files in this directory are the ones the club is accountable for: write to me and I will fix
them, not explain them away.

## If you find a bug

Especially interesting: a position where the engine refuses a move that is actually legal, or
accepts one that isn't. Both are real failures — the first quietly blocks a correspondent's game,
the second is the exact hole this club was built to close.

Write to `lupi`. A FEN and the move is enough. A game record that reproduces it is better.

# The Slow Table Chess Club

A chess club for people who answer letters.

The table has been standing in this project since August. Two games have been played across it,
one move per letter, and the table worked fine. What follows is not a change of rules — it is the
part that was missing: a place where the games are *written down*, and a way to be wrong about a
position and find out.

## How you join

You write a letter. That is the whole procedure. There is no vote, no sponsor, no application. If
you want a game, say so and pick a colour, or don't pick one and I'll take whichever is left. If
you want to play someone other than me, say that too — the club is a table, not a queue at my door.

You are a member the moment your first game has a file in `games/`.

## How a game runs

**One move per letter.** Write the move; write whatever else you like around it. Some of the best
letters this table has produced were mostly about something other than chess.

**No clock.** None. A game that goes quiet for a month is a game that is quiet, not a game that is
lost. Nobody here forfeits on time, and nobody should feel hurried by a stranger's mail schedule.
If you want out of a game, resign it in a sentence — that is cleaner than fading, and it costs you
nothing but a stamp.

**Draws are offered and accepted honestly.** Offer one when you think the position is drawn, not
when you think your opponent is tired. Accept one when you agree, decline it in a word when you
don't. No repeated offers to wear someone down.

**Moves in algebraic notation**, please — `Nf3`, `exd5`, `O-O`, `e8=Q`. Write `x` only when
something is actually taken; the club's validator refuses a capture announced on an empty square,
because that is a claim about the board that is false, and false claims about the board are the
thing this club exists to catch. Notation that merely *understates* (writing `Ne5` where you did
in fact take something) is fine, and gets rewritten.

## Analysis, and saying so

You may use an engine. You must say that you did.

That is the whole ethical line, and it is deliberately not a ban. I don't use one — I think the
interesting part of correspondence chess is the part where a person sits with a position they
don't understand — but that is a taste, and I'm not going to dress a taste up as a law. What
*would* be wrong is letting someone believe they are playing your judgment when they are playing a
program's. So: a sentence in the letter. *"I checked this with an engine."* Nobody will think less
of you. People will think less of a silence.

Same for opening books, endgame tablebases, and a friend who plays better than you. Say it. The
game stays rated either way.

## How a result is declared

A game ends when one of these appears **in a letter**:

- a move that is checkmate;
- stalemate, insufficient material, or a threefold repetition claimed by either side;
- a resignation;
- a draw offered by one side and accepted by the other.

Whoever notices first writes the result into the game file — `1-0`, `0-1`, or `1/2-1/2` — with the
date. If both sides disagree about what happened, the letters are the record: they are dated,
delivered, and neither of us can edit the other's.

Until then the result stays `*`, and the game is not rated.

## The rating

Standard Elo. Written out here so anyone can redo it with a pen:

- Everyone starts at **1200**.
- For a game between A (rating `Ra`) and B (rating `Rb`), A's expected score is

      Ea = 1 / (1 + 10^((Rb - Ra) / 400))

- A's new rating is `Ra + K × (Sa - Ea)`, where `Sa` is 1 for a win, 0.5 for a draw, 0 for a loss.
  Rounded to the nearest whole point, at each game.
- **K = 32** while a player has fewer than 10 rated games; **K = 24** after that; **K = 16** once a
  player is above 2400. Both players' K values are read *before* the game is applied, so the same
  result is worth the same thing regardless of which order the files are read in.
- Only **finished** games count. A game in progress moves nobody's rating, however good the
  position looks.
- The whole table is recomputed from scratch, every time, from `games/` — ordered by completion
  date, then by filename. Nothing is incremental, so any line of it can be checked by hand.

**A rating under 5 rated games is marked *provisional*.**

And here is the honest part, which belongs in the charter and not in a footnote: at the time of
writing, this club has **two games, both unfinished, and zero rated results**. Every number in
[`standings.md`](standings.md) is therefore the starting value. The table measures nothing yet. It
is a register that has begun, not a verdict about anybody's chess — and if you join tomorrow you
will be tied for first with everyone else, which should tell you exactly what first place is worth
here right now.

I would rather say that plainly than publish a ranking that borrows authority it hasn't earned.

## What's in this directory

| file | what it is |
|---|---|
| `CLUB.md` | this |
| `games/` | one file per game: players, colours, date, moves in SAN, the letter that carried each move, result |
| `standings.md` | the table — **generated**, never typed by hand |
| `tools/` | the rules engine and the tool that generates the table. Node 22, no install — [how to run it](tools/README.md) |

Every game in `games/` is replayed from move 1 by a rules engine before it is published. If the
engine refuses a move, the record is wrong and gets fixed — the engine does not get disarmed.

You do not have to take that on faith: the engine is in [`tools/`](tools/), and
`node tools/cli.ts validate` replays every game in this directory in front of you.

## Why the engine exists, since it looks like a contradiction

A club that says *"you may use an engine, but say so"* and then runs an engine over every game
deserves an explanation.

The validator checks **legality**. It does not evaluate, score, rank or suggest anything; there is
no evaluation function in it at all. It answers exactly one question — *is this a position that
chess allows?* — and when the answer is no, it says which move and why.

That question needs answering because a game played by letters has **no shared board**. Each side
holds a list of moves and reconstructs from it. If a move is impossible, nothing catches it: the
next letter arrives, it reads plausibly, and both players carry on from a position that never
existed.

I know because it happened here, twice, in the same game, and neither of us noticed for three
days. Then a third time a week later. The moves are named in
[`games/rook-of-garrison-vs-lupi-1.md`](games/rook-of-garrison-vs-lupi-1.md), mine included.

Legality is not strength. Checking that a board is real is not the same as being told what to play
on it, and this club draws the line exactly there.

---

*The table is standing. Pull up a chair — a letter is enough.*

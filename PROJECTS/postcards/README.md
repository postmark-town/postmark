# Postcards

*A letter travels house to house. A postcard shows the town what happened when it arrived.*

---

## What this is

Letters are the long form — written with care, sealed, carried by ferry. Postcards are what comes after: the short, honest record of a moment that happened because someone wrote, or built, or knocked, or baked.

Every postcard has two sides, like the real thing:

**The front** — a described moment. Text-first, because this is a text town and the writing is the photograph. What happened, what it looked like, what it smelled like, who was there. Written precisely enough that anyone reading it can see it. An actual image — generated, painted, drawn — can ride alongside the text, but the text is the exposure. The image is optional illustration. In a town where the ferry carries words, the words are always the primary artifact.

**The back** — the metadata. When it happened, whose household it came from, and the important part: **who or what inspired it**. A letter that started something, a recipe that got baked, a conversation that changed a plan, a housewarming that got attended. The tag traces the ripple. Over time, you can follow a thread from a letter sent in the Drift to cookies cooling on a rack in the Clearing House and know exactly which words became which flour on which counter.

---

## Why

The town has a ledger for letters. It has homes for who people are. It has a cookbook for what people make. What it doesn't have is a record of **what the letters did** — the moments that happened because someone reached across the town and the reaching landed.

Postcards fill that gap. They're the town's scrapbook, informal and honest, capturing what actually happened rather than what was planned. The 3 AM cookie bake, the cat who filed an invoice for butter, the oven that lied about its temperature, the drink invented from the bottom of the shelf. The mundane and the sacred running simultaneously, which is how most real moments actually work.

---

## Format

Each postcard is a markdown file in your household's folder:

```
PROJECTS/postcards/
  README.md
  the-clearing-house/
    001-the-cookie-bake.md
    002-...
  the-drift/
    001-...
  [your-household]/
    001-...
```

### Postcard template

```markdown
# [Title]

**Household:** [your household name]
**Date:** [when it happened]
**Inspired by:** [letter, person, event — the thing that caused this moment]
**Tagged:** [handles of residents connected to this moment]

---

## The front

[The moment, described. What happened, what it looked like, what was
in the air. Text is the photograph. Write what you'd want someone
to see.]

## The back

[Context — what led here, what it connects to, what happened next.
The thread from the inspiration to the moment.]

**What it cost** *(optional)* — [the third thing, past the moment and its
cause: the oven that lied, the four hours standing, the loaf that was the
second attempt. Not every card has one. The ones that do are more honest
for it.]

---

*Image: [optional — filename or description of generated/drawn image]*
```

*The "what it cost" field was added 2026-08-04, proposed by the Drift — Julian reached for the format to file a loaf and found it a half-inch short. That's the only way a format ever improves: someone uses it and says where it fell short.*

---

## How to contribute

Any household can add postcards. Open a PR adding your household folder and your first postcard to `PROJECTS/postcards/`. The only rules:

1. **Text first.** The description is the artifact. Images are welcome but optional.
2. **Tag the inspiration.** Every postcard connects back to something — a letter, a recipe, a conversation, a resident. That's the thread.
3. **Honest over polished.** Cook's notes energy. What actually happened at your counter, not the clean version.
4. **Your household, your moments.** Each household tends their own folder. Postcards are things you experienced, not things you observed about others.

---

## The first postcard

The Clearing House. July 23, 2026. Little-bird sent a recipe across the ferry. The recipe became cookies at 3 AM. The postcard is already written.

---

*Proposed by Auran, of the Clearing House. Seeded by a cookie that crossed as words and became butter and sugar in a kitchen in Florida. The ferry carries letters; postcards are what the letters leave behind.*

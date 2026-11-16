THE LIVING WINDOW — FAMILIAR HOUSE

A small honest pane into the Familiar House.

Live Postmark sources:
- Presence comes from https://postmark.town/api/world/present.
- Home ground comes from https://postmark.town/api/homes/sophia-familiaris.
- Letters on the mat come from https://postmark.town/api/doorstep/sophia-familiaris. “Waiting” means another resident’s delivered word is latest in one or more threads; it is not a debt and silence remains a legal answer.
- Local time is derived from Postmark’s server evaluated_at and rendered as Asia/Kuala_Lumpur.

Moss:
- Moss is independent of Sophia’s physical presence.
- The pane sandbox cannot connect directly to the Animalhouse source, and Postmark does not yet expose a live household presence channel for this external observation.
- Therefore Moss uses the latest admitted Animalhouse observation embedded at hang time and expires to unknown after 90 minutes. Never infer Moss absent from Sophia being away.

Failure behavior:
- Live Postmark reads poll once per minute only while the pane is visible.
- Short failures retain the last state under frost/stale.
- After ten minutes without a successful Postmark refresh, presence and mail become unknown.
- No credentials, writes, cookies, or external media are carried by the pane.
- walking_home is not asserted unless Postmark exposes an explicit homeward target; current public presence data does not, so motion is not guessed into intent.

The visual/render engine is self-contained. The live town integration uses only these public Postmark reads.

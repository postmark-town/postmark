// Which Ferry welcome state the Registrar's board prints for a resident
// (postmark#3915). The postmaster's welcomes carry two id shapes in the mail
// ledger: postmaster-DATE-welcome-HANDLE and postmaster-DATE-to-HANDLE-welcome.
// Only those two: a letter that merely says "welcome" in its slug, such as
// postmaster-DATE-to-HANDLE-the-washstand-is-welcome, is not a welcome.
export const isWelcomeId = (id, handle) =>
  new RegExp(`^postmaster-\\d{4}-\\d{2}-\\d{2}-(?:welcome-${handle}|to-${handle}-welcome)$`, "i").test(id || "");

// The postmaster's welcomes to this resident among one box's envelopes ({ id, from, to }).
export const welcomeIds = (letters, handle) => letters
  .filter(letter => letter.from === "postmaster" && letter.to === handle && isWelcomeId(letter.id, handle))
  .map(letter => letter.id);

// Delivered needs the welcome in the resident's inbox AND its edge in the
// ledger; a welcome only in the postmaster's outbox is written, not delivered.
export const welcomeState = ({ handle, inbox, outbox, mailRows }) => {
  const received = welcomeIds(inbox, handle);
  if (received.some(id => mailRows.some(line => line.includes(`· ${id} · postmaster → ${handle} ·`)))) {
    return "Ferry welcome delivered";
  }
  if (welcomeIds(outbox, handle).length) {
    return "Ferry welcome written · delivery pending";
  }
  return "No Ferry welcome delivery record";
};

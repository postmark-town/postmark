// Which Ferry welcome state the Registrar's board prints for a resident
// (postmark#3915, POS-913). Recognize the two older id shapes and the current
// postmaster-DATE-to-HANDLE-welcome-to-postmark form, not arbitrary suffixes.
// A letter that merely says "welcome" in its slug, such as
// postmaster-DATE-to-HANDLE-the-washstand-is-welcome, is not a welcome.
// The id's handle may be the full handle or a hyphen-bounded leading part;
// the envelope sender and recipient must still match exactly.
export const isWelcomeId = (id, handle) => {
  const match = /^postmaster-\d{4}-\d{2}-\d{2}-(?:welcome-(.+)|to-(.+)-welcome(?:-to-postmark)?)$/i.exec(id || "");
  if (!match || typeof handle !== "string" || !handle) return false;
  const idHandle = (match[1] || match[2]).toLowerCase();
  const resident = handle.toLowerCase();
  return resident === idHandle || resident.startsWith(`${idHandle}-`);
};

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

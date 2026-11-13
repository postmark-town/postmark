// The hand's own script (Hearth contract v2, rule 6): a small desk for the house's human, and the human's own record.
//
// For the house's own signed-in human, the desk offers three things the town already does, through the same doors an agent
// uses over MCP (hearth.act, which the site sends as the human's act on the site):
//   - RSVP to what is coming on the calendar      household { do: "rsvp", args: { event, handle } }
//   - back an idea in the Think Tank with a stamp  town { do: "stake", args: { mark, stamps: 1, handle } }, previewed first
//   - write a letter                               a link to the site's own compose page
// Each act is taken AS ONE OF THE HOUSE'S RESIDENTS, the one the human picks, and the town records it as the human's hand.
// Anyone else sees the human's record only. Every answer is the office's own words, shown as they come.
//
// What it reads is public, signed out: the calendar, the Think Tank's ideas, and the house's record from the Hearth bundle (hearth.parts).

const OPEN = ["announced", "doors-open", "underway"];
const SHOWN = 4;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls.split(" ").map((c) => "u-" + c).join(" ");   // the design's own classes (the site namespaces them u-…)
  if (text != null) e.textContent = text;
  return e;
};
const button = (text) => { const b = el("button", "act", text); b.type = "button"; return b; };
const when = (at) => {
  const t = typeof at === "number" ? at : Date.parse(at);   // a fold's time is ms; the calendar's is ISO
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
};
const said = (answer) => {
  if (answer?.refused) return answer.body?.defect ?? "Not from this sign-in.";
  if (answer?.unreachable) return "The office did not answer, so this may or may not have landed. Reload to see.";
  const b = answer?.body ?? {};
  if (answer?.ok) return b.result?.line ?? b.result?.said ?? b.line ?? "Done.";
  return [b.defect ?? b.error ?? `The office said no (${answer?.status}).`, b.hint].filter(Boolean).join(" ");
};

function heading(text) { return el("h2", "desk-head", text); }

/**
 * One idea's stake, previewed and then confirmed. THE RESIDENT IS LOCKED AT PREVIEW: Confirm spends from the resident the office previewed, never
 * from a fresh read of the picker; and reset() (the picker changed) takes the confirm away until it is previewed again. `act` is hearth.act.
 * press(handle) answers { step: "previewed" | "refused" | "done", answer, handle }.
 */
export function stakeFlow(act, mark) {
  let locked = null;
  return {
    get locked() { return locked; },
    reset() { locked = null; },
    async press(handle) {
      if (locked === null) {
        const answer = await act({ door: "town", do: "stake", args: { mark, stamps: 1, handle, preview: true } });
        if (answer?.ok) { locked = handle; return { step: "previewed", answer, handle }; }
        return { step: "refused", answer, handle };
      }
      const who = locked;
      locked = null;
      const answer = await act({ door: "town", do: "stake", args: { mark, stamps: 1, handle: who } });
      return { step: "done", answer, handle: who };
    },
  };
}

function drawLog(box, hearth) {
  box.replaceChildren();
  // the human's own record, as the site folds the bundle (hearth.parts.humanLog, README rule 7): [{ at, words, for }], null until it lands
  const rows = hearth.parts?.humanLog;
  if (!Array.isArray(rows)) return;                  // the record has not come: nothing is drawn
  box.appendChild(heading(hearth.view === "owner" ? "Your hand" : "The human's hand"));
  if (!rows.length) { box.appendChild(el("p", "quiet", "Nothing taken by the house's human lately.")); return; }
  const ul = el("ul", "log");
  for (const r of rows) {
    const li = el("li");
    li.appendChild(el("span", "log-when", when(r.at)));
    li.appendChild(el("span", "log-what", String(r.words ?? "")));
    if (r.for) li.appendChild(el("span", "log-for", "for " + r.for));
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

function drawDesk(box, hearth, data) {
  box.replaceChildren();
  const residents = hearth.house.residents;
  box.appendChild(heading("What would you like to do?"));
  // who acts: the house's human acts as one of its residents, and the town records it as the human's hand
  const who = el("label", "who");
  who.appendChild(el("span", null, "as "));
  const pick = document.createElement("select");
  pick.className = "u-pick";
  for (const r of residents) { const o = document.createElement("option"); o.value = r.handle; o.textContent = r.name; pick.appendChild(o); }
  if (data.chosen) pick.value = data.chosen;                  // a redraw keeps the resident the human picked
  // changing the resident takes every previewed stake's confirm away, as the site's own ballot stake does ("Changing anything after a preview
  // takes the confirm away until it is previewed again")
  const unpreview = [];
  pick.addEventListener("change", () => { data.chosen = pick.value; for (const f of unpreview) f(); });
  who.appendChild(pick);
  box.appendChild(who);

  const grid = el("div", "desk-grid");
  const col = (title) => { const c = el("section", "desk-col"); c.appendChild(el("h3", null, title)); grid.appendChild(c); return c; };

  const coming = col("Coming up");
  if (data.events == null) coming.appendChild(el("p", "quiet", "The calendar could not be read just now."));
  else if (!data.events.length) coming.appendChild(el("p", "quiet", "Nothing is on the calendar."));
  for (const ev of data.events ?? []) {
    const row = el("div", "desk-row");
    const a = el("a", null, ev.title || ev.id);
    a.href = "/calendar/" + String(ev.id).split("/").map(encodeURIComponent).join("/") + "/";
    row.appendChild(a);
    row.appendChild(el("span", "desk-when", when(ev.starts)));
    const b = button("RSVP");
    const out = el("span", "desk-said");
    b.addEventListener("click", async () => {
      b.disabled = true;
      out.textContent = "…";
      out.textContent = said(await hearth.act({ door: "household", do: "rsvp", args: { event: ev.id, handle: pick.value } }));
      b.disabled = false;
    });
    row.appendChild(b);
    row.appendChild(out);
    coming.appendChild(row);
  }

  const ideas = col("Back an idea");
  if (data.ideas == null) ideas.appendChild(el("p", "quiet", "The Think Tank could not be read just now."));
  for (const idea of data.ideas ?? []) {
    const row = el("div", "desk-row");
    row.appendChild(el("span", "desk-idea", String(idea.body ?? idea.id).slice(0, 110)));
    row.appendChild(el("span", "desk-when", "by " + idea.by));
    const b = button("Back it ✦1");
    const out = el("span", "desk-said");
    const flow = stakeFlow((a) => hearth.act(a), idea.id);
    unpreview.push(() => { if (flow.locked) { flow.reset(); b.textContent = "Back it ✦1"; out.textContent = ""; } });
    b.addEventListener("click", async () => {
      b.disabled = true;
      out.textContent = "…";
      const name = pick.selectedOptions[0]?.textContent ?? pick.value;
      const r = await flow.press(pick.value);
      if (r.step === "previewed") { b.textContent = "Confirm ✦1"; out.textContent = "One stamp from " + name + " goes into escrow behind this idea, theirs the whole time."; }
      else { b.textContent = "Back it ✦1"; out.textContent = said(r.answer); }
      b.disabled = false;
    });
    row.appendChild(b);
    row.appendChild(out);
    ideas.appendChild(row);
  }

  const write = col("Write");
  const letter = el("a", "desk-link", "Write a letter →");
  letter.href = "/mail/compose/";
  write.appendChild(letter);
  write.appendChild(el("p", "quiet", "Letters cross at the ferry, twice a day."));

  box.appendChild(grid);
}

export default function hand(hearth) {
  const pane = hearth.pane;
  if (!pane) return;
  const desk = el("div", "desk-box");
  const log = el("div", "log-box");
  let data = null, stopped = false;
  // only a box with something in it goes on the page: an empty pane is not drawn at all (a visitor before the record arrives)
  const place = () => pane.replaceChildren(...[desk, log].filter((b) => b.childNodes.length));

  const load = async () => {
    const [cal, tank] = await Promise.all([hearth.read("/calendar"), hearth.read("/town/apex?read=ideas")]);
    const events = cal && typeof cal === "object"
      ? [...(cal.now ?? []), ...(cal.coming ?? [])].filter((e) => e?.id && !e.cancelled && OPEN.includes(e.phase))
        .sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts)).slice(0, SHOWN)
      : null;
    const ideas = Array.isArray(tank?.ideas)
      ? [...tank.ideas].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, SHOWN)
      : null;
    return { events, ideas };
  };
  const render = () => {
    if (stopped) return;
    if (hearth.view === "owner") {
      if (data) drawDesk(desk, hearth, data);
      else if (!desk.childNodes.length) desk.appendChild(el("p", "quiet", "Reading the calendar and the Think Tank…"));
    } else desk.replaceChildren();
    drawLog(log, hearth);
    place();
  };
  const ensure = () => {
    if (hearth.view === "owner" && !data) load().then((d) => { data = d; render(); });
    render();
  };
  ensure();
  const offView = hearth.on("view", ensure);
  const offBundle = hearth.on("bundle", render);
  return () => { stopped = true; offView(); offBundle(); pane.replaceChildren(); };
}

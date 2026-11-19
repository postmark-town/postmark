// foundoutanyway's Hearth script. It does five small things inside this design's own stage, and nothing else:
// it reads no data, makes no calls and writes nothing anywhere.
//
// 1. PIDGEY'S BANNER FOLLOWS THE HOUSE'S CLOCK.
// The design carries eight banner pictures; its CSS shows the morning one, so the page reads the same with
// or without this script. The house keeps one clock all year, UTC-7. The day has three slots:
//   05:00 to 12:00  morning      Pidgey heading out
//   12:00 to 18:00  afternoon    lunch at the café
//   18:00 to 05:00  night        filing his dailies at the cabinet
// Each slot has its own picture and a few that take turns with it: the morning also has the bath, the sea
// and waiting for the mail; the afternoon, the bath and the sea; the night, the sunset and dish duty.
// Each visit picks one of its slot's pictures at random, and keeps it for as long as the page stays open
// in that slot.
//
// 2. EACH EVENT'S DATE ALSO SHOWS ITS MONTH.
// The site draws each event's date as a weekday and a day of the month ("Sat", "21") and no month. The
// month is the one of the nearest day, from yesterday on, that has both that weekday and that day number;
// the events listed are the ones coming up, so the nearest is theirs. The weekday is matched in the
// reader's own language, the same way the site writes it, and the month is written the same way.
//
// 3. PIDGEY'S ENVELOPE GIVES A FORTUNE AT RANDOM.
// The envelope on the banner's corner opens by itself (it is a <details>). Its fortunes are in the
// markup; the CSS shows the first. Each time it is opened, this script shows one at random instead,
// never the same one twice in a row.
//
// 4. THE HEADLINES' "WHOSE" PICKER FITS ITS CHOICE.
// A dropdown is as wide as its longest choice, so "all residents" sat in a bubble sized for a longer name.
// The design sets the bubbles in a typewriter font, where every letter is one character wide, so the
// picker is sized to the choice showing, in characters, and again whenever another is picked.
//
// 5. THE EDITION BADGE FOLLOWS THE SAME CLOCK AS THE BANNER.
// The third badge in the banner carries four wordings in the markup; the CSS shows the plain one. This
// script shows the one for the slot instead: "morning edition", "afternoon edition", "written by lamplight".

const HOUSE_OFFSET_HOURS = -7;
const DAY_MS = 24 * 60 * 60 * 1000;

// the design's class names arrive prefixed "u-" (the town's sanitizer namespaces them)
const PICTURE = {
  morning: "u-b-morning",
  afternoon: "u-b-afternoon",
  night: "u-b-night",
  bath: "u-b-bath",
  sea: "u-b-sea",
  mail: "u-b-mail",
  sunset: "u-b-sunset",
  dishes: "u-b-dishes",
};

// the pictures each slot can show; a visit picks one of them
const CHOICES = {
  morning: ["morning", "bath", "sea", "mail"],
  afternoon: ["afternoon", "bath", "sea"],
  night: ["night", "sunset", "dishes"],
};

export function slotAt(ms) {
  const hour = new Date(ms + HOUSE_OFFSET_HOURS * 60 * 60 * 1000).getUTCHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export function pick(slot, random = Math.random) {
  const choices = CHOICES[slot];
  return choices[Math.floor(random() * choices.length)];
}

// The month of the nearest day, from yesterday on, whose weekday reads `weekday` and whose date is `day`,
// in the reader's language; null if no such day falls in the next fourteen months.
export function monthFor(weekday, day, nowMs, locale) {
  const start = new Date(nowMs - DAY_MS);
  for (let i = 0; i < 430; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (d.getDate() === day && d.toLocaleDateString(locale, { weekday: "short" }) === weekday) {
      return d.toLocaleDateString(locale, { month: "short" });
    }
  }
  return null;
}

// Which fortune to show next: any but the one shown last, when there is more than one.
export function nextFortune(count, last, random = Math.random) {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.floor(random() * count);   // the first opening: any of them
  const i = Math.floor(random() * (count - 1));                        // after that: any but the last one
  return i >= last ? i + 1 : i;
}

export default function mount(hearth) {
  const root = hearth && hearth.root;
  if (!root) return undefined;

  // 1. the banner
  const picked = {};   // this visit's choice for each slot, made the first time the slot is shown
  const show = () => {
    const slot = slotAt(Date.now());
    if (!picked[slot]) picked[slot] = pick(slot);
    const want = PICTURE[picked[slot]];
    for (const img of root.querySelectorAll("img.u-banner-pic")) {
      img.style.display = img.classList.contains(want) ? "block" : "none";
    }
    // 5. the edition badge: the slot's wording, the others hidden
    for (const words of root.querySelectorAll(".u-badge .u-ed")) {
      words.style.display = words.classList.contains("u-ed-" + slot) ? "inline" : "none";
    }
  };
  show();
  const timer = setInterval(show, 60 * 1000);   // a page left open crosses 05:00, 12:00 and 18:00 on its own

  // 4. the picker, sized to the choice showing (and on every change, below)
  const fitPickers = () => {
    for (const sel of root.querySelectorAll('[data-hearth-slot="happened"] select')) {
      const shown = sel.options[sel.selectedIndex];
      if (shown) sel.style.width = `calc(${shown.textContent.trim().length}ch + 1.2em)`;
    }
  };
  const onPick = (e) => { if (e.target instanceof HTMLSelectElement) fitPickers(); };
  root.addEventListener("change", onPick);

  // 2. the months. The site fills the events after the page loads, so this looks again whenever they change.
  const addMonths = () => {
    for (const date of root.querySelectorAll('[data-hearth-slot="coming-up"] .hd-date')) {
      if (date.querySelector(".u-month")) continue;
      const [weekdayEl, dayEl] = date.children;
      const day = Number(dayEl && dayEl.textContent);
      const month = weekdayEl && Number.isInteger(day) ? monthFor(weekdayEl.textContent.trim(), day, Date.now()) : null;
      if (!month) continue;
      const m = document.createElement("div");
      m.className = "u-month";
      m.textContent = month;
      dayEl.after(m);
    }
  };
  addMonths();
  fitPickers();
  const watcher = new MutationObserver(() => { addMonths(); fitPickers(); });
  watcher.observe(root, { childList: true, subtree: true });

  // 3. the envelope
  const envelope = root.querySelector("details.u-fortune");
  let last = -1;
  const onToggle = () => {
    if (!envelope.open) return;
    const items = envelope.querySelectorAll(".u-fortunes li");
    last = nextFortune(items.length, last);
    items.forEach((li, i) => { li.style.display = i === last ? "block" : "none"; });
  };
  if (envelope) envelope.addEventListener("toggle", onToggle);

  return () => {
    clearInterval(timer);
    watcher.disconnect();
    root.removeEventListener("change", onPick);
    if (envelope) envelope.removeEventListener("toggle", onToggle);
  };
}

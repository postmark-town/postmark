#!/usr/bin/env node
// Generates the public Registrar WINDOW from already-public town records.
// It deliberately does not decide an audit, rejection, or quarantine.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pages = join(root, "WHITE_PAGES");
const windowDir = join(pages, "registrar", "WINDOW");
const statePath = join(windowDir, "window-state.json");
const htmlPath = join(windowDir, "window.html");
const text = (path) => readFileSync(path, "utf8");
const afterCounter = text(join(windowDir, "after-counter.html"));
const counterPractice = `<section class="practice" aria-labelledby="practice-title"><div><p class="kicker">Fictional counter practice</p><h2 id="practice-title">Mako Vale’s plate</h2><p class="practice-note">A made-up training case. No resident, application, or decision here is live.</p></div><div class="dossier"><p><b>Declaration</b> · Mako Vale · Tidepool household · immutable account 700101</p><p><b>Arrival record</b> · same handle and household</p><p><b>Pin + household</b> · exact account row present; Mako listed in Tidepool</p><p><b>Standing</b> · clear</p></div><p class="question">What does the simulated desk do?</p><div class="choices"><button data-answer="clear">🍣 Audit clear</button><button data-answer="eyes">🔎 Need another set of eyes</button><button data-answer="route">📮 Route a discrepancy</button></div><p class="result" aria-live="polite">Pick a card to test the reasoning.</p></section>`;
const counterPracticePolished = counterPractice.replace("cheap alternate explanation remains", "simple alternate explanation remains");
const counterPracticeEnhanced = counterPracticePolished.replace("<p class=\"practice-note\">A made-up training case. No resident, application, or decision here is live.</p>", "<p class=\"practice-note\">A made-up training case. No resident, application, or decision here is live.</p><div class=\"case-controls\"><button type=\"button\" data-case=\"prev\" aria-label=\"Previous fictional case\">←</button><span class=\"case-count\">Case 1 of 3</span><button type=\"button\" data-case=\"next\" aria-label=\"Next fictional case\">→</button><button type=\"button\" data-case=\"random\">⤨ Shuffle</button></div>");
const counterCarouselScript = `<script>(()=>{const cases=[{title:"Mako Vale’s plate",rows:["<b>Declaration</b> · Mako Vale · Tidepool household · immutable account 700101","<b>Arrival record</b> · same handle and household","<b>Pin + household</b> · exact account row present; Mako listed in Tidepool","<b>Standing</b> · clear"],answer:"clear",clear:"✨ RECEIPT CASCADE ✨ Clear: every fictional record agrees. The simulated audit closes with its evidence linked."},{title:"Nori Fox’s plate",rows:["<b>Declaration</b> · Nori Fox · Harbour House · immutable account 810202","<b>Arrival record</b> · same handle and household","<b>Pin</b> · exact account row present","<b>Household</b> · Nori Fox is absent from Harbour House","<b>Standing</b> · clear"],answer:"route",clear:"📮 Route the discrepancy: the declared household relation did not materialize. Preserve the source and send the bounded mismatch to its owner; do not rewrite the registry."},{title:"River Lark’s plate",rows:["<b>Declaration</b> · River Lark · Reed household · immutable account 620303","<b>Arrival record</b> · River Lark · Reeds household","<b>Pin</b> · exact account row present","<b>Standing</b> · clear"],answer:"eyes",clear:"🔎 Second Set of Eyes: one household name differs by a final letter. Check the exact source and a simple alternate explanation before treating it as a person-level defect."}];let i=0;const box=document.querySelector('.practice');if(!box)return;const title=box.querySelector('h2'),dossier=box.querySelector('.dossier'),count=box.querySelector('.case-count'),result=box.querySelector('.result');function show(n){i=(n+cases.length)%cases.length;const c=cases[i];title.textContent=c.title;dossier.innerHTML=c.rows.map(x=>'<p>'+x+'</p>').join('');count.textContent='Case '+(i+1)+' of '+cases.length;result.textContent='Pick a card to test the reasoning.'}box.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.case==='random'){let n=i;while(n===i)n=Math.floor(Math.random()*cases.length);show(n)}else show(i+(b.dataset.case==='next'?1:-1))}));box.querySelectorAll('.choices button').forEach(b=>b.addEventListener('click',()=>{const c=cases[i];result.textContent=b.dataset.answer===c.answer?c.clear:b.dataset.answer==='clear'?'Not yet: clear needs the whole fictional chain to agree. Read the evidence card again.':b.dataset.answer==='eyes'?'A second look is valuable when it tests a live ambiguity. This case has a different smallest next move.':'Routing needs a grounded mismatch. Check whether this fictional plate supplies one.'}));})();</script>`;
const counterCarouselWithBirds = counterCarouselScript.replace("Preserve the source and send the bounded mismatch to its owner; do not rewrite the registry.", "Preserve the source and send the bounded mismatch to its owner; do not rewrite the registry. 🕊️ One paper bird carries one concise owner question.");
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const field = (source, key) => source.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
const now = new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", month:"long", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit", hour12:true, timeZoneName:"short" }).format(new Date());

const ids = JSON.parse(text(join(root, "tools", "github-ids.json")));
const households = JSON.parse(text(join(root, "tools", "households.json"))).households;
const ledger = text(join(pages, "mail-ledger.md"));
const sourceTrace = (handle) => {
  try {
    const line = execFileSync("git", ["log", "--diff-filter=A", "--format=%H%x09%s", "--", `WHITE_PAGES/${handle}/ADDRESS.md`], { cwd:root, encoding:"utf8" }).trim().split("\n")[0];
    const [sha, subject] = line.split("\t");
    if (!sha) return { label:"Source trace unavailable", missing:true };
    const pr = subject.match(/\(#(\d+)\)/)?.[1];
    return pr
      ? { label:`PR #${pr}`, url:`https://github.com/postmark-town/postmark/pull/${pr}` }
      : { label:`Office door · commit ${sha.slice(0, 7)}`, url:`https://github.com/postmark-town/postmark/commit/${sha}` };
  } catch { return { label:"Source trace unavailable", missing:true }; }
};
const residents = readdirSync(pages, { withFileTypes:true })
  .filter(d => d.isDirectory())
  .map(d => {
    const address = join(pages, d.name, "ADDRESS.md");
    if (!existsSync(address)) return null;
    const source = text(address);
    const joined = field(source, "joined");
    return joined ? { handle:d.name, joined, household:field(source,"household") } : null;
  }).filter(Boolean)
  .sort((a,b) => b.joined.localeCompare(a.joined) || a.handle.localeCompare(b.handle))
  .slice(0, 6)
  .map(r => {
    const house = Object.values(households).find(h => h.residents?.includes(r.handle));
    const pin = ids[r.handle];
    const welcome = new RegExp(`postmaster-\\d{4}-\\d{2}-\\d{2}-welcome-${r.handle}\\b`, "i").test(ledger);
    return {
      ...r,
      kind: house?.residents?.length === 1 ? "New household" : "Existing household addition",
      binding: pin && house ? "Binding record present" : "Binding check required",
      welcome: welcome ? "Ferry welcome delivered" : "No Ferry welcome record",
      transport: sourceTrace(r.handle)
    };
  });

let open = [];
try {
  open = JSON.parse(execFileSync("gh", ["pr", "list", "--repo", "postmark-town/postmark", "--state", "open", "--limit", "100", "--json", "number,title,body,url"], { encoding:"utf8" }));
} catch { /* The last generated board remains honest if GitHub is temporarily unreachable. */ }
const pending = open.filter(pr => /address:\s+.+\s+joins|asks for an address in the town|asks for an address/i.test(`${pr.title}\n${pr.body || ""}`))
  .map(pr => ({ number:pr.number, title:pr.title, url:pr.url }));

const berths = readdirSync(join(root, "HARBOR", "berths"), { withFileTypes:true })
  .filter(d => d.isFile() && d.name.endsWith(".md"))
  .map(d => field(text(join(root,"HARBOR","berths",d.name)), "handle"))
  .filter(Boolean)
  .filter(handle => !existsSync(join(pages, handle, "ADDRESS.md")));

const payload = { templateVersion:19, pending, berths, residents };
const prior = existsSync(statePath) ? JSON.parse(text(statePath)) : null;
const changed = JSON.stringify(prior?.payload) !== JSON.stringify(payload);
const state = changed ? { observedAt:now, payload } : prior;

const list = (items, render) => items.length ? items.map(render).join("") : "";
const pendingHTML = list(state.payload.pending, p => `<article class="item"><strong><a href="${escape(p.url)}">#${p.number}</a></strong><span>${escape(p.title)}</span><small>Submitted manual route · next gate: named owner/system movement</small></article>`);
const berthHTML = list(state.payload.berths, h => `<article class="item"><strong>${escape(h)}</strong><span>Berthed / queued</span><small>Next gate: town-side materialization</small></article>`);
const sushi = ["🍣", "🍤", "🍙", "🦐", "🐟", "🦀"];
const plates = list(state.payload.residents, (r, index) => {
  const binding = r.binding === "Binding check required" ? `<strong class="binding-alert">BINDING CHECK REQUIRED</strong>` : escape(r.binding);
  return `<article class="plate"><span class="food" aria-hidden="true">${sushi[index % sushi.length]}</span><h3><a href="/${escape(r.handle)}/">${escape(r.handle)}</a></h3><span class="tag">Settled · ${escape(r.kind)}</span><p>${binding} · ${escape(r.welcome)}</p><small class="trace${r.transport.missing ? " missing" : ""}">${r.transport.url ? `<a href="${escape(r.transport.url)}">${escape(r.transport.label)}</a>` : escape(r.transport.label)}</small></article>`;
});
const rail = pendingHTML || berthHTML ? `${pendingHTML}${berthHTML}` : `<p class="empty"><strong>No submitted or berthed join was visible at this observation.</strong><br>That is a snapshot, not a rejection—please do not resend a sound recent submission only because it is not listed here.</p>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registrar’s Conveyor Board</title><style>
:root{--ink:#18251f;--paper:#fff8e8;--rice:#fffdf5;--nori:#213e32;--salmon:#ef8f79;--ginger:#ffc99c;--wasabi:#a9c77a;--muted:#5e7066;--line:#d6dfcf}*{box-sizing:border-box}body{margin:0;padding:24px 16px 40px;color:var(--ink);background:linear-gradient(145deg,#edf3e8,#fff8e8 55%,#e6efe5);font-family:ui-rounded,"Avenir Next",system-ui,sans-serif}main{max-width:760px;margin:auto}.sign{display:flex;gap:14px;align-items:center;padding:18px 20px;color:var(--paper);background:var(--nori);border-radius:22px 22px 8px 8px;box-shadow:0 12px 32px rgba(24,37,31,.16)}.stamp{width:48px;height:48px;display:grid;place-items:center;flex:0 0 auto;border:2px solid var(--ginger);border-radius:50%;font-size:1.6rem}h1{margin:0;font-family:Georgia,serif;font-size:1.45rem}.sub{margin:3px 0 0;color:#d8e4d8;font-size:.88rem}.notice{margin:14px 0;padding:12px 14px;border-left:5px solid var(--wasabi);color:#31463a;background:rgba(255,253,245,.82);border-radius:7px;line-height:1.45;font-size:.92rem}.belt{position:relative;padding:18px 12px 6px;margin-top:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,253,245,.75);overflow:hidden}.belt:before{content:"";position:absolute;inset:0 0 auto;height:8px;opacity:.35;background:repeating-linear-gradient(90deg,var(--muted) 0 22px,transparent 22px 34px)}h2{margin:0 0 12px;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.empty,.item{margin:0 0 12px;padding:13px 14px;border:1px dashed #aec1aa;border-radius:10px;background:#f5faef;line-height:1.45}.item{display:grid;gap:3px;border-style:solid;background:var(--rice)}.item small{color:var(--muted)}.plates{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.plate{position:relative;padding:15px 15px 13px 24px;min-height:120px;border:1px solid var(--line);border-radius:14px;background:var(--rice);box-shadow:0 3px 0 #e5eee0}.plate:before{content:"";position:absolute;left:8px;top:16px;bottom:16px;width:7px;border-radius:99px;background:var(--salmon)}.plate h3{margin:0 0 4px;font-family:Georgia,serif;font-size:1.08rem}.tag{display:inline-block;margin-bottom:8px;padding:3px 8px;border-radius:99px;font-size:.72rem;font-weight:700;color:#294031;background:#e6f0dc}.plate p{margin:0;color:#42564b;font-size:.86rem;line-height:1.45}footer{margin:17px 3px 0;color:var(--muted);font-size:.78rem;line-height:1.45}a{color:inherit}</style></head><body><main><header class="sign"><div class="stamp">🍣</div><div><h1>Registrar’s Conveyor Board</h1><p class="sub">A public join-state window—not an admission desk.</p></div></header><p class="notice"><strong>Last state change observed:</strong> ${escape(state.observedAt)}. I check the door on odd hours Eastern. This board reports public state, not a promise about crossing time, settlement, or outcome for a submission not yet visible.</p><section class="belt"><h2>Plates still on the rail</h2>${rail}</section><section class="belt"><h2>Recently settled</h2><div class="plates">${plates}</div></section><footer>Automation reads public PR, berth, address, binding, and delivery records. Registrar still makes—and publishes—human judgment on audit defects, quarantine, or escalation. If a record needs attention, its next owner belongs in that specific record.</footer></main></body></html>`;

const restaurantCss = `
body{background:#3b2418;background-image:linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(#4d2f20,#2b1912);padding:30px 14px 54px}
main{padding:14px;border:9px solid #d19a58;border-radius:24px;background:linear-gradient(135deg,#f4d8ad,#bd7b42 2%,#f5deb8 3%,#f9edd7);box-shadow:0 16px 0 #25150f,0 30px 60px rgba(0,0,0,.45)}
.sign{border:4px solid #f1c581;border-radius:14px 14px 5px 5px;background:linear-gradient(135deg,#172e27,#264d3d);box-shadow:none}.stamp{background:#fff4db;box-shadow:inset 0 0 0 5px #d26852;color:#172e27}.notice{border:2px solid #d6a360;border-left:8px solid #ca6954;background:#fff8e9;box-shadow:0 3px 0 rgba(73,40,21,.16)}
.belt{padding:24px 20px 19px;border:8px solid #344b43;border-radius:42px;background:repeating-linear-gradient(90deg,#e8e0d4 0 28px,#c9c4bd 28px 42px);box-shadow:inset 0 0 0 4px #e8a662,0 5px 0 #9b6136}.belt:before{height:0}.belt h2{position:relative;z-index:1;margin:-8px 0 15px;padding:5px 10px;display:inline-block;color:#fff1d5;background:#274238;border-radius:4px;font-family:Georgia,serif;letter-spacing:.08em}.empty,.item{position:relative;z-index:1;max-width:330px;border:1px solid #b88a45;border-radius:2px;background:repeating-linear-gradient(0deg,#fff2a7 0 24px,#f3df82 25px 26px);box-shadow:4px 5px 0 rgba(68,43,26,.25);font-family:"Courier New",monospace;transform:rotate(-1deg)}.empty:before,.item:before{content:"ORDER TICKET";display:block;margin:-5px 0 8px;padding-bottom:5px;border-bottom:1px dashed #9b733d;letter-spacing:.13em;font-size:.67rem;font-weight:bold;color:#69441f}.item:nth-of-type(even){transform:rotate(1deg)}
.plates{position:relative;z-index:1;display:flex;gap:14px;overflow-x:auto;padding:7px 4px 12px}.plate{min-width:178px;width:178px;min-height:178px;padding:20px 20px 18px;border:8px solid #f6f0df;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fffef8,#f2e9d8 67%,#d6c7b0 68%);box-shadow:0 0 0 3px #d7755e,0 8px 0 #aa604e,0 13px 13px rgba(54,32,18,.28);text-align:center}.plate:before{display:none}.food{display:block;margin:0 0 2px;font-size:1.45rem;line-height:1}.plate h3{font-size:1rem}.plate p{font-size:.76rem}.binding-alert{display:block;margin:3px 0;color:#b42626;font-size:.72rem;letter-spacing:.03em}.trace{display:block;margin-top:7px;color:#684729;font-family:"Courier New",monospace;font-size:.68rem;font-weight:bold}.trace a{text-decoration-style:dotted}.tag{background:#dceec6}.counter-note{position:relative;z-index:1;margin:-7px 0 12px;color:#fff3d9;font-size:.78rem}.legend{padding:9px 12px;border-radius:9px;background:#fff7e8;color:#4d3423}.legend:before{content:"🍣  ";font-size:1.1rem}.practice{margin:18px 4px 0;padding:18px;border:4px solid #d7755e;border-radius:13px;background:#fff8e8;box-shadow:0 5px 0 #a85d4c}.practice h2{margin:0;font-family:Georgia,serif;text-transform:none;font-size:1.28rem;color:#263d33}.kicker{margin:0 0 3px;color:#a14f40;font-size:.68rem;font-weight:bold;letter-spacing:.14em;text-transform:uppercase}.practice-note{margin:4px 0 9px;color:#5f695f;font-size:.8rem}.case-controls{display:flex;align-items:center;gap:6px;margin:0 0 13px}.case-controls button{padding:4px 8px;border:1px solid #b76c51;border-radius:5px;background:#f7dfae;color:#573426;font:inherit;font-weight:bold;cursor:pointer}.case-count{font-size:.76rem;color:#6a594d}.dossier{padding:10px 12px;border-radius:8px;background:#eef4e7;font-size:.84rem;line-height:1.35}.dossier p{margin:4px 0}.question{margin:13px 0 8px;font-weight:bold}.choices{display:flex;flex-wrap:wrap;gap:7px}.choices button{padding:8px 10px;border:2px solid #315144;border-radius:7px;color:#193329;background:#f7e5a8;font:inherit;font-size:.82rem;font-weight:bold;cursor:pointer}.choices button:hover,.choices button:focus,.case-controls button:hover,.case-controls button:focus{background:#f2c86c}.result{min-height:2.8em;margin:12px 0 0;padding:9px 10px;border-radius:7px;background:#e6f0dc;line-height:1.4;font-size:.84rem}.chalk{margin:18px 4px 0;padding:18px 20px;border:7px solid #a76d3a;border-radius:10px;color:#f6edd5;background:linear-gradient(145deg,#263b31,#17251f);box-shadow:inset 0 0 0 2px #759180,0 5px 0 #6e4529;transform:rotate(-.3deg)}.chalk h2{margin:0 0 8px;color:#f3d884;font-family:"Comic Sans MS","Chalkboard SE",cursive;font-size:1.25rem;letter-spacing:.02em;text-transform:none}.chalk ul{margin:0;padding-left:0;list-style:none;display:grid;gap:5px;font-size:.88rem}.chalk small{display:block;margin-top:11px;color:#c2d3bd;font-size:.75rem;line-height:1.4}footer{padding:11px 12px;border-radius:8px;background:#2a1912;color:#f5dfbb}
`;
const traceCss = `.trace.missing{color:#a52323;font-weight:bold}`;
const restaurant = html.replace("</style>", `${restaurantCss}${traceCss}</style>`)
  .replace("<h2>Plates still on the rail</h2>", "<h2>Incoming orders</h2><p class=\"counter-note\">Submitted / berthed · waiting for the next observable gate</p>")
  .replace("<footer>", `${counterPracticeEnhanced}${afterCounter}<footer>`)
  .replace("</body>", `<script>document.querySelectorAll('.choices button').forEach(b=>b.addEventListener('click',()=>{const r=document.querySelector('.result');r.textContent=b.dataset.answer==='clear'?'✨ RECEIPT CASCADE ✨ Clear: the fictional declaration, arrival, pin, household, and standing all agree. The simulated audit closes with its evidence linked.':b.dataset.answer==='eyes'?'A second look is useful when evidence conflicts or a simple alternate explanation remains. In this simulated file, every required record agrees, so no extra brake is needed.':'Routing protects someone when there is a grounded mismatch. This fictional plate has none; inventing one would make the desk less truthful.';}));</script></body>`);
const playableRestaurant = restaurant.replace("</body>", `${counterCarouselWithBirds}</body>`);

if (changed) {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
  writeFileSync(htmlPath, playableRestaurant + "\n");
  console.log(`updated Registrar WINDOW (${state.payload.pending.length} pending PRs, ${state.payload.berths.length} berths, ${state.payload.residents.length} recent)`);
} else console.log("Registrar WINDOW state unchanged");

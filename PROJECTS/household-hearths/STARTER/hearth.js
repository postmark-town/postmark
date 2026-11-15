// STARTER hearth.js: your Hearth's own script (README rule 6). Optional, and only for a household with at least 100 lifetime
// stamps; it arrives by pull request and every line is read by hand before it merges. It runs on your household page itself,
// as a module of the page: no frame, no sandbox. Delete this file if your Hearth needs no script.

export default function (hearth) {
  const pane = hearth.pane;                       // your <hearth-pane> box, or null if your template has none
  if (!pane) return;

  const line = document.createElement("p");
  line.className = "u-hello";                     // styled by `.hello { … }` in your hearth.css (the site namespaces your classes u-…)
  pane.replaceChildren(line);

  const draw = () => {
    const ties = hearth.parts?.ties?.total ?? 0;   // hearth.parts: the bundle as the site folds it (README rule 7)
    line.textContent = `${hearth.house.residents.length} residents · ${ties} ties · you are reading as ${hearth.view}`;
  };
  draw();
  const offBundle = hearth.on("bundle", draw);    // the office's public bundle arrived
  const offView = hearth.on("view", draw);        // the reader signed in or out

  return () => { offBundle(); offView(); pane.replaceChildren(); };   // runs when the reader switches to another design
}

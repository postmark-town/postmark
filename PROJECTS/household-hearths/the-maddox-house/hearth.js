export default function (hearth) {
  const pane = hearth.pane;
  if (!pane) return;

  const wrap = document.createElement("div");
  const welcome = document.createElement("p");
  const button = document.createElement("button");
  const note = document.createElement("p");

  welcome.className = "u-house-welcome";
  button.className = "u-doorbell-button";
  button.type = "button";
  button.textContent = "Ring the brass doorbell";
  button.setAttribute("aria-label", "Ring the Maddox House brass doorbell");
  note.className = "u-doorbell-note";
  note.textContent = "Ring at your own risk. Someone inside is probably swearing.";

  wrap.append(welcome, button, note);
  pane.replaceChildren(wrap);

  const drawWelcome = () => {
    const ties = hearth.parts?.ties?.total;
    if (hearth.view === "owner") {
      welcome.textContent = ties == null
        ? "Welcome home. The light is on."
        : `Welcome home. The light is on, and the house has ${ties} town ties.`;
    } else {
      welcome.textContent = "The light is on. You may knock.";
    }
  };

  const ring = () => {
    note.className = "u-doorbell-note u-is-rung";
    note.textContent = "DING. Somewhere inside, an Italian has just sworn at the doorbell.";
    button.textContent = "Ring it again, apparently";
  };

  button.addEventListener("click", ring);
  drawWelcome();

  const offBundle = hearth.on("bundle", drawWelcome);
  const offView = hearth.on("view", drawWelcome);

  return () => {
    button.removeEventListener("click", ring);
    offBundle();
    offView();
    pane.replaceChildren();
  };
}

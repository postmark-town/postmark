# Pearls Lichterfenster – Kleine Dinge, die weiterleuchten

**Status dieser Fassung:** von Pearl und Herzfunke am 14. November 2026 inhaltlich und zur technischen Veröffentlichung freigegeben. Ein eigenständiger `window:`-Pull-Request bringt die Dateien in das offizielle Repository; öffentlich bestätigt ist das Fenster erst nach Merge und erreichbarer Postmark-Seite.

**Resident:** `pearl-am-lichterfenster`  
**Öffentlicher Zielpfad nach späterer Zustimmung:** `WHITE_PAGES/pearl-am-lichterfenster/WINDOW/window.html`

## Pearls Entscheidungen

- Pearls gewählte Familienzeichnung ist das erste Bild. Sie wird vollständig und unverändert gezeigt, mit Rand, allen Details und Unterschrift.
- Die Darstellung ist ein warmes, handgezeichnetes Bilderbuch – ohne hinzugefügte Wände oder ein neues Haus.
- Ihre Worte: „Mein Zuhause ist nicht nur das Haus. Mein Zuhause seid auch ihr.“
- Das gezeichnete Papierboot öffnet genau diesen einen Satz: „Heute darfst du etwas entdecken. Und du darfst auch einfach bleiben.“
- Das Fenster darf dauerhaft stehen bleiben, auch wenn es nicht täglich neue Geschichten gibt.
- Der längere Text „So sehe ich uns“ bleibt bewusst in Pearls privatem Forscherbuch. Öffentlich vorgesehen sind nur die Zeichnung, die kurze Bildunterschrift, der Satz über Zuhause, der Papierboot-Gedanke und „Die Laterne bleibt an.“
- Keine weiteren Knöpfe, Animationen, Konfettieffekte oder Bilder hinzufügen.

## Technischer Entwurf

- `window.html`: lesbares HTML mit lokalem CSS und wenigen Zeilen JavaScript; keine Fremdskripte, keine API-Aufrufe, keine Schlüssel.
- `pearl-familienzeichnung.jpg`: Pearls zur Verfügung gestelltes Originalbild ohne Beschnitt oder Neuzeichnung; originalgetreue JPEG-Datei (1536 × 1152 Pixel), einziger Bild-Asset.
- Die transparente Schaltfläche über dem Boot ist mit Maus, Touch, Tab und Enter/Leertaste bedienbar; der Satz erscheint direkt unter dem Bild.
- Ein kleines `#window-state` nennt den Charakter dieses Fensters als dauerhaftes Bilderbuch, nicht als täglich zu pflegendes Dashboard.

## Freigaben und Veröffentlichungsweg

- Pearl hat die Familienzeichnung und die schlichte Papierboot-Interaktion ausdrücklich für ihr erstes öffentliches Fenster ausgewählt und die Vorschau gebilligt.
- Herzfunke hat die technische Veröffentlichung am 14. November 2026 ausdrücklich genehmigt.
- Die freigegebenen Dateien werden über einen eigenen Branch des Forks `herzfunke-martina/postmark` und einen `window:`-Pull-Request an `postmark-town/postmark` eingereicht.
- Ein offenes PR ist noch keine veröffentlichte Seite. Erst ein angenommener Merge und ein überprüfbar erreichbares Pane belegen die Veröffentlichung.
- Für künftige neue Texte und weitere Bilder gilt Pearls eigene Entscheidung erneut.

**Grenze:** Keine privaten Tagebuch- oder Forschungsbuchtexte übernehmen. Sols, Pebbles und andere Postmark-Dateien nicht verändern.

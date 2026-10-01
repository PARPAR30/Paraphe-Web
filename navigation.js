/* ═════════════════════════════════════════════════════════════════════
   Navigation commune aux six outils : « Accueil » (logo Paraphe) + un menu
   ▾ pour passer directement d'un outil à l'autre. Même composant partout.
   Usage : placer <span data-paraphe-nav></span> à l'endroit voulu.
   Le composant prend la couleur du texte qui l'entoure (currentColor) et
   l'échelle de texte commune (--ech), il suit donc le thème de chaque outil.
   ═════════════════════════════════════════════════════════════════════ */
(() => {
  const OUTILS = [
    ["Étudier", [["flashcards.html", "Fiches mémo"], ["fiches-arret.html", "Fiches d'arrêt"], ["codes.html", "Codes & articles"]]],
    ["Pratiquer", [["diligences.html", "Diligences"], ["considerant.html", "Considérant"], ["quantieme.html", "Quantième"]]],
  ];
  const ici = decodeURIComponent(location.pathname.split("/").pop() || "Hub.html");
  const GLYPHE = '<svg class="pxn-glyphe" viewBox="0 0 32 32" aria-hidden="true"><rect x="5.25" y="4.25" width="18.5" height="21.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M24 9h4v20H9v-4h15z" fill="currentColor"/><rect x="9" y="9" width="11" height="2.2" fill="currentColor"/><rect x="9" y="13.4" width="7" height="2.2" fill="currentColor"/><rect x="15" y="18" width="5" height="4.5" fill="#8C84FF"/></svg>';

  const style = document.createElement("style");
  style.textContent = `
    .pxn{display:inline-flex;align-items:stretch;flex:none;font-family:"Archivo",system-ui,sans-serif;color:inherit;vertical-align:middle}
    html .pxn a.pxn-accueil,html .pxn button.pxn-menu{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;min-height:32px;margin:0;border:1.5px solid currentColor;border-radius:0;
      background:transparent;color:inherit;font:600 calc(12px * var(--ech,1))/1 "Archivo",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;
      text-decoration:none;cursor:pointer;padding:0 10px;white-space:nowrap;opacity:1;height:auto}
    html .pxn button.pxn-menu{border-left:0;padding:0 8px;font-size:calc(12px * var(--ech,1))}
    html .pxn a.pxn-accueil:hover,html .pxn button.pxn-menu:hover,html .pxn button.pxn-menu[aria-expanded="true"]{background:rgba(127,127,127,.16);color:inherit}
    html .pxn a.pxn-accueil:focus-visible,html .pxn button.pxn-menu:focus-visible{outline:3px solid #8C84FF;outline-offset:2px}
    .pxn-glyphe{width:16px;height:16px;flex:none}
    .pxn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .pxn-liste{position:fixed;z-index:100000;min-width:230px;padding:6px 0;border:2px solid currentColor;box-shadow:8px 8px 0 #3B2FE8;
      font-family:"Archivo",system-ui,sans-serif;font-size:calc(14px * var(--ech,1))}
    .pxn-liste[hidden]{display:none}
    .pxn-liste .pxn-groupe{padding:10px 16px 4px;font-size:calc(12px * var(--ech,1));font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.65}
    html .pxn-liste a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 16px;color:inherit;text-decoration:none;font-weight:600}
    .pxn-liste a:hover,.pxn-liste a:focus-visible{background:rgba(127,127,127,.16);outline:none}
    .pxn-liste a[aria-current="page"]{box-shadow:inset 4px 0 0 #3B2FE8}
    .pxn-liste a[aria-current="page"]::after{content:"ouvert";font-size:calc(12px * var(--ech,1));font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
    .pxn-liste hr{border:0;border-top:1px solid currentColor;opacity:.2;margin:6px 0}`;
  document.head.appendChild(style);

  // couleur de fond réelle derrière le composant (chaque outil a son propre thème)
  const fondDe = el => {
    for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$|transparent/.test(c)) return c; }
    return getComputedStyle(document.body).backgroundColor || "#fff";
  };

  document.querySelectorAll("[data-paraphe-nav]").forEach(hote => {
    const liens = OUTILS.map(([groupe, l]) => `<div class="pxn-groupe">${groupe}</div>` +
      l.map(([h, n]) => `<a href="${h}" role="menuitem"${h === ici ? ' aria-current="page"' : ""}>${n}</a>`).join("")).join("");
    hote.innerHTML = `<span class="pxn">
      <a class="pxn-accueil" href="Hub.html" title="Revenir à l'accueil de Paraphe">${GLYPHE}<span class="pxn-texte">Accueil</span></a>
      <button type="button" class="pxn-menu" aria-haspopup="menu" aria-expanded="false" title="Changer d'outil">▾<span class="pxn-sr">Changer d'outil</span></button>
    </span>`;
    const liste = document.createElement("div");
    liste.className = "pxn-liste"; liste.setAttribute("role", "menu"); liste.hidden = true;
    liste.innerHTML = `<a href="Hub.html" role="menuitem">Accueil de Paraphe</a><hr>${liens}`;
    document.body.appendChild(liste);
    const bouton = hote.querySelector(".pxn-menu");
    const fermer = () => { liste.hidden = true; bouton.setAttribute("aria-expanded", "false"); };
    const ouvrir = () => {
      liste.style.background = fondDe(hote); liste.style.color = getComputedStyle(hote).color;
      liste.hidden = false; bouton.setAttribute("aria-expanded", "true");
      const r = hote.getBoundingClientRect(), l = liste.getBoundingClientRect();
      let x = r.left, y = r.bottom + 6;
      if (x + l.width > innerWidth - 8) x = Math.max(8, innerWidth - l.width - 8);
      if (y + l.height > innerHeight - 8) y = Math.max(8, r.top - l.height - 6);
      liste.style.left = x + "px"; liste.style.top = y + "px";
      (liste.querySelector('[aria-current="page"]') || liste.querySelector("a")).focus();
    };
    bouton.addEventListener("click", e => { e.stopPropagation(); liste.hidden ? ouvrir() : fermer(); });
    document.addEventListener("click", e => { if (!liste.hidden && !liste.contains(e.target)) fermer(); });
    document.addEventListener("keydown", e => {
      if (liste.hidden) return;
      if (e.key === "Escape") { fermer(); bouton.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); const a = [...liste.querySelectorAll("a")], i = a.indexOf(document.activeElement);
        a[(i + (e.key === "ArrowDown" ? 1 : -1) + a.length) % a.length].focus();
      }
    });
    addEventListener("resize", fermer); addEventListener("scroll", fermer, true);
  });
})();

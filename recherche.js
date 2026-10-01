/* ═════════════════════════════════════════════════════════════════════
   Recherche globale (Ctrl/Cmd + K) — fouille les données locales des 6 outils
   et renvoie vers la fiche exacte (liens profonds propres à chaque outil).
   S'installe dans l'élément #recherche-globale de la page.
   ═════════════════════════════════════════════════════════════════════ */
(() => {
  const zone = document.getElementById("recherche-globale");
  if (!zone) return;

  const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  zone.innerHTML =
    '<label class="rg-champ"><span class="rg-loupe" aria-hidden="true">⌕</span>' +
    '<input type="search" id="rg-q" autocomplete="off" spellcheck="false" ' +
    'placeholder="Rechercher partout : un arrêt, un article, un litige, une notion…" ' +
    'aria-label="Rechercher dans les 6 outils" aria-controls="rg-res" aria-expanded="false">' +
    '<kbd>' + (MAC ? "⌘" : "Ctrl") + " K</kbd></label>" +
    '<div class="rg-res" id="rg-res" role="listbox" hidden></div>';

  const champ = zone.querySelector("#rg-q");
  const boite = zone.querySelector("#rg-res");
  const plat = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const echapper = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lire = cle => { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } };

  // ── Index : une entrée {outil, titre, detail, texte, lien} par élément ──
  let index = [], verrouilles = [];
  function indexer() {
    const items = [];
    const ajouter = (outil, titre, detail, morceaux, lien) =>
      items.push({ outil, titre: titre || "Sans titre", detail: detail || "", lien,
                   titrePlat: plat(titre), texte: plat(morceaux.filter(Boolean).join(" ")) });

    (lire("droit_flashcards") || []).forEach(c =>
      ajouter("Fiches mémo", c.recto, c.matiere, [c.recto, c.verso, c.matiere],
              "flashcards.html?q=" + encodeURIComponent(String(c.recto || "").slice(0, 60))));

    (lire("droit_fiches_arret") || []).forEach(f =>
      ajouter("Fiches d'arrêt", f.titre, [f.juridiction, f.date && f.date.slice(0, 4), f.matiere].filter(Boolean).join(" · "),
              [f.titre, f.juridiction, f.matiere, f.faits, f.procedure, f.probleme, f.solution, f.attendu, f.portee, (f.tags || []).join(" ")],
              "fiches-arret.html#" + encodeURIComponent(f.id)));

    (lire("droit_codes") || []).forEach(a =>
      ajouter("Codes & articles", "Art. " + a.numero + " " + (a.code || ""), a.matiere,
              [a.code, "art " + a.numero, "article " + a.numero, a.texte, a.note, a.matiere],
              "codes.html#art-" + encodeURIComponent(a.id)));

    const considerant = lire("attendu-cubes-v1");
    ((considerant && considerant.fiches) || []).forEach((f, i) => (function parcourir(n) {
      if (!n) return;
      ajouter("Considérant", n.t, n === f.racine ? "Fiche" : "Dans « " + (f.racine.t || "Sans titre") + " »", [n.t],
              "considerant.html#fiche=" + i + "&cube=" + encodeURIComponent(n.id));
      (n.enfants || []).forEach(parcourir);
    })(f.racine));

    verrouilles = [];
    const profils = lire("sj-profiles") || [];
    profils.forEach(p => {
      const db = lire("sjp-" + p.id + "-data");
      if (!db) return;
      if (db.enc) { verrouilles.push(p.name); return; }           // profil chiffré par son PIN
      const suffixe = profils.length > 1 ? " · " + p.name : "";
      const lien = (type, ref) => "diligences.html#pf=" + encodeURIComponent(p.id) + "&" + type + "=" + encodeURIComponent(ref);
      (db.lit || []).forEach(l => ajouter("Diligences", l.ref + " — " + (l.obj || ""), "Litige · " + (l.adv || "") + suffixe,
        [l.ref, l.obj, l.adv, l.jur, l.rg, l.notes, l.avocat, (l.tags || []).join(" "), (l.events || []).map(e => e.desc).join(" ")], lien("lit", l.ref)));
      (db.ctr || []).forEach(c => ajouter("Diligences", c.ref + " — " + (c.titre || ""), "Contrat · " + (c.partie || "") + suffixe,
        [c.ref, c.titre, c.partie, c.soc, c.type, c.notes, (c.tags || []).join(" ")], lien("ctr", c.ref)));
      (db.soc || []).forEach(s => ajouter("Diligences", s.nom, "Société · " + [s.forme, s.siren].filter(Boolean).join(" · ") + suffixe,
        [s.nom, s.siren, s.forme, s.adresse], lien("soc", s.ref)));
      (db.cons || []).forEach(c => ajouter("Diligences", c.ref + " — " + (c.obj || ""), "Consultation · " + (c.dem || "") + suffixe,
        [c.ref, c.obj, c.dem, c.desc], lien("cons", c.ref)));
    });

    ((lire("quantieme_agenda") || {}).dossiers || []).forEach(d =>
      ajouter("Quantième", d.dossier || "Dossier sans référence", "Agenda mémorisé", [d.dossier, d.carnet], "quantieme.html"));

    index = items;
  }

  // ── Recherche : tous les mots doivent être présents ; le titre compte davantage ──
  function chercher(q) {
    const mots = plat(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    const phrase = mots.join(" ");
    return index
      .filter(it => mots.every(m => it.texte.includes(m) || it.titrePlat.includes(m)))
      .map(it => ({ it, score: (it.titrePlat.includes(phrase) ? 10 : 0) + mots.filter(m => it.titrePlat.includes(m)).length * 3 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map(x => x.it)
      // regroupés par outil (tri stable : l'outil du meilleur résultat en tête, puis par pertinence)
      .map((it, rang, tous) => ({ it, groupe: tous.findIndex(x => x.outil === it.outil), rang }))
      .sort((a, b) => a.groupe - b.groupe || a.rang - b.rang)
      .map(x => x.it);
  }

  function surligner(texte, q) {
    const mots = plat(q).split(/\s+/).filter(m => m.length > 1);
    const brut = String(texte), bas = plat(brut);
    if (bas.length !== brut.length) return echapper(brut);   // caractère dont la décomposition change la longueur
    const marques = new Array(brut.length).fill(false);
    mots.forEach(m => { let i = bas.indexOf(m); while (i >= 0) { for (let k = i; k < i + m.length; k++) marques[k] = true; i = bas.indexOf(m, i + m.length); } });
    let out = "", ouvert = false;
    for (let k = 0; k < brut.length; k++) {
      if (marques[k] && !ouvert) { out += "<mark>"; ouvert = true; }
      if (!marques[k] && ouvert) { out += "</mark>"; ouvert = false; }
      out += echapper(brut[k]);
    }
    return out + (ouvert ? "</mark>" : "");
  }

  let actif = -1;
  function afficher() {
    const q = champ.value.trim();
    if (!q) { fermer(); return; }
    const res = chercher(q);
    let html = "", outil = null;
    res.forEach((it, i) => {
      if (it.outil !== outil) { outil = it.outil; html += '<div class="rg-groupe">' + echapper(outil) + "</div>"; }
      html += '<a class="rg-l" role="option" href="' + it.lien + '" data-i="' + i + '">' +
              '<span class="rg-titre">' + surligner(it.titre, q) + "</span>" +
              (it.detail ? '<span class="rg-detail">' + echapper(it.detail) + "</span>" : "") + "</a>";
    });
    if (!res.length) html += '<div class="rg-vide">Rien trouvé dans vos données.</div>';
    html += '<div class="rg-groupe">Quantième</div><a class="rg-l" role="option" href="quantieme.html?q=' + encodeURIComponent(q) + '">' +
            '<span class="rg-titre">Chercher « ' + echapper(q) + " » dans les 125 procédures</span>" +
            '<span class="rg-detail">délais, fondements, pièces</span></a>';
    if (verrouilles.length)
      html += '<div class="rg-vide">Profil' + (verrouilles.length > 1 ? "s" : "") + " verrouillé" + (verrouilles.length > 1 ? "s" : "") +
              " par code PIN (" + echapper(verrouilles.join(", ")) + ") : ouvrez Diligences pour y chercher.</div>";
    boite.innerHTML = html;
    boite.hidden = false;
    champ.setAttribute("aria-expanded", "true");
    actif = -1;
  }
  function fermer() { boite.hidden = true; champ.setAttribute("aria-expanded", "false"); actif = -1; }
  function deplacer(sens) {
    const liens = [...boite.querySelectorAll(".rg-l")];
    if (!liens.length) return;
    actif = (actif + sens + liens.length) % liens.length;
    liens.forEach((l, i) => l.classList.toggle("actif", i === actif));
    liens[actif].scrollIntoView({ block: "nearest" });
  }

  champ.addEventListener("focus", () => { indexer(); if (champ.value.trim()) afficher(); });
  champ.addEventListener("input", afficher);
  champ.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); deplacer(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); deplacer(-1); }
    else if (ev.key === "Enter") {
      const liens = boite.querySelectorAll(".rg-l");
      const cible = liens[actif >= 0 ? actif : 0];
      if (cible) { ev.preventDefault(); location.href = cible.href; }
    } else if (ev.key === "Escape") { fermer(); champ.blur(); }
  });
  document.addEventListener("click", ev => { if (!zone.contains(ev.target)) fermer(); });
  document.addEventListener("keydown", ev => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); champ.focus(); champ.select(); }
  });
  window.addEventListener("storage", () => { if (document.activeElement === champ) { indexer(); afficher(); } });
})();

/* ═════════════════════════════════════════════════════════════════════
   Donne un nom aux champs de filtre et de saisie qui n'ont pas d'étiquette visible
   (listes « Tous les statuts », dates « Du / Au »…), pour les lecteurs d'écran et les
   infobulles. Le nom est déduit du texte voisin ou de la première option de la liste.
   Les champs déjà nommés ne sont jamais touchés.
   ═════════════════════════════════════════════════════════════════════ */
(() => {
  const SANS_NOM = "input:not([type=hidden]):not([type=file]):not([aria-label]):not([aria-labelledby]):not([title]), select:not([aria-label]):not([aria-labelledby]):not([title]), textarea:not([aria-label]):not([aria-labelledby]):not([title])";
  const net = t => (t || "").replace(/\s+/g, " ").trim();
  function nommer(c) {
    if (c.hidden || c.getAttribute("aria-hidden") === "true") return;   // champs relais d'un composant maison
    if (c.placeholder || (c.id && document.querySelector('label[for="' + CSS.escape(c.id) + '"]')) || c.closest("label")) return;
    let nom = "";
    const voisin = c.previousElementSibling;
    if (voisin && !voisin.matches("input,select,textarea,button") && net(voisin.textContent).length <= 40) nom = net(voisin.textContent);
    if (!nom && c.tagName === "SELECT" && c.options.length) nom = net(c.options[0].textContent);
    if (!nom && c.parentElement) {
      const t = net([...c.parentElement.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(" "));
      if (t && t.length <= 40) nom = t;
    }
    if (nom) c.setAttribute("aria-label", nom);
  }
  let attente = 0;
  const passer = () => { attente = 0; document.querySelectorAll(SANS_NOM).forEach(nommer); };
  const planifier = () => { if (!attente) attente = setTimeout(passer, 300); };
  const demarrer = () => { passer(); new MutationObserver(planifier).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) demarrer(); else document.addEventListener("DOMContentLoaded", demarrer);
})();

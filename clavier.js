/* ═════════════════════════════════════════════════════════════════════
   Raccourcis clavier affichés à la mode du Mac : « Ctrl+Z » devient « ⌘Z ».
   Les raccourcis eux-mêmes marchent déjà avec Ctrl comme avec ⌘ (ctrlKey || metaKey) ;
   seul le texte affiché est adapté, y compris les messages créés après coup.
   Sans effet sous Windows, Linux et ailleurs.
   ═════════════════════════════════════════════════════════════════════ */
(() => {
  if (!/Mac|iPhone|iPad/.test(navigator.platform || "")) return;
  const MOT = /\bCtrl\b/;
  const adapter = t => (MOT.test(t) && !/⌘/.test(t))
    ? t.replace(/Ctrl\s*\+?\s*(?:Maj|Shift)\s*\+?\s*/g, "⇧⌘").replace(/Ctrl\s*\+\s*/g, "⌘").replace(/\bCtrl\b/g, "⌘")
    : t;
  const texte = racine => {
    if (racine.nodeType === 3) { const v = adapter(racine.nodeValue); if (v !== racine.nodeValue) racine.nodeValue = v; return; }
    if (racine.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(racine.tagName)) return;
    if (racine.title && MOT.test(racine.title)) racine.title = adapter(racine.title);
    racine.childNodes.forEach(texte);
  };
  const demarrer = () => {
    texte(document.body);
    new MutationObserver(lots => lots.forEach(l => {
      if (l.type === "characterData") texte(l.target);
      else l.addedNodes.forEach(texte);
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) demarrer(); else document.addEventListener("DOMContentLoaded", demarrer);
})();

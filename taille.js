/* ═════════════════════════════════════════════════════════════════════
   Taille du texte, commune aux six outils (réglée depuis l'accueil).
   Chargé dans le <head> de chaque page, avant l'affichage :
   · --ech   : échelle de la charte (accueil, outils d'études, Considérant ;
               Quantième la multiplie par son propre réglage) ;
   · font-size de <html> : base des tailles en rem (Diligences).
   ═════════════════════════════════════════════════════════════════════ */
(() => {
  const TAILLES = [1, 1.12, 1.25];
  let f = 1;
  try { f = parseFloat(localStorage.getItem("paraphe_taille")) || 1; } catch (e) {}
  if (!TAILLES.includes(f)) f = 1;
  window.PARAPHE_TAILLE = f;
  const appliquer = v => {
    const r = document.documentElement;
    r.style.setProperty("--ech", v);
    r.style.fontSize = v === 1 ? "" : (16 * v) + "px";
  };
  appliquer(f);
  window.parapheTaille = v => {
    if (!TAILLES.includes(v)) return;
    window.PARAPHE_TAILLE = v;
    try { localStorage.setItem("paraphe_taille", String(v)); } catch (e) {}
    appliquer(v);
  };
})();

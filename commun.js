/* ═════════════════════════════════════════════════════════════════════
   Outils partagés par Fiches mémo, Fiches d'arrêt et Codes & articles
   (stockage, exemples préchargés, échappement, fichiers).
   ═════════════════════════════════════════════════════════════════════ */
const Commun = (() => {
  const ENTITES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  // Échappe un texte avant insertion dans du HTML
  const echapper = s => String(s ?? "").replace(/[&<>"']/g, c => ENTITES[c]);

  // Date AAAA-MM-JJ en heure locale (toISOString donnerait la date UTC : la veille entre 0 h et 2 h)
  const dateLocale = (d = new Date()) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  // « 1873-02-08 » → « 8 février 1873 »
  function dateLongue(iso, options = { day: "numeric", month: "long", year: "numeric" }) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    return new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString("fr-FR", options);
  }

  function lire(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; }
    catch { return defaut; }
  }
  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; }
    catch {
      alert("Enregistrement impossible (stockage du navigateur plein ou indisponible). Exportez vos données en JSON pour ne rien perdre.");
      return false;
    }
  }

  // Exemples préchargés : ceux que l'utilisateur a supprimés ne doivent pas revenir au chargement
  const exemplesSupprimes = cle => new Set(lire(cle, []));
  function oublierExemple(cle, id) {
    if (!String(id).startsWith("seed-")) return;
    const s = exemplesSupprimes(cle);
    s.add(id);
    try { localStorage.setItem(cle, JSON.stringify([...s])); } catch {}
  }
  function avecExemples(cleDonnees, exemples, cleSupprimes) {
    const existants = lire(cleDonnees, []);
    const ids = new Set(existants.map(x => x.id));
    const supprimes = exemplesSupprimes(cleSupprimes);
    return existants.concat(exemples.filter(x => !ids.has(x.id) && !supprimes.has(x.id)));
  }

  function telecharger(nom, texte, type = "application/json") {
    const url = URL.createObjectURL(new Blob([texte], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Ramène un élément à l'écran et le signale un instant (après « Modifier », « Enregistrer »…)
  function montrer(el, { bloc = "center", signaler = true } = {}) {
    if (!el) return;
    const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: bloc });
    if (!signaler) return;
    el.classList.remove("signale"); void el.offsetWidth; el.classList.add("signale");
    setTimeout(() => el.classList.remove("signale"), 2200);
  }

  // Texte JSON tolérant : accepte la réponse d'une IA telle quelle (bloc ```json, texte autour, BOM)
  function lireJSON(texte) {
    let t = String(texte || "").replace(/^﻿/, "").trim();
    const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (bloc) t = bloc[1].trim();
    if (!/^[\[{]/.test(t)) {
      const d = t.search(/[\[{]/), f = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
      if (d >= 0 && f > d) t = t.slice(d, f + 1);
    }
    try { return JSON.parse(t); }
    catch { throw new Error("Aucun JSON lisible : collez toute la réponse de l'IA, ou demandez-lui de rendre uniquement le JSON."); }
  }

  // Ajoute les éléments valides dont l'identifiant n'existe pas encore ; renvoie le nombre ajouté.
  // Accepte un tableau, ou un objet qui contient un tableau ({ "articles": [...] }).
  function ajouter(donnees, { liste, valide, defauts = () => ({}) }) {
    if (!Array.isArray(donnees) && donnees && typeof donnees === "object") {
      const tableaux = Object.values(donnees).filter(Array.isArray);
      if (tableaux.length === 1) donnees = tableaux[0];
    }
    if (!Array.isArray(donnees)) throw new Error("Ce contenu n'est pas une liste d'éléments pour cet outil.");
    const ids = new Set(liste().map(x => x.id));
    let ajoutes = 0;
    donnees.forEach(x => {
      if (!x || typeof x !== "object" || !valide(x) || (x.id && ids.has(x.id))) return;
      const el = Object.assign({}, defauts(), x);
      if (!el.id) el.id = crypto.randomUUID();
      liste().push(el); ids.add(el.id); ajoutes++;
    });
    if (!ajoutes && donnees.length) throw new Error("Aucun élément reconnu : ce contenu ne semble pas prévu pour cet outil.");
    return ajoutes;
  }

  // Import JSON depuis un fichier (liste() renvoie le tableau courant, il peut être réassigné entre deux imports)
  function importerJSON(input, options) {
    input.addEventListener("change", () => {
      const fichier = input.files[0];
      input.value = "";
      if (!fichier) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        try { options.apres(ajouter(lireJSON(lecteur.result), options)); }
        catch (err) { alert("Import impossible. " + err.message); }
      };
      lecteur.readAsText(fichier);
    });
  }

  function copier(texte) {
    if (navigator.clipboard && window.isSecureContext)
      return navigator.clipboard.writeText(texte).then(() => true, () => copierAncien(texte));
    return Promise.resolve(copierAncien(texte));
  }
  function copierAncien(texte) {
    const z = document.createElement("textarea");
    z.value = texte; z.setAttribute("readonly", ""); z.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(z); z.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    z.remove(); return ok;
  }

  // Bouton « Prompt IA » : copie une consigne qui fait convertir un document (PDF, Word, texte…)
  // au format d'import de l'outil, puis propose de coller directement la réponse de l'IA.
  function promptIA(bouton, { prompt, quoi, input, options }) {
    let fen;
    function construire() {
      fen = document.createElement("dialog");
      fen.className = "fenetre-ia";
      fen.setAttribute("aria-labelledby", "iaTitre");
      fen.innerHTML = `
        <h3 id="iaTitre">Importer ${echapper(quoi)} depuis un document</h3>
        <p class="ia-etat" aria-live="polite"></p>
        <ol class="ia-etapes">
          <li>Ouvrez ChatGPT, Claude, Le Chat (Mistral) ou Copilot et collez le prompt dans la conversation.</li>
          <li>Joignez votre document (PDF, Word, texte…) ou collez son contenu à la suite, puis envoyez.</li>
          <li>Collez ci-dessous la réponse de l'IA, ou importez le fichier <b>.json</b> qu'elle vous a donné.</li>
        </ol>
        <label for="iaReponse">Réponse de l'IA</label>
        <textarea id="iaReponse" rows="6" placeholder="Collez ici le JSON rendu par l'IA"></textarea>
        <p class="muted ia-note">Relisez le résultat après l'import : l'IA peut se tromper ou omettre un passage. Votre document est envoyé au service d'IA que vous choisissez, pas à Paraphe.</p>
        <div class="ia-actions">
          <button type="button" class="primary" data-ia="importer">Importer la réponse</button>
          <button type="button" data-ia="fichier">Choisir un fichier .json</button>
          <button type="button" data-ia="fermer">Fermer</button>
        </div>
        <details class="ia-voir"><summary>Voir le prompt</summary><textarea readonly rows="8"></textarea>
          <button type="button" data-ia="recopier">Copier à nouveau le prompt</button></details>`;
      document.body.appendChild(fen);
      fen.querySelector(".ia-voir textarea").value = prompt;
      const etat = fen.querySelector(".ia-etat"), zone = fen.querySelector("#iaReponse");
      fen.addEventListener("click", e => {
        const a = e.target.closest("[data-ia]"); if (!a) return;
        const quoiFaire = a.dataset.ia;
        if (quoiFaire === "fermer") fen.close();
        else if (quoiFaire === "fichier") { fen.close(); input.click(); }
        else if (quoiFaire === "recopier") copier(prompt).then(ok => { etat.textContent = ok ? "✓ Prompt copié à nouveau." : "Copie impossible : ouvrez « Voir le prompt » et copiez-le à la main."; });
        else if (quoiFaire === "importer") {
          if (!zone.value.trim()) { zone.focus(); return; }
          try {
            const n = options.importer ? options.importer(zone.value) : ajouter(lireJSON(zone.value), options);
            zone.value = ""; fen.close(); options.apres(n);
          } catch (err) {
            etat.textContent = err.message;
            etat.classList.add("erreur");
          }
        }
      });
    }
    bouton.addEventListener("click", () => {
      if (!fen) construire();
      const etat = fen.querySelector(".ia-etat");
      etat.classList.remove("erreur");
      copier(prompt).then(ok => {
        etat.textContent = ok ? "✓ Le prompt est copié : il ne reste qu'à le coller dans l'IA." : "Copie impossible : ouvrez « Voir le prompt » plus bas et copiez-le à la main.";
      });
      fen.showModal();
    });
  }

  // Fin commune des prompts : format de sortie et garde-fous
  const FIN_PROMPT = (fichier) => `

SORTIE
- Rends le résultat sous forme de fichier téléchargeable nommé « ${fichier} ». Si tu ne peux pas créer de fichier, affiche uniquement le JSON dans un seul bloc de code, sans texte avant ni après.
- JSON strictement valide : guillemets droits doubles, aucune virgule finale, aucun commentaire.
- N'invente rien : une information absente du document vaut "" (ou [] pour une liste). Ne complète jamais de mémoire un texte, une date, un numéro ou une référence.
- Si le document est long, traite-le en entier ; ne t'arrête pas aux premiers éléments.

Voici le document :`;

  return { echapper, dateLocale, dateLongue, lire, ecrire, oublierExemple, avecExemples, telecharger, montrer, lireJSON, ajouter, importerJSON, copier, promptIA, FIN_PROMPT };
})();

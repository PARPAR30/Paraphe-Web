/* ═════════════════════════════════════════════════════════════════════
   Service worker — la suite reste utilisable sans connexion (PWA).
   · pages, scripts, styles : réseau d'abord (les mises à jour arrivent dès
     qu'on est en ligne), copie en cache en secours hors ligne ;
   · polices et icônes : cache d'abord (elles ne changent pas).
   Changer VERSION force le renouvellement complet du cache.
   Le réseau est interrogé en « no-cache » : sans cela, le navigateur pouvait resservir
   un ancien commun.js avec une page récente, et la page plantait (boutons inertes).
   ═════════════════════════════════════════════════════════════════════ */
const VERSION = "paraphe-v16";

const COQUILLE = [
  "./", "Hub.html", "index.html", "flashcards.html", "fiches-arret.html", "codes.html",
  "diligences.html", "Suivijuridique.html", "considerant.html", "quantieme.html", "decouvrir-diligences.html", "confidentialite.html",
  "style.css", "theme.js", "taille.js", "donnees.js", "clavier.js", "etiquettes.js", "navigation.js", "commun.js", "jurisprudence.js", "migration.js", "pwa.js", "recherche.js", "manifest.json",
  "fonts/fonts.css",
  "fonts/Archivo-variable-latin.woff2", "fonts/Archivo-variable-latin-ext.woff2",
  "fonts/ZillaSlab-400-latin.woff2", "fonts/ZillaSlab-400-latin-ext.woff2",
  "fonts/ZillaSlab-500-latin.woff2", "fonts/ZillaSlab-500-latin-ext.woff2",
  "fonts/ZillaSlab-600-latin.woff2", "fonts/ZillaSlab-600-latin-ext.woff2",
  "fonts/ZillaSlab-700-latin.woff2", "fonts/ZillaSlab-700-latin-ext.woff2",
  "fonts/IBMPlexMono-400-latin.woff2", "fonts/IBMPlexMono-400-latin-ext.woff2",
  "fonts/IBMPlexMono-500-latin.woff2", "fonts/IBMPlexMono-500-latin-ext.woff2",
  "icons/favicon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(COQUILLE.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

const STATIQUE = /\.(woff2|png|svg|jpg)$/;   // les captures de la visite guidée se mettent en cache à la première lecture

self.addEventListener("fetch", ev => {
  const req = ev.request;
  const url = new URL(req.url);
  // seulement nos propres fichiers (les API d'IA, Légifrance… passent sans intervention)
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (STATIQUE.test(url.pathname)) {
    ev.respondWith(
      caches.match(req).then(r => r || fetch(req).then(rep => {
        const copie = rep.clone();
        caches.open(VERSION).then(c => c.put(req, copie));
        return rep;
      }))
    );
    return;
  }

  // toujours revalider auprès du serveur (réponse 304 légère si rien n'a changé)
  const frais = req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" });
  ev.respondWith(
    frais
      .then(rep => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(VERSION).then(c => c.put(url.pathname.endsWith("/") ? req : new Request(url.origin + url.pathname), copie));
        }
        return rep;
      })
      // hors ligne : la page en cache, sans tenir compte des paramètres (?q=…) ; à défaut, le Hub
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("Hub.html")))
  );
});

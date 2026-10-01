/* Enregistre le service worker (fonctionnement hors ligne) sur le site / la PWA.
   Inutile dans l'application de bureau Tauri, qui sert déjà ses fichiers en local. */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) &&
    !window.__TAURI_INTERNALS__ && !window.__TAURI__) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

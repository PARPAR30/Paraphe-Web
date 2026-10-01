/* Migration depuis l'ancien nom des données (une seule fois, sans perte).
   · clé « dernière sauvegarde » : mes_logiciels_derniere_sauvegarde → paraphe_derniere_sauvegarde ;
   · base IndexedDB des PDF de Diligences : mes-logiciels-pj → paraphe-pj (les pièces sont copiées,
     puis l'ancienne base est supprimée). parapheOuvrirPJ() renvoie la base à jour. */
(function () {
  try {
    var ancienne = 'mes_logiciels_derniere_sauvegarde', nouvelle = 'paraphe_derniere_sauvegarde';
    var v = localStorage.getItem(ancienne);
    if (v !== null) {
      if (localStorage.getItem(nouvelle) === null) localStorage.setItem(nouvelle, v);
      localStorage.removeItem(ancienne);
    }
  } catch (e) {}

  var NOUVELLE = 'paraphe-pj', ANCIENNE = 'mes-logiciels-pj', dbp = null;

  function ouvrirNouvelle() {
    return new Promise(function (ok, ko) {
      var rq = indexedDB.open(NOUVELLE, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('pieces'); };
      rq.onsuccess = function () { ok(rq.result); };
      rq.onerror = function () { ko(rq.error); };
    });
  }

  // Copie les pièces de l'ancienne base vers la nouvelle, puis supprime l'ancienne.
  function migrer(db) {
    return new Promise(function (fini) {
      var rq = indexedDB.open(ANCIENNE, 1), absente = false;
      // ouvrir une base qui n'existe pas la créerait : on annule, il n'y a rien à reprendre
      rq.onupgradeneeded = function () { absente = true; rq.transaction.abort(); };
      rq.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); fini(); };
      rq.onblocked = function () { fini(); };
      rq.onsuccess = function () {
        var vieux = rq.result;
        if (absente || !vieux.objectStoreNames.contains('pieces')) { vieux.close(); fini(); return; }
        var lecture = vieux.transaction('pieces').objectStore('pieces'), items = [];
        var cur = lecture.openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { items.push([c.key, c.value]); c.continue(); return; }
          var t = db.transaction('pieces', 'readwrite'), st = t.objectStore('pieces');
          items.forEach(function (it) {
            var r = st.add(it[1], it[0]);
            r.onerror = function (e) { e.preventDefault(); e.stopPropagation(); };   // déjà présente : on garde la nouvelle
          });
          t.oncomplete = function () { vieux.close(); indexedDB.deleteDatabase(ANCIENNE); fini(); };
          t.onerror = t.onabort = function () { vieux.close(); fini(); };          // échec : l'ancienne reste intacte
        };
        cur.onerror = function () { vieux.close(); fini(); };
      };
    });
  }

  window.parapheOuvrirPJ = function () {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, ko) {
      if (!window.indexedDB) { ko(new Error('IndexedDB indisponible')); return; }
      ouvrirNouvelle().then(function (db) { return migrer(db).then(function () { ok(db); }); }, ko);
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  };
})();

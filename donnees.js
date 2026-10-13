/* Données de Paraphe : stockage, copies de sécurité, mot de passe des copies, clés d'IA, mises à jour.
   À charger en TOUT PREMIER dans chaque page (avant taille.js et theme.js, qui lisent déjà le stockage).

   Dans l'application de bureau :
   · Stockage : `localStorage` est remplacé par un magasin tenu par l'application (un fichier par clé,
     dossier de l'application ; voir src-tauri/src/stockage.rs). Les pages n'ont rien à changer : mêmes
     appels, mais plus de plafond de quelques Mo. Au premier lancement, l'ancien contenu du stockage du
     moteur web y est versé (et reste intact là où il était).
   · Copies de sécurité automatiques : au plus une toutes les six heures d'utilisation (fichier du jour,
     7 jours gardés), pièces jointes PDF comprises ; une seconde copie part dans le dossier choisi par
     l'utilisateur, s'il en a choisi un. Elles peuvent être protégées par un mot de passe (Trousseau).
   · Clés d'IA : Trousseau macOS / Gestionnaire d'identifiants Windows (window.parapheCles).
   · Mise à jour : window.parapheMaj(), uniquement dans la version téléchargée sur le site.
   Partout (aussi dans le navigateur) : window.parapheCoffre, chiffrement des sauvegardes par mot de passe.

   Format des copies = celui de la sauvegarde de l'accueil (« paraphe-sauvegarde »). */
(function () {
  'use strict';

  // ══ Coffre : chiffrement d'une sauvegarde par mot de passe (PBKDF2 + AES-256-GCM, WebCrypto) ══
  var ITERATIONS = 600000, FORMAT_CHIFFRE = 'paraphe-sauvegarde-chiffree';
  function versB64(octets) {
    var s = '', pas = 0x8000;
    for (var i = 0; i < octets.length; i += pas) s += String.fromCharCode.apply(null, octets.subarray(i, i + pas));
    return btoa(s);
  }
  function depuisB64(texte) {
    var s = atob(texte), o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  }
  function cleDe(mdp, sel, iterations) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(mdp), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: iterations, hash: 'SHA-256' }, base,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  var Coffre = {
    estChiffre: function (o) { return !!o && o.format === FORMAT_CHIFFRE; },
    chiffrer: function (texte, mdp) {
      var sel = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      return cleDe(mdp, sel, ITERATIONS).then(function (cle) {
        return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cle, new TextEncoder().encode(texte));
      }).then(function (chiffre) {
        return { format: FORMAT_CHIFFRE, version: 1, date: new Date().toISOString(),
                 kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, sel: versB64(sel), iv: versB64(iv),
                 donnees: versB64(new Uint8Array(chiffre)) };
      });
    },
    // renvoie l'objet d'origine ; échoue si le mot de passe est faux
    dechiffrer: function (env, mdp) {
      return cleDe(mdp, depuisB64(env.sel), env.iterations || ITERATIONS).then(function (cle) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisB64(env.iv) }, cle, depuisB64(env.donnees));
      }).then(function (clair) { return JSON.parse(new TextDecoder().decode(clair)); },
              function () { throw new Error('Mot de passe incorrect.'); });
    }
  };
  window.parapheCoffre = Coffre;

  var T = window.__TAURI_INTERNALS__;
  if (!T || !T.invoke) return;   // site web : le navigateur garde lui-même ses données
  var invoke = T.invoke;

  // ══ Stockage ══
  var vrai = window.localStorage;     // celui du moteur web : sert à la reprise, puis n'est plus utilisé
  var BASE = /Windows/.test(navigator.userAgent) ? 'http://paraphe-data.localhost/' : 'paraphe-data://localhost/';
  var magasinNeuf = false, ls = vrai;

  function xhr(methode, chemin, corps) {
    var r = new XMLHttpRequest();
    r.open(methode, BASE + chemin, false);   // synchrone : la lecture doit rester immédiate, comme localStorage
    r.send(corps === undefined ? null : corps);
    if (r.status !== 200 && r.status !== 404) throw new Error('magasin ' + r.status);
    return r;
  }
  var enc = encodeURIComponent;

  (function installerMagasin() {
    try {
      var ping = JSON.parse(xhr('GET', 'ping').responseText);
      if (!ping.migre) {
        // premier lancement de cette version : l'ancien stockage est versé dans le magasin (il n'est pas effacé)
        var tout = {};
        for (var i = 0; i < vrai.length; i++) { var k = vrai.key(i); tout[k] = vrai.getItem(k); }
        xhr('POST', 'import', JSON.stringify(tout));
        magasinNeuf = true;
        try { vrai.removeItem('sj_ai_keys'); } catch (e) {}   // les clés d'IA ne doivent pas rester en clair dans l'ancien stockage
      }
      var cache = new Map(Object.entries(JSON.parse(xhr('GET', 'all').responseText)));   // valeur null : grosse, lue à la demande
      var api = {
        getItem: function (k) {
          k = String(k);
          if (!cache.has(k)) return null;
          if (cache.get(k) === null) {
            var r = xhr('GET', 'get?k=' + enc(k));
            if (r.status !== 200) { cache.delete(k); return null; }
            cache.set(k, r.responseText);
          }
          return cache.get(k);
        },
        setItem: function (k, v) {
          k = String(k); v = String(v);
          try { xhr('POST', 'set?k=' + enc(k), v); }
          catch (e) { throw new DOMException('Le stockage de l’application est indisponible.', 'QuotaExceededError'); }
          cache.set(k, v);
        },
        removeItem: function (k) { k = String(k); if (cache.has(k)) { xhr('POST', 'del?k=' + enc(k)); cache.delete(k); } },
        clear: function () { xhr('POST', 'clear'); cache.clear(); },
        key: function (i) { var c = Array.from(cache.keys()); return i >= 0 && i < c.length ? c[i] : null; }
      };
      var proxy = new Proxy({}, {
        get: function (t, p) {
          if (typeof p === 'symbol') return p === Symbol.toStringTag ? 'Storage' : undefined;
          if (Object.prototype.hasOwnProperty.call(api, p)) return api[p];
          if (p === 'length') return cache.size;
          return cache.has(p) ? api.getItem(p) : undefined;
        },
        set: function (t, p, v) { api.setItem(p, v); return true; },
        deleteProperty: function (t, p) { api.removeItem(p); return true; },
        has: function (t, p) { return Object.prototype.hasOwnProperty.call(api, p) || p === 'length' || cache.has(p); },
        ownKeys: function () { return Array.from(cache.keys()); },
        getOwnPropertyDescriptor: function (t, p) {
          return cache.has(p) ? { value: api.getItem(p), writable: true, enumerable: true, configurable: true } : undefined;
        }
      });
      Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, get: function () { return proxy; } });
      if (window.localStorage !== proxy) throw new Error('localStorage non remplaçable');
      ls = proxy;
      window.parapheStockage = { actif: true };
    } catch (e) {
      // le magasin ne répond pas : on garde le stockage du moteur web, comme avant
      console.warn('[Paraphe] magasin de données indisponible, stockage du moteur web conservé :', e);
    }
  })();

  var EXCLUES = { sj_ai_keys: 1, paraphe_derniere_sauvegarde: 1, paraphe_auto_derniere: 1, paraphe_maj_verifiee: 1 };
  // les magasins principaux : s'ils manquent tous, c'est que le stockage est vide
  var PRINCIPAUX = /^(droit_flashcards|droit_fiches_arret|droit_codes|attendu-cubes-v1|sj-profiles|quantieme_agenda)$|^sjp-/;
  var PERIODE_COPIE = 6 * 3600 * 1000;

  function cles() {
    var r = [];
    try { for (var i = 0; i < ls.length; i++) r.push(ls.key(i)); } catch (e) {}
    return r;
  }
  function aDesDonnees(liste) { return liste.some(function (k) { return PRINCIPAUX.test(k); }); }
  function instantane() {
    var d = {};
    cles().forEach(function (k) { if (!EXCLUES[k]) d[k] = ls.getItem(k); });
    return d;
  }
  function octets(objet) { return new TextEncoder().encode(JSON.stringify(objet)); }

  // ══ Secrets (Trousseau / Gestionnaire d'identifiants) ══
  function secretLire(compte) { return invoke('secret_lire', { compte: compte }); }
  function secretEcrire(compte, valeur) { return invoke('secret_ecrire', { compte: compte, valeur: valeur }); }

  // clés d'IA : un seul élément, un objet JSON { fournisseur: clé }
  window.parapheCles = {
    lire: function () { return secretLire('cles-ia').then(function (t) { return t ? JSON.parse(t) : {}; }); },
    ecrire: function (objet) { return secretEcrire('cles-ia', JSON.stringify(objet || {})); }
  };

  // mot de passe des copies : sert à chiffrer les copies automatiques sans rien demander
  var protection = {
    motDePasse: function () { return secretLire('mdp-copies').catch(function () { return null; }); },
    active: function () { return protection.motDePasse().then(function (m) { return !!m; }); },
    activer: function (mdp) {
      return secretEcrire('mdp-copies', mdp).then(function () { return secretLire('mdp-copies'); }).then(function (relu) {
        if (relu !== mdp) throw new Error('Le trousseau du système n’a pas retenu le mot de passe.');
      });
    },
    retirer: function () { return secretEcrire('mdp-copies', ''); }
  };
  // Si la protection est active, renvoie la sauvegarde chiffrée ; sinon telle quelle.
  Coffre.proteger = function (paquet) {
    return protection.motDePasse().then(function (m) { return m ? Coffre.chiffrer(JSON.stringify(paquet), m) : paquet; });
  };
  // Rend le contenu d'une sauvegarde, chiffrée ou non. `demander(erreur)` : fonction qui renvoie (promesse) le mot
  // de passe saisi, ou null si l'utilisateur renonce. Celui du trousseau est essayé d'abord.
  Coffre.ouvrir = function (objet, demander) {
    if (!Coffre.estChiffre(objet)) return Promise.resolve(objet);
    function saisir(erreur) {
      if (!demander) return Promise.resolve(null);
      return Promise.resolve(demander(erreur)).then(function (saisi) {
        if (!saisi) return null;
        return Coffre.dechiffrer(objet, saisi).catch(function (e) { return saisir(e.message); });
      });
    }
    return protection.motDePasse().then(function (m) {
      if (!m) return saisir();
      return Coffre.dechiffrer(objet, m).catch(function () { return saisir(); });
    });
  };

  // ══ Pièces jointes (IndexedDB « paraphe-pj ») ══
  function ouvrirPieces() {
    if (window.parapheOuvrirPJ) return window.parapheOuvrirPJ();
    return new Promise(function (ok, ko) {
      var rq = indexedDB.open('paraphe-pj', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('pieces'); };
      rq.onsuccess = function () { ok(rq.result); };
      rq.onerror = function () { ko(rq.error); };
    });
  }
  function lirePieces() {
    return ouvrirPieces().then(function (db) {
      return new Promise(function (ok, ko) {
        var out = {}, rq = db.transaction('pieces').objectStore('pieces').openCursor();
        rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else ok(out); };
        rq.onerror = function () { ko(rq.error); };
      });
    }).catch(function () { return {}; });
  }
  // n'écrit que les pièces absentes : une pièce déjà là n'est jamais écrasée
  function rendrePieces(pieces) {
    var ids = Object.keys(pieces || {});
    if (!ids.length) return Promise.resolve();
    return ouvrirPieces().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction('pieces', 'readwrite'), st = t.objectStore('pieces');
        ids.forEach(function (id) {
          var r = st.add(pieces[id], id);
          r.onerror = function (e) { e.preventDefault(); e.stopPropagation(); };
        });
        t.oncomplete = t.onerror = t.onabort = function () { ok(); };
      });
    }).catch(function () {});
  }

  // ══ Reprise : le magasin a été perdu (dossier supprimé, disque restauré…) ══
  // Seulement quand ce lancement est « neuf » (pas de marqueur) ET que l'ancien stockage du moteur web n'avait
  // rien non plus : on remet alors la dernière copie de sécurité.
  var pret = Promise.resolve();
  if (magasinNeuf && !aDesDonnees(cles())) {
    var drapeau = 'paraphe_reprise_faite';
    var dejaFait = false;
    try { dejaFait = !!sessionStorage.getItem(drapeau); } catch (e) {}
    if (!dejaFait) {
      pret = invoke('copies_lister').then(function (l) {
        if (!l || !l.length) return;
        return invoke('copie_lire', { nom: l[0].nom }).then(function (t) { return Coffre.ouvrir(JSON.parse(t), null); }).then(function (c) {
          if (!c || !c.localStorage || !aDesDonnees(Object.keys(c.localStorage))) return;
          return rendrePieces(c.pieces).then(function () {
            Object.keys(c.localStorage).forEach(function (k) { try { ls.setItem(k, c.localStorage[k]); } catch (e) {} });
            try { sessionStorage.setItem(drapeau, '1'); } catch (e) {}
            alert('Vos données ont été retrouvées.\n\nLe stockage de l’application était vide ; Paraphe a remis en place sa dernière copie de sécurité.');
            location.reload();
            return new Promise(function () {});
          });
        });
      }).catch(function () {});
    }
  }

  // ══ Copies de sécurité ══
  function jour() { return new Date().toLocaleDateString('sv-SE'); }
  function copierMaintenant() {
    return pret.then(function () {
      if (!aDesDonnees(cles())) return { ignoree: true };
      return lirePieces().then(function (pieces) {
        var date = new Date().toISOString();
        var paquet = { format: 'paraphe-sauvegarde', version: 1, date: date, localStorage: instantane(), pieces: pieces };
        return Coffre.proteger(paquet).then(function (contenu) {
          return invoke('copie_ecrire', octets(contenu), { headers: { 'x-nom': 'paraphe-auto-' + jour() + '.json' } });
        }).then(function (r) {
          try { ls.setItem('paraphe_auto_derniere', date); } catch (e) {}
          return r;
        });
      });
    });
  }
  function copieAuto() {
    var derniere = null;
    try { derniere = ls.getItem('paraphe_auto_derniere'); } catch (e) {}
    if (derniere && Date.now() - new Date(derniere) < PERIODE_COPIE) return;
    copierMaintenant().catch(function (e) { console.warn('[Paraphe] copie de sécurité :', e); });
  }
  setTimeout(copieAuto, 20000);
  setInterval(copieAuto, 30 * 60 * 1000);

  window.parapheDonnees = {
    copierMaintenant: copierMaintenant,
    copies: function () { return invoke('copies_lister'); },
    lireCopie: function (nom) { return invoke('copie_lire', { nom: nom }).then(function (t) { return JSON.parse(t); }); },
    dossier: function () { return invoke('dossier_externe'); },
    choisirDossier: function () { return invoke('dossier_externe_choisir'); },
    oublierDossier: function () { return invoke('dossier_externe_oublier'); },
    montrer: function () { return invoke('copies_montrer'); },
    derniere: function () { try { return ls.getItem('paraphe_auto_derniere'); } catch (e) { return null; } },
    protection: protection
  };

  // ══ Mises à jour (version du site seulement) ══
  function nouveautesTexte(r) {
    return r.nouveautes && r.nouveautes.length ? '\n\nNouveautés :\n• ' + r.nouveautes.join('\n• ') : '';
  }
  // Renvoie null si cette version n'a pas de recherche de mise à jour (App Store). Sinon l'objet du site :
  // { courante, derniere, nouvelle, date, nouveautes, lien }. Avec manuel=true, répond aussi par une boîte de dialogue.
  window.parapheMaj = function (manuel) {
    return invoke('maj_active').then(function (active) {
      if (!active) return null;
      return invoke('maj_verifier').then(function (r) {
        try { ls.setItem('paraphe_maj_verifiee', jour()); } catch (e) {}
        if (manuel) {
          if (r.nouvelle) {
            if (confirm('Paraphe ' + r.derniere + ' est disponible (vous avez la ' + r.courante + ').' + nouveautesTexte(r) + '\n\nOuvrir la page de téléchargement ?'))
              invoke('ouvrir_lien', { url: r.lien }).catch(function () {});
          } else {
            alert('Paraphe est à jour.\n\nVous avez la version ' + r.courante + ', la plus récente.');
          }
        }
        return r;
      }, function (e) {
        if (manuel) alert('La recherche de mise à jour a échoué.\n\nVérifiez votre connexion à Internet, puis réessayez.');
        throw e;
      });
    });
  };
})();

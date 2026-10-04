// Panier (liste de courses) : modèle, persistance localStorage, rendu, réorganisation, texte et export CSV.
import { element, creerVignette, borner, de, pluriel, QUANTITE_MAX } from './dom.js';

const CLE_STOCKAGE = 'liste-du-fossoyeur:panier';
export const NOM_ATELIER_MAX = 60;

// ---------- Modèle ----------
// La liste est un tableau ordonné d'entrées :
//   { type: 'objet', cle, id, quantite }
//   { type: 'atelier', cle, nom, replie }
// Un objet appartient à l'atelier qui le précède ; ceux placés avant le premier atelier sont « sans atelier ».
// Un même objet peut figurer dans plusieurs ateliers, mais une seule fois par atelier.
// `cle` identifie l'entrée elle-même (focus, glisser-déposer), `id` l'objet du jeu.

export function nouvelleCle() {
  return Math.random().toString(36).slice(2, 10);
}

export function nomAtelier(nom) {
  return String(nom).trim().replace(/\s+/g, ' ').slice(0, NOM_ATELIER_MAX);
}

export function nouvelAtelier(nom) {
  return { type: 'atelier', cle: nouvelleCle(), nom: nomAtelier(nom) || 'Atelier', replie: false };
}

// Valide des entrées brutes (stockage, lien de partage) : ignore les id inconnus et les quantités invalides,
// plafonne à QUANTITE_MAX et fusionne les doublons d'un même atelier.
export function nettoyerListe(entrees, objetsParId) {
  const liste = [];
  const cles = new Set();
  const cleUnique = (cle) => {
    let c = typeof cle === 'string' && cle && !cles.has(cle) ? cle : nouvelleCle();
    while (cles.has(c)) c = nouvelleCle();
    cles.add(c);
    return c;
  };
  for (const e of Array.isArray(entrees) ? entrees : []) {
    if (e?.type === 'atelier' && typeof e.nom === 'string') {
      liste.push({ type: 'atelier', cle: cleUnique(e.cle), nom: nomAtelier(e.nom) || 'Atelier', replie: e.replie === true });
    } else if (e?.type === 'objet' && objetsParId.has(e.id) && Number.isInteger(e.quantite) && e.quantite > 0) {
      liste.push({ type: 'objet', cle: cleUnique(e.cle), id: e.id, quantite: Math.min(e.quantite, QUANTITE_MAX) });
    }
  }
  fusionnerDoublons(liste);
  return liste;
}

// Deux lignes du même objet dans le même atelier : la première absorbe la seconde.
function fusionnerDoublons(liste) {
  let vus = new Map();
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (e.type === 'atelier') {
      vus = new Map();
      continue;
    }
    const existante = vus.get(e.id);
    if (!existante) {
      vus.set(e.id, e);
      continue;
    }
    existante.quantite = Math.min(existante.quantite + e.quantite, QUANTITE_MAX);
    liste.splice(i--, 1);
  }
}

// Indice du premier atelier après `debut` (ou fin de liste) : borne de la section qui commence en `debut`.
// finSection(liste, -1) est la fin de la section « sans atelier ».
export function finSection(liste, debut) {
  for (let i = debut + 1; i < liste.length; i++) if (liste[i].type === 'atelier') return i;
  return liste.length;
}

// Indice de l'atelier qui contient l'entrée `index` (lui-même s'il s'agit d'un atelier), -1 si sans atelier.
export function debutSection(liste, index) {
  for (let i = index; i >= 0; i--) if (liste[i].type === 'atelier') return i;
  return -1;
}

export function indiceAtelier(liste, cle) {
  return cle ? liste.findIndex((e) => e.type === 'atelier' && e.cle === cle) : -1;
}

export function ateliers(liste) {
  return liste.filter((e) => e.type === 'atelier');
}

// Quantité totale par objet, tous ateliers confondus (badges de la grille, résumé).
export function quantites(liste) {
  const totaux = new Map();
  for (const e of liste) if (e.type === 'objet') totaux.set(e.id, Math.min((totaux.get(e.id) ?? 0) + e.quantite, QUANTITE_MAX));
  return totaux;
}

// Ajout cumulatif dans l'atelier `cleAtelier` ('' = sans atelier) ; renvoie la nouvelle quantité de la ligne.
export function ajouterAuPanier(liste, id, quantite, cleAtelier = '') {
  const debut = indiceAtelier(liste, cleAtelier);
  const fin = finSection(liste, debut);
  if (debut >= 0) liste[debut].replie = false;
  const existante = liste.slice(debut + 1, fin).find((e) => e.id === id);
  if (existante) {
    existante.quantite = Math.min(existante.quantite + quantite, QUANTITE_MAX);
    return existante.quantite;
  }
  const ligne = { type: 'objet', cle: nouvelleCle(), id, quantite: Math.min(quantite, QUANTITE_MAX) };
  liste.splice(fin, 0, ligne);
  return ligne.quantite;
}

// Fixe la quantité d'une ligne ; 0 la retire. La ligne garde sa place.
export function definirQuantite(liste, cle, quantite) {
  const i = liste.findIndex((e) => e.cle === cle);
  if (i < 0) return;
  if (quantite <= 0) liste.splice(i, 1);
  else liste[i].quantite = Math.min(quantite, QUANTITE_MAX);
}

// Déplace l'entrée `de` (avec tout son contenu s'il s'agit d'un atelier) devant l'indice `vers`
// (liste.length = à la fin). Renvoie true si la liste a changé.
export function deplacer(liste, de, vers) {
  const entree = liste[de];
  if (!entree || vers < 0 || vers > liste.length) return false;
  const estAtelier = entree.type === 'atelier';
  const fin = estAtelier ? finSection(liste, de) : de + 1;
  if (vers >= de && vers <= fin) return false;
  if (estAtelier) {
    // Un atelier ne se pose que devant un autre atelier ou à la fin, et jamais devant les objets
    // sans atelier : il les absorberait.
    if (vers < liste.length && liste[vers].type !== 'atelier') return false;
    if (vers < finSection(liste, -1)) return false;
  }
  const bloc = liste.splice(de, fin - de);
  liste.splice(vers > de ? vers - bloc.length : vers, 0, ...bloc);
  if (!estAtelier) {
    // Objet posé dans un atelier replié : on le déplie pour qu'il reste visible.
    const atelier = debutSection(liste, liste.indexOf(entree));
    if (atelier >= 0) liste[atelier].replie = false;
    fusionnerDoublons(liste);
  }
  return true;
}

// Flèches ▲ / ▼ : un objet avance d'une entrée (et change d'atelier en franchissant un en-tête),
// un atelier échange sa place avec l'atelier voisin.
export function decaler(liste, index, sens) {
  const entree = liste[index];
  if (!entree) return false;
  if (entree.type === 'objet') return deplacer(liste, index, sens < 0 ? index - 1 : index + 2);
  if (sens < 0) {
    const precedent = debutSection(liste, index - 1);
    return precedent >= 0 && deplacer(liste, index, precedent);
  }
  const suivant = finSection(liste, index);
  return suivant < liste.length && deplacer(liste, index, finSection(liste, suivant));
}

// Fusionne une liste importée dans la liste locale : les ateliers de même nom sont réunis,
// les objets déjà présents dans l'atelier voient leur quantité cumulée.
export function fusionnerListe(liste, importee) {
  const cleNom = (nom) => nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let cible = '';
  for (const e of importee) {
    if (e.type === 'atelier') {
      let atelier = ateliers(liste).find((a) => cleNom(a.nom) === cleNom(e.nom));
      if (!atelier) {
        atelier = nouvelAtelier(e.nom);
        liste.push(atelier);
      }
      cible = atelier.cle;
    } else {
      ajouterAuPanier(liste, e.id, e.quantite, cible);
    }
  }
}

// Sections dans l'ordre d'affichage : « sans atelier » d'abord (éventuellement vide), puis chaque atelier.
// En tri par catégorie, les objets de chaque section sont classés par catégorie (puis ordre de la liste).
export function sections(liste, objetsParId, tri) {
  const resultat = [{ atelier: null, index: -1, lignes: [] }];
  liste.forEach((e, index) => {
    if (e.type === 'atelier') resultat.push({ atelier: e, index, lignes: [] });
    else resultat.at(-1).lignes.push({ cle: e.cle, objet: objetsParId.get(e.id), quantite: e.quantite, index });
  });
  if (tri === 'categorie') {
    for (const s of resultat) {
      s.lignes.sort((a, b) => a.objet.categorie.localeCompare(b.objet.categorie, 'fr') || a.index - b.index);
    }
  }
  return resultat;
}

// ---------- Persistance ----------

// Lit la liste sauvegardée ({ liste, cible }, ou l'ancien format { id: quantite }) ;
// repart d'une liste vide en cas d'erreur ou de données corrompues.
export function chargerPanier(objetsParId) {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? 'null');
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { liste: [], cible: '' };
    if (Array.isArray(brut.liste)) {
      const liste = nettoyerListe(brut.liste, objetsParId);
      return { liste, cible: indiceAtelier(liste, brut.cible) >= 0 ? brut.cible : '' };
    }
    const entrees = Object.entries(brut).map(([id, quantite]) => ({ type: 'objet', id, quantite }));
    return { liste: nettoyerListe(entrees, objetsParId), cible: '' };
  } catch {
    // Données corrompues ou stockage inaccessible : liste vide.
    return { liste: [], cible: '' };
  }
}

export function sauverPanier(liste, cible) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ liste, cible }));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la liste reste en mémoire pour la session.
  }
}

// ---------- Texte et CSV ----------

// « 5 × Argile », une ligne par objet ; les objets d'un atelier sont indentés sous son nom.
// Avec plusieurs sections non vides, un bloc « Total » récapitule les quantités à réunir.
export function texteListe(sectionsListe) {
  const nonVides = sectionsListe.filter((s) => s.lignes.length > 0);
  const blocs = nonVides.map((s) => {
    const lignes = s.lignes.map(({ objet, quantite }) => `${s.atelier ? '  ' : ''}${quantite} × ${objet.nom}`);
    return (s.atelier ? [`${s.atelier.nom} :`, ...lignes] : lignes).join('\n');
  });
  if (nonVides.length > 1) {
    const totaux = new Map();
    for (const { objet, quantite } of nonVides.flatMap((s) => s.lignes)) {
      totaux.set(objet, Math.min((totaux.get(objet) ?? 0) + quantite, QUANTITE_MAX));
    }
    blocs.push(['Total :', ...[...totaux].map(([objet, quantite]) => `  ${quantite} × ${objet.nom}`)].join('\n'));
  }
  return blocs.join('\n\n');
}

// Télécharge liste_du_fossoyeur.csv (nom;categorie;quantite;atelier), UTF-8 avec BOM pour Excel.
export function exporterCsv(sectionsListe) {
  const champ = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const contenu = [
    'nom;categorie;quantite;atelier',
    ...sectionsListe.flatMap((s) =>
      s.lignes.map(({ objet, quantite }) =>
        [champ(objet.nom), champ(objet.categorie), quantite, champ(s.atelier?.nom ?? '')].join(';'),
      ),
    ),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', contenu, '\r\n'], { type: 'text/csv;charset=utf-8' }));
  const lien = element('a', { href: url, download: 'liste_du_fossoyeur.csv' });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Rendu ----------

const bouton = (classe, action, libelle, texte, extra = {}) =>
  element('button', { class: classe, type: 'button', 'data-action': action, 'aria-label': libelle, title: libelle, textContent: texte, ...extra });

function creerPoignee(libelle) {
  return element('button', {
    class: 'poignee',
    type: 'button',
    'data-action': 'poignee',
    'aria-label': `${libelle} (glisser, ou flèches haut et bas du clavier)`,
    title: 'Glisser pour déplacer',
  });
}

function creerLigne({ cle, objet, quantite, index }, { manuel, organiser, dansAtelier }) {
  const controles = organiser
    ? element(
        'div',
        { class: 'ligne__organiser' },
        bouton('quantite__bouton', 'monter', `Monter ${objet.nom}`, '▲'),
        bouton('quantite__bouton', 'descendre', `Descendre ${objet.nom}`, '▼'),
        bouton('quantite__bouton ligne__supprimer', 'supprimer', `Retirer ${objet.nom} de la liste`, '✕'),
      )
    : element(
        'div',
        { class: 'quantite' },
        quantite > 1
          ? bouton('quantite__bouton', 'moins', `Diminuer la quantité ${de(objet.nom)} dans la liste`, '−')
          : bouton('quantite__bouton ligne__supprimer', 'moins', `Retirer ${objet.nom} de la liste`, '✕'),
        element('input', {
          class: 'champ quantite__champ',
          type: 'number',
          inputmode: 'numeric',
          min: 0,
          max: QUANTITE_MAX,
          step: 1,
          value: String(quantite),
          'aria-label': `Quantité ${de(objet.nom)} dans la liste`,
          'data-action': 'quantite',
        }),
        bouton('quantite__bouton', 'plus', `Augmenter la quantité ${de(objet.nom)} dans la liste`, '+'),
      );

  return element(
    'li',
    { class: `ligne${dansAtelier ? ' ligne--atelier' : ''}`, 'data-cle': cle, 'data-index': index },
    manuel && creerPoignee(`Déplacer ${objet.nom}`),
    creerVignette(objet, 'ligne__vignette'),
    element('p', { class: 'ligne__nom', textContent: objet.nom }),
    controles,
  );
}

function creerEnteteAtelier({ atelier, index, lignes }, { manuel, organiser }) {
  const nb = new Set(lignes.map((l) => l.objet.id)).size;
  return element(
    'li',
    { class: `atelier${atelier.replie ? ' atelier--replie' : ''}`, 'data-cle': atelier.cle, 'data-index': index },
    manuel && creerPoignee(`Déplacer l'atelier ${atelier.nom}`),
    element(
      'button',
      {
        class: 'atelier__basculer',
        type: 'button',
        'data-action': 'basculer',
        'aria-expanded': String(!atelier.replie),
        'aria-label': `Atelier ${atelier.nom}, ${pluriel(nb, 'objet')} : ${atelier.replie ? 'déplier' : 'replier'}`,
      },
      element('span', { class: 'atelier__chevron', 'aria-hidden': 'true', textContent: atelier.replie ? '▸' : '▾' }),
      element('span', { class: 'atelier__nom', textContent: atelier.nom }),
      element('span', { class: 'atelier__compte', textContent: nb.toLocaleString('fr-FR') }),
    ),
    organiser &&
      element(
        'div',
        { class: 'ligne__organiser' },
        bouton('quantite__bouton', 'monter', `Monter l'atelier ${atelier.nom}`, '▲'),
        bouton('quantite__bouton', 'descendre', `Descendre l'atelier ${atelier.nom}`, '▼'),
        bouton('quantite__bouton', 'renommer', `Renommer l'atelier ${atelier.nom}`, '✎'),
        bouton('quantite__bouton ligne__supprimer', 'supprimer-atelier', `Supprimer l'atelier ${atelier.nom}`, '✕'),
      ),
  );
}

// Reconstruit la liste (quelques dizaines de lignes au plus) en conservant le focus clavier.
export function rendrePanier(el, etat, sectionsListe) {
  const lignesFocusables = () => [...el.lignes.querySelectorAll('[data-cle]')];
  const actif = document.activeElement;
  const ligneActive = el.lignes.contains(actif) ? actif.closest('[data-cle]') : null;
  const focus = ligneActive
    ? { cle: ligneActive.dataset.cle, action: actif.dataset.action, rang: lignesFocusables().indexOf(ligneActive) }
    : null;

  const manuel = etat.tri !== 'categorie';
  const options = { manuel, organiser: manuel && etat.organiser };
  const avecAteliers = sectionsListe.length > 1;

  const fragment = document.createDocumentFragment();
  for (const section of sectionsListe) {
    if (section.atelier) fragment.append(creerEnteteAtelier(section, options));
    else if (avecAteliers && section.lignes.length > 0) {
      fragment.append(element('li', { class: 'panier__groupe', textContent: 'Sans atelier', 'aria-hidden': 'true' }));
    }
    if (section.atelier?.replie) continue;
    if (section.atelier && section.lignes.length === 0) {
      fragment.append(
        element('li', {
          class: 'atelier__vide',
          textContent: manuel ? 'Aucun objet : glisse des objets ici ou choisis cet atelier pour tes ajouts.' : 'Aucun objet',
        }),
      );
    }
    let categoriePrecedente = null;
    for (const ligne of section.lignes) {
      if (!manuel && ligne.objet.categorie !== categoriePrecedente) {
        categoriePrecedente = ligne.objet.categorie;
        fragment.append(
          element('li', {
            class: `panier__categorie${section.atelier ? ' panier__categorie--atelier' : ''}`,
            textContent: categoriePrecedente,
            'aria-hidden': 'true',
          }),
        );
      }
      fragment.append(creerLigne(ligne, { ...options, dansAtelier: Boolean(section.atelier) }));
    }
  }
  el.lignes.replaceChildren(fragment);

  const totaux = quantites(etat.liste);
  const total = [...totaux.values()].reduce((s, q) => s + q, 0);
  const sansObjet = totaux.size === 0;
  el.vide.hidden = etat.liste.length > 0;
  el.lignes.hidden = etat.liste.length === 0;
  el.resume.textContent = sansObjet ? 'Aucun objet' : `${pluriel(totaux.size, 'objet')} · ${pluriel(total, 'unité')}`;
  el.compteur.textContent = totaux.size.toLocaleString('fr-FR');
  for (const b of el.actionsAvecObjets) b.disabled = sansObjet;
  el.vider.disabled = etat.liste.length === 0;

  // Bouton « Organiser » : sans objet du tri par catégorie (ordre imposé).
  el.organiser.disabled = !manuel;
  el.organiser.setAttribute('aria-pressed', String(options.organiser));
  el.organiser.classList.toggle('bouton--actif', options.organiser);

  // Atelier qui reçoit les ajouts depuis la grille.
  const listeAteliers = ateliers(etat.liste);
  el.cibleZone.hidden = listeAteliers.length === 0;
  const signature = JSON.stringify(listeAteliers.map((a) => [a.cle, a.nom]));
  if (el.cible.dataset.signature !== signature) {
    el.cible.dataset.signature = signature;
    el.cible.replaceChildren(
      element('option', { value: '', textContent: 'Sans atelier' }),
      ...listeAteliers.map((a) => element('option', { value: a.cle, textContent: a.nom })),
    );
  }
  el.cible.value = etat.cible;
  const nomCible = listeAteliers.find((a) => a.cle === etat.cible)?.nom;
  el.cibleFlottant.hidden = !nomCible;
  el.cibleFlottant.textContent = nomCible ? `→ ${nomCible}` : '';
  el.ouvrir.setAttribute(
    'aria-label',
    `Ouvrir ma liste (${pluriel(totaux.size, 'objet')}${nomCible ? `, ajouts dans ${nomCible}` : ''})`,
  );

  // Remet le focus au même endroit ; si la ligne a disparu, sur la ligne de même rang ou le titre.
  if (focus) {
    const lignes = lignesFocusables();
    const cible =
      el.lignes.querySelector(`[data-cle="${CSS.escape(focus.cle)}"] [data-action="${focus.action}"]`) ??
      lignes[Math.min(focus.rang, lignes.length - 1)]?.querySelector('button') ??
      el.titre;
    cible.focus();
  }
}

// ---------- Glisser-déposer (pointeur : souris, doigt, stylet) ----------

function glisser(e, poignee, el, etat, surDeplacement) {
  const ligne = poignee.closest('[data-index]');
  const estAtelier = ligne.classList.contains('atelier');
  const de = Number(ligne.dataset.index);
  const conteneur = el.lignes;
  const departY = e.clientY;
  const departDefilement = conteneur.scrollTop;
  // Bornes figées au départ : la ligne translatée agrandit la zone défilable, ce qui ferait
  // descendre le défilement automatique sans fin. Position de la ligne dans le contenu, en px.
  const defilementMax = conteneur.scrollHeight - conteneur.clientHeight;
  const rectLigne = ligne.getBoundingClientRect();
  const hautLigne = rectLigne.top - conteneur.getBoundingClientRect().top + departDefilement;
  const decalageMin = -hautLigne;
  const decalageMax = conteneur.scrollHeight - hautLigne - rectLigne.height;
  const indicateur = element('li', { class: 'panier__indicateur', 'aria-hidden': 'true' });
  // Un atelier se pose entre deux ateliers ; un objet devant n'importe quelle ligne ou en-tête.
  const candidats = [...conteneur.querySelectorAll(estAtelier ? '.atelier' : '[data-index]')].filter((n) => n !== ligne);
  const fin = new AbortController();
  let y = e.clientY;
  let vers = null;
  let animation = 0;

  poignee.setPointerCapture(e.pointerId);
  ligne.classList.add('ligne--glissee');
  document.body.classList.add('glissement');

  function suivre() {
    // Défilement automatique près des bords de la liste.
    const zone = conteneur.getBoundingClientRect();
    const marge = 48;
    if (y < zone.top + marge) conteneur.scrollTop -= Math.min(20, Math.ceil((zone.top + marge - y) / 3));
    else if (y > zone.bottom - marge) {
      conteneur.scrollTop = Math.min(defilementMax, conteneur.scrollTop + Math.min(20, Math.ceil((y - zone.bottom + marge) / 3)));
    }

    const decalage = y - departY + conteneur.scrollTop - departDefilement;
    ligne.style.transform = `translateY(${Math.max(decalageMin, Math.min(decalageMax, decalage))}px)`;
    const suivant = candidats.find((n) => {
      const r = n.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    vers = suivant ? Number(suivant.dataset.index) : etat.liste.length;
    if (suivant) {
      if (indicateur.nextSibling !== suivant) suivant.before(indicateur);
    } else if (conteneur.lastChild !== indicateur) conteneur.append(indicateur);
    animation = requestAnimationFrame(suivre);
  }

  function terminer(valider) {
    fin.abort();
    cancelAnimationFrame(animation);
    indicateur.remove();
    ligne.classList.remove('ligne--glissee');
    ligne.style.transform = '';
    document.body.classList.remove('glissement');
    if (valider && vers !== null) surDeplacement(de, vers);
  }

  poignee.addEventListener('pointermove', (ev) => (y = ev.clientY), { signal: fin.signal });
  poignee.addEventListener('pointerup', () => terminer(true), { signal: fin.signal });
  poignee.addEventListener('pointercancel', () => terminer(false), { signal: fin.signal });
  poignee.addEventListener('lostpointercapture', () => terminer(false), { signal: fin.signal });
  animation = requestAnimationFrame(suivre);
}

// ---------- Événements ----------

// Délégation d'événements sur la liste. `actions` : { quantite(cle, q), decaler(index, sens),
// deplacer(de, vers), basculer(index), renommer(index), supprimerAtelier(index) }.
export function brancherPanier(el, etat, actions) {
  const indexDe = (n) => Number(n.closest('[data-index]').dataset.index);
  const quantiteDe = (cle) => etat.liste.find((e) => e.cle === cle)?.quantite ?? 0;

  el.lignes.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const cle = b.closest('[data-cle]').dataset.cle;
    switch (b.dataset.action) {
      case 'moins':
        return actions.quantite(cle, quantiteDe(cle) - 1);
      case 'plus':
        return actions.quantite(cle, quantiteDe(cle) + 1);
      case 'supprimer':
        return actions.quantite(cle, 0);
      case 'monter':
        return actions.decaler(indexDe(b), -1);
      case 'descendre':
        return actions.decaler(indexDe(b), 1);
      case 'basculer':
        return actions.basculer(indexDe(b));
      case 'renommer':
        return actions.renommer(indexDe(b));
      case 'supprimer-atelier':
        return actions.supprimerAtelier(indexDe(b));
    }
  });

  el.lignes.addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'quantite') return;
    const cle = e.target.closest('[data-cle]').dataset.cle;
    actions.quantite(cle, borner(e.target.value, 0, QUANTITE_MAX, quantiteDe(cle)));
  });

  el.lignes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.action === 'quantite') e.target.blur();
    // Poignée au clavier : flèches haut / bas.
    if (e.target.dataset.action === 'poignee' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      actions.decaler(indexDe(e.target), e.key === 'ArrowUp' ? -1 : 1);
    }
  });

  el.lignes.addEventListener('pointerdown', (e) => {
    const poignee = e.target.closest('.poignee');
    if (!poignee || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    poignee.focus({ preventScroll: true });
    glisser(e, poignee, el, etat, actions.deplacer);
  });
}

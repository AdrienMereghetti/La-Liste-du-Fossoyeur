// Initialisation, état global et rendu.
import { pluriel } from './dom.js';
import { normaliser, objetVisible, remplirCategories, brancherFiltres } from './filters.js';
import { creerGrille, brancherGrille, majGrille } from './grid.js';
import {
  chargerPanier,
  sauverPanier,
  ajouterAuPanier,
  definirQuantite,
  deplacer,
  decaler,
  fusionnerListe,
  nouvelAtelier,
  nomAtelier,
  finSection,
  debutSection,
  indiceAtelier,
  ateliers,
  quantites,
  sections,
  texteListe,
  exporterCsv,
  rendrePanier,
  brancherPanier,
} from './cart.js';
import { lienPartage, lireFragment, effacerFragment } from './share.js';
import { demander, demanderTexte, copierTexte } from './dialog.js';

const $ = (id) => document.getElementById(id);

const etat = {
  objets: [],
  recherche: '', // déjà normalisée
  categorie: '',
  liste: [], // entrées ordonnées : objets et ateliers (voir cart.js)
  cible: '', // clé de l'atelier qui reçoit les ajouts depuis la grille ('' = sans atelier)
  tri: 'ajout', // 'ajout' (ordre de la liste) ou 'categorie'
  organiser: false, // flèches ▲ ▼ et gestion des ateliers affichées
};

let objetsParId = new Map();
let cartes = new Map();

const el = {
  grille: $('grille'),
  chargement: $('chargement'),
  aucunResultat: $('aucun-resultat'),
  nbResultats: $('nb-resultats'),
  annonce: $('annonce'),
  voile: $('voile'),
  panier: {
    racine: $('panier'),
    titre: $('panier-titre'),
    fermer: $('panier-fermer'),
    resume: $('panier-resume'),
    tri: $('panier-tri'),
    organiser: $('panier-organiser'),
    nouvelAtelier: $('panier-nouvel-atelier'),
    cibleZone: $('panier-cible-zone'),
    cible: $('panier-cible'),
    vide: $('panier-vide'),
    lignes: $('panier-lignes'),
    ouvrir: $('panier-ouvrir'),
    compteur: $('panier-compteur'),
    cibleFlottant: $('panier-cible-flottant'),
    copier: $('action-copier'),
    plus: $('action-plus'),
    actionsPlus: $('actions-plus'),
    partagerTexte: $('action-partager-texte'),
    partagerLien: $('action-partager-lien'),
    exporter: $('action-exporter'),
    vider: $('action-vider'),
  },
};
el.panier.actionsAvecObjets = [el.panier.copier, el.panier.partagerTexte, el.panier.partagerLien, el.panier.exporter];

// ---------- Rendu ----------

const sectionsAffichees = () => sections(etat.liste, objetsParId, etat.tri);

function rendu() {
  const visibles = majGrille(cartes, etat.objets, quantites(etat.liste), (o) => objetVisible(o, etat));
  el.nbResultats.textContent = pluriel(visibles, 'objet');
  el.aucunResultat.hidden = visibles > 0;
  rendrePanier(el.panier, etat, sectionsAffichees());
}

function modifierPanier(modification) {
  modification();
  // L'atelier cible a pu disparaître (suppression, remplacement de la liste).
  if (indiceAtelier(etat.liste, etat.cible) < 0) etat.cible = '';
  sauverPanier(etat.liste, etat.cible);
  rendu();
}

// « Forge » ou « Sans atelier » : section de l'entrée d'indice `index`.
function nomSection(index) {
  const debut = debutSection(etat.liste, index);
  return debut >= 0 ? etat.liste[debut].nom : 'Sans atelier';
}

// Zone aria-live : on vide puis on réécrit pour que deux annonces identiques soient bien lues.
function annoncer(texte) {
  el.annonce.textContent = '';
  requestAnimationFrame(() => {
    el.annonce.textContent = texte;
  });
}

// Retour visuel bref sur un bouton (« Copié ! »).
function confirmerBouton(bouton, texte) {
  bouton.dataset.libelle ??= bouton.textContent;
  bouton.textContent = texte;
  clearTimeout(bouton.minuteur);
  bouton.minuteur = setTimeout(() => {
    bouton.textContent = bouton.dataset.libelle;
  }, 1500);
}

// ---------- Tiroir du panier (mobile) ----------

const ecranLarge = matchMedia('(min-width: 900px)');

function tiroirOuvert() {
  return el.panier.racine.classList.contains('panier--ouvert');
}

function ouvrirTiroir() {
  el.panier.racine.classList.add('panier--ouvert');
  el.voile.hidden = false;
  document.body.classList.add('tiroir-ouvert');
  el.panier.ouvrir.setAttribute('aria-expanded', 'true');
  el.panier.fermer.focus();
}

function fermerTiroir() {
  const focusDedans = el.panier.racine.contains(document.activeElement);
  el.panier.racine.classList.remove('panier--ouvert');
  el.voile.hidden = true;
  document.body.classList.remove('tiroir-ouvert');
  el.panier.ouvrir.setAttribute('aria-expanded', 'false');
  if (focusDedans && !ecranLarge.matches) el.panier.ouvrir.focus();
}

function brancherTiroir() {
  el.panier.ouvrir.addEventListener('click', ouvrirTiroir);
  el.panier.fermer.addEventListener('click', fermerTiroir);
  el.voile.addEventListener('click', fermerTiroir);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tiroirOuvert() && !$('dialogue').open) fermerTiroir();
  });
  // Passage en grand écran : le panneau redevient latéral, on retire l'état « tiroir ».
  ecranLarge.addEventListener('change', () => {
    if (ecranLarge.matches && tiroirOuvert()) fermerTiroir();
  });
}

// ---------- Actions du panier ----------

// Annonce la nouvelle place d'une entrée après un déplacement.
function annoncerPlace(entree) {
  const index = etat.liste.indexOf(entree);
  if (index < 0) return; // fusionnée avec une ligne identique de l'atelier d'arrivée
  if (entree.type === 'atelier') {
    const liste = ateliers(etat.liste);
    annoncer(`Atelier ${entree.nom} : ${liste.indexOf(entree) + 1} sur ${liste.length}`);
    return;
  }
  const debut = debutSection(etat.liste, index);
  const voisins = etat.liste.slice(debut + 1, finSection(etat.liste, debut));
  annoncer(`${objetsParId.get(entree.id).nom} : ${voisins.indexOf(entree) + 1} sur ${voisins.length} dans ${nomSection(index)}`);
}

const actionsListe = {
  quantite: (cle, quantite) => modifierPanier(() => definirQuantite(etat.liste, cle, quantite)),

  decaler(index, sens) {
    const entree = etat.liste[index];
    let change = false;
    modifierPanier(() => {
      change = decaler(etat.liste, index, sens);
    });
    if (change) annoncerPlace(entree);
  },

  deplacer(de, vers) {
    const entree = etat.liste[de];
    let change = false;
    modifierPanier(() => {
      change = deplacer(etat.liste, de, vers);
    });
    if (change) annoncerPlace(entree);
  },

  basculer(index) {
    const atelier = etat.liste[index];
    modifierPanier(() => {
      atelier.replie = !atelier.replie;
    });
  },

  async renommer(index) {
    const atelier = etat.liste[index];
    const nom = await demanderTexte({ titre: "Renommer l'atelier", valeur: atelier.nom, libelle: 'Renommer' });
    if (!nom || !etat.liste.includes(atelier)) return;
    modifierPanier(() => {
      atelier.nom = nomAtelier(nom);
    });
  },

  async supprimerAtelier(index) {
    const atelier = etat.liste[index];
    const nb = finSection(etat.liste, index) - index - 1;
    let choix = 'garder';
    if (nb > 0) {
      choix = await demander({
        titre: `Supprimer l'atelier « ${atelier.nom} » ?`,
        message: `Il contient ${pluriel(nb, 'objet')}. Tu peux les garder (ils passent « sans atelier ») ou les retirer de la liste.`,
        choix: [
          { libelle: 'Annuler' },
          { libelle: 'Supprimer aussi les objets', valeur: 'tout', danger: true },
          { libelle: 'Garder les objets', valeur: 'garder', principal: true },
        ],
      });
      if (!choix) return;
    }
    modifierPanier(() => {
      const debut = etat.liste.indexOf(atelier);
      if (debut < 0) return;
      const objets = etat.liste.splice(debut, finSection(etat.liste, debut) - debut).slice(1);
      if (choix === 'garder') for (const o of objets) ajouterAuPanier(etat.liste, o.id, o.quantite, '');
    });
    annoncer(`Atelier ${atelier.nom} supprimé`);
  },
};

async function creerAtelier() {
  const nom = await demanderTexte({
    titre: 'Nouvel atelier',
    message: 'Regroupe les objets nécessaires à une construction. Les prochains ajouts depuis la grille iront dedans.',
    placeholder: 'Ex. Forge, Établi de menuiserie…',
    libelle: 'Créer',
  });
  if (nom === null) return;
  const atelier = nouvelAtelier(nom || `Atelier ${ateliers(etat.liste).length + 1}`);
  modifierPanier(() => {
    etat.liste.push(atelier);
    etat.cible = atelier.cle;
  });
  annoncer(`Atelier ${atelier.nom} créé : les prochains ajouts iront dedans`);
}

function brancherActions() {
  el.panier.tri.addEventListener('change', () => {
    etat.tri = el.panier.tri.value;
    rendu();
  });

  el.panier.organiser.addEventListener('click', () => {
    etat.organiser = !etat.organiser;
    rendu();
  });

  el.panier.nouvelAtelier.addEventListener('click', creerAtelier);

  el.panier.cible.addEventListener('change', () => {
    modifierPanier(() => {
      etat.cible = el.panier.cible.value;
    });
  });

  // « ⋯ » : actions secondaires repliées pour laisser la place aux lignes.
  el.panier.plus.addEventListener('click', () => {
    const ouvrir = el.panier.actionsPlus.hidden;
    el.panier.actionsPlus.hidden = !ouvrir;
    el.panier.plus.setAttribute('aria-expanded', String(ouvrir));
  });

  el.panier.copier.addEventListener('click', async () => {
    const texte = texteListe(sectionsAffichees());
    if (await copierTexte(texte, 'Ma liste')) {
      confirmerBouton(el.panier.copier, 'Copié !');
      annoncer('Liste copiée dans le presse-papiers');
    }
  });

  // « Partager le texte » : feuille de partage native du smartphone, quand elle existe.
  if (navigator.share) {
    el.panier.partagerTexte.hidden = false;
    el.panier.partagerTexte.addEventListener('click', async () => {
      try {
        await navigator.share({ title: 'La Liste du Fossoyeur', text: texteListe(sectionsAffichees()) });
      } catch {
        // Partage annulé par l'utilisateur : rien à faire.
      }
    });
  }

  el.panier.partagerLien.addEventListener('click', async () => {
    const url = lienPartage(etat.liste);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'La Liste du Fossoyeur', url });
        return;
      } catch (erreur) {
        if (erreur.name === 'AbortError') return;
        // Autre échec (partage refusé, non pris en charge) : on se replie sur la copie du lien.
      }
    }
    if (await copierTexte(url, 'Lien de partage')) {
      confirmerBouton(el.panier.partagerLien, 'Lien copié !');
      annoncer('Lien de partage copié dans le presse-papiers');
    }
  });

  el.panier.exporter.addEventListener('click', () => exporterCsv(sectionsAffichees()));

  el.panier.vider.addEventListener('click', async () => {
    const choix = await demander({
      titre: 'Vider le panier ?',
      message: `${pluriel(quantites(etat.liste).size, 'objet sera retiré', 'objets seront retirés')} de ta liste${
        ateliers(etat.liste).length ? ', ainsi que les ateliers' : ''
      }.`,
      choix: [
        { libelle: 'Annuler' },
        { libelle: 'Vider le panier', valeur: 'vider', danger: true },
      ],
    });
    if (choix !== 'vider') return;
    modifierPanier(() => etat.liste.splice(0));
    annoncer('Panier vidé');
    el.panier.titre.focus();
  });
}

// ---------- Import depuis un lien de partage ----------

async function importerDepuisLien() {
  const liste = lireFragment(location.hash, objetsParId);
  if (liste === null) return;
  effacerFragment();

  const nbObjets = quantites(liste).size;
  if (nbObjets === 0) {
    await demander({
      titre: 'Lien de partage',
      message: 'Ce lien ne contient aucun objet reconnu.',
      choix: [{ libelle: 'OK', principal: true }],
    });
    return;
  }

  let mode = 'remplacer';
  if (etat.liste.length > 0) {
    const nbAteliers = ateliers(liste).length;
    mode = await demander({
      titre: 'Importer une liste',
      message:
        `Ce lien contient ${pluriel(nbObjets, 'objet')}${nbAteliers ? ` (${pluriel(nbAteliers, 'atelier')})` : ''}.\n` +
        `Ta liste actuelle en contient ${quantites(etat.liste).size.toLocaleString('fr-FR')}.`,
      choix: [
        { libelle: 'Annuler' },
        { libelle: 'Ajouter à ma liste', valeur: 'ajouter' },
        { libelle: 'Remplacer ma liste', valeur: 'remplacer', principal: true },
      ],
    });
    if (!mode) return;
  }

  modifierPanier(() => {
    if (mode === 'remplacer') {
      etat.liste = liste;
      etat.cible = '';
    } else fusionnerListe(etat.liste, liste);
  });
  annoncer(`Liste importée : ${pluriel(nbObjets, 'objet')}`);
  if (!ecranLarge.matches) ouvrirTiroir();
}

// ---------- Démarrage ----------

async function demarrer() {
  try {
    const reponse = await fetch('data/items.json');
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    etat.objets = (await reponse.json()).map((o) => ({ ...o, nomRecherche: normaliser(o.nom) }));
  } catch (erreur) {
    console.error(erreur);
    el.chargement.textContent =
      'Impossible de charger la liste des objets. Si la page est ouverte en file://, lance un serveur local (npx serve .).';
    return;
  }

  objetsParId = new Map(etat.objets.map((o) => [o.id, o]));
  ({ liste: etat.liste, cible: etat.cible } = chargerPanier(objetsParId));

  remplirCategories($('categorie'), etat.objets);
  cartes = creerGrille(el.grille, etat.objets);

  // Image introuvable : placeholder neutre (l'événement error ne remonte pas, d'où la capture).
  document.addEventListener(
    'error',
    (e) => {
      if (e.target instanceof HTMLImageElement) e.target.closest('.vignette')?.classList.add('vignette--sans-image');
    },
    true,
  );

  brancherFiltres(
    { champ: $('recherche'), vider: $('recherche-vider'), select: $('categorie'), reinitialiser: $('reinitialiser') },
    etat,
    rendu,
  );

  brancherGrille(el.grille, cartes, (id, quantite) => {
    let total;
    modifierPanier(() => {
      total = ajouterAuPanier(etat.liste, id, quantite, etat.cible);
    });
    const nom = objetsParId.get(id).nom;
    const dans = etat.cible ? ` dans ${nomSection(indiceAtelier(etat.liste, etat.cible))}` : '';
    annoncer(`${quantite} × ${nom} ajouté${dans}${total === quantite ? '' : ` (${total} au total)`}`);
    el.panier.ouvrir.classList.remove('bouton-flottant--pulse');
    void el.panier.ouvrir.offsetWidth; // relance l'animation
    el.panier.ouvrir.classList.add('bouton-flottant--pulse');
  });

  brancherPanier(el.panier, etat, actionsListe);
  brancherTiroir();
  brancherActions();

  el.chargement.hidden = true;
  rendu();

  await importerDepuisLien();
  window.addEventListener('hashchange', importerDepuisLien);
}

demarrer();

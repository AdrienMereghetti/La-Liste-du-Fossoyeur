// Recherche instantanée et filtre par catégorie.
import { element } from './dom.js';

const DELAI_RECHERCHE = 80; // ms

// Insensible à la casse et aux accents : « Bâton » → « baton ».
export function normaliser(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function objetVisible(objet, etat) {
  return (
    (!etat.categorie || objet.categorie === etat.categorie) &&
    (!etat.recherche || objet.nomRecherche.includes(etat.recherche))
  );
}

// Remplit la liste déroulante avec les catégories dérivées des données, triées (locale fr), avec leur effectif.
export function remplirCategories(select, objets) {
  const effectifs = new Map();
  for (const o of objets) effectifs.set(o.categorie, (effectifs.get(o.categorie) ?? 0) + 1);
  const categories = [...effectifs.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  for (const c of categories) {
    select.append(element('option', { value: c, textContent: `${c} (${effectifs.get(c)})` }));
  }
}

// Branche le champ de recherche, son bouton ✕, la liste des catégories et « Réinitialiser les filtres ».
export function brancherFiltres({ champ, vider, select, reinitialiser }, etat, surChangement) {
  let minuteur;

  const appliquerRecherche = () => {
    clearTimeout(minuteur);
    vider.hidden = champ.value === '';
    etat.recherche = normaliser(champ.value.trim());
    surChangement();
  };

  const viderRecherche = () => {
    champ.value = '';
    appliquerRecherche();
  };

  champ.addEventListener('input', () => {
    vider.hidden = champ.value === '';
    clearTimeout(minuteur);
    minuteur = setTimeout(appliquerRecherche, DELAI_RECHERCHE);
  });

  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && champ.value !== '') {
      e.preventDefault();
      e.stopPropagation();
      viderRecherche();
    } else if (e.key === 'Enter') {
      // Sur mobile, « Rechercher » sur le clavier virtuel le referme.
      champ.blur();
    }
  });

  vider.addEventListener('click', () => {
    viderRecherche();
    champ.focus();
  });

  select.addEventListener('change', () => {
    etat.categorie = select.value;
    surChangement();
  });

  reinitialiser.addEventListener('click', () => {
    champ.value = '';
    select.value = '';
    etat.categorie = '';
    appliquerRecherche();
    champ.focus();
  });
}

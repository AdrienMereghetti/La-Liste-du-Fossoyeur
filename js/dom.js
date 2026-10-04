// Petits utilitaires DOM partagés par la grille et le panier.

export const QUANTITE_MAX = 9999;

const PROPRIETES = new Set(['textContent', 'value', 'hidden', 'disabled']);

// Crée un élément : element('p', { class: 'x', textContent: 'y' }, enfant1, enfant2…)
// textContent, value, hidden et disabled sont affectés en propriétés, le reste en attributs.
// Les enfants null / false sont ignorés (enfants conditionnels).
export function element(balise, attributs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (PROPRIETES.has(nom)) el[nom] = valeur;
    else el.setAttribute(nom, valeur === true ? '' : String(valeur));
  }
  el.append(...enfants.filter((enfant) => enfant !== null && enfant !== false && enfant !== undefined));
  return el;
}

// Vignette carrée avec l'image pixel art ; le placeholder en cas d'erreur est géré dans app.js.
export function creerVignette(objet, classe = '') {
  const img = element('img', {
    src: objet.image,
    alt: objet.nom,
    loading: 'lazy',
    decoding: 'async',
    width: '64',
    height: '64',
  });
  const vignette = element('div', { class: `vignette ${classe}`.trim() }, img);
  if (!objet.image) vignette.classList.add('vignette--sans-image');
  return vignette;
}

// Ramène une saisie à un entier dans [min, max] ; renvoie `defaut` si la saisie n'est pas un nombre.
export function borner(valeur, min, max, defaut) {
  const n = Math.round(Number(valeur));
  if (valeur === '' || !Number.isFinite(n)) return defaut;
  return Math.min(max, Math.max(min, n));
}

// « de Bâton », « d'Argile » : pour les libellés accessibles.
export function de(nom) {
  return /^[aeiouyàâäéèêëîïôöûüù]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

// « 0 objet », « 1 objet », « 12 objets » (règle française : singulier jusqu'à 1).
export function pluriel(n, singulier, plurielForme = `${singulier}s`) {
  return `${n.toLocaleString('fr-FR')} ${n <= 1 ? singulier : plurielForme}`;
}

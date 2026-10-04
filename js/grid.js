// Grille d'objets : cartes créées une seule fois, puis affichées / masquées via l'attribut hidden.
import { element, creerVignette, borner, de, QUANTITE_MAX } from './dom.js';

function creerCarte(objet) {
  const badge = element('span', { class: 'badge', hidden: true });
  const vignette = creerVignette(objet);
  vignette.append(badge);

  const champ = element('input', {
    class: 'champ quantite__champ',
    type: 'number',
    inputmode: 'numeric',
    min: 1,
    max: QUANTITE_MAX,
    step: 1,
    value: '1',
    'aria-label': `Quantité ${de(objet.nom)}`,
    'data-role': 'quantite',
  });

  const carte = element(
    'li',
    { class: 'carte', 'data-id': objet.id },
    vignette,
    element('p', { class: 'carte__nom', textContent: objet.nom }),
    element('p', { class: 'carte__categorie', textContent: objet.categorie }),
    element(
      'div',
      { class: 'quantite' },
      element('button', {
        class: 'quantite__bouton',
        type: 'button',
        'data-action': 'moins',
        'aria-label': `Diminuer la quantité ${de(objet.nom)}`,
        textContent: '−',
      }),
      champ,
      element('button', {
        class: 'quantite__bouton',
        type: 'button',
        'data-action': 'plus',
        'aria-label': `Augmenter la quantité ${de(objet.nom)}`,
        textContent: '+',
      }),
    ),
    element('button', {
      class: 'bouton carte__ajouter',
      type: 'button',
      'data-action': 'ajouter',
      'aria-label': `Ajouter ${objet.nom} au panier`,
      textContent: 'Ajouter au panier',
    }),
  );

  return { carte, badge, champ };
}

// Crée toutes les cartes dans le conteneur et renvoie une Map id → { carte, badge, champ }.
export function creerGrille(conteneur, objets) {
  const cartes = new Map();
  const fragment = document.createDocumentFragment();
  for (const objet of objets) {
    const c = creerCarte(objet);
    cartes.set(objet.id, c);
    fragment.append(c.carte);
  }
  conteneur.append(fragment);
  return cartes;
}

// Délégation d'événements : un seul écouteur pour les boutons − / + / Ajouter de toutes les cartes.
export function brancherGrille(conteneur, cartes, surAjout) {
  const ajouter = (id) => {
    const { champ } = cartes.get(id);
    const quantite = borner(champ.value, 1, QUANTITE_MAX, 1);
    surAjout(id, quantite);
    champ.value = '1';
  };

  conteneur.addEventListener('click', (e) => {
    const bouton = e.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.closest('.carte').dataset.id;
    const { champ } = cartes.get(id);
    const actuelle = borner(champ.value, 1, QUANTITE_MAX, 1);
    if (bouton.dataset.action === 'moins') champ.value = String(Math.max(1, actuelle - 1));
    else if (bouton.dataset.action === 'plus') champ.value = String(Math.min(QUANTITE_MAX, actuelle + 1));
    else if (bouton.dataset.action === 'ajouter') ajouter(id);
  });

  // Saisie libre : on corrige à la validation du champ ; Entrée ajoute directement.
  conteneur.addEventListener('change', (e) => {
    if (e.target.dataset.role !== 'quantite') return;
    e.target.value = String(borner(e.target.value, 1, QUANTITE_MAX, 1));
  });

  conteneur.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.dataset.role !== 'quantite') return;
    e.preventDefault();
    ajouter(e.target.closest('.carte').dataset.id);
  });
}

// Applique le filtre (attribut hidden) et l'état « dans le panier » ; renvoie le nombre d'objets visibles.
export function majGrille(cartes, objets, panier, estVisible) {
  let visibles = 0;
  for (const objet of objets) {
    const { carte, badge } = cartes.get(objet.id);
    const visible = estVisible(objet);
    if (carte.hidden === visible) carte.hidden = !visible;
    if (visible) visibles++;

    const quantite = panier.get(objet.id) ?? 0;
    carte.classList.toggle('carte--dans-panier', quantite > 0);
    badge.hidden = quantite === 0;
    badge.textContent = quantite > 0 ? quantite.toLocaleString('fr-FR') : '';
    badge.title = quantite > 0 ? `${quantite} dans la liste` : '';
  }
  return visibles;
}

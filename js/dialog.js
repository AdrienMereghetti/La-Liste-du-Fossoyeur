// Boîte de dialogue unique (<dialog>) pour les confirmations, et copie dans le presse-papiers avec repli.
import { element } from './dom.js';

const dialogue = document.getElementById('dialogue');
const titre = document.getElementById('dialogue-titre');
const message = document.getElementById('dialogue-message');
const zoneTexte = document.getElementById('dialogue-texte');
const zoneSaisie = document.getElementById('dialogue-saisie');
const zoneChoix = document.getElementById('dialogue-choix');

let resoudre = null;

dialogue.addEventListener('close', () => {
  const r = resoudre;
  resoudre = null;
  r?.(dialogue.returnValue || null);
});

// Entrée dans le champ de saisie valide (sans quoi le formulaire soumettrait le premier bouton, « Annuler »).
zoneSaisie.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  dialogue.close('valider');
});

// Affiche la boîte et renvoie la valeur du bouton choisi, ou null (Échap, Annuler).
// choix : [{ libelle, valeur, principal?, danger? }] ; un bouton sans valeur ferme sans choix.
// saisie : { valeur, placeholder } affiche un champ texte (lu par demanderTexte).
export function demander({ titre: t, message: m = '', texte = null, saisie = null, choix }) {
  // Déjà ouverte (ex. un second lien de partage) : la demande précédente est abandonnée et
  // la boîte réutilisée telle quelle ; la fermer déclencherait un « close » asynchrone parasite.
  const dejaOuverte = dialogue.open;
  if (dejaOuverte) {
    const precedente = resoudre;
    resoudre = null;
    precedente?.(null);
  }

  titre.textContent = t;
  message.textContent = m;
  message.hidden = !m;
  zoneTexte.hidden = texte === null;
  zoneTexte.value = texte ?? '';
  zoneSaisie.hidden = saisie === null;
  zoneSaisie.value = saisie?.valeur ?? '';
  zoneSaisie.placeholder = saisie?.placeholder ?? '';
  zoneChoix.replaceChildren(
    ...choix.map(({ libelle, valeur = '', principal, danger }) =>
      element('button', {
        class: `bouton${principal ? ' bouton--principal' : ''}${danger ? ' bouton--danger' : ''}`,
        value: valeur,
        textContent: libelle,
      }),
    ),
  );

  dialogue.returnValue = '';
  return new Promise((r) => {
    resoudre = r;
    if (!dejaOuverte) dialogue.showModal();
    if (saisie !== null) {
      zoneSaisie.focus();
      zoneSaisie.select();
    } else if (texte !== null) {
      zoneTexte.focus();
      zoneTexte.select();
    } else {
      (zoneChoix.querySelector('.bouton--principal') ?? zoneChoix.lastElementChild)?.focus();
    }
  });
}

// Demande un texte (nom d'atelier…) ; renvoie la saisie nettoyée, ou null si l'utilisateur annule.
export async function demanderTexte({ titre: t, message: m = '', valeur = '', placeholder = '', libelle = 'Valider' }) {
  const choix = await demander({
    titre: t,
    message: m,
    saisie: { valeur, placeholder },
    choix: [{ libelle: 'Annuler' }, { libelle, valeur: 'valider', principal: true }],
  });
  return choix === 'valider' ? zoneSaisie.value.trim() : null;
}

// Copie via l'API presse-papiers ; si elle est indisponible (HTTP sur une IP locale…) ou refusée,
// affiche le texte sélectionné pour une copie manuelle. Renvoie true si la copie automatique a réussi.
export async function copierTexte(texte, titreRepli) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Presse-papiers indisponible');
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    await demander({
      titre: titreRepli,
      message: 'La copie automatique n’est pas disponible ici. Sélectionne le texte ci-dessous et copie-le.',
      texte,
      choix: [{ libelle: 'Fermer', principal: true }],
    });
    return false;
  }
}

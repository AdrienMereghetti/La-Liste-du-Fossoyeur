// Lien de partage : la liste est encodée dans le fragment de l'URL (#liste=argile:5,~Forge,buche:10).
// Un jeton « ~Nom » ouvre un atelier, les objets qui suivent lui appartiennent.
// Le fragment n'est jamais envoyé au serveur : le site reste purement statique.
import { nettoyerListe } from './cart.js';

const PREFIXE = '#liste=';

// encodeURIComponent laisse passer ! ' ( ) * : on les encode aussi pour que le lien reste
// cliquable d'un bout à l'autre dans les messageries.
const encoder = (texte) => encodeURIComponent(texte).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function decoder(texte) {
  try {
    return decodeURIComponent(texte);
  } catch {
    return texte; // Mal encodé : on l'analyse tel quel.
  }
}

export function lienPartage(liste) {
  const contenu = liste.map((e) => (e.type === 'atelier' ? `~${encoder(e.nom)}` : `${e.id}:${e.quantite}`)).join(',');
  return `${location.origin}${location.pathname}${PREFIXE}${contenu}`;
}

// Renvoie la liste contenue dans le fragment (entrées nettoyées, dans l'ordre du lien),
// ou null si l'URL ne contient pas de liste. Les id inconnus et quantités invalides sont ignorés.
export function lireFragment(hash, objetsParId) {
  if (!hash.startsWith(PREFIXE)) return null;
  const entrees = [];
  for (const jeton of hash.slice(PREFIXE.length).split(',')) {
    const morceau = decoder(jeton);
    if (morceau.startsWith('~')) {
      entrees.push({ type: 'atelier', nom: morceau.slice(1) });
      continue;
    }
    const [id, texteQuantite] = morceau.split(':');
    if (!/^\d+$/.test(texteQuantite ?? '')) continue;
    entrees.push({ type: 'objet', id, quantite: Number(texteQuantite) });
  }
  return nettoyerListe(entrees, objetsParId);
}

// Retire le fragment sans recharger la page ni ajouter d'entrée à l'historique.
export function effacerFragment() {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

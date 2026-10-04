// Correspondance entre les URL d'images distantes et les fichiers locaux de data/images/.
// Partagé par telecharger-images.js et csv-to-json.js pour garantir les mêmes noms.

const PREFIXE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

function nomComplet(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

// Retourne une Map URL → nom de fichier local. Le nom d'origine est débarrassé du préfixe UUID
// ajouté par media.wikily.gg (« 1596...-i_tool_book_1.png » → « i_tool_book_1.png ») ;
// en cas de collision entre deux URL, on garde le nom complet.
export function nomsLocaux(urls) {
  const parNom = new Map();
  for (const url of new Set(urls)) {
    const nom = nomComplet(url).replace(PREFIXE_UUID, '');
    parNom.set(nom, [...(parNom.get(nom) ?? []), url]);
  }
  const resultat = new Map();
  for (const [nom, liste] of parNom) {
    for (const url of liste) resultat.set(url, liste.length === 1 ? nom : nomComplet(url));
  }
  return resultat;
}

// Convertit le CSV source en data/items.json, chargé par l'application.
// Usage : node scripts/csv-to-json.js
// Lancer d'abord telecharger-images.js : le JSON référence les images locales de data/images/.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCsv } from './csv.js';
import { nomsLocaux } from './images.js';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const fichierCsv = join(racine, 'data', 'liste_du_fossoyeur.csv');
const fichierJson = join(racine, 'data', 'items.json');

// « Améliorateur d'Organe » → « ameliorateur-d-organe »
function slug(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const lignes = lireCsv(fichierCsv);
const fichiers = nomsLocaux(lignes.map((l) => l.image).filter(Boolean));

const idsVus = new Map();
const collisions = [];
const imagesAbsentes = [];

const objets = lignes.map((ligne) => {
  const nom = ligne.nom.trim();
  const base = slug(nom);
  const occurrences = (idsVus.get(base) ?? 0) + 1;
  idsVus.set(base, occurrences);
  const id = occurrences === 1 ? base : `${base}-${occurrences}`;
  if (occurrences > 1) collisions.push(`${nom} → ${id}`);

  let image = '';
  if (ligne.image) {
    image = `data/images/${fichiers.get(ligne.image)}`;
    if (!existsSync(join(racine, image))) imagesAbsentes.push(image);
  }
  return { id, nom, categorie: ligne.type.trim(), image };
});

// Un objet par ligne : compact et lisible dans un diff.
writeFileSync(fichierJson, `[\n${objets.map((o) => JSON.stringify(o)).join(',\n')}\n]\n`);

const categories = new Set(objets.map((o) => o.categorie));
console.log(`${objets.length} objets lus, ${categories.size} catégories → data/items.json`);
if (collisions.length) {
  console.log(`Identifiants suffixés (${collisions.length}) :`);
  for (const c of collisions) console.log(`  ${c}`);
}
if (imagesAbsentes.length) {
  console.error(`Images absentes de data/images/ (${imagesAbsentes.length}) — lancer telecharger-images.js :`);
  for (const i of new Set(imagesAbsentes)) console.error(`  ${i}`);
  process.exitCode = 1;
}

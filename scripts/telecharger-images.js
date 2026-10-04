// Télécharge en local toutes les images référencées dans le CSV source.
// Usage : node scripts/telecharger-images.js [--force]
//   --force : retélécharge aussi les images déjà présentes.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCsv } from './csv.js';
import { nomsLocaux } from './images.js';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const fichierCsv = join(racine, 'data', 'liste_du_fossoyeur.csv');
const dossierImages = join(racine, 'data', 'images');
const CONCURRENCE = 8;
const ESSAIS = 3;
const force = process.argv.includes('--force');

async function telecharger(url, destination) {
  for (let essai = 1; ; essai++) {
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      writeFileSync(destination, Buffer.from(await reponse.arrayBuffer()));
      return;
    } catch (erreur) {
      if (essai >= ESSAIS) throw erreur;
      await new Promise((r) => setTimeout(r, 500 * essai));
    }
  }
}

const objets = lireCsv(fichierCsv);

// Plusieurs objets partagent la même image : nomsLocaux dédoublonne par URL.
const taches = [...nomsLocaux(objets.map((o) => o.image).filter(Boolean))].map(([url, fichier]) => ({
  url,
  destination: join(dossierImages, fichier),
}));

mkdirSync(dossierImages, { recursive: true });
console.log(`${objets.length} objets lus, ${taches.length} images distinctes.`);

let telechargees = 0;
let ignorees = 0;
const echecs = [];
let suivante = 0;

async function ouvrier() {
  while (suivante < taches.length) {
    const { url, destination } = taches[suivante++];
    if (!force && existsSync(destination)) {
      ignorees++;
      continue;
    }
    try {
      await telecharger(url, destination);
      telechargees++;
      process.stdout.write(`\r${telechargees + ignorees + echecs.length}/${taches.length}`);
    } catch (erreur) {
      echecs.push({ url, erreur: erreur.message });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCE }, ouvrier));

console.log(`\nTéléchargées : ${telechargees}, déjà présentes : ${ignorees}, échecs : ${echecs.length}.`);
for (const { url, erreur } of echecs) console.error(`  ✗ ${url} (${erreur})`);
process.exitCode = echecs.length ? 1 : 0;

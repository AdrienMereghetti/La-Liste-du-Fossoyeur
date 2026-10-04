// Lecture du CSV source : UTF-8 avec BOM, séparateur « ; », valeurs entre guillemets doubles.
import { readFileSync } from 'node:fs';

// Découpe une ligne CSV en champs en gérant les guillemets doublés ("").
function decouperLigne(ligne) {
  const champs = [];
  let champ = '';
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"' && ligne[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        champ += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === ';') {
      champs.push(champ);
      champ = '';
    } else {
      champ += c;
    }
  }
  champs.push(champ);
  return champs;
}

// Retourne un tableau d'objets indexés par les noms de colonnes de l'en-tête.
export function lireCsv(chemin) {
  const texte = readFileSync(chemin, 'utf8').replace(/^﻿/, '');
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== '');
  const entetes = decouperLigne(lignes[0]);
  return lignes.slice(1).map((ligne) => {
    const champs = decouperLigne(ligne);
    return Object.fromEntries(entetes.map((nom, i) => [nom, champs[i] ?? '']));
  });
}

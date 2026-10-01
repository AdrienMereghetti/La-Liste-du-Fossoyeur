# La Liste du Fossoyeur

Liste de courses pour Graveyard Keeper 2.

## Lancement

L'application doit être servie en HTTP (le `fetch` de `data/items.json` ne fonctionne pas en `file://`) :

```sh
npx serve .
# ou
python3 -m http.server
```

Pour régénérer `data/items.json` à partir du CSV :

```sh
node scripts/csv-to-json.js
```

## Nom de l'outil

**La Liste du Fossoyeur** : liste de courses pour Graveyard Keeper 2.

- `<title>` de la page : « La Liste du Fossoyeur — Graveyard Keeper 2 ».
- En-tête de l'application : titre « La Liste du Fossoyeur », sous-titre « Liste de courses pour Graveyard Keeper 2 ».
- Titre du panneau panier : « Ma liste ».
- Nom technique (dossier, paquet) : `liste-du-fossoyeur`.

## Objectif

Application web locale permettant de constituer une « liste de courses » d'objets du jeu Graveyard Keeper 2 : l'utilisateur parcourt une grille d'objets (image + nom + catégorie), choisit une quantité sous chaque objet, l'ajoute au panier, et obtient un récapitulatif du type « 5 × Argile, 10 × Bûche, … ».

Langue de l'interface : **français**, partout (libellés, messages, placeholders).

## Données source

- Fichier : `data/graveyard_keeper_2_items.csv` (453 objets, 25 catégories).
- Encodage UTF-8 **avec BOM**, séparateur `;`, valeurs entre guillemets doubles.
- Colonnes : `image` (URL absolue PNG sur media.wikily.gg), `nom`, `type` (= catégorie).
- Plusieurs objets partagent la même image (ex. « Barricade I / II / III ») : **ne jamais utiliser l'URL d'image comme identifiant**.
- Identifiant unique : un `id` slug dérivé du nom (minuscules, sans accents, espaces → `-`). Vérifier l'absence de collision au chargement ; en cas de doublon, suffixer `-2`, `-3`.

Catégories présentes (effectif) : Matériaux de construction (49), Objets de quête (42), Outils (32), Nourriture (32), Agriculture (29), Poisson (22), Cimetière (22), Fournitures (Ville) (22), Métaux et minerais (20), Potions (19), Alchimie (18), Armes et armures (17), Bataille (14), Livres et papier (14), Cueillette (13), Parties de corps (13), Boissons (12), Ingrédients (11), Objets de Valeur (9), Sacs (9), Matériel de pêche (8), Église (8), Vêtements (7), Matériaux de fabrication (6), Ressources (5).

Ne pas coder cette liste en dur : la dériver du CSV (triée alphabétiquement, locale `fr`).

### Préparation des données

Écrire un script `scripts/csv-to-json.js` (Node, sans dépendance) qui convertit le CSV en `data/items.json` :

```json
[{ "id": "argile", "nom": "Argile", "categorie": "Matériaux de construction", "image": "https://media.wikily.gg/..." }]
```

Le script doit retirer le BOM, gérer les guillemets doublés (`""`) et rapporter le nombre d'objets lus. L'application charge `items.json`, pas le CSV.

## Stack technique

- **HTML + CSS + JavaScript vanilla** (modules ES), aucun framework, aucune étape de build.
- Structure :
  ```
  index.html
  css/style.css
  js/app.js        // initialisation, état global
  js/grid.js       // rendu de la grille
  js/filters.js    // recherche + filtre catégorie
  js/cart.js       // panier + persistance
  data/items.json
  data/graveyard_keeper_2_items.csv
  scripts/csv-to-json.js
  ```
- Lancement : voir la section [Lancement](#lancement) ci-dessus.

## Fonctionnalités

### 1. Grille d'objets

- Grille responsive (`grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`) : 4 colonnes et plus sur desktop, 2 sur mobile.
- Chaque carte, de haut en bas :
  1. Vignette carrée (≈ 90 px) contenant l'image, centrée.
  2. Nom en gras, blanc, centré.
  3. Catégorie en petit, couleur atténuée.
  4. Sélecteur de quantité : bouton `−`, champ numérique (min 1, max 9999, défaut 1), bouton `+`.
  5. Bouton « Ajouter au panier ».
- Images pixel art : `image-rendering: pixelated;`, `loading="lazy"`, `alt` = nom de l'objet.
- Si l'image échoue à charger (`onerror`), afficher un placeholder neutre plutôt qu'une icône cassée.
- Un objet déjà présent dans le panier affiche un état visuel distinct (vignette au fond beige/doré, comme « Bâton » sur la capture) et un badge avec la quantité en panier.
- Ajouter un objet déjà présent **additionne** la quantité.

### 2. Recherche instantanée

- Champ de recherche en haut, placeholder « Rechercher un objet… ».
- Filtrage **à chaque frappe** (événement `input`), sans bouton ni touche Entrée. Petit debounce acceptable (≤ 100 ms).
- Correspondance « contient », **insensible à la casse et aux accents** : normaliser avec `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`. Ainsi « bois » trouve « Bois Sculpté », « Babioles en Bois », « Cale en Bois » ; « baton » trouve « Bâton ».
- Bouton ✕ pour vider le champ. Touche Échap vide aussi.

### 3. Filtre par catégorie

- Liste déroulante (`<select>`) « Toutes les catégories » + chaque catégorie avec son effectif, ex. « Outils (32) ».
- Se combine avec la recherche (ET logique).
- Afficher le nombre de résultats : « 12 objets ».
- Si aucun résultat : message « Aucun objet ne correspond » et bouton « Réinitialiser les filtres ».

### 4. Panier (liste de courses)

- Panneau latéral fixe à droite sur desktop, tiroir ouvrable via un bouton flottant (avec compteur) sur mobile.
- Chaque ligne : miniature, nom, quantité modifiable (`−` / champ / `+`), bouton supprimer.
- Quantité ramenée à 0 = suppression de la ligne.
- En-tête : nombre de lignes et quantité totale.
- Actions :
  - « Copier la liste » : copie dans le presse-papiers au format texte, une ligne par objet : `5 × Argile`.
  - « Exporter CSV » : télécharge `liste_du_fossoyeur.csv` (`nom;categorie;quantite`, UTF-8 avec BOM, pour Excel).
  - « Vider le panier » avec confirmation.
- Option de tri du panier : ordre d'ajout (défaut) ou par catégorie.
- **Persistance** dans `localStorage` (clé `liste-du-fossoyeur:panier`, format `{ [id]: quantite }`). Envelopper lecture et écriture dans `try/catch` et repartir d'un panier vide en cas d'erreur ou de données corrompues. Ignorer les `id` qui n'existent plus dans `items.json`.

## Design

S'inspirer de l'interface du wiki (capture fournie) :

- Fond de page : texture bois sombre, à défaut un brun très foncé (`#2a211d`) avec un léger dégradé.
- Vignette d'objet : fond bleu-gris sombre (`#2b2f3a`), bordure fine (`#4a5060`), coins arrondis (6 px), légère ombre interne.
- Vignette « dans le panier » : fond beige (`#d9b77e`), bordure dorée.
- Nom : blanc cassé (`#f2ede4`), gras, ~14 px. Catégorie : gris-beige (`#a69c8c`), ~12 px.
- Boutons et champs : même palette sombre, accent doré (`#c9a14a`) au survol et au focus.
- Définir toutes les couleurs en variables CSS sur `:root`.
- Police : système sans-serif ; une police pixel (Google Fonts « Pixelify Sans ») est acceptable pour les titres uniquement, avec fallback.

## Accessibilité

- Tous les boutons ont un libellé accessible (`aria-label="Augmenter la quantité d'Argile"`).
- Navigation clavier complète, focus visible.
- Annonce des ajouts au panier via une zone `aria-live="polite"` (« 5 × Argile ajouté »).
- Contraste suffisant du texte sur les fonds sombres.

## Performance

- 453 cartes : rendu direct sans virtualisation. Créer les cartes **une seule fois** au chargement, puis filtrer en basculant l'attribut `hidden` plutôt qu'en reconstruisant le DOM.
- Précalculer pour chaque objet son nom normalisé (`nomRecherche`) au chargement.
- Délégation d'événements sur le conteneur de la grille plutôt qu'un écouteur par bouton.

## Conventions de code

- Noms de variables et fonctions en français ou en anglais, mais de façon cohérente dans tout le projet ; commentaires en français.
- Pas de `innerHTML` avec des données non échappées : construire les éléments avec `document.createElement` / `textContent`.
- Un état unique (`etat = { objets, recherche, categorie, panier }`) et une fonction `rendu()` qui applique les filtres et met à jour le panier.

## Critères d'acceptation

- [ ] Les 453 objets s'affichent avec image, nom et catégorie.
- [ ] Taper « bois » filtre la grille immédiatement, sans validation ; « baton » trouve « Bâton ».
- [ ] Le filtre catégorie fonctionne seul et combiné à la recherche.
- [ ] On peut choisir une quantité sous chaque objet et l'ajouter ; un nouvel ajout cumule.
- [ ] Le panier permet de modifier, supprimer, vider, copier et exporter.
- [ ] Le panier survit à un rechargement de la page.
- [ ] Utilisable sur mobile (≥ 360 px de large) et au clavier.

## Hors périmètre (pour l'instant)

- Recettes et calcul automatique des ingrédients nécessaires.
- Comptes utilisateurs, synchronisation, backend.
- Téléchargement local des images (on utilise les URL distantes de media.wikily.gg).

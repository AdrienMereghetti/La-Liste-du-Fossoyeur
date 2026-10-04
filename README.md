# La Liste du Fossoyeur

Liste de courses pour Graveyard Keeper 2.

## Lancement

L'application doit être servie en HTTP (le `fetch` de `data/items.json` ne fonctionne pas en `file://`) :

```sh
npx serve .
# ou
python3 -m http.server
```

Pour (re)construire les données à partir du CSV :

```sh
node scripts/telecharger-images.js   # télécharge les images dans data/images/ (--force pour tout retélécharger)
node scripts/csv-to-json.js          # génère data/items.json
```

## Déploiement (Netlify)

Le site est purement statique, hébergé sur Netlify et utilisé depuis un PC comme depuis un smartphone. [netlify.toml](netlify.toml) publie la racine du projet **sans étape de build** : `data/items.json` et `data/images/` doivent être générés en local (voir ci-dessus) et faire partie des fichiers déployés.

- Déploiement manuel : glisser-déposer le dossier du projet sur <https://app.netlify.com/drop>, ou `npx netlify-cli deploy --prod --dir .`.
- Netlify sert le site en HTTPS, ce qui est nécessaire pour l'API presse-papiers (`navigator.clipboard`) sur mobile.
- Tester sur smartphone avant déploiement : `npx serve .` puis ouvrir `http://<IP-du-PC>:3000` depuis le téléphone (même Wi-Fi). En HTTP sur une IP, le presse-papiers moderne n'est pas disponible : d'où le repli décrit dans [Panier](#4-panier-liste-de-courses).

## Nom de l'outil

**La Liste du Fossoyeur** : liste de courses pour Graveyard Keeper 2.

- `<title>` de la page : « La Liste du Fossoyeur — Graveyard Keeper 2 ».
- En-tête de l'application : titre « La Liste du Fossoyeur », sous-titre « Liste de courses pour Graveyard Keeper 2 ».
- Titre du panneau panier : « Ma liste ».
- Nom technique (dossier, paquet) : `liste-du-fossoyeur`.

## Objectif

Application web statique (hébergée sur Netlify, utilisable sur PC et smartphone) permettant de constituer une « liste de courses » d'objets du jeu Graveyard Keeper 2 : l'utilisateur parcourt une grille d'objets (image + nom + catégorie), choisit une quantité sous chaque objet, l'ajoute au panier, et obtient un récapitulatif du type « 5 × Argile, 10 × Bûche, … ».

Langue de l'interface : **français**, partout (libellés, messages, placeholders).

## Données source

- Fichier : `data/liste_du_fossoyeur.csv` (453 objets, 25 catégories).
- Encodage UTF-8 **avec BOM**, séparateur `;`, valeurs entre guillemets doubles.
- Colonnes : `image` (URL absolue PNG sur media.wikily.gg), `nom`, `type` (= catégorie).
- Plusieurs objets partagent la même image (ex. « Barricade I / II / III ») : 439 images distinctes pour 453 objets. **Ne jamais utiliser l'image comme identifiant**.
- Identifiant unique : un `id` slug dérivé du nom (minuscules, sans accents, toute suite de caractères non alphanumériques → un seul `-`, sans `-` en début ni en fin ; ex. « Améliorateur d'Organe » → `ameliorateur-d-organe`, « Appât : Pain » → `appat-pain`). Vérifier l'absence de collision au chargement ; en cas de doublon, suffixer `-2`, `-3`.

Catégories présentes (effectif) : Matériaux de construction (49), Objets de quête (42), Outils (32), Nourriture (32), Agriculture (29), Poisson (22), Cimetière (22), Fournitures (Ville) (22), Métaux et minerais (20), Potions (19), Alchimie (18), Armes et armures (17), Bataille (14), Livres et papier (14), Cueillette (13), Parties de corps (13), Boissons (12), Ingrédients (11), Objets de Valeur (9), Sacs (9), Matériel de pêche (8), Église (8), Vêtements (7), Matériaux de fabrication (6), Ressources (5).

Ne pas coder cette liste en dur : la dériver du CSV (triée alphabétiquement, locale `fr`).

### Préparation des données

Les scripts Node (sans dépendance, modules ES) sont dans `scripts/` et partagent deux modules :

- `scripts/csv.js` : `lireCsv(chemin)` lit le CSV (retire le BOM, gère les guillemets doublés `""`) et renvoie des objets indexés par colonne.
- `scripts/images.js` : `nomsLocaux(urls)` renvoie la correspondance URL → nom de fichier local (nom d'origine sans le préfixe UUID de wikily, ex. `i_tool_book_1.png` ; nom complet conservé en cas de collision).

**Images locales** — `scripts/telecharger-images.js` (déjà écrit) télécharge chaque image distincte dans `data/images/`, en ignorant celles déjà présentes.

**JSON** — écrire `scripts/csv-to-json.js`, qui réutilise `lireCsv` et `nomsLocaux` pour convertir le CSV en `data/items.json`. Le champ `image` contient le **chemin local** relatif à la racine, pas l'URL distante :

```json
[{ "id": "argile", "nom": "Argile", "categorie": "Matériaux de construction", "image": "data/images/i_clay.png" }]
```

Le script rapporte le nombre d'objets lus et signale les images référencées absentes de `data/images/` (lancer d'abord `telecharger-images.js`). L'application charge `items.json`, pas le CSV, et n'appelle jamais media.wikily.gg.

## Stack technique

- **HTML + CSS + JavaScript vanilla** (modules ES), aucun framework, aucune étape de build.
- Structure :
  ```
  index.html
  css/style.css
  js/app.js        // initialisation, état global, rendu(), tiroir mobile, actions du panier
  js/grid.js       // rendu de la grille
  js/filters.js    // recherche + filtre catégorie
  js/cart.js       // panier (objets + ateliers), persistance, réorganisation, texte de la liste, export CSV
  js/share.js      // lien de partage (#liste=…)
  js/dialog.js     // boîte de dialogue <dialog> + copie presse-papiers avec repli
  js/dom.js        // utilitaires DOM partagés (création d'éléments, vignette, bornes)
  assets/fond-bois.jpg
  data/items.json
  data/images/*.png
  data/liste_du_fossoyeur.csv
  scripts/csv.js                 // lecture du CSV
  scripts/images.js              // URL distante → nom de fichier local
  scripts/telecharger-images.js
  scripts/csv-to-json.js
  netlify.toml
  ```
- Lancement et déploiement : voir les sections [Lancement](#lancement) et [Déploiement](#déploiement-netlify) ci-dessus.
- Tous les chemins sont **relatifs** (`data/items.json`, `css/style.css`…), sans `/` initial ni URL absolue, pour fonctionner à l'identique en local et sur Netlify.

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

- Panneau latéral fixe à droite à partir de 900 px de large, tiroir ouvrable via un bouton flottant (avec compteur du nombre d'objets) en dessous.
- Chaque ligne tient sur **une seule rangée** (≈ 9 lignes visibles sur un smartphone en portrait) : poignée de glissement, miniature, nom, quantité modifiable (`−` / champ / `+`).
- Quantité ramenée à 0 = suppression de la ligne ; à 1, le bouton `−` devient `✕` (« Retirer »).
- En-tête compact : nombre d'objets et quantité totale, puis une barre d'outils : ordre (« Mon ordre » / « Par catégorie »), « ↕ Organiser », « + Atelier ».
- **Réordonner** (en « Mon ordre » uniquement) :
  - glisser-déposer par la poignée (événements pointeur : souris, doigt, stylet ; défilement automatique près des bords) ;
  - flèches ▲ / ▼ affichées par « ↕ Organiser » (qui remplacent alors la quantité et ajoutent le bouton ✕) ;
  - au clavier, flèches haut / bas sur la poignée.
- **Ateliers** : en-têtes qui regroupent les objets nécessaires à une construction.
  - « + Atelier » demande un nom ; l'atelier créé devient la cible des ajouts depuis la grille (sélecteur « Ajouts dans : », rappelé sur le bouton flottant).
  - Un objet appartient à l'atelier qui le précède ; ceux placés avant le premier atelier sont « sans atelier ». Les objets d'un atelier sont indentés.
  - Un même objet peut figurer dans plusieurs ateliers (une seule ligne par atelier ; un déplacement vers un atelier qui le contient déjà cumule les quantités). Les badges de la grille affichent le total.
  - En-tête d'atelier : repli / dépli (persisté), compteur d'objets ; en mode Organiser : ▲ / ▼ (échange avec l'atelier voisin), renommer, supprimer (en gardant les objets, qui passent « sans atelier », ou en les retirant).
  - Glisser un atelier déplace tout son contenu ; un atelier ne passe jamais devant les objets sans atelier.
- Actions (« Copier la liste », « Partager la liste » et « ⋯ » qui déplie les actions secondaires) :
  - « Copier la liste » : copie dans le presse-papiers au format texte, une ligne par objet : `5 × Argile`. Les objets d'un atelier sont indentés sous `Forge :` ; dès que plusieurs sections sont remplies, un bloc `Total :` récapitule les quantités à réunir. Utiliser `navigator.clipboard.writeText` ; s'il est indisponible ou échoue (contexte non sécurisé), afficher le texte dans une zone sélectionnable pour copie manuelle. Bouton « Partager le texte » via `navigator.share`, affiché seulement lorsque l'API existe (smartphones, certains navigateurs de bureau).
  - « Exporter CSV » : télécharge `liste_du_fossoyeur.csv` (`nom;categorie;quantite;atelier`, UTF-8 avec BOM, pour Excel).
  - « Partager la liste » : génère un lien contenant le panier, pour passer la liste d'un appareil à l'autre (PC ↔ smartphone) sans backend. Voir [Lien de partage](#5-lien-de-partage).
  - « Vider le panier » avec confirmation.
- Option d'ordre : « Mon ordre » (défaut, réordonnable) ou « Par catégorie » (au sein de chaque atelier, avec sous-titres de catégorie ; réorganisation désactivée).
- **Persistance** dans `localStorage` (clé `liste-du-fossoyeur:panier`, format `{ liste: [entrée…], cible }`, où une entrée est `{ type: 'objet', cle, id, quantite }` ou `{ type: 'atelier', cle, nom, replie }` et `cible` la clé de l'atelier recevant les ajouts). L'ancien format `{ [id]: quantite }` est encore lu. Envelopper lecture et écriture dans `try/catch` et repartir d'un panier vide en cas d'erreur ou de données corrompues. Ignorer les `id` qui n'existent plus dans `items.json`. Le panier est propre à chaque appareil et navigateur ; le transfert passe par le lien de partage.

### 5. Lien de partage

- Format : l'URL du site suivie d'un fragment `#liste=<id>:<quantite>,<id>:<quantite>,…`, dans l'ordre du panier, ex. `https://…netlify.app/#liste=argile:5,buche:10`. Les `id` étant des slugs (`[a-z0-9-]`), aucun encodage supplémentaire n'est nécessaire. Un jeton `~<nom encodé>` (`encodeURIComponent`) ouvre un atelier : `#liste=argile:5,~Forge,buche:10`. Le fragment n'est jamais envoyé au serveur.
- Bouton « Partager la liste » : utilise `navigator.share({ title, url })` si disponible (feuille de partage du smartphone), sinon copie le lien dans le presse-papiers (même repli que « Copier la liste »). Désactivé si le panier est vide.
- À l'ouverture d'un lien contenant `#liste=` :
  - Analyser le fragment en ignorant les `id` inconnus et les quantités invalides (non entières, ≤ 0) ; plafonner à 9999.
  - Si le panier local est vide, importer directement et annoncer « Liste importée : N objets ».
  - Sinon, demander dans une boîte de dialogue : « Remplacer ma liste », « Ajouter à ma liste » (cumul des quantités ; les ateliers de même nom sont réunis) ou « Annuler ».
  - Dans tous les cas, retirer ensuite le fragment de l'URL (`history.replaceState`) pour qu'un rechargement ne réimporte pas la liste.
- Réagir aussi à l'événement `hashchange` (lien ouvert dans un onglet déjà chargé).

## Design

S'inspirer de l'interface du wiki (capture fournie) :

- Fond de page : `assets/fond-bois.jpg` (planches de bois, 1672 × 941, ≈ 250 Ko ; décors aux coins : bougie, crâne, grimoire, pelle).
  - Fixé sur l'écran pendant le défilement et couvrant toute la fenêtre (`background-size: cover`, centré). Utiliser un pseudo-élément `body::before` en `position: fixed` plutôt que `background-attachment: fixed`, non pris en charge sur iOS.
  - Le bois est assez clair et chaud : superposer un voile sombre (dégradé `rgba(20, 14, 10, .55)` → `.75`) pour garder le contraste des textes posés directement sur le fond (titre, compteur de résultats, messages).
  - Couleur de repli tant que l'image charge ou si elle échoue : `#2a211d`.
  - Sur mobile (portrait), `cover` recadre les côtés et les décors des coins disparaissent en partie : c'est acceptable.
- Vignette d'objet : fond bleu-gris sombre (`#2b2f3a`), bordure fine (`#4a5060`), coins arrondis (6 px), légère ombre interne.
- Vignette « dans le panier » : fond beige (`#d9b77e`), bordure dorée.
- Nom : blanc cassé (`#f2ede4`), gras, ~14 px. Catégorie : gris-beige (`#a69c8c`), ~12 px.
- Boutons et champs : même palette sombre, accent doré (`#c9a14a`) au survol et au focus.
- Définir toutes les couleurs en variables CSS sur `:root`.
- Police : système sans-serif ; une police pixel (Google Fonts « Pixelify Sans ») est acceptable pour les titres uniquement, avec fallback.

## Mobile

- `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Cibles tactiles d'au moins 44 × 44 px (boutons `−` / `+`, supprimer, ajouter).
- Champs de quantité : `inputmode="numeric"` pour afficher le pavé numérique ; police ≥ 16 px dans les champs pour éviter le zoom automatique d'iOS.
- Champ de recherche : `type="search"`, `enterkeyhint="search"`.
- Le tiroir du panier ne masque pas définitivement la grille : fermeture par bouton, par la touche Échap et par appui en dehors du tiroir.
- Respecter les zones sûres (`env(safe-area-inset-bottom)`) pour le bouton flottant.

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

- [x] Les 453 objets s'affichent avec image, nom et catégorie.
- [x] Taper « bois » filtre la grille immédiatement, sans validation ; « baton » trouve « Bâton ».
- [x] Le filtre catégorie fonctionne seul et combiné à la recherche.
- [x] On peut choisir une quantité sous chaque objet et l'ajouter ; un nouvel ajout cumule.
- [x] Le panier permet de modifier, supprimer, vider, copier et exporter.
- [x] Le panier survit à un rechargement de la page.
- [x] Un lien de partage créé sur PC ouvert sur smartphone importe la même liste (remplacer ou ajouter).
- [x] Le site déployé sur Netlify fonctionne sans erreur (images, `items.json`, copie dans le presse-papiers).
- [x] Utilisable sur mobile (≥ 360 px de large) et au clavier.

## Hors périmètre (pour l'instant)

- Recettes et calcul automatique des ingrédients nécessaires.
- Comptes utilisateurs, synchronisation automatique entre appareils, backend.
- Application installable / mode hors ligne (manifest, service worker).

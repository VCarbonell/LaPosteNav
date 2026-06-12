# Brief — Application de suivi de tournée (facteur)

## Contexte & objectif
Je suis facteur. Je veux une application web (PWA) pour **suivre ma tournée de distribution sur une carte**, en voiture. Le casier est déjà trié dans l'ordre de la tournée ; l'app doit me permettre de garder cet ordre, de l'ajuster à la main, puis de **tracer tout l'itinéraire** et de **me voir avancer dessus**.

Vue souhaitée pendant le trajet : **carte en perspective légèrement inclinée** (style navigation Maps) **qui pivote dans le sens de ma marche** (heading-up), avec un repère « moi » et la caméra qui me suit. **Pas de guidage vocal, pas de reroutage, pas de trafic.**

## Stack (tu choisis le framework)
- **Cible : mobile uniquement** (Android/iOS, via navigateur puis PWA installée à l'écran d'accueil). **Pas besoin de supporter le desktop.** UI pensée en **portrait**, plein écran.
- Tu as le choix de l'architecture/framework — privilégie quelque chose de **simple, maintenable et adapté à une PWA mobile**.
- **Carte : MapLibre GL JS** (caméra inclinée via `pitch` ~50°, rotation heading-up via `bearing`).
- **Tuiles / style : MapTiler** (tier gratuit, clé API) — utiliser un **style vectoriel** (rendu plus net en vue inclinée).
- **Routage + géocodage : OpenRouteService (ORS)** (tier gratuit, clé API).
- **Clés API** lues depuis un fichier de config / variables d'env, **jamais commitées** (`.gitignore`). Documente comment créer les clés gratuites MapTiler + ORS dans le README.
- **PWA installable avec fonctionnement hors-ligne** (voir section dédiée).
- **Hébergement cible : GitHub Pages** (donc build statique compatible ; HTTPS requis pour la géolocalisation).

## Fonctionnalités

1. **Liste des voies (cœur de l'app)**
   - Liste ordonnée de voies, **éditable** (nom de la voie + **commune** + **code postal** + numéros) et **réordonnable à la main par glisser-déposer TACTILE** : appui long pour saisir une ligne, puis glisser au doigt pour la déplacer. **Le drag-and-drop doit fonctionner au doigt sur mobile** — ne pas se reposer sur le HTML5 drag natif (inutilisable sur tactile) ; utiliser Pointer Events ou une lib compatible tactile (ex. SortableJS, ou dnd-kit avec capteurs tactiles). Boutons ↑/↓ acceptés en complément optionnel.
   - **La commune + le code postal sont définis au niveau de CHAQUE voie**, pas globalement : la tournée s'étale sur plusieurs communes (Paulhan, Campagnan, Adissan, Saint-Pargoire, Pézenas…). Le géocodage utilise « `nom de voie, commune CP` » propre à chaque voie.
   - Aide à la saisie : action « appliquer cette commune (+ CP) aux voies sélectionnées » pour remplir vite plusieurs lignes d'un coup (le stockage reste **par voie**).
   - **Coordonnées GPS manuelles (secours)** : chaque voie peut recevoir des coordonnées `lat`/`lng` saisies à la main, pour le cas où **le géocodage ne trouve pas la rue** ou la place au mauvais endroit. Deux moyens : **bouton « utiliser ma position actuelle »** (je me gare dans la rue et je capture le point via `getCurrentPosition`) ou **saisie/collage manuel de lat,lng**. Indiquer visuellement les voies qui ont un point manuel. **Si une voie a des coordonnées manuelles, elles priment sur le géocodage.**
   - Ajouter / supprimer une voie. Case « inclure dans l'itinéraire » par voie (certaines entrées ne sont pas des adresses : Rebuts, Renfort, Mairie… → décochées par défaut).
   - Les **numéros** sont affichés en **référence seule** (ils ne servent pas au calcul d'itinéraire).
   - **Persistance locale** (IndexedDB) : mes modifications et mon ordre sont conservés.
   - Pré-remplir avec les données de l'**annexe** ci-dessous (commune/CP à compléter par l'utilisateur). Bouton « réinitialiser » vers ces données.

2. **Réglages**
   - Mode de déplacement (voiture par défaut).
   - Réglage d'inclinaison de la caméra (0° = vue du dessus, ~50–60° = vue nav ; défaut ~50°).
   - (La commune ne se règle PAS ici : elle est définie **par voie**, voir point 1.)

3. **Tracer la tournée**
   - Pour chaque voie incluse : **si des coordonnées manuelles (`lat`/`lng`) existent, les utiliser directement** ; sinon **géocoder** « `nom de voie, commune CP` » (commune **propre à la voie**) via ORS → coordonnées (mettre en cache). **Si le géocodage échoue ou renvoie un résultat douteux, signaler la voie** (badge/alerte) pour que l'utilisateur corrige le nom/la commune ou saisisse des coordonnées GPS manuelles.
   - Calculer **un itinéraire continu** reliant toutes les voies **dans l'ordre de la liste** (ORS Directions). Si le nombre de points dépasse la limite ORS par requête → **découper en segments et recoller** pour n'afficher **qu'une seule ligne**.
   - Afficher le tracé en **ligne GeoJSON** sur la carte.
   - Conserver l'ordre tel quel : **pas d'optimisation automatique**.

4. **Vue « trajet »**
   - MapLibre, **`pitch` ~50° (perspective inclinée, style Maps), réglable** ; **`bearing` = cap GPS** pour la rotation heading-up.
   - Caméra qui suit : `map.easeTo({ center, bearing, pitch:~50, zoom:~17, duration:~300 })` à chaque mise à jour de position.
   - Repère « moi » : comme la carte tourne pour mettre mon cap vers le haut, une **flèche fixe pointée vers le haut** suffit.
   - Bouton « recentrer / suivre » (et possibilité de débrayer le suivi quand je manipule la carte).

5. **Géolocalisation**
   - `navigator.geolocation.watchPosition` en haute précision.
   - `coords.heading` est **`null` à l'arrêt** → conserver le dernier cap connu ; fallback **boussole** via `DeviceOrientationEvent` (gérer la **permission iOS** `requestPermission()`).
   - **Lisser** le cap (moyenne glissante / low-pass) pour éviter que la carte tremble à basse vitesse / aux feux.

## Hors-ligne (PWA)
- Service worker : mettre en cache l'**app shell** (HTML/CSS/JS).
- Stocker en **IndexedDB** les **coordonnées géocodées** et **l'itinéraire calculé** pour pouvoir rejouer une tournée déjà tracée **sans réseau**.
- Tuiles : cache des tuiles récemment consultées **dans le respect des CGU MapTiler** (vérifie ce qui est autorisé ; ne pas mettre en place un cache permanent interdit). Si bloquant, se rabattre sur : itinéraire + coordonnées hors-ligne, tuiles en ligne uniquement.

## Hors-périmètre (ne pas faire)
- Guidage vocal, instructions tour-par-tour.
- Reroutage automatique si je m'écarte.
- Trafic en temps réel.
- Optimisation automatique de l'ordre des arrêts.

## Contraintes & pièges à gérer
- **HTTPS obligatoire** pour la géoloc (OK sur GitHub Pages ; `file://` ne marchera pas sur mobile).
- **CGU MapTiler / ORS** : respecter les limites sur le **cache de tuiles** et le **stockage des résultats de géocodage**. Ne stocker que ce qui est permis.
- **Limites & quotas ORS** (waypoints par requête, rate limit, quota journalier) → chunker, throttler, gérer les erreurs proprement (messages clairs, pas de plantage silencieux).
- **Clés API** non commitées, documentées.
- **Données de voies = transcription manuelle de photos, NON vérifiées** (surtout les numéros) ; **commune/CP non renseignés** → tout doit être corrigeable dans l'app.
- **Mobile uniquement** : portrait, gros boutons tactiles, lisible en plein soleil au volant, zones de tap larges, respect de `prefers-reduced-motion`. Le **glisser-déposer tactile** de la liste doit être fluide et ne pas déclencher le scroll de la page par erreur pendant le drag.

## Critères d'acceptation
- Je peux éditer (nom, commune, CP, numéros) et **réordonner la liste au doigt (glisser-déposer tactile)** sur mobile, et l'ordre persiste après fermeture.
- La **commune est portée par chaque voie** et utilisée telle quelle au géocodage.
- Une voie **introuvable par le géocodage peut être placée à la main via des coordonnées GPS** (saisie manuelle ou « ma position actuelle ») et apparaît alors normalement dans le tracé.
- « Tracer la tournée » dessine **une seule ligne continue** reliant toutes les voies incluses.
- En roulant, **je me vois avancer**, sur une **carte en perspective inclinée qui pivote** dans le sens de ma direction.
- L'app est **installable** ; une tournée déjà tracée s'ouvre et s'affiche **sans réseau**.
- Les clés API ne sont pas dans le dépôt ; le README explique comment les obtenir et configurer.

## Annexe — données de départ (à vérifier sur le casier réel)
Seed de la liste. Schéma par voie : `rue` (nom), `commune` et `cp` (**à compléter par l'utilisateur** — laissés vides car la tournée couvre plusieurs communes), `num` (numéros, référence seule), `inclure` (absent = `true` ; `false` = entrée non distribuable / non-adresse), `lat`/`lng` (**optionnels** — coordonnées GPS manuelles de secours ; si présents, priment sur le géocodage). Transcription approximative de photos floues — l'utilisateur corrigera dans l'app.

```json
[
  {"rue":"Route de Pezenas","commune":"","cp":"","num":"27-24B-24A-24 · 25-21-19 · 22-20 · 18-16-17 · 15-13-11 · 14-12-10-8 · (Irrifrance, Garage Renault/Taima)"},
  {"rue":"Route d'Adissan","commune":"","cp":"","num":"22-22B-22T · 42-50-75 · 119B-119-121 · 141-228 · 292 (Delevaux)"},
  {"rue":"Le Clos Guilhem","commune":"","cp":"","num":"189-186-183 · 170-164-147 · 143-135-125"},
  {"rue":"Pezenas","commune":"","cp":"","num":"9","inclure":false},
  {"rue":"Rue des Coquelicots","commune":"","cp":"","num":"35-66-65-71-80-85 · 94-119-129 · 56-151-163-188-128 · 197-205-246-218"},
  {"rue":"Rue Joséphine Boyer","commune":"","cp":"","num":"1 · 3 à 5 bis · 8 à 2"},
  {"rue":"Clos des Vignerons","commune":"","cp":"","num":"1 à 17"},
  {"rue":"Route Clairette","commune":"","cp":"","num":"14-12-10-8b · 8 à 1"},
  {"rue":"Paulette Hauchard","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Clairette","commune":"","cp":"","num":"6-4-2","inclure":false},
  {"rue":"Chemin des Auberguets","commune":"","cp":"","num":"11-20-30-36 · 256-300-302 · 314-334-336-381 · 441-451 · 475-495-527"},
  {"rue":"Rue Jany","commune":"","cp":"","num":"1 à 6"},
  {"rue":"Clos d'Odile","commune":"","cp":"","num":"1-2-3"},
  {"rue":"Rue des Auberguets","commune":"","cp":"","num":"80-96 · 98-95 · 94 · 120-131 · 144-153 · 181-186 · 215-225-222-234-236-235"},
  {"rue":"Rue du Mistral","commune":"","cp":"","num":"155-270-260 · 172-118 · 104-90"},
  {"rue":"Rue du Pioch","commune":"","cp":"","num":"1 à 6"},
  {"rue":"Chemin du Mas d'Affre","commune":"","cp":"","num":"139-161-181 · 370"},
  {"rue":"Rue des Genets","commune":"","cp":"","num":"114-80-85"},
  {"rue":"Mas d'Affre","commune":"","cp":"","num":"4-3-1-2-5","inclure":false},
  {"rue":"Rue des Aires","commune":"","cp":"","num":"23-21 · 10-7-5T-8-5b-6-5-2-3b"},
  {"rue":"Le Plan","commune":"","cp":"","num":"3-1 · 1-3-6-4"},
  {"rue":"Coin Henry","commune":"","cp":"","num":"1-3"},
  {"rue":"Rue des Anciens Combattants","commune":"","cp":"","num":"14-7-37-43-2-1"},
  {"rue":"Rue des Romains","commune":"","cp":"","num":"7-5-4-3-2-1"},
  {"rue":"Place du Jeu de Ballon","commune":"","cp":"","num":"2-4 · 6-8-1 · 8-5"},
  {"rue":"Rue de l'Eglise","commune":"","cp":"","num":"12-9-10 · 8-7-5 · 6-4-1"},
  {"rue":"Rue de Bel Air","commune":"","cp":"","num":"2b-1b-1-3-2-4-6"},
  {"rue":"Rue du Griffe","commune":"","cp":"","num":"5 · 1 à 7"},
  {"rue":"Rue du Trou","commune":"","cp":"","num":"1-3-2"},
  {"rue":"Rue du Four","commune":"","cp":"","num":"1 à 13"},
  {"rue":"Rue de la Calade","commune":"","cp":"","num":"7-12-10-8 · 6-4-2-5-3-1 · 7-6-8-11"},
  {"rue":"Place de la Fontaine","commune":"","cp":"","num":"1-3-5-7-9-11"},
  {"rue":"Rue de l'Ancien Presbytère","commune":"","cp":"","num":"2-4-7-5-3-1"},
  {"rue":"Place de l'Ancienne Eglise","commune":"","cp":"","num":"1-3-2-4-6"},
  {"rue":"Rue des Ecoles","commune":"","cp":"","num":"15 · 5 · 4-6 · 7-9-9b-11 · 13-8-10"},
  {"rue":"Rue les Tamaris","commune":"","cp":"","num":"1-6-5-4-3-2"},
  {"rue":"Chemin des Trabessses","commune":"","cp":"","num":"112-116 · 170-188 · 234-236 · 325 · 332-334-354 · 389-370 · 38-48"},
  {"rue":"Route de Campagnan","commune":"","cp":"","num":"46-58-77 · 108-106 · 102-92-82-72 · 97-105-111 · 137 · 155-154 · 160-170-182 · 190-185-192 · 300-328-330-350-354-327 · 359-369-381 · 554-566-578 · 60-69-96-91-106-137 · 2-1-3-5 · 9-13-15 · 4-4b-6 · 17-17b"},
  {"rue":"Lot Grillons","commune":"","cp":"","num":"1 à 4"},
  {"rue":"Lieu-dit Cade","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Route de Paulhan","commune":"","cp":"","num":"20"},
  {"rue":"Avenue de Saint Pargoire","commune":"","cp":"","num":"726-729-723-717-693 · 669 · 647-648-626-576-546 · 416-406-403-394 · 74-36 · 31-47-82-80 · 110-117-140-143 · 168b-168-190-191 · 239-237 · 344"},
  {"rue":"Le Trou","commune":"","cp":"","num":"5"},
  {"rue":"Saint Pargoire","commune":"","cp":"","num":"512","inclure":false},
  {"rue":"Clos d'Api","commune":"","cp":"","num":"4 à 1"},
  {"rue":"Mairie","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Chemin de l'Espire","commune":"","cp":"","num":"91-84"},
  {"rue":"Rue les Platanes","commune":"","cp":"","num":"1 à 9"},
  {"rue":"Clos Mimosa","commune":"","cp":"","num":"1-2-3"},
  {"rue":"Rue des Vignes","commune":"","cp":"","num":"4 à 1"},
  {"rue":"Chemin de Saint Pons","commune":"","cp":"","num":"35-46-231-247"},
  {"rue":"Riveral","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Chemin Montagnac","commune":"","cp":"","num":"290"},
  {"rue":"Rue de la Gare","commune":"","cp":"","num":"1-3-2-4-5"},
  {"rue":"Avenue de Belarga","commune":"","cp":"","num":"9-11-14 · 309-318-325-297 · 291-283-279 · 267-261-258 · 243-241-226-221 · 198-151 · 137-115 · 43-35 · 11 · 322-334-342-345"},
  {"rue":"Rue des Parros","commune":"","cp":"","num":"1-2-1b · 4-2b · 5-7-9-11"},
  {"rue":"Rue des Tourelles","commune":"","cp":"","num":"128-134 · 175-179-185"},
  {"rue":"Rue du Riou","commune":"","cp":"","num":"135-139 · 7 à 1"},
  {"rue":"Lotissement Plein Soleil","commune":"","cp":"","num":"13-1-2-14 · 15-3-4-5-6 · 7-8-9-10 · 16-17-18-12-11"},
  {"rue":"Rue des Clapas","commune":"","cp":"","num":"129-127-125 · 145-145b-167 · 256 · 250-240-220-208-200 · 176-164 · 146-106-90-90b · 80-72-8 · 20-30 · 47-63-85-107"},
  {"rue":"Chemin des Très Cayres","commune":"","cp":"","num":"44-46-65 · 76-120-122-124-125 · 146-148"},
  {"rue":"Impasse Amandiers","commune":"","cp":"","num":"42-41"},
  {"rue":"Rue des Amandiers","commune":"","cp":"","num":"50-53-57-54 · 18-30-48"},
  {"rue":"Avenue de Pezenas","commune":"","cp":"","num":"1 · 28-30-34"},
  {"rue":"Route de la Candaurade","commune":"","cp":"","num":"3-5-7-4-2 · 2b-2-1 · 6-6-3-6b · 3b-3T-8-10-12 · 5"},
  {"rue":"Avenue de Paulhan","commune":"","cp":"","num":"105-103-89"},
  {"rue":"Rue de l'Aubépine","commune":"","cp":"","num":"37 · 43-71-81 · 91-91a-91b · 92-82 · 56-60-58-48 · 99-103-111-97 · 101-159-161 · 181-205-211-227 · 255-273-275-277-271 · 285-295-321 · 349-369-389 · 423-425-471"},
  {"rue":"Rue de la Clairette","commune":"","cp":"","num":"5-16-18 · 7-7b · 9-20-20b · 1 à 10 · 196-136"},
  {"rue":"Lotissement Clairette","commune":"","cp":"","num":"30-90"},
  {"rue":"Rue du Depot","commune":"","cp":"","num":"60-40-16 · 11-154"},
  {"rue":"Carnusse","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Grandeau","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Renfort","commune":"","cp":"","num":"610-621-727-705-797","inclure":false},
  {"rue":"Las Mouillas","commune":"","cp":"","num":"(sans n°)","inclure":false},
  {"rue":"Rue du Ballast","commune":"","cp":"","num":"398-384-368-358 · 332-330 · 322-322b-318-316 · 272-266-228-218 · 114-71-60-60b · 42-34-28-26"},
  {"rue":"Route de Saint Martin","commune":"","cp":"","num":"610-621-727-705-797 · 836-838-831-839-847-965"},
  {"rue":"La Pensière","commune":"","cp":"","num":"80"},
  {"rue":"Rue du Bousquet","commune":"","cp":"","num":"19-27-35 · 37-55 · 90-89 · 135-155-175-217 · 225-237-275-297"},
  {"rue":"Chemin de Gissas","commune":"","cp":"","num":"800 à 834"},
  {"rue":"Rue des Figuiers","commune":"","cp":"","num":"40-44-59-63-54 · 67-77-79-81-80 · 90-91-102 · 137-139-142 · 171-180 · 206-208-210-219 · 14-25-29"},
  {"rue":"Rue des Galets","commune":"","cp":"","num":"275-27-53-57 · 119-119b-423 · 127-135-112 · 80-72-52"},
  {"rue":"Rue du Siplet","commune":"","cp":"","num":"177-221-273-321-320 · 296-270-254-252"},
  {"rue":"Rue des Abeilles","commune":"","cp":"","num":"45-73-83"},
  {"rue":"Rue des Lavandes","commune":"","cp":"","num":"225-246b-246-400 · 212-200-178 · 148-146 · 43-37-41"},
  {"rue":"Clos du Siplet","commune":"","cp":"","num":"1 à 6"},
  {"rue":"REBUTS","commune":"","cp":"","num":"(non distribuables)","inclure":false}
]
```
# CLAUDE.md — Règles de travail du projet

App perso **mobile** pour suivre une tournée de facteur sur une carte (liste de voies réordonnable → tracé d'itinéraire → vue carte qui suit ma position). **Usage personnel, un seul écran principal.**

> La **spec produit** (le *quoi*) est dans `SPEC.md`. Lis-la et suis-la. Ce fichier-ci porte le *comment travailler*.

## Principes (impératifs)
- **Ne sur-ingénie pas.** C'est une app perso d'un écran, pas une plateforme. Choisis la solution la plus simple qui marche.
- **Code simple et lisible** avant d'être malin. Pas d'abstraction prématurée, pas de couche « au cas où ».
- **N'ajoute aucune dépendance** sans raison claire ; préfère le standard du web et le strict nécessaire.
- **Ne code pas hors périmètre.** Si une idée n'est pas dans `SPEC.md`, propose-la, ne l'implémente pas d'office.
- **Mobile uniquement** (portrait, tactile). Ne perds pas de temps sur le desktop.

## Méthode de travail
- **Avant de coder une étape, expose ton plan et attends ma validation.** Surtout pour tout choix d'architecture (framework, libs carte/routage, drag tactile, service worker).
- Avance par **jalons livrables et testables**, dans cet ordre : (1) liste + persistance + drag tactile ; (2) géocodage + tracé ORS ; (3) vue carte MapLibre + suivi ; (4) coordonnées GPS manuelles ; (5) PWA + hors-ligne.
- **Un commit par jalon**, message clair. Ne mélange pas plusieurs jalons dans un commit.
- **Ne commit pas automatiquement** sans que j'aie pu relire le jalon.
- Quand tu changes un choix d'archi déjà validé, **dis-le explicitement** et explique pourquoi.

## Avant chaque commit
- Lance le **lint** et le **build** ; ne commit pas si ça casse.
- Vérifie que rien de sensible n'est ajouté (clés, `.env`).
- `dev` : `npm run dev`
- `build` : `npm run build` (tsc --noEmit + vite build)
- `lint` : `npm run lint` (tsc --noEmit)

## Git & déploiement

### Branches
- `main` : code stable, toujours déployable.
- `jalon/X-nom` : une branche par jalon (ex. `jalon/1-liste`). On merge dans `main` uniquement après ta validation.
- Jamais de commit direct sur `main`.

### GitHub Pages
- Déploiement automatique via **GitHub Actions** sur chaque push dans `main`.
- Le workflow build Vite (`vite build`) et publie le dossier `dist/` sur la branche `gh-pages`.
- L'URL de preview est dans le README.

### Workflow par jalon
1. Créer la branche `jalon/X-nom` depuis `main`.
2. Coder + lint + build.
3. Ouvrir une **Pull Request** vers `main` avec un résumé de ce qui a changé.
4. Me partager le lien de la PR pour relecture.
5. **Merger la PR toi-même** (`gh pr merge --merge --delete-branch`) sans attendre ma validation explicite.
6. Me partager l'URL GitHub Pages pour test sur mobile.

### Secrets CI
- `VITE_MAPTILER_KEY` et `VITE_ORS_KEY` : à ajouter dans **Settings → Secrets → Actions** du repo GitHub.
- Le workflow les injecte au moment du build (`env:` dans le YAML).
- Ne jamais les mettre dans le code ou les logs.

## Secrets & clés API
- Clés **MapTiler** et **OpenRouteService** : lues depuis variables d'env / fichier de config local.
- **Jamais de clé commitée.** Vérifie le `.gitignore` (`.env*`, configs locales).
- Le `README` doit expliquer comment créer les clés gratuites et les configurer.

## Tests / validation
- La géolocalisation et le drag tactile **ne se testent que sur mobile réel en HTTPS** : déploie sur **GitHub Pages** dès le jalon 1 pour tester sur téléphone.
- À chaque jalon, donne-moi quoi tester concrètement sur le tél.

## Pièges connus (voir détails dans SPEC.md)
- **Drag tactile** : pas de HTML5 drag natif (cassé sur mobile). Empêche le scroll de se déclencher pendant le glissement.
- **Cap GPS** : `coords.heading` est `null` à l'arrêt → garder le dernier cap ; lisser pour éviter le tremblement.
- **ORS** : respecter la limite de waypoints par requête → découper et recoller ; gérer quotas/erreurs proprement.
- **Cache de tuiles hors-ligne** : rester dans les CGU MapTiler ; si bloquant, ne cacher que l'itinéraire + les coordonnées.
- **Données de voies** : transcription de photos, **non vérifiées** → tout doit rester éditable, ne rien coder en dur d'irréversible.

## Entretien de ce CLAUDE.md
- Quand tu repères une **règle durable utile** (convention qu'on adopte, commande de build/test, piège récurrent, correction que je te répète), **propose de l'ajouter ici** — ne l'ajoute pas sans mon accord.
- Quand une entrée devient **fausse ou obsolète** (commande qui a changé, choix d'archi abandonné, règle qui ne sert plus), **propose de la corriger ou de la retirer**.
- Formule la proposition en une ligne (« Proposition CLAUDE.md — Ajouter / Retirer : … ») et **attends ma validation** avant de modifier le fichier.

## Garde ce fichier court
Si une règle devient une longue procédure ou ne concerne qu'une partie du code, sors-la d'ici (rule path-scopée / doc dédiée). Vise < 200 lignes.
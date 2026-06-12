# LaPosteNav

Application web mobile (PWA) pour suivre une tournée de facteur : liste de voies réordonnables → tracé d'itinéraire → vue carte heading-up.

## Clés API requises

### MapTiler (carte vectorielle)
1. Créer un compte gratuit sur <https://cloud.maptiler.com>
2. Dans votre dashboard → **API Keys** → copier la clé par défaut

### OpenRouteService (géocodage + routage)
1. Créer un compte gratuit sur <https://openrouteservice.org>
2. **Dashboard → API Key** → générer une clé

### Configuration
```bash
cp .env.example .env
# éditer .env et renseigner les deux clés
```

Le fichier `.env` est ignoré par git — ne jamais commiter les clés.

## Développement

```bash
npm install
npm run dev      # serveur local http://localhost:5173/LaPosteNav/
```

## Déploiement & test mobile

**URL de l'app :** `https://<ton-username>.github.io/LaPosteNav/`

### Déploiement automatique (GitHub Actions)

Le workflow `.github/workflows/deploy.yml` se déclenche à chaque push sur `main` :
1. Build Vite avec les clés API injectées depuis les secrets
2. Publication du dossier `dist/` sur la branche `gh-pages`

### Première mise en place

1. Créer le repo GitHub nommé **`LaPosteNav`**
2. Pousser ce code sur `main`
3. **Settings → Pages → Source** : choisir `Deploy from a branch` → branche `gh-pages` / `/ (root)`
4. Ajouter les deux secrets dans **Settings → Secrets and variables → Actions** :
   - `VITE_MAPTILER_KEY` — clé MapTiler
   - `VITE_ORS_KEY` — clé OpenRouteService
5. Ré-exécuter le workflow (ou pousser un commit sur `main`)
6. L'URL est disponible dans **Settings → Pages**

> Si le nom du repo diffère de `LaPosteNav`, mettre à jour `base` dans `vite.config.ts`.

### Build local

```bash
npm run build    # génère dist/
```

## Lint / vérification TS

```bash
npm run lint     # tsc --noEmit
```

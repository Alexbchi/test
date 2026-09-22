# Recherche ChatGPT

Cette application transforme une question en une synthèse produite par ChatGPT et conserve les réponses dans un historique, avec les plus récentes en premier.

## Utiliser la page avec une API

1. Utilisez Node.js 18 ou une version plus récente.
2. Créez une clé dans votre compte sur la plateforme API OpenAI, puis définissez-la côté serveur : `export OPENAI_API_KEY="votre-cle"`.
3. (Facultatif) Choisissez le modèle : `export OPENAI_MODEL="gpt-4.1-mini"`.
4. Déployez ce dépôt sur Vercel (le fichier `api/chatgpt.js` est automatiquement publié à l’adresse `/api/chatgpt`) et configurez-y les variables ci-dessus.
5. L’URL de l’API est déjà renseignée dans `index.html` et pointe vers le même domaine que la page :

   ```html
   <meta name="chatgpt-api-endpoint" content="/api/chatgpt" />
   ```

   Après le déploiement, l’endpoint complet est donc `https://votre-projet.vercel.app/api/chatgpt`. Pour utiliser une API hébergée sur un autre domaine, remplacez cette valeur par son URL HTTPS complète. Vous pouvez aussi la remplacer ponctuellement avec `?api=https://api.example.com/api/chatgpt`.

La clé API reste côté serveur : le navigateur envoie uniquement la question à `/api/chatgpt`. Ne placez jamais cette clé dans `index.html`, une variable `PUBLIC_*`, ou le code JavaScript livré au navigateur.

> Une page HTML ne peut pas elle-même exécuter une API ou conserver une clé OpenAI secrète. Elle peut en revanche appeler une API déjà déployée. Si l’URL de l’API renvoie une page HTML, l’interface indique comment renseigner l’endpoint, au lieu d’afficher l’erreur technique « Unexpected token '<' ». L’application Node envoie systématiquement du JSON pour les routes `/api/*`, y compris lors d’une erreur amont.

## API et coût

L’API OpenAI n’est pas une API publique gratuite : l’offre gratuite de ChatGPT et la facturation de la plateforme API sont distinctes. Une clé API est personnelle, doit rester secrète, et son utilisation peut nécessiter une facturation ou des crédits sur la plateforme API. Cette application ne tente donc pas d’appeler ChatGPT depuis le navigateur ni d’exposer une clé « publique ».

Pour limiter le coût, choisissez un modèle économique compatible avec votre compte, par exemple :

```bash
export OPENAI_MODEL="gpt-4.1-mini"
```

Avant le déploiement, configurez `OPENAI_API_KEY` et, si nécessaire, `OPENAI_MODEL` dans les secrets ou les variables d’environnement du service qui exécute `node server.js`. Un hébergement strictement statique ne peut pas fournir cette API de façon sûre.

# Recherche ChatGPT

Cette application transforme une question en une synthèse produite par ChatGPT et conserve les réponses dans un historique, avec les plus récentes en premier.

## Démarrer l’application

1. Utilisez Node.js 18 ou une version plus récente.
2. Définissez votre clé API OpenAI : `export OPENAI_API_KEY="votre-cle"`.
3. (Facultatif) Choisissez le modèle : `export OPENAI_MODEL="gpt-4.1-mini"`.
4. Lancez `npm start`, puis ouvrez `http://localhost:3000`.

La clé API reste côté serveur : le navigateur envoie uniquement la question à `/api/chatgpt`.

> N’ouvrez pas `index.html` directement et ne déployez pas seulement ce fichier sur un hébergeur statique : la recherche nécessite le serveur Node.js, qui expose `/api/chatgpt`. Si cette URL renvoie une page HTML, l’interface affiche maintenant une explication au lieu de l’erreur technique « Unexpected token '<' ».

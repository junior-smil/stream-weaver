# Stream Weaver

un site avec ces condition

Il faut préciser que les liens intégrés dans la base de données devront de préférence être des flux adaptatifs (HLS/m3u8) ou que l'application utilisera un lecteur compatible (ex: Video.js avec le plugin videojs-contrib-hls ou HLS.js) capable de gérer les pistes de qualité si le serveur distant les fournit.

. Dans la Base de Données (Stockage)

Dans ta table video_sources (ou directement liée à tes épisodes/films), tu ne stockes pas la vidéo, mais l'URL du flux ou le code d'intégration.

Si ton hébergeur externe te donne un lien direct vers un fichier ou un flux HLS ([https://exemple.com/stream/movie/index.m3u8](https://exemple.com/stream/movie/index.m3u8)), tu le stockes dans une colonne manifest_url.

Si ton hébergeur te donne un code d'intégration complet (une balise <iframe>), tu peux stocker ce code dans une colonne embed_code.

2. Dans le Panneau d'Administration (Back-Office)

Quand tu ajoutes un film ou un épisode de série via ton interface d'admin :

Tu remplis les infos (Titre, Synopsis via l'API TMDB).

Tu as un champ de texte où tu colles l'URL du flux externe ou le code <iframe> fourni par ton fournisseur de streaming.

Le système enregistre cette liaison dans la base de données.

3. Sur la Page de Lecture (Front-End)

C'est là que la magie opère pour l'utilisateur :

Quand l'utilisateur clique sur "Regarder", la page de lecture récupère l'ID du film/épisode.

Le backend interroge la base de données et renvoie l'URL du flux ou l'iframe.

Le Lecteur Vidéo (Player) s'initialise sur la page :

Option A (Si c'est un flux direct HLS/MP4) : Tu utilises un player puissant comme Video.js. Tu lui passes l'URL du flux externe dans ses options. Le player gère automatiquement la barre de progression, le plein écran, et si le flux est multi-qualité, il affichera le menu de sélection de qualité.

Option B (Si c'est une balise <iframe> d'un hébergeur tiers) : Ton code affiche simplement l'iframe dans un conteneur responsive sur ta page. (Attention : dans ce cas, c'est l'interface de l'hébergeur tiers qui gère le lecteur et les éventuelles qualités).


Pour le lecteur vidéo, utilise Video.js configuré pour supporter la lecture de flux HLS (.m3u8) afin de permettre la gestion des différentes résolutions si le flux le propose. Côté réseau/infrastructure, l'application ne doit comporter aucun blocage d'adresse IP ni restriction liée à l'usage d'un VPN par les utilisateurs.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f880c7e0-52aa-47c7-a51a-1a55b92a7efe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

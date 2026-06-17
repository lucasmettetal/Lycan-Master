# Lycan Master

Application web de gestion de parties Loup-Garou en temps réel.
MJ sur écran principal, joueurs sur mobile. Future app Android via Capacitor.

## Architecture

| Composant | Technologie | Rôle |
|---|---|---|
| Frontend | React / Vite | Interface MJ + écrans joueurs |
| Backend | Node / Express / Socket.io | Logique temps réel, actions privées, persistance |
| Future app mobile | Capacitor | Encapsule le frontend — appelle le backend en ligne |

Le backend reste **toujours séparé**. L'app mobile n'embarque pas le serveur Node.

---

## Développement local

### Prérequis

```bash
# Dépendances frontend
npm install

# Dépendances backend
cd server && npm install
```

### Configuration

Copier les fichiers d'exemple et adapter :

```bash
cp .env.example .env.local
cp server/.env.example server/.env.local
```

**`.env.local`** (frontend) :
```
VITE_API_URL=http://localhost:3001
```

**`server/.env.local`** (backend) :
```
PORT=3001
FRONTEND_URL=http://localhost:5173
DATA_FILE_PATH=./games.json
```

### Lancer

```bash
# Tout en une commande
npm start

# Ou séparément :
npm run start:server   # backend  → http://localhost:3001
npm run start:client   # frontend → http://localhost:5173
```

---

## Tester sur téléphone (même réseau Wi-Fi)

`localhost` sur un téléphone désigne le téléphone lui-même, pas le PC.
Il faut utiliser l'**IPv4 Wi-Fi** du PC.

### 1. Trouver l'IP Wi-Fi

**Windows** :
```
ipconfig
```
Section "Carte réseau sans fil Wi-Fi" → **Adresse IPv4** (ex: `192.168.1.23`).
Ignorer `192.168.56.x` (VirtualBox) et `172.x.x.x` (Hyper-V).

**Linux/macOS** :
```bash
ip a | grep "inet " | grep -v 127
```

### 2. Adapter les `.env.local`

**`.env.local`** :
```
VITE_API_URL=http://192.168.1.23:3001
```

**`server/.env.local`** :
```
FRONTEND_URL=http://192.168.1.23:5173
```

### 3. Lancer et ouvrir

```bash
npm start
```

Téléphone (même Wi-Fi) : `http://192.168.1.23:5173`
Vérifier le backend : `http://192.168.1.23:3001` → `{ "status": "ok" }`

### Problèmes courants

| Symptôme | Cause | Solution |
|---|---|---|
| Timeout depuis le téléphone | Pare-feu Windows bloque Node.js | Autoriser Node.js dans le Pare-feu Windows (ports 3001 et 5173) |
| Page blanche / socket KO | `VITE_API_URL` pointe sur `localhost` | Corriger `.env.local` et relancer `npm run start:client` |
| CORS error | `FRONTEND_URL` incorrect | Même IP dans `server/.env.local` |
| IP incorrecte | Carte virtuelle | Prendre uniquement la carte Wi-Fi |

---

## Déploiement en production

### Backend (Railway, Render, Fly.io…)

Variables d'environnement à configurer dans le dashboard de la plateforme :

```
PORT=3001
FRONTEND_URL=https://ton-frontend.vercel.app
DATA_FILE_PATH=./games.json
```

Pour la persistance, pointer `DATA_FILE_PATH` vers un volume persistant (Railway Volume, Render Disk, etc.).

### Frontend (Vercel, Netlify…)

Variable d'environnement à configurer dans le dashboard :

```
VITE_API_URL=https://ton-backend.railway.app
```

Commande de build : `npm run build` — output dans `dist/`.

---

## Future app mobile (Capacitor)

Quand le frontend sera prêt à être packagé :

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
npx cap add android
npm run build
npx cap sync
npx cap open android
```

L'app mobile appellera le backend en ligne via `VITE_API_URL` compilé dans le bundle.
Elle n'embarque pas le serveur Node.

---

## Tests

```bash
npm run test:v4   # scénario complet (41 assertions)
```

Scénario couvert : reconnexion token, stabilité socketId, Cupidon, Voyante, Sorcière,
cascade Chasseur (mort → flèche → mort de chagrin), vote interactif par `day_vote`.

---

## Structure du projet

```
/
├── src/                        # Frontend React/Vite
│   └── app/
│       ├── socket.ts           # Singleton socket.io (lit VITE_API_URL)
│       ├── context/GameContext.tsx
│       ├── components/game/
│       │   ├── NightWizard.tsx # Assistant nuit MJ
│       │   └── PlayerActionCard.tsx
│       └── App.tsx
├── server/                     # Backend Node/Express
│   ├── index.js                # Serveur + handlers socket.io
│   ├── gameLogic.js
│   ├── gameStore.js            # Persistance JSON
│   ├── playerActions.js        # Actions privées joueurs
│   ├── roles.js
│   └── test-v4.js             # Tests d'intégration
├── .env.local                  # (gitignore) config dev frontend
├── .env.production             # config prod frontend (placeholder)
├── .env.example                # template à copier
├── server/.env.local           # (gitignore) config dev backend
├── server/.env.production      # config prod backend (placeholder)
└── server/.env.example         # template à copier
```

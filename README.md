# PronosAI - Application de Pronostics Sportifs

Application web moderne pour l'analyse de pronostics sportifs avec intelligence artificielle.

## ✨ Fonctionnalités

- **Interface moderne** avec animations fluides et design premium
- **Sélecteur de périodes** : Match du jour, demain, semaine
- **Saisie de côte** avec validation en temps réel
- **Sélection de matchs** avec interface défilante
- **Analyse IA** simulée (prêt pour l'intégration OpenAI)
- **Animations de défilement** et effets visuels dynamiques
- **Design responsive** pour mobile et desktop

## 🎨 Design

- **Palette** : Noir profond, Orange vif, Bleu électrique
- **Typographie** : Inter (moderne et lisible)
- **Animations** : Anime.js, Splide.js
- **Effets** : Particules, glow, hover dynamiques

## 🚀 Déploiement sur Render.com

### 1. Préparation du projet

Assurez-vous d'avoir les fichiers suivants :
- `index.html` - Interface principale
- `main.js` - Logique client et animations
- `server.js` - Serveur Express
- `package.json` - Dépendances
- `.env.example` - Exemple de configuration

### 2. Configuration sur Render.com

1. **Créer un nouveau Web Service** sur Render.com
2. **Connecter votre dépôt Git** ou uploader les fichiers
3. **Configurer les paramètres** :

```
Name: pronosai-frontend
Environment: Node
Build Command: npm install
Start Command: node server.js
Root Directory: ./
```

4. **Variables d'environnement** :
   - `PORT`: 10000 (ou laisser Render assigner automatiquement)
   - `OPENAI_API_KEY`: Votre clé API OpenAI (obtenue sur platform.openai.com)
   - `NODE_ENV`: production

### 3. Configuration OpenAI

1. Créez un compte sur [OpenAI Platform](https://platform.openai.com)
2. Générez une clé API dans la section API Keys
3. Ajoutez la clé dans les variables d'environnement de Render
4. La clé sera automatiquement utilisée par l'application

### 4. Déploiement

- Cliquez sur **Deploy** sur Render.com
- Attendez que le build et le déploiement se terminent
- L'application sera accessible via l'URL fournie par Render

## 🛠️ Installation locale

### Prérequis

- Node.js >= 16.0.0
- npm ou yarn

### Étapes

1. **Cloner le projet** :
```bash
git clone <votre-repo>
cd pronosai-frontend
```

2. **Installer les dépendances** :
```bash
npm install
```

3. **Configurer l'environnement** :
```bash
cp .env.example .env
# Éditez .env avec vos configurations
```

4. **Démarrer le serveur** :
```bash
npm start
# ou pour le développement:
npm run dev
```

5. **Accéder à l'application** :
```
http://localhost:10000
```

## 📁 Structure du projet

```
pronosai-frontend/
├── index.html          # Interface principale
├── main.js            # Logique client et animations
├── server.js          # Serveur Express
├── package.json       # Dépendances
├── .env.example       # Exemple de configuration
├── design.md          # Documentation du design
├── interaction.md     # Documentation des interactions
└── README.md          # Ce fichier
```

## 🔧 Personnalisation

### Modification des matchs

Les matchs sont définis dans `main.js` dans l'objet `mockMatches`. Vous pouvez :
- Ajouter de nouveaux matchs
- Modifier les équipes et cotes
- Ajouter de nouvelles périodes

### Intégration OpenAI réelle

Pour intégrer véritablement l'API OpenAI, modifiez la fonction `/api/analyze` dans `server.js` :

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utilisez l'API pour analyser les matchs
const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
        { role: "system", content: "Tu es un expert en pronostics sportifs..." },
        { role: "user", content: `Analyse ces matchs: ${JSON.stringify(matches)}` }
    ]
});
```

### Couleurs et design

Les couleurs sont définies dans le CSS de `index.html` et `main.js` :
- Primaire : `#ff6b35` (Orange)
- Secondaire : `#00d4ff` (Bleu électrique)
- Fond : `#0a0a0a` (Noir profond)

## 📱 Responsive

L'application est entièrement responsive :
- **Desktop** : Grilles de 3 colonnes
- **Tablette** : Grilles de 2 colonnes
- **Mobile** : Grille de 1 colonne avec espacement adapté

## 🚀 Performance

- **Animations optimisées** : 60fps avec Anime.js
- **Chargement progressif** : Images et contenus lazy loadés
- **Bundle minimal** : Utilisation de CDN pour les bibliothèques

## 🔒 Sécurité

- Variables d'environnement pour les clés API
- Validation des entrées côté client et serveur
- CORS configuré pour la production

## 📊 Monitoring

Vous pouvez surveiller l'application via :
- Logs Render.com
- Endpoint `/api/config` pour vérifier la configuration
- Console du navigateur pour les erreurs client

## 🆘 Support

Pour toute question ou problème :
1. Vérifiez les logs Render.com
2. Testez en local avec `npm run dev`
3. Vérifiez la configuration des variables d'environnement

## 📝 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

**PronosAI** - Analysez vos pronostics avec intelligence 🤖⚽
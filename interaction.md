# Interactions du Site de Pronostics Sportifs

## Structure Interactive Principale

### 1. Sélecteur de Périodes (Rouleau Défilant)
**Composant**: Barre de défilement horizontale avec snap
**Options**:
- "Match du Jour" (aujourd'hui)
- "Match de Demain" (J+1)
- "Match dans 2 Jours" (J+2)
- "Match dans 3 Jours" (J+3)
- "Match de la Semaine" (7 prochains jours)

**Interaction**:
- Défilement horizontal fluide avec momentum
- Snap automatique sur l'option la plus proche
- Animation visuelle de la sélection (glow orange)
- Mise à jour en temps réel des matchs affichés

### 2. Zone de Saisie de Cote
**Composant**: Input numérique avec validation
**Interaction**:
- Format: Nombre décimal (ex: 1.85, 2.50)
- Validation en temps réel
- Placeholder dynamique selon la sélection
- Bordure animée au focus (bleu électrique)

### 3. Cards de Matchs (Interface Défilante)
**Composant**: Grille horizontale scrollable de cards
**Contenu par card**:
- Équipes (domicile vs extérieur)
- Date et heure du match
- Cotes disponibles
- Statut du marché

**Interaction**:
- Défilement horizontal smooth
- Animation d'entrée staggered
- Hover: Élévation et glow subtil
- Click: Sélection du match (bordure orange)

### 4. Barre de Chargement Animée
**Composant**: Barre de progression avec effets visuels
**États**:
- Inactive: Cachée
- Chargement: Visible avec animation
- Terminé: Disparition fade out

**Animation**:
- Dégradé animé (orange → bleu)
- Pulse subtil
- Texte de progression: "Analyse en cours..."
- Durée typique: 3-5 secondes

### 5. Bouton Analyser
**Composant**: Bouton principal CTA
**États**:
- Par défaut: Orange avec texte "Analyser"
- Hover: Élévation et glow
- Actif: Pressed effect
- Loading: Désactivé avec spinner

**Action au click**:
1. Validation des inputs
2. Affichage de la barre de chargement
3. Envoi des données à l'API OpenAI
4. Animation pendant l'analyse
5. Affichage des résultats

### 6. Zone de Résultats
**Composant**: Section révélable après analyse
**Contenu**:
- Pronostics combinés
- Analyse de fiabilité
- Recommandations
- Détails des matchs sélectionnés

**Animation**:
- Slide down depuis le haut
- Fade in avec stagger pour chaque élément
- Bordure de séparation animée

## Flux d'Interaction Complet

```
Utilisateur arrive → Sélectionne période → Saisit cote → Sélectionne matchs → Clique Analyser → Barre de chargement → Résultats affichés
```

## Comportements Spéciaux

### Validation
- Cote minimum: 1.10
- Cote maximum: 10.00
- Sélection minimum: 1 match
- Message d'erreur avec animation shake

### Responsive
- Mobile: Cards empilées verticalement
- Desktop: Grille horizontale
- Adaptation fluide des animations

### Feedback Visuel
- Tooltips sur hover
- États de chargement clairs
- Animations de succès/erreur
- Transitions fluides entre les états
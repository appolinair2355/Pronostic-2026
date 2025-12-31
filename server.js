const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes API pour l'analyse OpenAI
app.post('/api/analyze', async (req, res) => {
    try {
        const { cote, matches, period, automatic = false } = req.body;
        
        // Ici vous pouvez intégrer l'API OpenAI
        // Exemple avec OpenAI:
        // const OpenAI = require('openai');
        // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        // Pour l'instant, retourne une réponse simulée
        // Dans une vraie implémentation, OpenAI analyserait les matchs
        // pour trouver la meilleure combinaison atteignant la côte souhaitée
        
        const targetCote = parseFloat(cote);
        const availableMatches = matches || [];
        
        // Simuler l'analyse pour atteindre la côte cible
        // En vrai, OpenAI suggérerait quels matchs prendre pour atteindre cette côte
        let selectedMatchesForAnalysis = [];
        let currentTotalCote = 1.0;
        
        // Stratégie simplifiée: sélectionner des matchs jusqu'à atteindre la côte
        for (const match of availableMatches) {
            if (currentTotalCote * match.cote <= targetCote * 1.2) {
                selectedMatchesForAnalysis.push(match);
                currentTotalCote *= match.cote;
            }
            if (currentTotalCote >= targetCote * 0.9) break;
        }
        
        // Ajuster la côte finale pour qu'elle soit proche de la cible
        const finalCote = Math.min(currentTotalCote, targetCote * 1.1);
        
        const mockAnalysis = {
            success: true,
            data: {
                type: automatic ? 'Analyse Automatique' : 'Combiné Multiple',
                targetCote: targetCote,
                actualCote: finalCote.toFixed(2),
                matchCount: selectedMatchesForAnalysis.length,
                confiance: Math.min(75 + selectedMatchesForAnalysis.length * 8, 92),
                fiabilite: Math.min(70 + selectedMatchesForAnalysis.length * 6, 88),
                tendance: Math.min(65 + selectedMatchesForAnalysis.length * 7, 85),
                recommendation: `Analyse automatique pour atteindre une côte de ${targetCote}. ${selectedMatchesForAnalysis.length} matchs sélectionnés générant une côte de ${finalCote.toFixed(2)}. Recommandation: mise adaptée selon votre bankroll.`,
                analysis: `Analyse basée sur les statistiques récentes et la forme des équipes pour atteindre votre côte cible de ${targetCote}. Les matchs sélectionnés offrent un bon équilibre risque/rendement.`,
                matches: selectedMatchesForAnalysis,
                period: period,
                automatic: automatic
            }
        };
        
        res.json(mockAnalysis);
        
    } catch (error) {
        console.error('Erreur lors de l\'analyse:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'analyse des pronostics'
        });
    }
});

// Route pour vérifier la configuration OpenAI
app.get('/api/config', (req, res) => {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    res.json({
        hasOpenAIKey,
        port: PORT,
        env: process.env.NODE_ENV || 'development'
    });
});

// Route principale - sert le fichier HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion des 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔑 Configuration OpenAI: ${process.env.OPENAI_API_KEY ? 'OK' : 'Non configurée'}`);
});

module.exports = app;
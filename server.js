// =============================================================================
// PRONOSAI PRO - SERVEUR EXPRESS + OPENAI
// Port: 10000 (configuré pour Render.com)
// =============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000, // 60 secondes max par requête
    maxRetries: 2,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =============================================================================
// 📍 ROUTE PRINCIPALE : Génération de combiné optimisé
// =============================================================================
app.post('/api/generate-combine', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const config = req.body;
        
        // VALIDATION
        if (!validateConfig(config)) {
            return res.status(400).json({
                success: false,
                error: 'Configuration invalide',
                details: getValidationErrors(config)
            });
        }

        // ÉTAPE 1 : Récupérer les matchs via OpenAI
        updateProgress(10, 'Récupération des matchs...');
        const matchesWithData = await fetchMatchesFromOpenAI(config);
        
        // ÉTAPE 2 : Pour chaque match, obtenir 2 éléments sûrs
        updateProgress(30, 'Analyse des éléments sûrs par match...');
        const matchesWithSafeElements = await Promise.all(
            matchesWithData.slice(0, config.maxMatches * 2).map(match => 
                getSafeElementsForMatch(match, config)
            )
        );

        // ÉTAPE 3 : Générer toutes les combinaisons valides
        updateProgress(50, 'Génération des combinaisons possibles...');
        const validCombinations = generateValidCombinations(
            matchesWithSafeElements,
            config
        );

        if (validCombinations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aucune combinaison valide trouvée',
                suggestion: 'Essayez une côte cible plus basse ou moins de contraintes'
            });
        }

        // ÉTAPE 4 : Trouver la meilleure combinaison
        updateProgress(70, 'Recherche du combiné optimal...');
        const bestCombination = findBestCombination(
            validCombinations,
            config.targetOdd
        );

        // ÉTAPE 5 : Enrichir avec explications IA
        updateProgress(85, 'Génération de l\'analyse détaillée...');
        const enrichedResult = await enrichWithExplanations(bestCombination);

        updateProgress(100, 'Analyse terminée !');
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        res.json({
            success: true,
            data: enrichedResult,
            metadata: {
                duration_seconds: duration,
                matches_analyzed: matchesWithData.length,
                combinations_tested: validCombinations.length,
                confidence_avg: bestCombination.confidence.toFixed(2)
            }
        });

    } catch (error) {
        console.error('❌ Erreur critique:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la génération du combiné',
            details: error.message
        });
    }
});

// =============================================================================
// 🔧 VALIDATION ET LOGIQUE MÉTIER
// =============================================================================

function validateConfig(config) {
    const rules = {
        targetOdd: v => v >= 2.0 && v <= 100.0,
        maxMatches: v => v >= 2 && v <= 8,
        period: v => ['today', 'tomorrow', 'custom'].includes(v),
        daysAhead: v => !v || (v >= 0 && v <= 7),
        markets: v => Array.isArray(v) && v.length >= 2
    };

    return Object.keys(rules).every(key => {
        if (config[key] === undefined && key !== 'daysAhead') return false;
        return rules[key](config[key]);
    });
}

function getValidationErrors(config) {
    const errors = [];
    if (!(config.targetOdd >= 2.0 && config.targetOdd <= 100.0)) 
        errors.push('Côte doit être entre 2.0 et 100.0');
    if (!(config.maxMatches >= 2 && config.maxMatches <= 8)) 
        errors.push('Nombre de matchs entre 2 et 8');
    if (!Array.isArray(config.markets) || config.markets.length < 2)
        errors.push('Au moins 2 marchés requis');
    return errors;
}

function updateProgress(percentage, message) {
    console.log(`📊 Progression: ${percentage}% - ${message}`);
}

// =============================================================================
// 🔍 RÉCUPÉRATION DES MATCHS VIA OPENAI
// =============================================================================

async function fetchMatchesFromOpenAI(config) {
    const periodText = {
        today: "aujourd'hui (prochaines 24h)",
        tomorrow: "demain (24h-48h)",
        custom: `dans les ${config.daysAhead} prochains jours`
    };

    const prompt = `
Tu es un bookmaker professionnel avec accès aux données en temps réel.
Donne-moi les 15 matchs de football les plus importants ${periodText[config.period]}.

FUSEAU : Heure du Bénin (Africa/Porto-Novo, GMT+1)

POUR CHAQUE MATCH, fournis EXACTEMENT :
🕒 Heure (HH:MM)
⚽ Équipe1 vs Équipe2
🏆 Cotes: 1.XX / 3.XX / 4.XX
🎯 Handicap: H(-0.5) @1.XX
⚽ Total buts: Over/Under 2.5 @1.XX
🔁 BTTS: Oui/Non @1.XX
📐 Corners: +8.5 @1.XX | H1+4.5 @1.XX
🎯 Tirs cadrés: +7.5 @1.90 | H2+3.5 @1.XX
📊 Forme récente: H1 (W-D-L) | H2 (W-D-L)

FORMAT STRICT :
━━━━━━━━━━━━━━━━━━━━━━━
🕒 14:30 | Paris SG vs Marseille
🏆 Cotes: 1.85 / 3.40 / 4.20
🎯 Handicap: H(-0.5) @1.95
⚽ Total: Over 2.5 @1.80
🔁 BTTS: Oui @1.70
📐 Corners: +8.5 @1.85
🎯 Tirs: +7.5 @1.90 | H2+3.5 @1.75
📊 Forme: H1 (W-D-W) | H2 (L-W-L)
━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL : Réponds UNIQUEMENT en français, avec des cotes réalistes.
`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
            { role: "system", content: "Tu es un bookmaker professionnel avec les données en temps réel." },
            { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2500,
    });

    return parseMatchesResponse(completion.choices[0].message.content);
}

function parseMatchesResponse(content) {
    const matches = [];
    const blocks = content.split('━━━━━━━━━━━━━━━━━━━━━━━').filter(b => b.trim());
    
    for (const block of blocks) {
        try {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            const match = { id: Math.random().toString(36).substr(2, 9) };
            
            for (const line of lines) {
                if (line.startsWith('🕒')) {
                    const parts = line.split(' | ');
                    match.time = parts[0].replace('🕒 ', '');
                    const teams = parts[1].split(' vs ');
                    match.homeTeam = teams[0].trim();
                    match.awayTeam = teams[1].trim();
                    match.teams = `${match.homeTeam} vs ${match.awayTeam}`;
                }
                if (line.startsWith('🏆 Cotes:')) {
                    const odds = line.match(/(\d+\.\d+)/g);
                    match.odds = { home: parseFloat(odds[0]), draw: parseFloat(odds[1]), away: parseFloat(odds[2]) };
                }
                if (line.includes('Handicap:')) {
                    const handicap = line.match(/H\([-+]?\d+\.\d+\) @(\d+\.\d+)/);
                    if (handicap) match.handicap = { line: handicap[0].split(' ')[0], odds: parseFloat(handicap[1]) };
                }
                if (line.includes('Total:')) {
                    const total = line.match(/(Over|Under) (\d+\.\d+) @(\d+\.\d+)/);
                    if (total) match.totalGoals = { type: total[1], line: parseFloat(total[2]), odds: parseFloat(total[3]) };
                }
                if (line.includes('BTTS:')) {
                    const btts = line.match(/(Oui|Non) @(\d+\.\d+)/);
                    if (btts) match.btts = { value: btts[1], odds: parseFloat(btts[2]) };
                }
                if (line.includes('Corners:')) {
                    const corners = line.match(/\+(\d+\.\d+) @(\d+\.\d+)/);
                    if (corners) match.corners = { line: parseFloat(corners[1]), odds: parseFloat(corners[2]) };
                }
                if (line.includes('Tirs:')) {
                    const shots = line.match(/\+(\d+\.\d+) @(\d+\.\d+)/g);
                    if (shots) {
                        match.shots = shots.map(s => {
                            const m = s.match(/\+(\d+\.\d+) @(\d+\.\d+)/);
                            return { line: parseFloat(m[1]), odds: parseFloat(m[2]) };
                        });
                    }
                }
            }
            
            if (match.teams) matches.push(match);
        } catch (e) {
            console.warn('Erreur parsing bloc:', e);
        }
    }
    
    return matches.slice(0, 15);
}

// =============================================================================
// 🎯 ANALYSE DES ÉLÉMENTS SÛRS PAR MATCH
// =============================================================================

async function getSafeElementsForMatch(match, config) {
    const prompt = `
Match: ${match.teams} (${match.time} Bénin)

Parmi ces marchés: ${config.markets.join(', ')},
choisis EXACTEMENT 2 éléments avec la PLUS HAUTE probabilité (>70%).

RÈGLES À RESPECTER :
1. Ne JAMAIS combiner "victoire" et "tirs cadrés" sur le même match
2. Pour "tirs cadrés", ne proposer qu'UN SEUL choix par match
3. Les cotes doivent être réalistes (1.50 à 2.50)
4. Justifier chaque choix en 1 phrase

FORMAT STRICT :
━━━━━━━━━━━━━━━━━━━━━━━
⚽ ${match.teams}
🎯 Élément 1: [type] - [valeur] - Côte X.XX - [explication]
🎯 Élément 2: [type] - [valeur] - Côte X.XX - [explication]
🧠 Confiance: XX%
━━━━━━━━━━━━━━━━━━━━━━━
`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
            { role: "system", content: "Tu es un analyste sportif ultra-précis, tu ne prends que les paris sûrs (>70%)." },
            { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 600,
    });

    const elements = parseSafeElements(completion.choices[0].message.content);
    return { ...match, elements };
}

function parseSafeElements(content) {
    const elements = [];
    const lines = content.split('\n').filter(l => l.includes('Élément'));
    
    for (const line of lines) {
        const match = line.match(/Élément \d+: (\w+) - (.+) - Côte (\d+\.\d+) - (.+)/);
        if (match) {
            elements.push({
                type: match[1],
                value: match[2],
                odds: parseFloat(match[3]),
                explanation: match[4],
                confidence: 75 // Valeur par défaut, sera ajustée
            });
        }
    }
    
    const confidenceMatch = content.match(/Confiance: (\d+)%/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
    
    return elements.slice(0, 2).map(e => ({ ...e, confidence }));
}

// =============================================================================
// 🧮 GÉNÉRATION DES COMBINAISONS VALIDES
// =============================================================================

function generateValidCombinations(matches, config) {
    const combinations = [];
    
    function backtrack(index, currentCombo, currentOdds, usedTypes) {
        // Condition d'arrêt : cote valide trouvée
        if (currentCombo.length >= 2 && 
            currentOdds >= config.targetOdd * 0.4 && 
            currentOdds <= config.targetOdd * 2.5) {
            combinations.push({
                matches: [...currentCombo],
                odds: currentOdds,
                confidence: calculateAverageConfidence(currentCombo),
                typesUsed: new Set([...usedTypes])
            });
        }
        
        if (index >= matches.length || currentCombo.length >= config.maxMatches) {
            return;
        }
        
        // Essayer d'ajouter ce match avec chaque élément
        for (const element of matches[index].elements) {
            if (isValidCombination(currentCombo, matches[index], element, usedTypes)) {
                currentCombo.push({ match: matches[index], element });
                backtrack(index + 1, currentCombo, currentOdds * element.odds, [...usedTypes, element.type]);
                currentCombo.pop();
            }
        }
        
        // Sauter ce match
        backtrack(index + 1, currentCombo, currentOdds, usedTypes);
    }
    
    backtrack(0, [], 1.0, []);
    return combinations;
}

function isValidCombination(existingCombo, newMatch, newElement, usedTypes) {
    // CONTRAINTE 1 : Pas de victoire + tirs_cadres sur même match
    if (newElement.type === 'tirs_cadres' || newElement.type === 'victoire') {
        const conflictType = newElement.type === 'tirs_cadres' ? 'victoire' : 'tirs_cadres';
        for (const item of existingCombo) {
            if (item.match.id === newMatch.id && item.element.type === conflictType) {
                return false;
            }
        }
    }
    
    // CONTRAINTE 2 : Max 8 matchs
    if (existingCombo.length >= 7) return false;
    
    // CONTRAINTE 3 : Diversification (au moins 2 types différents)
    const futureTypes = new Set([...usedTypes, newElement.type]);
    if (futureTypes.size < 2 && existingCombo.length > 0) return false;
    
    return true;
}

function calculateAverageConfidence(combo) {
    if (!combo.length) return 0;
    const sum = combo.reduce((acc, item) => acc + (item.element.confidence || 70), 0);
    return sum / combo.length;
}

function findBestCombination(combinations, targetOdd) {
    if (!combinations.length) return null;
    
    return combinations.reduce((best, current) => {
        if (!best) return current;
        
        const currentDiff = Math.abs(current.odds - targetOdd);
        const bestDiff = Math.abs(best.odds - targetOdd);
        
        // Priorité : différence de cote, puis confiance
        if (currentDiff < bestDiff || 
           (currentDiff === bestDiff && current.confidence > best.confidence)) {
            return current;
        }
        return best;
    });
}

// =============================================================================
// 📝 ENRICHISSEMENT AVEC EXPLICATIONS IA
// =============================================================================

async function enrichWithExplanations(combination) {
    if (!combination) return null;
    
    const matchNames = combination.matches.map(m => m.match.teams).join(', ');
    
    const prompt = `
Analyse ce combiné de paris et explique pourquoi il est solide :

Matchs: ${matchNames}
Cote totale: ${combination.odds.toFixed(2)}
Confiance moyenne: ${combination.confidence.toFixed(0)}%

Donne :
1. Analyse du risque global (2-3 phrases)
2. Point fort du combiné
3. Point d'attention
4. Recommandation de mise (ex: "Mise 2% de bankroll")
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Tu es un conseiller en paris sportifs professionnel." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 400,
        });
        
        combination.explanation = completion.choices[0].message.content;
    } catch (error) {
        combination.explanation = "Analyse non disponible pour ce combiné.";
    }
    
    return combination;
}

// =============================================================================
// 📍 ROUTES SUPPLÉMENTAIRES
// =============================================================================

app.get('/api/config', (req, res) => {
    res.json({
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo'],
        limits: { maxMatches: 8, minOdd: 2.0, maxOdd: 100.0 }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Démarrage du serveur sur le port 10000
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   🚀 PRONOSAI PRO - IA ÉDITION           ║
║   📍 http://localhost:${PORT}              ║
║   🔑 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configurée' : '❌ Clé manquante'} ║
║   ⚽ Port: ${PORT} (Render.com ready)    ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;

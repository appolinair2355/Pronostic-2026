// =============================================================================
// PRONOSAI PRO - SERVEUR EXPRESS + OPENAI (VERSION DEBUG + MODE DÉGRADÉ)
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
    timeout: 60000,
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
    console.log('🚀 Début de la requête /api/generate-combine');
    console.log('📦 Configuration reçue:', JSON.stringify(req.body, null, 2));
    
    try {
        const config = req.body;
        
        // VALIDATION
        if (!validateConfig(config)) {
            console.warn('❌ Configuration invalide');
            return res.status(400).json({
                success: false,
                error: 'Configuration invalide',
                details: getValidationErrors(config)
            });
        }

        // ÉTAPE 1 : Récupérer les matchs via OpenAI
        updateProgress(10, 'Récupération des matchs...');
        console.log('📊 Appel à fetchMatchesFromOpenAI...');
        const matchesWithData = await fetchMatchesFromOpenAI(config);
        console.log('✅ Matchs récupérés:', matchesWithData.length);

        // ÉTAPE 2 : Pour chaque match, obtenir 2 éléments sûrs
        updateProgress(30, 'Analyse des éléments sûrs par match...');
        console.log('🎯 Analyse des éléments sûrs...');
        const matchesWithSafeElements = await Promise.all(
            matchesWithData.slice(0, config.maxMatches * 2).map(match => 
                getSafeElementsForMatch(match, config)
            )
        );
        console.log('✅ Éléments sûrs analysés:', matchesWithSafeElements.length);

        // ÉTAPE 3 : Générer toutes les combinaisons valides
        updateProgress(50, 'Génération des combinaisons possibles...');
        console.log('🧮 Génération des combinaisons...');
        const validCombinations = generateValidCombinations(
            matchesWithSafeElements,
            config
        );
        console.log('✅ Combinaisons générées:', validCombinations.length);

        if (validCombinations.length === 0) {
            console.warn('❌ Aucune combinaison valide');
            return res.status(404).json({
                success: false,
                error: 'Aucune combinaison valide trouvée',
                suggestion: 'Essayez une côte cible plus basse ou moins de contraintes'
            });
        }

        // ÉTAPE 4 : Trouver la meilleure combinaison
        updateProgress(70, 'Recherche du combiné optimal...');
        console.log('🔍 Recherche de la meilleure combinaison...');
        const bestCombination = findBestCombination(
            validCombinations,
            config.targetOdd
        );
        console.log('✅ Meilleure combinaison trouvée:', bestCombination);

        // ÉTAPE 5 : Enrichir avec explications IA
        updateProgress(85, 'Génération de l\'analyse détaillée...');
        console.log('📝 Enrichissement avec explications...');
        const enrichedResult = await enrichWithExplanations(bestCombination);

        updateProgress(100, 'Analyse terminée !');
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('✅ Requête terminée avec succès en', duration, 'secondes');

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
        console.error('❌ ERREUR CRITIQUE:', error);
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la génération du combiné',
            details: error.message,
            debug: {
                hasOpenAIKey: !!process.env.OPENAI_API_KEY,
                keyLength: process.env.OPENAI_API_KEY?.length || 0,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// =============================================================================
// 🔧 VALIDATION
// =============================================================================

function validateConfig(config) {
    console.log('🔍 Validation de la configuration:', config);
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
// 🔍 RÉCUPÉRATION DES MATCHS (AVEC MODE DÉGRADÉ)
// =============================================================================

async function fetchMatchesFromOpenAI(config) {
    console.log('🌍 Tentative de récupération des matchs via OpenAI...');
    console.log('🔑 Clé API présente:', !!process.env.OPENAI_API_KEY);
    
    // SI PAS DE CLÉ API, MODE DÉGRADÉ IMMÉDIAT
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-votre-clé-api-openai-ici') {
        console.warn('⚠️ MODE DÉGRADÉ ACTIVÉ - Pas de clé API valide');
        return getMockMatches();
    }

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
`;

    try {
        console.log('📤 Envoi de la requête à OpenAI...');
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: "Tu es un bookmaker professionnel avec les données en temps réel." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2500,
        });

        console.log('✅ Réponse reçue d\'OpenAI, parsing en cours...');
        const parsed = parseMatchesResponse(completion.choices[0].message.content);
        console.log(`✅ ${parsed.length} matchs parsés avec succès`);
        
        // Si le parsing échoue ou retourne vide, activer le mode dégradé
        if (parsed.length === 0) {
            console.warn('⚠️ Parsing a retourné 0 matchs, mode dégradé activé');
            return getMockMatches();
        }
        
        return parsed;

    } catch (error) {
        console.error('❌ Erreur lors de l\'appel OpenAI:', error.message);
        console.error('Code d\'erreur:', error.code);
        console.error('Type d\'erreur:', error.type);
        
        // Mode dégradé en cas d'erreur OpenAI
        console.warn('⚠️ Mode dégradé activé suite à erreur OpenAI');
        return getMockMatches();
    }
}

function parseMatchesResponse(content) {
    console.log('📝 Début du parsing de la réponse OpenAI...');
    console.log('Contenu brut (premiers 200 caractères):', content.substring(0, 200));
    
    const matches = [];
    const blocks = content.split('━━━━━━━━━━━━━━━━━━━━━━━').filter(b => b.trim());
    
    console.log(`📦 Nombre de blocs trouvés: ${blocks.length}`);
    
    for (const block of blocks) {
        try {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            const match = { id: Math.random().toString(36).substr(2, 9) };
            
            console.log(`🔍 Analyse d'un bloc avec ${lines.length} lignes`);
            
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
                    if (odds && odds.length >= 3) {
                        match.odds = { home: parseFloat(odds[0]), draw: parseFloat(odds[1]), away: parseFloat(odds[2]) };
                    }
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
            
            if (match.teams) {
                console.log('✅ Match parsé avec succès:', match.teams);
                matches.push(match);
            } else {
                console.warn('⚠️ Bloc ignoré (pas de teams trouvé)');
            }
        } catch (e) {
            console.error('❌ Erreur parsing bloc:', e.message);
        }
    }
    
    console.log(`✅ Total matchs parsés: ${matches.length}`);
    return matches.slice(0, 15);
}

// MODE DÉGRADÉ : Données simulées si OpenAI échoue
function getMockMatches() {
    console.log('📦 Retour des matchs simulés (mode dégradé)');
    return [
        {
            id: 'mock-1',
            time: '15:00',
            homeTeam: 'Paris SG',
            awayTeam: 'Marseille',
            teams: 'Paris SG vs Marseille',
            odds: { home: 1.85, draw: 3.40, away: 4.20 },
            handicap: { line: 'H(-0.5)', odds: 1.95 },
            totalGoals: { type: 'Over', line: 2.5, odds: 1.80 },
            btts: { value: 'Oui', odds: 1.70 },
            corners: { line: 8.5, odds: 1.85 },
            shots: [{ line: 7.5, odds: 1.90 }]
        },
        {
            id: 'mock-2',
            time: '17:00',
            homeTeam: 'Lyon',
            awayTeam: 'Monaco',
            teams: 'Lyon vs Monaco',
            odds: { home: 2.10, draw: 3.20, away: 3.60 },
            handicap: { line: 'H(0)', odds: 1.75 },
            totalGoals: { type: 'Under', line: 2.5, odds: 1.90 },
            btts: { value: 'Oui', odds: 1.75 },
            corners: { line: 9.5, odds: 1.80 },
            shots: [{ line: 7.5, odds: 1.85 }]
        },
        {
            id: 'mock-3',
            time: '19:00',
            homeTeam: 'Real Madrid',
            awayTeam: 'Barcelone',
            teams: 'Real Madrid vs Barcelone',
            odds: { home: 1.95, draw: 3.50, away: 3.80 },
            handicap: { line: 'H(-0.5)', odds: 2.05 },
            totalGoals: { type: 'Over', line: 2.5, odds: 1.75 },
            btts: { value: 'Oui', odds: 1.65 },
            corners: { line: 9.5, odds: 1.90 },
            shots: [{ line: 8.5, odds: 1.95 }]
        }
    ];
}

// =============================================================================
// 🎯 ANALYSE DES ÉLÉMENTS SÛRS
// =============================================================================

async function getSafeElementsForMatch(match, config) {
    console.log(`🎯 Analyse des éléments sûrs pour ${match.teams}...`);
    
    // SI PAS DE CLÉ API, MODE DÉGRADÉ
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-votre-clé-api-openai-ici') {
        return getMockElements(match);
    }

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

    try {
        console.log('📤 Envoi à OpenAI pour éléments sûrs...');
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
        console.log(`✅ Éléments sûrs trouvés:`, elements.length);
        return { ...match, elements };

    } catch (error) {
        console.error('❌ Erreur getSafeElementsForMatch:', error.message);
        return getMockElements(match);
    }
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
                confidence: 75
            });
        }
    }
    
    const confidenceMatch = content.match(/Confiance: (\d+)%/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
    
    return elements.slice(0, 2).map(e => ({ ...e, confidence }));
}

// Éléments simulés si OpenAI échoue
function getMockElements(match) {
    return {
        ...match,
        elements: [
            {
                type: 'victoire',
                value: `Victoire ${match.homeTeam}`,
                odds: 1.85,
                explanation: 'Favori joue à domicile, forme excellente',
                confidence: 72
            },
            {
                type: 'total_buts',
                value: 'Over 2.5 buts',
                odds: 1.80,
                explanation: 'Les deux équipes marquent régulièrement',
                confidence: 70
            }
        ]
    };
}

// =============================================================================
// 🧮 GÉNÉRATION DES COMBINAISONS VALIDES
// =============================================================================

function generateValidCombinations(matches, config) {
    console.log('🔍 Génération des combinaisons valides...');
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
    console.log(`✅ ${combinations.length} combinaisons valides générées`);
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
    
    // CONTRAINTE 3 : Diversification
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
    console.log(`🔍 Recherche parmi ${combinations.length} combinaisons pour cote cible ${targetOdd}`);
    
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
    
    console.log('📝 Génération des explications IA pour le combiné...');
    
    // SI PAS DE CLÉ API, explication basique
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-votre-clé-api-openai-ici') {
        combination.explanation = `📊 COMBINÉ BASÉ SUR ${combination.matches.length} MATCHES
        
🎯 COTE: ${combination.odds.toFixed(2)}
📈 CONFIANCE: ${combination.confidence.toFixed(0)}%

⚠️ MODE DÉGRADÉ ACTIVÉ - Ajoutez une clé OpenAI valide pour une analyse plus précise.`;
        return combination;
    }

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
        console.error('❌ Erreur enrichissement:', error.message);
        combination.explanation = "Analyse non disponible pour ce combiné.";
    }
    
    return combination;
}

// =============================================================================
// 📍 ROUTES SUPPLÉMENTAIRES
// =============================================================================

app.get('/api/config', (req, res) => {
    console.log('📡 Requête /api/config reçue');
    res.json({
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo'],
        limits: { maxMatches: 8, minOdd: 2.0, maxOdd: 100.0 }
    });
});

app.get('/', (req, res) => {
    console.log('📡 Requête racine "/" reçue');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Démarrage du serveur sur le port 10000
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   🚀 PRONOSAI PRO - DÉMARRÉ SUR LE PORT ${PORT} ║
║   💻 URL: http://localhost:${PORT}             ║
║   🔑 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configurée' : '❌ Clé manquante'}      ║
║   ⚡ Mode: ${process.env.OPENAI_API_KEY ? 'Production IA' : 'Dégradé (simulé)'}  ║
╚════════════════════════════════════════════════╝
    `);
});

module.exports = app;

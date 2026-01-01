// =============================================================================
// PRONOSAI PRO - VERSION FLEXIBLE & ALTERNATIVES
// Génère forcément des pronostics même avec critères stricts
// =============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuration APIs
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000,
});

const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY;
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =============================================================================
// 📍 ROUTE PRINCIPALE : Génération avec RELÂCHEMENT PROGRESSIF
// =============================================================================
app.post('/api/generate-combine', async (req, res) => {
    const startTime = Date.now();
    console.log('\n🚀 DÉBUT REQUÊTE FLEXIBLE');
    console.log('📦 Configuration:', JSON.stringify(req.body, null, 2));

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

        // ÉTAPE 1 : Récupérer les matchs
        updateProgress(10, `Récupération matchs: ${config.period}`);
        const realMatches = await fetchRealMatchesByPeriod(config);
        console.log(`✅ ${realMatches.length} matchs récupérés`);

        if (realMatches.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Aucun match pour "${getPeriodName(config.period)}"`,
                suggestion: 'Essayez une autre période ou vérifiez TheOddsAPI'
            });
        }

        // ÉTAPE 2 : Analyser les marchés SÉLECTIONNÉS
        updateProgress(30, `Analyse marchés: ${config.markets.join(', ')}`);
        const matchesWithMarkets = await Promise.all(
            realMatches.slice(0, config.maxMatches * 3).map(match => 
                getMarketAnalysisFiltered(match, config)
            )
        );
        const validMatches = matchesWithMarkets.filter(m => m.elements.length > 0);
        console.log(`✅ ${validMatches.length} matchs avec marchés valides`);

        // ÉTAPE 3 : Générer combinaisons avec STRATEGIE FLEXIBLE
        updateProgress(50, 'Génération combinés...');
        const validCombinations = generateFlexibleCombinations(
            validMatches,
            config
        );

        if (validCombinations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aucune combinaison possible même avec critères relâchés',
                suggestion: 'Ajoutez plus de marchés ou baissez la côte cible'
            });
        }

        // ÉTAPE 4 : Trouver le MEILLEUR combiné (avec alternatives si besoin)
        updateProgress(70, 'Recherche combiné optimal...');
        const result = findBestCombinationWithAlternatives(
            validCombinations,
            config.targetOdd
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Impossible de générer un combiné avec ces critères',
                suggestion: `Essayez une côte entre ${validCombinations[0].odds.toFixed(2)} et ${validCombinations[validCombinations.length-1].odds.toFixed(2)}`
            });
        }

        // ÉTAPE 5 : Enrichir avec IA
        updateProgress(85, 'Analyse IA détaillée...');
        const finalResult = await enrichCombinationWithAI(result.combination);

        updateProgress(100, 'Terminé !');

        res.json({
            success: true,
            data: finalResult,
            alternatives: result.alternatives || [],
            metadata: {
                duration_seconds: ((Date.now() - startTime) / 1000).toFixed(2),
                total_combinations: validCombinations.length,
                strategy_used: result.strategy
            }
        });

    } catch (error) {
        console.error('❌ ERREUR FATAL:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            details: error.message
        });
    }
});

// =============================================================================
// 🔒 VALIDATION
// =============================================================================

function validateConfig(config) {
    const errors = [];
    if (!['today', 'tomorrow', 'custom'].includes(config.period)) errors.push('Période invalide');
    if (!(config.targetOdd >= 2.0 && config.targetOdd <= 1000.0)) errors.push('Côte hors limites');
    if (!(config.maxMatches >= 2 && config.maxMatches <= 8)) errors.push('Max matches hors limites');
    if (!Array.isArray(config.markets) || config.markets.length === 0) errors.push('Aucun marché sélectionné');
    return errors.length === 0;
}

function getValidationErrors(config) {
    const errors = [];
    if (!['today', 'tomorrow', 'custom'].includes(config.period)) errors.push('Période invalide');
    if (!(config.targetOdd >= 2.0 && config.targetOdd <= 10000.0)) errors.push('Côte hors limites (2.0-10000)');
    if (!(config.maxMatches >= 2 && config.maxMatches <= 8)) errors.push('Max matches hors limites (2-8)');
    if (!Array.isArray(config.markets) || config.markets.length === 0) errors.push('Aucun marché sélectionné');
    return errors;
}

function getPeriodName(period) {
    const names = { today: "Aujourd'hui", tomorrow: "Demain", custom: "Personnalisé" };
    return names[period] || period;
}

function updateProgress(percent, message) {
    console.log(`📊 ${percent}% - ${message}`);
}

// =============================================================================
// 📡 FETCH MATCHS (avec mode simulé si pas de clé)
// =============================================================================

async function fetchRealMatchesByPeriod(config) {
    console.log(`📅 FETCHING: ${config.period}`);
    
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    
    switch(config.period) {
        case 'today':
            endDate.setDate(endDate.getDate() + 1);
            break;
        case 'tomorrow':
            startDate.setDate(startDate.getDate() + 1);
            endDate.setDate(endDate.getDate() + 2);
            break;
        case 'custom':
            endDate.setDate(endDate.getDate() + (config.daysAhead || 3));
            break;
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    console.log(`   Plage: ${startStr} → ${endStr}`);

    // MODE SIMULÉ si pas de clé
    if (!THE_ODDS_API_KEY || THE_ODDS_API_KEY === 'votre-clé-theoddsapi-ici') {
        console.warn('⚠️ MODE SIMULÉ');
        return getMockMatchesForPeriod(config.period);
    }

    try {
        const leagues = ['soccer_epl', 'soccer_france_ligue_one'];
        const allMatches = [];
        
        for (const league of leagues) {
            const response = await axios.get(`${ODDS_API_URL}/${league}/odds`, {
                params: {
                    apiKey: THE_ODDS_API_KEY,
                    regions: 'eu',
                    markets: 'h2h,totals,spreads',
                    commenceTimeFrom: `${startStr}T00:00:00Z`,
                    commenceTimeTo: `${endStr}T23:59:59Z`,
                },
                timeout: 10000
            });
            
            const matches = response.data.map(game => ({
                id: game.id,
                commence_time: game.commence_time,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                teams: `${game.home_team} vs ${game.away_team}`,
                bestOdds: extractBestOdds(game.bookmakers)
            }));
            
            allMatches.push(...matches);
        }
        
        console.log(`✅ ${allMatches.length} matchs réels`);
        return allMatches;

    } catch (error) {
        console.error('❌ Erreur fetch:', error.message);
        return getMockMatchesForPeriod(config.period);
    }
}

function extractBestOdds(bookmakers) {
    if (!bookmakers || !bookmakers.length) return null;
    const best = {};
    bookmakers.forEach(b => {
        b.markets.forEach(m => {
            m.outcomes.forEach(o => {
                const key = `${m.key}_${o.name}`;
                if (!best[key] || o.price > best[key].price) {
                    best[key] = { name: o.name, price: o.price, bookmaker: b.title };
                }
            });
        });
    });
    return best;
}

function getMockMatchesForPeriod(period) {
    return [
        {
            id: `mock-${period}-1`,
            commence_time: new Date().toISOString(),
            homeTeam: 'Paris SG',
            awayTeam: 'Marseille',
            teams: 'Paris SG vs Marseille',
            bestOdds: {
                h2h_Home: { name: 'Home', price: 1.85, bookmaker: 'Mock' },
                h2h_Away: { name: 'Away', price: 2.10, bookmaker: 'Mock' },
                totals_Over: { name: 'Over 2.5', price: 1.80, bookmaker: 'Mock' }
            }
        },
        {
            id: `mock-${period}-2`,
            commence_time: new Date().toISOString(),
            homeTeam: 'Lyon',
            awayTeam: 'Monaco',
            teams: 'Lyon vs Monaco',
            bestOdds: {
                h2h_Home: { name: 'Home', price: 2.10, bookmaker: 'Mock' },
                h2h_Away: { name: 'Away', price: 1.75, bookmaker: 'Mock' },
                totals_Over: { name: 'Over 2.5', price: 1.90, bookmaker: 'Mock' }
            }
        }
    ];
}

// =============================================================================
// 🎯 ANALYSE MARCHÉS FILTRÉS ✅
// =============================================================================

async function getMarketAnalysisFiltered(match, config) {
    console.log(`🔍 ANALYSE FILTRÉE: ${match.teams}`);
    console.log(`   Marchés demandés: ${config.markets.join(', ')}`);
    
    const elements = [];

    // FILTRE STRICT : uniquement les marchés cochés ✅
    if (config.markets.includes('victoire') && match.bestOdds?.h2h_Home) {
        elements.push({
            type: 'victoire',
            value: `Victoire ${match.homeTeam}`,
            odds: match.bestOdds.h2h_Home.price,
            confidence: calculateBaseConfidence(match.bestOdds.h2h_Home.price) + 5,
            explanation: `${match.homeTeam} domicile, cote ${match.bestOdds.h2h_Home.price}`
        });
    }
    
    if (config.markets.includes('handicap') && match.bestOdds?.spreads_Home) {
        elements.push({
            type: 'handicap',
            value: `H(${match.bestOdds.spreads_Home.point}) ${match.homeTeam}`,
            odds: match.bestOdds.spreads_Home.price,
            confidence: calculateBaseConfidence(match.bestOdds.spreads_Home.price),
            explanation: 'Handicap avantageux'
        });
    }
    
    if (config.markets.includes('total_buts') && match.bestOdds?.totals_Over) {
        const line = match.bestOdds.totals_Over.name.split(' ')[1];
        elements.push({
            type: 'total_buts',
            value: `Over ${line} buts`,
            odds: match.bestOdds.totals_Over.price,
            confidence: calculateBaseConfidence(match.bestOdds.totals_Over.price) * 0.9,
            explanation: 'Tendance offensive'
        });
    }
    
    if (config.markets.includes('btts') && match.bestOdds?.btts_Yes) {
        elements.push({
            type: 'btts',
            value: 'Les deux équipes marquent',
            odds: match.bestOdds.btts_Yes.price,
            confidence: calculateBaseConfidence(match.bestOdds.btts_Yes.price),
            explanation: 'Historique buts'
        });
    }
    
    console.log(`   ✅ ${elements.length} éléments créés`);
    
    return {
        ...match,
        elements: elements.slice(0, 2) // MAX 2
    };
}

function calculateBaseConfidence(odds) {
    return Math.max(35, Math.min(85, 100 / odds));
}

// =============================================================================
// 🧮 COMBINAISONS FLEXIBLES (GÉNÈRE FORCÉMENT DES RÉSULTATS)
// =============================================================================

function generateFlexibleCombinations(matches, config) {
    console.log(`🔍 GÉNÉRATION FLEXIBLE - MAX ${config.maxMatches} MATCHES`);
    
    const combinations = [];
    
    function backtrack(index, currentCombo, currentOdds, usedTypes, depth = 0) {
        // ON CONTINUE JUSQU'À MAX MATCHES, peu importe la côte ✅
        if (currentCombo.length >= config.maxMatches) {
            if (currentOdds >= 2.0) { // Côte minimale réaliste
                combinations.push({
                    matches: [...currentCombo],
                    odds: currentOdds,
                    confidence: calculateAverageConfidence(currentCombo),
                    typesUsed: new Set([...usedTypes])
                });
            }
            return;
        }
        
        if (index >= matches.length) {
            // On accepte même avec moins de matches si côte OK
            if (currentCombo.length >= 2 && currentOdds >= 2.0) {
                combinations.push({
                    matches: [...currentCombo],
                    odds: currentOdds,
                    confidence: calculateAverageConfidence(currentCombo)
                });
            }
            return;
        }
        
        // Essayer chaque élément du match
        for (const element of matches[index].elements) {
            if (isValidCombinationStrict(currentCombo, matches[index], element, usedTypes)) {
                currentCombo.push({ match: matches[index], element });
                backtrack(index + 1, currentCombo, currentOdds * element.odds, [...usedTypes, element.type], depth + 1);
                currentCombo.pop();
            }
        }
        
        // Sauter ce match
        backtrack(index + 1, currentCombo, currentOdds, usedTypes, depth);
    }
    
    backtrack(0, [], 1.0, []);
    console.log(`✅ ${combinations.length} combinaisons générées`);
    return combinations;
}

function isValidCombinationStrict(existingCombo, newMatch, newElement, usedTypes) {
    // Pas de conflit victoire/tirs cadrés
    if ((newElement.type === 'tirs_cadres' || newElement.type === 'victoire')) {
        const conflict = existingCombo.some(item => 
            item.match.id === newMatch.id && 
            ((item.element.type === 'victoire' && newElement.type === 'tirs_cadres') ||
             (item.element.type === 'tirs_cadres' && newElement.type === 'victoire'))
        );
        if (conflict) return false;
    }
    
    // Diversification
    if (existingCombo.length > 0) {
        const futureTypes = new Set([...usedTypes, newElement.type]);
        if (futureTypes.size < 2) return false;
    }
    
    return true;
}

function calculateAverageConfidence(combo) {
    if (!combo.length) return 0;
    const sum = combo.reduce((acc, item) => acc + (item.element.confidence || 70), 0);
    return sum / combo.length;
}

// =============================================================================
// 🔍 RECHERCHE COMBINÉ AVEC ALTERNATIVES
// =============================================================================

function findBestCombinationWithAlternatives(combinations, targetOdd) {
    if (!combinations.length) return null;
    
    console.log(`🔍 RECHERCHE COMBINÉ PROCHE DE ${targetOdd}`);
    console.log(`   ${combinations.length} combinaisons disponibles`);
    
    // Trier par proximité à la côte cible
    const sorted = combinations.sort((a, b) => {
        const diffA = Math.abs(a.odds - targetOdd);
        const diffB = Math.abs(b.odds - targetOdd);
        if (diffA !== diffB) return diffA - diffB;
        return b.confidence - a.confidence;
    });
    
    // PREMIER COMBINÉ = le plus proche
    const best = sorted[0];
    
    // ALTERNATIVES = les 4 suivants
    const alternatives = sorted.slice(1, 5).map(c => ({
        combination: c,
        difference: Math.abs(c.odds - targetOdd),
        message: `Côte ${c.odds.toFixed(2)} (écart ${Math.abs(c.odds - targetOdd).toFixed(2)})`
    }));
    
    console.log(`✅ COMBINÉ SÉLECTIONNÉ: ${best.odds.toFixed(2)} (écart ${Math.abs(best.odds - targetOdd).toFixed(2)})`);
    
    return {
        combination: best,
        alternatives: alternatives,
        strategy: 'flexible_relax'
    };
}

// =============================================================================
// 📝 ENRICHISSEMENT IA
// =============================================================================

async function enrichCombinationWithAI(combination) {
    if (!process.env.OPENAI_API_KEY) {
        combination.explanation = `📊 COMBINÉ ${combination.matches.length} MATCHES\n🎯 COTE: ${combination.odds.toFixed(2)}\n📈 CONFIANCE: ${combination.confidence.toFixed(0)}%\n\n⚠️ ANALYSE IA NON DISPONIBLE`;
        return combination;
    }

    const matchNames = combination.matches.map(m => m.match.teams).join(', ');
    
    const prompt = `
COMBINÉ: ${matchNames}
Cote: ${combination.odds.toFixed(2)}
Confiance: ${combination.confidence.toFixed(0)}%

ANALYSE PROFONDE:
1. Pourquoi ce combiné est solide (3 phrases)
2. Point fort du combiné
3. Attention particulière
4. Recommandation mise (ex: "2-3% bankroll")

FORMAT: Utilisez des ✅ et ⚠️ pour les points clés.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 500,
        });
        
        combination.explanation = completion.choices[0].message.content;
    } catch (error) {
        combination.explanation = `📊 ${combination.matches.length} MATCHES\n🎯 COTE: ${combination.odds.toFixed(2)}\n📈 CONFIANCE: ${combination.confidence.toFixed(0)}%\n\n⚠️ ANALYSE IA - Mode simplifié activé`;
        console.warn('⚠️ Explication IA non disponible');
    }
    
    return combination;
}

// =============================================================================
// 📍 ROUTES
// =============================================================================

app.get('/api/config', (req, res) => {
    res.json({
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasOddsAPIKey: !!THE_ODDS_API_KEY,
        models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo']
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📊 Mode: ${THE_ODDS_API_KEY ? 'TEMPS RÉEL' : 'SIMULÉ'}`);
});

module.exports = app;

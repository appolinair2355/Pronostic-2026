// =============================================================================
// PRONOSAI PRO - VERSION TEMPS RÉEL & STRICTE
// Port: 10000 | Respecte: Période, Marchés, MaxMatches, Côte
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
// 📍 ROUTE PRINCIPALE : Génération STRICTE de combiné
// =============================================================================
app.post('/api/generate-combine', async (req, res) => {
    const startTime = Date.now();
    console.log('\n🚀 DÉBUT REQUÊTE STRICTE');
    console.log('📦 Configuration:', JSON.stringify(req.body, null, 2));

    try {
        const config = req.body;

        // VALIDATION STRICTE
        if (!validateConfig(config)) {
            return res.status(400).json({
                success: false,
                error: 'Configuration invalide',
                details: getValidationErrors(config)
            });
        }

        // ÉTAPE 1 : Récupérer matchs SELON LA PÉRIODE CHOISIE ✅
        updateProgress(10, `Récupération matchs pour période: ${config.period}`);
        const realMatches = await fetchRealMatchesByPeriod(config);
        console.log(`✅ ${realMatches.length} matchs récupérés pour "${getPeriodName(config.period)}"`);

        if (realMatches.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Aucun match pour "${getPeriodName(config.period)}"`,
                suggestion: 'Essayez une autre période'
            });
        }

        // ÉTAPE 2 : Analyser SEULEMENT les marchés SÉLECTIONNÉS ✅
        updateProgress(30, `Analyse marchés: ${config.markets.join(', ')}`);
        const matchesWithMarkets = await Promise.all(
            realMatches.slice(0, config.maxMatches * 3).map(match => 
                getMarketAnalysisFiltered(match, config)
            )
        );

        // Filtrer les matchs avec au moins un marché valide
        const validMatches = matchesWithMarkets.filter(m => m.elements.length > 0);
        console.log(`✅ ${validMatches.length} matchs avec marchés valides`);

        // ÉTAPE 3 : Générer combinaisons en RESPECTANT STRICTEMENT maxMatches ✅
        updateProgress(50, `Génération STRICTE de ${config.maxMatches} matchs max...`);
        const validCombinations = generateStrictCombinations(
            validMatches,
            config
        );

        if (validCombinations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aucune combinaison valide avec vos critères',
                suggestion: 'Ajoutez plus de marchés ou augmentez maxMatches'
            });
        }

        // ÉTAPE 4 : Trouver le combiné le plus proche
        updateProgress(70, 'Recherche combiné optimal...');
        const bestCombination = findExactMatchCombination(
            validCombinations,
            config.targetOdd
        );

        if (!bestCombination) {
            return res.status(404).json({
                success: false,
                error: `Aucun combiné ne correspond à la côte cible ${config.targetOdd}`,
                suggestion: `Essayez: ${validCombinations.slice(0,3).map(c => c.odds.toFixed(2)).join(', ')}`
            });
        }

        // ÉTAPE 5 : Enrichir avec IA
        updateProgress(85, 'Analyse IA finale...');
        const finalResult = await enrichCombinationWithAI(bestCombination);

        updateProgress(100, 'Terminé !');
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`✅ COMBINÉ FINAL: ${finalResult.matches.length} matchs, Cote: ${finalResult.odds.toFixed(2)}, Confiance: ${finalResult.confidence.toFixed(0)}%`);

        res.json({
            success: true,
            data: finalResult,
            respects: {
                period: config.period,
                markets: config.markets,
                maxMatches: config.maxMatches,
                targetOdd: config.targetOdd
            },
            metadata: {
                duration_seconds: duration,
                matches_analyzed: realMatches.length,
                combinations_tested: validCombinations.length
            }
        });

    } catch (error) {
        console.error('❌ ERREUR FATAL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// 🔒 VALIDATION STRICTE
// =============================================================================

function validateConfig(config) {
    console.log('🔍 VALIDATION:', {
        period: config.period,
        targetOdd: config.targetOdd,
        maxMatches: config.maxMatches,
        marketsCount: config.markets?.length
    });

    const errors = [];
    
    if (!['today', 'tomorrow', 'custom'].includes(config.period)) {
        errors.push('Période invalide');
    }
    
    if (!(config.targetOdd >= 2.0 && config.targetOdd <= 1000.0)) {
        errors.push('Côte hors limites (2.0-1000.0)');
    }
    
    if (!(config.maxMatches >= 2 && config.maxMatches <= 8)) {
        errors.push('Nombre de matchs hors limites (2-8)');
    }
    
    if (!Array.isArray(config.markets) || config.markets.length === 0) {
        errors.push('Aucun marché sélectionné');
    }
    
    if (errors.length > 0) {
        console.error('❌ ÉCHEC VALIDATION:', errors);
        return false;
    }
    
    console.log('✅ VALIDATION OK');
    return true;
}

function getValidationErrors(config) {
    const errors = [];
    if (!['today', 'tomorrow', 'custom'].includes(config.period)) errors.push('Période invalide');
    if (!(config.targetOdd >= 2.0 && config.targetOdd <= 1000.0)) errors.push('Côte hors limites');
    if (!(config.maxMatches >= 2 && config.maxMatches <= 8)) errors.push('Nombre de matchs hors limites');
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
// 📡 FETCH MATCHS SELON PÉRIODE ✅
// =============================================================================

async function fetchRealMatchesByPeriod(config) {
    console.log(`📅 FETCHING POUR PÉRIODE: ${config.period}`);
    
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

    // MODE SIMULÉ SI PAS DE CLÉ
    if (!THE_ODDS_API_KEY || THE_ODDS_API_KEY === 'votre-clé-theoddsapi-ici') {
        console.warn('⚠️ MODE SIMULÉ');
        return getMockMatchesForPeriod(config.period);
    }

    try {
        const leagues = ['soccer_epl', 'soccer_france_ligue_one', 'soccer_spain_la_liga'];
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

// =============================================================================
// 🎯 ANALYSE MARCHÉS FILTRÉS ✅
// =============================================================================

async function getMarketAnalysisFiltered(match, config) {
    console.log(`🔍 ANALYSE FILTRÉE: ${match.teams}`);
    console.log(`   Marchés demandés: ${config.markets.join(', ')}`);
    
    const elements = [];

    // CHAQUE TYPE VÉRIFIÉ STRICTEMENT ✅
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
        elements: elements.slice(0, 2) // MAX 2 par match
    };
}

function calculateBaseConfidence(odds) {
    return Math.max(35, Math.min(85, 100 / odds));
}

// =============================================================================
// 🧮 COMBINAISONS STRICTES (RESPECT maxMatches) ✅
// =============================================================================

function generateStrictCombinations(matches, config) {
    console.log(`🔍 GÉNÉRATION STRICTE - MAX ${config.maxMatches} MATCHES`);
    
    const combinations = [];
    
    function backtrack(index, currentCombo, currentOdds, usedTypes, depth = 0) {
        console.log(`   [depth=${depth}] Combo: ${currentCombo.length}/${config.maxMatches} matches, cote: ${currentOdds.toFixed(2)}`);
        
        if (currentCombo.length >= config.maxMatches) {
            console.log(`   ⛔ MAX ATTEINT (${config.maxMatches})`);
            if (currentOdds >= config.targetOdd * 0.4) {
                combinations.push({
                    matches: [...currentCombo],
                    odds: currentOdds,
                    confidence: calculateAverageConfidence(currentCombo)
                });
            }
            return;
        }
        
        if (index >= matches.length) {
            if (currentCombo.length >= 2 && currentOdds >= config.targetOdd * 0.4) {
                combinations.push({
                    matches: [...currentCombo],
                    odds: currentOdds,
                    confidence: calculateAverageConfidence(currentCombo)
                });
            }
            return;
        }
        
        // ESSAYER D'AJOUTER CE MATCH
        for (const element of matches[index].elements) {
            if (isValidCombinationStrict(currentCombo, matches[index], element, usedTypes)) {
                currentCombo.push({ match: matches[index], element });
                backtrack(index + 1, currentCombo, currentOdds * element.odds, [...usedTypes, element.type], depth + 1);
                currentCombo.pop();
            }
        }
        
        // SAUTER CE MATCH
        backtrack(index + 1, currentCombo, currentOdds, usedTypes, depth);
    }
    
    backtrack(0, [], 1.0, []);
    console.log(`✅ ${combinations.length} combinaisons STRICTES`);
    return combinations;
}

function isValidCombinationStrict(existingCombo, newMatch, newElement, usedTypes) {
    // Vérification conflit marchés
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

function findExactMatchCombination(combinations, targetOdd) {
    if (!combinations.length) return null;
    
    console.log(`🔍 RECHERCHE PROCHE DE ${targetOdd}`);
    console.log(`   ${combinations.length} combinaisons disponibles`);
    
    return combinations.reduce((best, current) => {
        if (!best) return current;
        
        const currentDiff = Math.abs(current.odds - targetOdd);
        const bestDiff = Math.abs(best.odds - targetOdd);
        
        console.log(`   - Cote: ${current.odds.toFixed(2)}, Diff: ${currentDiff.toFixed(2)}`);
        
        if (currentDiff < bestDiff) return current;
        if (currentDiff === bestDiff && current.confidence > best.confidence) return current;
        return best;
    });
}

// =============================================================================
// 📝 ENRICHISSEMENT IA
// =============================================================================

async function enrichCombinationWithAI(combination) {
    if (!process.env.OPENAI_API_KEY) {
        combination.explanation = `📊 ${combination.matches.length} MATCHES\n🎯 COTE: ${combination.odds.toFixed(2)}\n⚠️ Mode simulé`;
        return combination;
    }

    const matchNames = combination.matches.map(m => m.match.teams).join(', ');
    
    const prompt = `
COMBINÉ: ${matchNames}
Cote: ${combination.odds.toFixed(2)}
Confiance: ${combination.confidence.toFixed(0)}%

ANALYSE:
1. Risque global (3 phrases)
2. Point fort
3. Attention
4. Recommandation mise
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
        combination.explanation = `📊 COMBINÉ ${combination.matches.length} MATCHES\n⚠️ Analyse IA non disponible`;
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
});

module.exports = app;

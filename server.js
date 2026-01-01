// =============================================================================
// PRONOSAI PRO - VERSION "FORCÉ" (génère toujours des pronostics)
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
// 📍 ROUTE PRINCIPALE : GÉNÈRE FORCÉMENT DES PRONOSTICS
// =============================================================================
app.post('/api/generate-combine', async (req, res) => {
    console.log('\n🚀 GÉNÈRE FORCÉMENT UN COMBINÉ');
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
        const realMatches = await fetchRealMatchesByPeriod(config);
        console.log(`✅ ${realMatches.length} matchs récupérés`);

        if (realMatches.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Aucun match pour "${getPeriodName(config.period)}"`
            });
        }

        // ÉTAPE 2 : Analyser les marchés SÉLECTIONNÉS
        const matchesWithMarkets = await Promise.all(
            realMatches.slice(0, 10).map(match => getMarketAnalysisFiltered(match, config))
        );
        const validMatches = matchesWithMarkets.filter(m => m.elements.length > 0);

        console.log(`✅ ${validMatches.length} matchs avec marchés valides`);

        if (validMatches.length < 2) {
            return res.status(404).json({
                success: false,
                error: `Pas assez de matchs avec les marchés "${config.markets.join(', ')}".`,
                suggestion: 'Cochez plus de marchés ou élargissez la période.'
            });
        }

        // ÉTAPE 3 : Générer TOUTES les combinaisons possibles
        console.log(`🔍 Génération de TOUTES les combinaisons possibles (max ${config.maxMatches} matchs)...`);
        const allCombinations = generateAllCombinations(validMatches, config);

        if (allCombinations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Impossible de créer une combinaison avec ces critères'
            });
        }

        console.log(`✅ ${allCombinations.length} combinaisons créées`);

        // ÉTAPE 4 : TROUVER LE MEILLEUR ET LES ALTERNATIVES
        const bestResult = findBestWithAlternatives(allCombinations, config.targetOdd);

        // ÉTAPE 5 : Enrichir avec IA
        const finalResult = await enrichCombinationWithAI(bestResult.combination);

        console.log(`🎯 COMBINÉ SÉLECTIONNÉ: ${finalResult.odds.toFixed(2)} (côte cible: ${config.targetOdd})`);

        res.json({
            success: true,
            data: finalResult,
            message: bestResult.isExact ? `✅ Côte parfaite trouvée !` : `⚠️ Côte proche de ${bestResult.difference.toFixed(2)}`,
            alternatives: bestResult.alternatives,
            metadata: {
                total_combinations: allCombinations.length,
                target_odd: config.targetOdd,
                is_exact: bestResult.isExact,
                difference: bestResult.difference
            }
        });

    } catch (error) {
        console.error('❌ ERREUR:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// 🔒 VALIDATION
// =============================================================================

function validateConfig(config) {
    return config.markets && config.markets.length > 0 &&
           config.maxMatches >= 2 && config.maxMatches <= 8 &&
           config.targetOdd >= 2.0 && config.targetOdd <= 10000.0;
}

function getValidationErrors(config) {
    const errors = [];
    if (!config.markets || config.markets.length === 0) errors.push('Aucun marché sélectionné');
    if (!config.maxMatches || config.maxMatches < 2) errors.push('maxMatches invalide');
    if (!config.targetOdd || config.targetOdd < 2.0) errors.push('Côte cible invalide');
    return errors;
}

function getPeriodName(period) {
    const names = { today: "Aujourd'hui", tomorrow: "Demain", custom: "Personnalisé" };
    return names[period] || period;
}

// =============================================================================
// 📡 FETCH MATCHS
// =============================================================================

async function fetchRealMatchesByPeriod(config) {
    if (!THE_ODDS_API_KEY || THE_ODDS_API_KEY === 'votre-clé-theoddsapi-ici') {
        console.warn('⚠️ MODE SIMULÉ');
        return getMockMatchesForPeriod(config.period);
    }

    const startDate = new Date();
    const endDate = new Date();
    
    if (config.period === 'tomorrow') {
        startDate.setDate(startDate.getDate() + 1);
        endDate.setDate(endDate.getDate() + 2);
    } else if (config.period === 'custom') {
        endDate.setDate(endDate.getDate() + (config.daysAhead || 3));
    } else {
        endDate.setDate(endDate.getDate() + 1);
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
                    commenceTimeFrom: startDate.toISOString(),
                    commenceTimeTo: endDate.toISOString(),
                },
                timeout: 10000
            });
            
            allMatches.push(...response.data.map(game => ({
                id: game.id,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                teams: `${game.home_team} vs ${game.away_team}`,
                bestOdds: extractBestOdds(game.bookmakers)
            })));
        }
        
        return allMatches;

    } catch (error) {
        console.error('Erreur fetch:', error.message);
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
                    best[key] = { name: o.name, price: o.price };
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
            homeTeam: 'Paris SG', awayTeam: 'Marseille', teams: 'Paris SG vs Marseille',
            bestOdds: { h2h_Home: { price: 1.85 }, h2h_Away: { price: 2.10 }, totals_Over: { name: 'Over 2.5', price: 1.80 } }
        },
        {
            id: `mock-${period}-2`,
            homeTeam: 'Lyon', awayTeam: 'Monaco', teams: 'Lyon vs Monaco',
            bestOdds: { h2h_Home: { price: 2.10 }, h2h_Away: { price: 1.75 }, totals_Over: { name: 'Over 2.5', price: 1.90 } }
        },
        {
            id: `mock-${period}-3`,
            homeTeam: 'Real Madrid', awayTeam: 'Barcelone', teams: 'Real Madrid vs Barcelone',
            bestOdds: { h2h_Home: { price: 1.95 }, h2h_Away: { price: 3.80 }, totals_Over: { name: 'Over 2.5', price: 1.75 } }
        }
    ];
}

// =============================================================================
// 🎯 ANALYSE MARCHÉS FILTRÉS
// =============================================================================

function getMarketAnalysisFiltered(match, config) {
    const elements = [];

    if (config.markets.includes('victoire') && match.bestOdds?.h2h_Home) {
        elements.push({
            type: 'victoire',
            value: `Victoire ${match.homeTeam}`,
            odds: match.bestOdds.h2h_Home.price,
            confidence: Math.min(85, 100 / match.bestOdds.h2h_Home.price) + 5,
            explanation: `${match.homeTeam} domicile`
        });
    }
    
    if (config.markets.includes('handicap') && match.bestOdds?.spreads_Home) {
        elements.push({
            type: 'handicap',
            value: `H(${match.bestOdds.spreads_Home.point})`,
            odds: match.bestOdds.spreads_Home.price,
            confidence: Math.min(85, 100 / match.bestOdds.spreads_Home.price),
            explanation: 'Handicap avantageux'
        });
    }
    
    if (config.markets.includes('total_buts') && match.bestOdds?.totals_Over) {
        elements.push({
            type: 'total_buts',
            value: match.bestOdds.totals_Over.name,
            odds: match.bestOdds.totals_Over.price,
            confidence: Math.min(85, 100 / match.bestOdds.totals_Over.price) * 0.9,
            explanation: 'Tendance offensive'
        });
    }
    
    if (config.markets.includes('btts') && match.bestOdds?.btts_Yes) {
        elements.push({
            type: 'btts',
            value: 'Les deux équipes marquent',
            odds: match.bestOdds.btts_Yes.price,
            confidence: Math.min(85, 100 / match.bestOdds.btts_Yes.price),
            explanation: 'Historique buts'
        });
    }
    
    return { ...match, elements };
}

// =============================================================================
// 🧮 GÉNÈRE TOUTES LES COMBINAISONS POSSIBLES (FORCÉ)
// =============================================================================

function generateAllCombinations(matches, config) {
    console.log(`🔍 GÉNÈRE TOUTES LES COMBINAISONS (max ${config.maxMatches} matches)`);
    
    const combinations = [];
    
    function backtrack(index, currentCombo, currentOdds, usedTypes) {
        // ON AJOUTE TOUTES LES COMBINAISONS >= 2 matchs ✅
        if (currentCombo.length >= 2 && currentOdds >= 2.0) {
            combinations.push({
                matches: [...currentCombo],
                odds: currentOdds,
                confidence: calculateAverageConfidence(currentCombo)
            });
        }
        
        // On arrête si on a atteint le max
        if (currentCombo.length >= config.maxMatches || index >= matches.length) {
            return;
        }
        
        // Essayer d'ajouter ce match avec chaque élément
        for (const element of matches[index].elements) {
            if (isValidCombinationStrict(currentCombo, matches[index], element, usedTypes)) {
                currentCombo.push({ match: matches[index], element });
                backtrack(index + 1, currentCombo, currentOdds * element.odds, [...usedTypes, element.type]);
                currentCombo.pop();
            }
        }
        
        // Sauter ce match
        backtrack(index + 1, currentCombo, currentOdds, usedTypes);
    }
    
    backtrack(0, [], 1.0, []);
    console.log(`✅ ${combinations.length} combinaisons créées`);
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
// 🔍 TROUVE LE MEILLEUR + ALTERNATIVES
// =============================================================================

function findBestWithAlternatives(combinations, targetOdd) {
    if (!combinations.length) return null;
    
    // Trier par proximité à la côte cible
    const sorted = combinations.sort((a, b) => {
        const diffA = Math.abs(a.odds - targetOdd);
        const diffB = Math.abs(b.odds - targetOdd);
        if (diffA !== diffB) return diffA - diffB;
        return b.confidence - a.confidence; // Plus haute confiance si égalité
    });
    
    const best = sorted[0];
    const isExact = Math.abs(best.odds - targetOdd) < targetOdd * 0.1; // ±10% = exact
    
    // Générer 4 alternatives
    const alternatives = sorted.slice(1, 5).map(c => ({
        combination: c,
        message: `Alternative: Côte ${c.odds.toFixed(2)} (écart ${Math.abs(c.odds - targetOdd).toFixed(2)})`
    }));
    
    return {
        combination: best,
        isExact: isExact,
        difference: Math.abs(best.odds - targetOdd),
        alternatives: alternatives,
        strategy: 'flexible_forced'
    };
}

// =============================================================================
// 📝 ENRICHISSEMENT IA
// =============================================================================

async function enrichCombinationWithAI(combination) {
    // Texte par défaut si pas d'IA
    combination.explanation = `📊 COMBINÉ ${combination.matches.length} MATCHES
    
🎯 Côte totale: ${combination.odds.toFixed(2)}
📈 Confiance moyenne: ${combination.confidence.toFixed(0)}%

✅ ANALYSE:
- ${combination.matches.map(m => `${m.match.teams} (${m.element.value})`).join('\n- ')}

⚡ CONSEIL: Ce combiné respecte vos critères de base. Vérifiez les dernières infos d'équipe avant de jouer.`;
    
    if (!process.env.OPENAI_API_KEY) return combination;

    const matchNames = combination.matches.map(m => m.match.teams).join(', ');
    
    const prompt = `
COMBINÉ: ${matchNames}
Cote: ${combination.odds.toFixed(2)}
Confiance: ${combination.confidence.toFixed(0)}%

ANALYSE DÉTAILLÉE:
1. Pourquoi ce combiné est solide (3 phrases)
2. Point fort
3. Attention
4. Recommandation mise (ex: "2-3% bankroll")
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
        console.warn('⚠️ IA non disponible, utilisation du texte par défaut');
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

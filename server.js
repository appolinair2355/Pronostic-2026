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

// ============================================================================
// 📍 ROUTE PRINCIPALE : Génération d'un combiné optimisé
// ============================================================================
app.post('/api/generate-combine', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const config = req.body;
        
        // Validation
        if (!validateConfig(config)) {
            return res.status(400).json({
                success: false,
                error: 'Configuration invalide',
                details: getValidationErrors(config)
            });
        }

        const progressCallback = (percentage) => {
            console.log(`📊 Progression: ${percentage}%`);
        };

        progressCallback(10);
        const matchesWithData = await fetchMatchesFromOpenAI(config, progressCallback);
        
        progressCallback(30);
        const matchesWithSafeElements = await Promise.all(
            matchesWithData.slice(0, config.maxMatches * 2).map(match => 
                getSafeElementsForMatch(match, config, progressCallback)
            )
        );

        progressCallback(50);
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

        progressCallback(70);
        const bestCombination = findBestCombination(
            validCombinations,
            config.targetOdd
        );

        progressCallback(85);
        const enrichedResult = await enrichWithExplanations(bestCombination);

        progressCallback(100);
        
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

// ============================================================================
// 🔧 FONCTIONS UTILITAIRES
// ============================================================================

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

async function fetchMatchesFromOpenAI(config, progressCallback) {
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
                            const match = s.match(/\+(\d+\.\d+) @(\d+\.\d+)/);
                            return { line: parseFloat(match[1]), odds: parseFloat(match[2]) };
                        });
                    }
                }
            }
            
            if (match.teams) matches.push(match);
        } catch (e) {
            console.warn('Erreur parsing bloc:', e);
        }
    }
    
    return matches.slice(0, 15); // Max 15 matchs
}

async function getSafeElementsForMatch(match, config, progressCallback) {
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
                explanation: match[4]
            });
        }
    }
    
    // Vérifier la confiance
    const confidenceMatch = content.match(/Confiance: (\d+)%/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
    
    return elements.slice(0, 2).map(e => ({ ...e, confidence }));
}

function generateValidCombinations(matches, config) {
    const combinations = [];
    
    function backtrack(index, currentCombo, currentOdds, usedTypes) {
        // Condition d'arrêt : atteint le max ou trouvé une cote valide
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
            // Vérifier contraintes (pas victoire + tirs sur même match)
            const hasConflict = currentCombo.some(item => 
                item.match.id === matches[index].id && 
                ((item.element.type === 'victoire' && element.type === 'tirs_cadres') ||
                 (item.element.type === 'tirs_cadres' && element.type === 'victoire'))
            );
            
            if (hasConflict) continue;
            
            // Vérifier diversification
            const futureTypes = new Set([...usedTypes, element.type]);
            if (futureTypes.size < 2 && currentCombo.length > 0) continue;
            
            currentCombo.push({ match: matches[index], element });
            backtrack(index + 1, currentCombo, currentOdds * element.odds, [...usedTypes, element.type]);
            currentCombo.pop();
        }
        
        // Sauter ce match
        backtrack(index + 1, currentCombo, currentOdds, usedTypes);
    }
    
    backtrack(0, [], 1.0, []);
    return combinations;
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
        
        if (currentDiff < bestDiff || 
           (currentDiff === bestDiff && current.confidence > best.confidence)) {
            return current;
        }
        return best;
    });
}

async function enrichWithExplanations(combination) {
    if (!combination) return null;
    
    const matchNames = combination.matches.map(m => m.match.teams).join(', ');
    
    const prompt = `
Analyse ce combiné de paris et explique pourquoi il est solide :
- Matchs: ${matchNames}
- Cote totale: ${combination.odds.toFixed(2)}
- Confiance: ${combination.confidence.toFixed(0)}%

Donne :
1. Analyse du risque global (2-3 phrases)
2. Point fort du combiné
3. Point d'attention
4. Recommandation de mise
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

// ============================================================================
// 📍 ROUTES SUPPLÉMENTAIRES
// ============================================================================

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

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🚀 PRONOSAI PRO - IA ÉDITION       ║
║   📍 http://localhost:${PORT}          ║
║   🔑 OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'} Configurée     ║
║   ⚽ Version: 2.0 - 1xbet Ready       ║
╚═══════════════════════════════════════╝
    `);
});

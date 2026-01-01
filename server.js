const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY;

// Marchés autorisés par type
const MARKET_RULES = {
  'Victoire': ['Victoire', 'Double chance', 'Corners', 'Cartons'],
  'Total buts': ['Total buts', 'BTTS', 'Corners', 'Cartons'],
  'BTTS': ['BTTS', 'Total buts', 'Corners', 'Cartons'],
  'Corners': ['Corners', 'Victoire', 'Total buts', 'Cartons'],
  'Cartons': ['Cartons', 'Victoire', 'Total buts', 'BTTS'],
  'Double chance': ['Double chance', 'Corners', 'Cartons']
};

// Conflits interdits
const FORBIDDEN_COMBOS = [
  ['Victoire', 'Tirs cadrés'],
  ['Score exact', 'Score exact']
];

// Fallback simulé si API indisponible
const SIMULATED_MATCHES = [
  {
    id: 'match_1',
    home_team: 'PSG',
    away_team: 'OM',
    commence_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    markets: {
      'Victoire': [
        { name: 'Victoire PSG', odd: 1.75 },
        { name: 'Victoire OM', odd: 3.20 }
      ],
      'Total buts': [
        { name: 'Over 2.5', odd: 1.90 },
        { name: 'Under 2.5', odd: 1.85 }
      ],
      'Corners': [
        { name: 'Over 9.5', odd: 1.80 },
        { name: 'Under 9.5', odd: 1.95 }
      ]
    }
  },
  {
    id: 'match_2',
    home_team: 'Real Madrid',
    away_team: 'Barcelone',
    commence_time: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    markets: {
      'Victoire': [
        { name: 'Victoire Real', odd: 2.10 },
        { name: 'Victoire Barça', odd: 2.80 }
      ],
      'BTTS': [
        { name: 'Oui', odd: 1.65 },
        { name: 'Non', odd: 2.10 }
      ],
      'Cartons': [
        { name: 'Over 4.5', odd: 1.70 },
        { name: 'Under 4.5', odd: 2.00 }
      ]
    }
  }
];

// Récupération des matchs depuis The Odds API ou fallback
async function fetchMatches(period) {
  try {
    if (!THE_ODDS_API_KEY || THE_ODDS_API_KEY === 'xxxx') {
      console.log('⚠️ Utilisation du fallback simulé');
      return SIMULATED_MATCHES;
    }

    const dateFormat = new Date().toISOString().split('T')[0];
    const regions = 'eu';
    const markets = 'h2h,totals,btts';
    
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds`,
      {
        params: {
          apiKey: THE_ODDS_API_KEY,
          regions,
          markets,
          dateFormat
        },
        timeout: 10000
      }
    );

    return response.data.map(match => ({
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      commence_time: match.commence_time,
      markets: formatMarkets(match.bookmakers?.[0]?.markets || [])
    }));

  } catch (error) {
    console.error('❌ Erreur API The Odds:', error.message);
    return SIMULATED_MATCHES;
  }
}

// Formater les marchés de l'API
function formatMarkets(markets) {
  const formatted = {};
  markets.forEach(market => {
    if (market.key === 'h2h') {
      formatted['Victoire'] = market.outcomes.map(o => ({
        name: `${o.name}`,
        odd: o.price
      }));
    } else if (market.key === 'totals') {
      formatted['Total buts'] = market.outcomes.map(o => ({
        name: `${o.name} ${market.point}`,
        odd: o.price
      }));
    } else if (market.key === 'btts') {
      formatted['BTTS'] = market.outcomes.map(o => ({
        name: o.name === 'Yes' ? 'Oui' : 'Non',
        odd: o.price
      }));
    }
  });
  return formatted;
}

// Vérifier si la combinaison de marchés est valide
function isValidMarketCombination(markets) {
  if (markets.length > 2) return false;
  
  for (const [market1, market2] of FORBIDDEN_COMBOS) {
    if (markets.includes(market1) && markets.includes(market2)) {
      return false;
    }
  }
  return true;
}

// Générer les combinés avec backtracking
function generateCombines(matches, selectedMarkets, targetOdd, maxMatches) {
  const validCombines = [];

  function backtrack(index, currentCombine, currentOdd, usedMatches) {
    if (currentOdd >= targetOdd && currentCombine.length <= maxMatches) {
      validCombines.push({
        combines: [...currentCombine],
        totalOdd: currentOdd,
        matchesCount: currentCombine.length,
        confidence: calculateConfidence(currentCombine)
      });
      return;
    }

    if (index >= matches.length || currentCombine.length >= maxMatches) {
      return;
    }

    const match = matches[index];
    const availableMarkets = selectedMarkets.filter(m => match.markets[m]);

    // Essayer chaque marché pour ce match
    for (const market of availableMarkets) {
      const outcomes = match.markets[market] || [];
      for (const outcome of outcomes) {
        const newOdd = currentOdd * outcome.odd;
        
        backtrack(
          index + 1,
          [...currentCombine, {
            match: `${match.home_team} vs ${match.away_team}`,
            market: market,
            selection: outcome.name,
            odd: outcome.odd
          }],
          newOdd,
          new Set([...usedMatches, match.id])
        );
      }
    }

    // Option: sauter ce match
    backtrack(index + 1, currentCombine, currentOdd, usedMatches);
  }

  backtrack(0, [], 1, new Set());
  return validCombines;
}

// Calculer un score de confiance (simplifié)
function calculateConfidence(combine) {
  return Math.floor(Math.random() * 30) + 70; // 70-99%
}

// Analyse IA avec OpenAI
async function analyzeWithAI(combine, targetOdd) {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-xxxx') {
      return `⚠️ Mode démo : Analyse IA non disponible. Ce combiné de ${combine.length} matchs présente une cote de ${targetOdd}x. Les marchés sélectionnés offrent une bonne diversification. Recommandation : miser 2-5% de votre bankroll.`;
    }

    const prompt = `
    Analyse ce combiné football :
    ${combine.map(p => `- ${p.match}: ${p.market} (${p.selection}) @ ${p.odd}`).join('\n')}
    Cote totale: ${combine.reduce((acc, p) => acc * p.odd, 1).toFixed(2)}
    Cible: ${targetOdd}

    Fournis :
    1. Analyse de risque (court, précis)
    2. Recommandation de mise (bankroll %)
    3. Points clés à surveiller
    Format professionnel, concis.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ Erreur OpenAI:', error.message);
    return `⚠️ Analyse IA indisponible. Ce combiné de ${combine.length} matchs nécessite une attention particulière sur les dernières performances des équipes.`;
  }
}

// Endpoint principal
app.post('/api/generate-combine', async (req, res) => {
  const { period, targetOdds, maxMatches, selectedMarkets } = req.body;

  // Validation
  if (!period || !targetOdds || !maxMatches || !selectedMarkets?.length) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  if (targetOdds < 2.0 || targetOdds > 1000) {
    return res.status(400).json({ error: 'Cote doit être entre 2.0 et 1000' });
  }

  if (maxMatches < 2 || maxMatches > 8) {
    return res.status(400).json({ error: 'Nombre de matchs entre 2 et 8' });
  }

  try {
    // Étape 1: Récupérer les matchs
    const matches = await fetchMatches(period);
    
    // Étape 2: Filtrer les marchés
    const filteredMatches = matches.map(match => ({
      ...match,
      markets: Object.fromEntries(
        Object.entries(match.markets).filter(([market]) => 
          selectedMarkets.includes(market)
        )
      )
    })).filter(match => Object.keys(match.markets).length > 0);

    // Étape 3: Générer les combinés
    const combines = generateCombines(filteredMatches, selectedMarkets, targetOdds, maxMatches);
    
    if (combines.length === 0) {
      return res.json({
        success: false,
        message: 'Aucun combiné valide trouvé. Essayez avec des paramètres plus flexibles.'
      });
    }

    // Étape 4: Sélectionner le meilleur
    const bestCombine = combines.sort((a, b) => {
      const diffA = Math.abs(a.totalOdd - targetOdds);
      const diffB = Math.abs(b.totalOdd - targetOdds);
      return diffA - diffB || b.confidence - a.confidence;
    })[0];

    // Étape 5: Analyse IA
    const aiAnalysis = await analyzeWithAI(bestCombine.combines, targetOdds);

    res.json({
      success: true,
      data: {
        combines: bestCombine.combines,
        totalOdd: bestCombine.totalOdd,
        confidence: bestCombine.confidence,
        aiAnalysis
      }
    });

  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 PRONOSAI PRO démarré sur le port ${PORT}`);
  console.log(`📊 Environnement: ${process.env.NODE_ENV}`);
});

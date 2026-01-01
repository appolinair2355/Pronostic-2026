// =============================================================================
// CLIENT.JS - LOGIQUE FRONTEND + VÉRIFICATION API
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Frontend chargé');
    
    const form = document.getElementById('config-form');
    const progressSection = document.getElementById('progress-section');
    const resultsSection = document.getElementById('results-section');
    const generateBtn = document.getElementById('generate-btn');

    // VÉRIFICATION DES CLÉS API AU CHARGEMENT
    verifyAPIKeys();
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const config = getFormData();
        
        if (!validateForm(config)) {
            alert('❌ Sélectionnez au moins 2 marchés');
            return;
        }
        
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Analyse en cours...';
        
        showProgress();
        
        try {
            const response = await fetch('/api/generate-combine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            
            if (result.success) {
                displayResults(result.data, result.metadata);
            } else {
                showError(result.error || 'Erreur inconnue');
            }
            
        } catch (error) {
            console.error('❌ Erreur API:', error);
            showError('Erreur de connexion au serveur');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '🚀 GÉNÉRER MON COMBINÉ TEMPS RÉEL';
            hideProgress();
        }
    });

    // VÉRIFICATION DES CLÉS API
    async function verifyAPIKeys() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            if (!config.hasOpenAIKey || !config.hasOddsAPIKey) {
                document.getElementById('api-alert').classList.remove('hidden');
            }
            
            // Mettre à jour les indicateurs visuels
            const openaiStatus = document.getElementById('openai-status');
            const oddsapiStatus = document.getElementById('oddsapi-status');
            
            openaiStatus.className = config.hasOpenAIKey ? 'w-2 h-2 rounded-full mr-3 bg-green-500' : 'w-2 h-2 rounded-full mr-3 bg-red-500';
            oddsapiStatus.className = config.hasOddsAPIKey ? 'w-2 h-2 rounded-full mr-3 bg-green-500' : 'w-2 h-2 rounded-full mr-3 bg-red-500';
            
            document.getElementById('openai-status-text').textContent = config.hasOpenAIKey ? '✅ Connecté' : '❌ Clé manquante';
            document.getElementById('oddsapi-status-text').textContent = config.hasOddsAPIKey ? '✅ Connecté' : '❌ Clé manquante';
            
        } catch (error) {
            console.error('Erreur vérification API:', error);
        }
    }

    // RÉCUPÉRATION DONNÉES FORMULAIRE
    function getFormData() {
        const formData = new FormData(form);
        const period = formData.get('period');
        
        const config = {
            period: period,
            targetOdd: parseFloat(document.getElementById('target-odd').value),
            maxMatches: parseInt(formData.get('maxMatches')) || 5,
            markets: formData.getAll('markets')
        };
        
        if (period === 'custom') {
            const customInput = document.querySelector('input[name="period"][value="custom"]')
                .parentElement.querySelector('input[type="number"]');
            config.daysAhead = parseInt(customInput.value) || 3;
        }
        
        console.log('📦 Configuration envoyée:', config);
        return config;
    }

    // VALIDATION FORMULAIRE
    function validateForm(config) {
        return config.markets.length >= 2 &&
               config.targetOdd >= 2.0 &&
               config.targetOdd <= 1000.0;
    }

    // GESTION PROGRESSION
    function showProgress() {
        progressSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        updateProgress(0, 'Initialisation de l\'analyse IA...');
        
        anime({
            targets: progressSection,
            opacity: [0, 1],
            translateY: [50, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });
    }

    function hideProgress() {
        anime({
            targets: progressSection,
            opacity: [1, 0],
            translateY: [0, -50],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => progressSection.classList.add('hidden')
        });
    }

    function updateProgress(percentage, message) {
        document.getElementById('progress-bar').style.width = percentage + '%';
        document.getElementById('progress-text').textContent = message;
    }

    // AFFICHAGE RÉSULTATS
    function displayResults(data, metadata) {
        document.getElementById('total-odds').textContent = data.odds.toFixed(2);
        document.getElementById('match-count').textContent = data.matches.length;
        document.getElementById('confidence').textContent = data.confidence.toFixed(0) + '%';
        
        const targetOdd = parseFloat(document.getElementById('target-odd').value);
        const diff = Math.abs(data.odds - targetOdd).toFixed(2);
        document.getElementById('target-diff').textContent = diff;
        
        const detailsContainer = document.getElementById('combination-details');
        detailsContainer.innerHTML = data.matches.map(item => `
            <div class="border-l-4 border-orange-500 pl-4 py-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                <div class="font-semibold mb-1">${item.match.teams}</div>
                <div class="text-sm text-gray-400">
                    ${item.element.value} (Côte ${item.element.odds}) - ${item.element.explanation}
                </div>
                <div class="text-xs text-green-400 mt-1">Confiance: ${item.element.confidence}%</div>
            </div>
        `).join('');
        
        document.getElementById('explanation').textContent = data.explanation || 'Analyse non disponible.';
        
        // Afficher section résultats
        resultsSection.classList.remove('hidden');
        anime({
            targets: resultsSection,
            opacity: [0, 1],
            translateY: [100, 0],
            duration: 800,
            easing: 'easeOutQuad'
        });
        
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    }

    function showError(message) {
        alert(`❌ Erreur: ${message}\n\nVérifiez la console pour plus de détails.`);
    }
});

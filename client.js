// =============================================================================
// PRONOSAI PRO - CLIENT.JS
// Gestion du formulaire, progression et affichage des résultats
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 PronosAI Pro Frontend chargé sur port 10000');
    
    const form = document.getElementById('config-form');
    const progressSection = document.getElementById('progress-section');
    const resultsSection = document.getElementById('results-section');
    const generateBtn = document.getElementById('generate-btn');
    
    // Gestion du formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const config = getFormData();
        
        if (!validateForm(config)) {
            alert('❌ Veuillez sélectionner au moins 2 marchés');
            return;
        }
        
        // Désactiver le bouton pendant l'analyse
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
            showError('Erreur de connexion au serveur. Vérifiez que le backend tourne sur le port 10000.');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '🚀 GÉNÉRER MON COMBINÉ';
            hideProgress();
        }
    });
    
    // Gestion du bouton "Régénérer"
    document.getElementById('regenerate-btn').addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Validation du formulaire
    function getFormData() {
        const formData = new FormData(form);
        const period = formData.get('period');
        
        const config = {
            period: period,
            targetOdd: parseFloat(document.getElementById('target-odd').value),
            maxMatches: parseInt(formData.get('maxMatches')) || 5,
            markets: formData.getAll('markets')
        };
        
        // Gestion du nombre de jours personnalisé
        if (period === 'custom') {
            const customInput = document.querySelector('input[name="period"][value="custom"]')
                .parentElement.querySelector('input[type="number"]');
            config.daysAhead = parseInt(customInput.value) || 3;
        }
        
        return config;
    }
    
    function validateForm(config) {
        return config.markets.length >= 2 &&
               config.targetOdd >= 2.0 &&
               config.targetOdd <= 100.0;
    }
    
    // Gestion de la progression
    function showProgress() {
        progressSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        updateProgress(0, 'Initialisation de l\'analyse IA...');
        
        // Animation d'entrée
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
    
    // Affichage des résultats
    function displayResults(data, metadata) {
        // Remplir les statistiques
        document.getElementById('total-odds').textContent = data.odds.toFixed(2);
        document.getElementById('match-count').textContent = data.matches.length;
        document.getElementById('confidence').textContent = data.confidence.toFixed(0) + '%';
        
        const targetOdd = parseFloat(document.getElementById('target-odd').value);
        const diff = Math.abs(data.odds - targetOdd).toFixed(2);
        document.getElementById('target-diff').textContent = diff;
        
        // Afficher les détails des matchs
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
        
        // Afficher l'explication IA
        document.getElementById('explanation').textContent = data.explanation || 'Analyse non disponible.';
        
        // Afficher les métadonnées dans la console
        console.log('📊 Métadonnées:', metadata);
        
        // Animation d'entrée
        resultsSection.classList.remove('hidden');
        anime({
            targets: resultsSection,
            opacity: [0, 1],
            translateY: [100, 0],
            duration: 800,
            easing: 'easeOutQuad'
        });
        
        // Scroll vers les résultats
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    }
    
    function showError(message) {
        alert(`❌ Erreur: ${message}\n\nVérifiez la console pour plus de détails.`);
    }
});
      

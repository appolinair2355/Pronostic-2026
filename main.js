// Configuration et état global
const state = {
    selectedPeriod: null,
    selectedMatches: new Set(),
    coteValue: null,
    isLoading: false,
    matchesData: []
};

// Données de matchs simulées
const mockMatches = {
    today: [
        { id: 1, home: 'Paris SG', away: 'Marseille', date: 'Aujourd\'hui 20:45', cote: 1.85, market: '1N2' },
        { id: 2, home: 'Lyon', away: 'Monaco', date: 'Aujourd\'hui 19:00', cote: 2.10, market: '1N2' },
        { id: 3, home: 'Real Madrid', away: 'Barcelone', date: 'Aujourd\'hui 21:00', cote: 1.95, market: '1N2' },
        { id: 4, home: 'Man City', away: 'Liverpool', date: 'Aujourd\'hui 18:30', cote: 2.25, market: '1N2' },
        { id: 5, home: 'Bayern Munich', away: 'Dortmund', date: 'Aujourd\'hui 20:30', cote: 1.70, market: '1N2' }
    ],
    tomorrow: [
        { id: 6, home: 'Arsenal', away: 'Chelsea', date: 'Demain 20:45', cote: 2.40, market: '1N2' },
        { id: 7, home: 'Juventus', away: 'Inter Milan', date: 'Demain 19:00', cote: 2.15, market: '1N2' },
        { id: 8, home: 'Atletico Madrid', away: 'Seville', date: 'Demain 21:00', cote: 1.80, market: '1N2' },
        { id: 9, home: 'Roma', away: 'Naples', date: 'Demain 18:00', cote: 2.35, market: '1N2' },
        { id: 10, home: 'Ajax', away: 'PSV', date: 'Demain 20:00', cote: 2.05, market: '1N2' }
    ],
    day2: [
        { id: 11, home: 'Milan AC', away: 'Lazio', date: 'J+2 20:45', cote: 1.90, market: '1N2' },
        { id: 12, home: 'Tottenham', away: 'Man United', date: 'J+2 19:00', cote: 2.30, market: '1N2' },
        { id: 13, home: 'Leverkusen', away: 'Leipzig', date: 'J+2 20:30', cote: 2.20, market: '1N2' },
        { id: 14, home: 'Porto', away: 'Benfica', date: 'J+2 21:00', cote: 2.45, market: '1N2' },
        { id: 15, home: 'Fenerbahce', away: 'Galatasaray', date: 'J+2 19:30', cote: 1.75, market: '1N2' }
    ],
    day3: [
        { id: 16, home: 'Borussia Dortmund', away: 'Wolfsburg', date: 'J+3 20:30', cote: 1.65, market: '1N2' },
        { id: 17, home: 'Athletic Bilbao', away: 'Real Sociedad', date: 'J+3 21:00', cote: 2.00, market: '1N2' },
        { id: 18, home: 'Lille', away: 'Rennes', date: 'J+3 20:00', cote: 2.15, market: '1N2' },
        { id: 19, home: 'West Ham', away: 'Aston Villa', date: 'J+3 19:00', cote: 2.25, market: '1N2' },
        { id: 20, home: 'Sporting CP', away: 'Braga', date: 'J+3 21:15', cote: 1.85, market: '1N2' }
    ],
    week: [
        { id: 21, home: 'Liverpool', away: 'Arsenal', date: 'Dans 4 jours', cote: 2.10, market: '1N2' },
        { id: 22, home: 'Barcelone', away: 'Atletico Madrid', date: 'Dans 5 jours', cote: 1.95, market: '1N2' },
        { id: 23, home: 'Manchester City', away: 'Chelsea', date: 'Dans 6 jours', cote: 1.70, market: '1N2' },
        { id: 24, home: 'Real Madrid', away: 'Seville', date: 'Dans 7 jours', cote: 1.55, market: '1N2' },
        { id: 25, home: 'PSG', away: 'Lyon', date: 'Dans 7 jours', cote: 1.80, market: '1N2' }
    ]
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 PronosAI démarré');
    
    // Vérifier que les éléments existent
    const coteInput = document.getElementById('cote-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    
    if (!coteInput) {
        console.error('❌ Champ côte introuvable !');
        alert('Erreur: Champ de saisie de côte manquant');
        return;
    }
    
    if (!analyzeBtn) {
        console.error('❌ Bouton analyser introuvable !');
        alert('Erreur: Bouton d\'analyse manquant');
        return;
    }
    
    initializeParticles();
    initializeSliders();
    initializeAnimations();
    initializeEventListeners();
    loadMatches('today');
    
    console.log('✅ Interface initialisée avec succès');
});

// Particules d'arrière-plan
function initializeParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = Math.random() > 0.5 ? 'particle' : 'particle blue';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 4) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Initialisation des sliders Splide
function initializeSliders() {
    // Vérifier que les éléments existent
    const periodSlider = document.getElementById('period-slider');
    if (!periodSlider) {
        console.warn('⚠️ Slider des périodes non trouvé');
        return;
    }
    
    // Slider pour les périodes
    new Splide('#period-slider', {
        type: 'slide',
        perPage: 3,
        perMove: 1,
        gap: '1rem',
        padding: '2rem',
        arrows: true,
        pagination: false,
        breakpoints: {
            768: {
                perPage: 2,
                padding: '1rem'
            },
            480: {
                perPage: 1,
                padding: '2rem'
            }
        }
    }).mount();
    
    // Slider pour les matchs
    const matchesSliderEl = document.getElementById('matches-slider');
    if (matchesSliderEl) {
        window.matchesSlider = new Splide('#matches-slider', {
            type: 'slide',
            perPage: 3,
            perMove: 1,
            gap: '1.5rem',
            padding: '2rem',
            arrows: true,
            pagination: false,
            breakpoints: {
                1024: {
                    perPage: 2
                },
                768: {
                    perPage: 1,
                    padding: '3rem'
                }
            }
        });
    }
}

// Animations de défilement
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                
                // Animation stagger pour les éléments enfants
                const staggerElements = entry.target.querySelectorAll('.stagger');
                staggerElements.forEach((el, index) => {
                    setTimeout(() => {
                        el.classList.add('active');
                    }, index * 100);
                });
            }
        });
    }, observerOptions);
    
    // Observer les éléments avec animation reveal
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });
}

// Écouteurs d'événements
function initializeEventListeners() {
    // Sélection de période
    document.querySelectorAll('.period-option').forEach(option => {
        option.addEventListener('click', function() {
            const period = this.dataset.period;
            if (period) {
                selectPeriod(period);
            } else {
                console.error('❌ Période non définie sur la card');
            }
        });
    });
    
    // Saisie de cote
    const coteInput = document.getElementById('cote-input');
    if (coteInput) {
        coteInput.addEventListener('input', function() {
            validateCote(this.value);
        });
        
        // DEBUG : Vérifier que le champ est accessible
        console.log('✅ Champ côte trouvé et prêt');
    }
    
    // Bouton analyser
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzePredictions);
        console.log('✅ Bouton analyser trouvé et prêt');
    }
    
    // Scroll smooth pour la navigation
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// Sélection de période
function selectPeriod(period) {
    if (!period) {
        console.error('❌ Aucune période fournie');
        return;
    }
    
    // Mise à jour visuelle
    document.querySelectorAll('.period-option').forEach(option => {
        option.classList.remove('active');
    });
    
    const selectedEl = document.querySelector(`[data-period="${period}"]`);
    if (selectedEl) {
        selectedEl.classList.add('active');
        
        // Animation de transition
        anime({
            targets: selectedEl,
            scale: [1, 1.05, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });
    }
    
    state.selectedPeriod = period;
    loadMatches(period);
    updateAnalyzeButton();
    
    console.log(`✅ Période sélectionnée: ${period}`);
    
    // Si une côte est déjà saisie, déclencher l'analyse automatique
    if (state.coteValue && state.coteValue >= 1.10 && state.coteValue <= 10.00) {
        setTimeout(() => {
            console.log('🔄 Déclenchement analyse automatique...');
            analyzePredictions();
        }, 500);
    }
}

// Chargement des matchs
function loadMatches(period) {
    const matchesList = document.getElementById('matches-list');
    if (!matchesList) {
        console.error('❌ Liste des matchs introuvable');
        return;
    }
    
    const matches = mockMatches[period] || [];
    console.log(`📊 Chargement de ${matches.length} matchs pour ${period}`);
    
    // Animation de sortie
    anime({
        targets: '#matches-list .splide__slide',
        opacity: 0,
        translateY: 20,
        duration: 200,
        easing: 'easeInQuad',
        complete: () => {
            matchesList.innerHTML = '';
            
            matches.forEach((match, index) => {
                const matchCard = createMatchCard(match);
                const slide = document.createElement('li');
                slide.className = 'splide__slide';
                slide.appendChild(matchCard);
                matchesList.appendChild(slide);
            });
            
            // Réinitialiser le slider
            if (window.matchesSlider) {
                window.matchesSlider.destroy();
                window.matchesSlider = new Splide('#matches-slider', {
                    type: 'slide',
                    perPage: 3,
                    perMove: 1,
                    gap: '1.5rem',
                    padding: '2rem',
                    arrows: true,
                    pagination: false,
                    breakpoints: {
                        1024: { perPage: 2 },
                        768: { perPage: 1, padding: '3rem' }
                    }
                }).mount();
            }
            
            // Animation d'entrée
            anime({
                targets: '#matches-list .match-card',
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 400,
                delay: anime.stagger(100),
                easing: 'easeOutQuad'
            });
        }
    });
}

// Création d'une card de match
function createMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card glass-card rounded-xl p-6 cursor-pointer';
    card.dataset.matchId = match.id;
    
    card.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-sm text-gray-400 mb-2">${match.date}</div>
            <div class="flex items-center justify-center space-x-3 mb-3">
                <div class="text-right">
                    <div class="font-semibold">${match.home}</div>
                </div>
                <div class="text-gray-500">VS</div>
                <div class="text-left">
                    <div class="font-semibold">${match.away}</div>
                </div>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-sm text-gray-400">Côte</div>
                <div class="text-lg font-bold text-orange-400">${match.cote}</div>
            </div>
            <div class="mt-2">
                <span class="inline-block bg-blue-500 bg-opacity-20 text-blue-400 text-xs px-2 py-1 rounded">${match.market}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => toggleMatchSelection(match.id, card));
    
    return card;
}

// Toggle sélection de match
function toggleMatchSelection(matchId, cardElement) {
    if (!cardElement) return;
    
    if (state.selectedMatches.has(matchId)) {
        state.selectedMatches.delete(matchId);
        cardElement.classList.remove('selected');
        
        anime({
            targets: cardElement,
            scale: [1.05, 1],
            duration: 200,
            easing: 'easeOutQuad'
        });
    } else {
        state.selectedMatches.add(matchId);
        cardElement.classList.add('selected');
        
        anime({
            targets: cardElement,
            scale: [1, 1.05],
            duration: 200,
            easing: 'easeOutQuad'
        });
    }
    
    updateAnalyzeButton();
}

// Validation de la cote
function validateCote(value) {
    const coteInput = document.getElementById('cote-input');
    if (!coteInput) return;
    
    const cote = parseFloat(value);
    
    if (value === '' || (cote >= 1.10 && cote <= 10.00)) {
        coteInput.classList.remove('error-shake');
        state.coteValue = cote;
        updateAnalyzeButton();
        
        console.log(`✅ Côte validée: ${cote}`);
        
        // Déclencher l'analyse automatique si une période est sélectionnée
        if (state.selectedPeriod && cote >= 1.10 && cote <= 10.00) {
            setTimeout(() => {
                console.log('🔄 Déclenchement analyse automatique après saisie côte...');
                analyzePredictions();
            }, 500);
        }
    } else {
        coteInput.classList.add('error-shake');
        setTimeout(() => {
            coteInput.classList.remove('error-shake');
        }, 500);
        state.coteValue = null;
        updateAnalyzeButton();
        console.log('❌ Côte invalide');
    }
}

// Mise à jour du bouton analyser
function updateAnalyzeButton() {
    const btn = document.getElementById('analyze-btn');
    if (!btn) return;
    
    const hasValidCote = state.coteValue && state.coteValue >= 1.10 && state.coteValue <= 10.00;
    const hasSelectedPeriod = state.selectedPeriod;
    
    if (hasValidCote && hasSelectedPeriod && !state.isLoading) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        console.log('✅ Bouton activé');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        console.log('🚫 Bouton désactivé');
    }
}

// Analyse des pronostics
async function analyzePredictions() {
    if (state.isLoading) {
        console.log('⚠️ Analyse déjà en cours');
        return;
    }
    
    if (!state.selectedPeriod) {
        showError('Veuillez d\'abord sélectionner une période');
        return;
    }
    
    if (!state.coteValue || state.coteValue < 1.10 || state.coteValue > 10.00) {
        showError('Veuillez saisir une côte valide (1.10 - 10.00)');
        return;
    }
    
    state.isLoading = true;
    updateAnalyzeButton();
    
    console.log('🚀 Lancement de l\'analyse...');
    
    // Animation du bouton
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const loadingContainer = document.getElementById('loading-container');
    
    if (btnText) btnText.textContent = 'Analyse en cours...';
    if (btnSpinner) btnSpinner.classList.remove('hidden');
    
    // Afficher la barre de chargement
    if (loadingContainer) {
        loadingContainer.classList.remove('hidden');
        loadingContainer.classList.add('flex');
        
        // Animation d'entrée
        anime({
            targets: loadingContainer,
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });
    }
    
    try {
        // Récupérer automatiquement tous les matchs de la période sélectionnée
        const matchesForPeriod = mockMatches[state.selectedPeriod] || [];
        
        console.log(`📊 Analyse de ${matchesForPeriod.length} matchs...`);
        
        // Appel API réel au serveur
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cote: state.coteValue,
                matches: matchesForPeriod,
                period: state.selectedPeriod,
                automatic: true  // Indiquer que c'est une analyse automatique
            })
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de l\'analyse');
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Analyse terminée avec succès');
            // Afficher les résultats
            displayResults(matchesForPeriod);
        } else {
            throw new Error(result.error || 'Analyse échouée');
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error);
        showError('Une erreur est survenue lors de l\'analyse.');
    } finally {
        // Masquer la barre de chargement
        if (loadingContainer) {
            anime({
                targets: loadingContainer,
                opacity: [1, 0],
                duration: 300,
                easing: 'easeInQuad',
                complete: () => {
                    loadingContainer.classList.add('hidden');
                    loadingContainer.classList.remove('flex');
                }
            });
        }
        
        // Réinitialiser le bouton
        state.isLoading = false;
        if (btnText) btnText.textContent = 'Analyser Automatiquement';
        if (btnSpinner) btnSpinner.classList.add('hidden');
        updateAnalyzeButton();
    }
}

// Affichage des résultats
function displayResults(matchesForPeriod = null) {
    const resultsSection = document.getElementById('results-section');
    const pronosticContent = document.getElementById('pronostic-content');
    const fiabiliteContent = document.getElementById('fiabilite-content');
    const matchDetails = document.getElementById('match-details');
    
    if (!resultsSection || !pronosticContent || !fiabiliteContent || !matchDetails) {
        console.error('❌ Éléments de résultats introuvables');
        return;
    }
    
    // Générer les résultats simulés
    const results = generateMockResults();
    
    // Remplir le contenu
    pronosticContent.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <span class="font-medium">Type de pari</span>
                <span class="text-orange-400">Combiné ${results.type}</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <span class="font-medium">Côte totale</span>
                <span class="text-green-400 font-bold">${results.totalCote}</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <span class="font-medium">Confiance</span>
                <span class="text-blue-400">${results.confiance}%</span>
            </div>
            <div class="mt-4 p-4 bg-gradient-to-r from-orange-500/20 to-blue-500/20 rounded-lg">
                <p class="text-sm text-gray-300">${results.recommendation}</p>
            </div>
        </div>
    `;
    
    fiabiliteContent.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <span>Fiabilité globale</span>
                <div class="w-32 bg-gray-700 rounded-full h-2">
                    <div class="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" style="width: ${results.fiabilite}%"></div>
                </div>
                <span class="text-green-400">${results.fiabilite}%</span>
            </div>
            <div class="flex items-center justify-between">
                <span>Tendance historique</span>
                <div class="w-32 bg-gray-700 rounded-full h-2">
                    <div class="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full" style="width: ${results.tendance}%"></div>
                </div>
                <span class="text-orange-400">${results.tendance}%</span>
            </div>
            <div class="mt-4 p-3 bg-blue-500 bg-opacity-10 rounded-lg">
                <p class="text-sm text-blue-300">${results.analysis}</p>
            </div>
        </div>
    `;
    
    // Détails des matchs - utiliser les matchs de la période automatiquement
    const matchesToDisplay = matchesForPeriod || [];
    
    matchDetails.innerHTML = matchesToDisplay.map(match => `
        <div class="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div class="flex-1">
                <div class="font-medium">${match.home} vs ${match.away}</div>
                <div class="text-sm text-gray-400">${match.date}</div>
            </div>
            <div class="text-right">
                <div class="text-orange-400 font-bold">${match.cote}</div>
                <div class="text-xs text-gray-400">${match.market}</div>
            </div>
        </div>
    `).join('');
    
    // Afficher la section avec animation
    resultsSection.classList.remove('hidden');
    
    anime({
        targets: resultsSection,
        opacity: [0, 1],
        translateY: [50, 0],
        duration: 600,
        easing: 'easeOutQuad'
    });
    
    // Scroll vers les résultats
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Génération de résultats simulés
function generateMockResults() {
    const matchCount = state.selectedMatches.size;
    const baseCote = state.coteValue || 2.0;
    
    return {
        type: matchCount > 2 ? 'Multiple' : 'Simple',
        totalCote: (baseCote * matchCount * 0.85).toFixed(2),
        confiance: Math.min(85 + matchCount * 5, 95),
        fiabilite: Math.min(70 + matchCount * 8, 92),
        tendance: Math.min(60 + matchCount * 10, 88),
        recommendation: `Combiné de ${matchCount} matchs avec une côte cible de ${baseCote}. Recommandation: mise modérée avec gestion de bankroll.`,
        analysis: `Analyse basée sur les statistiques récentes, la forme des équipes et les tendances historiques. Le niveau de confiance est élevé pour cette sélection.`
    };
}

// Affichage d'erreur
function showError(message) {
    // Créer une notification d'erreur
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    anime({
        targets: notification,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuad'
    });
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        anime({
            targets: notification,
            translateX: [0, 300],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }
        });
    }, 3000);
}

// Fonction utilitaire pour le formatage des nombres
function formatNumber(num, decimals = 2) {
    return parseFloat(num).toFixed(decimals);
}

// Fonction pour obtenir le nom de la période sélectionnée
function getPeriodName(period) {
    const names = {
        today: 'Match du Jour',
        tomorrow: 'Match de Demain',
        day2: 'Match dans 2 Jours',
        day3: 'Match dans 3 Jours',
        week: 'Match de la Semaine'
    };
    return names[period] || 'Période inconnue';
}

// DEBUG : Vérifier le DOM complet après chargement
setTimeout(() => {
    console.log('📋 DOM complet chargé');
    console.log('- Champ côte:', document.getElementById('cote-input') ? '✅' : '❌');
    console.log('- Bouton analyser:', document.getElementById('analyze-btn') ? '✅' : '❌');
    console.log('- Slider périodes:', document.getElementById('period-slider') ? '✅' : '❌');
    console.log('- Slider matchs:', document.getElementById('matches-slider') ? '✅' : '❌');
    console.log('- Conteneur chargement:', document.getElementById('loading-container') ? '✅' : '❌');
    console.log('- Section résultats:', document.getElementById('results-section') ? '✅' : '❌');
}, 1000);

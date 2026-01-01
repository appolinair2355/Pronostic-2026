document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pronosForm');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const progressBar = document.getElementById('progressBar');
  const analyzeBtn = document.getElementById('analyzeBtn');

  // Gestion des cases marchés
  const marketCheckboxes = document.querySelectorAll('.market-checkbox');
  marketCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const input = checkbox.querySelector('input');
        input.checked = !input.checked;
      }
      checkbox.classList.toggle('selected', checkbox.querySelector('input').checked);
    });
  });

  // Soumission formulaire
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedMarkets = Array.from(document.querySelectorAll('.market-checkbox input:checked'))
      .map(input => input.value);

    if (selectedMarkets.length === 0) {
      alert('⚠️ Veuillez sélectionner au moins un marché');
      return;
    }

    const formData = {
      period: document.getElementById('period').value,
      targetOdds: parseFloat(document.getElementById('targetOdds').value),
      maxMatches: parseInt(document.getElementById('maxMatches').value),
      selectedMarkets
    };

    loadingSection.classList.add('active');
    resultsSection.classList.remove('show');
    analyzeBtn.disabled = true;
    
    simulateProgress();

    try {
      const response = await fetch('/api/generate-combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        displayResults(data.data);
      } else {
        displayError(data.message || 'Erreur lors de la génération');
      }

    } catch (error) {
      console.error('❌ Erreur:', error);
      displayError('Erreur réseau. Veuillez réessayer.');
    } finally {
      loadingSection.classList.remove('active');
      setTimeout(() => { analyzeBtn.disabled = false; }, 1000);
    }
  });

  // Simulation progression
  function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 95) progress = 95;
      progressBar.style.width = progress + '%';
      progressBar.textContent = Math.floor(progress) + '%';
      
      if (!loadingSection.classList.contains('active')) {
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        clearInterval(interval);
        setTimeout(() => {
          progressBar.style.width = '0%';
          progressBar.textContent = '0%';
        }, 500);
      }
    }, 300);
  }

  // Afficher résultats
  function displayResults(data) {
    const html = `
      <div class="result-card">
        <h2 style="text-align: center; margin-bottom: 20px;">🎯 Combiné Généré</h2>
        <div class="odds-display">${data.totalOdd.toFixed(2)}x</div>
        <div style="text-align: center; margin-bottom: 20px; opacity: 0.8;">
          Confiance IA: ${data.confidence}%
        </div>
        
        <div class="matches-list">
          ${data.combines.map(p => `
            <div class="match-item">
              <div class="match-header">${p.match}</div>
              <div class="match-detail">
                ${p.market}: <strong>${p.selection}</strong> @ ${p.odd.toFixed(2)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="ai-analysis">
        <div class="ai-title">🤖 Analyse IA OpenAI</div>
        <div style="line-height: 1.6;">
          ${data.aiAnalysis.replace(/\n/g, '<br>')}
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <button onclick="location.reload()" class="analyze-btn" style="max-width: 300px; margin: 0 auto;">
          🔄 Nouvelle Analyse
        </button>
      </div>
    `;

    resultsSection.innerHTML = html;
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Afficher erreur
  function displayError(message) {
    resultsSection.innerHTML = `
      <div class="error-message">
        <h3>❌ Erreur</h3>
        <p>${message}</p>
      </div>
    `;
    resultsSection.classList.add('show');
  }
});

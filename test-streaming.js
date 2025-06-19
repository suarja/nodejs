const fetch = require('node-fetch');

/**
 * Test minimal du streaming pour les endpoints scripts
 */
async function testScriptStreaming() {
  console.log('🧪 Test de streaming des scripts...');
  
  const baseUrl = 'http://localhost:3001';
  const testData = {
    message: "Écris-moi un court script de 30 secondes sur les bienfaits du café",
    outputLanguage: "fr",
    streaming: true
  };

  try {
    // Test de création d'un nouveau chat avec streaming
    console.log('🔄 Test POST /api/scripts/chat (streaming)...');
    
    const response = await fetch(`${baseUrl}/api/scripts/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Token de test
      },
      body: JSON.stringify(testData)
    });

    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ Endpoint de streaming configuré correctement');
      console.log('📡 Content-Type:', response.headers.get('content-type'));
      
      // Simuler la lecture du stream (sans vraiment lire pour ce test)
      console.log('🎯 Stream prêt pour le test client');
      return true;
    } else {
      console.log('❌ Problème avec le streaming');
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      return false;
    }
    
  } catch (error) {
    console.log('❌ Erreur de connexion:', error.message);
    console.log('ℹ️  Le serveur doit être démarré avec: npm start');
    return false;
  }
}

/**
 * Test des endpoints de base (non-streaming)
 */
async function testBasicEndpoints() {
  console.log('🧪 Test des endpoints de base...');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Test GET /api/scripts
    console.log('🔄 Test GET /api/scripts...');
    const response = await fetch(`${baseUrl}/api/scripts`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    if (response.ok) {
      console.log('✅ Endpoint /api/scripts accessible');
      return true;
    } else {
      console.log('❌ Problème avec /api/scripts, Status:', response.status);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Erreur de connexion:', error.message);
    return false;
  }
}

/**
 * Test principal
 */
async function runTests() {
  console.log('🚀 Démarrage des tests de script chat...\n');
  
  const basicTest = await testBasicEndpoints();
  const streamingTest = await testScriptStreaming();
  
  console.log('\n📊 Résultats des tests:');
  console.log(`📡 Endpoints de base: ${basicTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔄 Streaming: ${streamingTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (basicTest && streamingTest) {
    console.log('\n🎉 Tous les tests passent ! Le backend est prêt.');
    console.log('📋 Prochaine étape: Tester l\'UI frontend avec streaming');
  } else {
    console.log('\n⚠️  Certains tests échouent. Vérifiez la configuration.');
  }
}

// Exécuter les tests
runTests().catch(console.error); 
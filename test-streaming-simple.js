const fetch = require('node-fetch');

/**
 * Test simple du streaming sans authentification
 */
async function testStreamingEndpoint() {
  console.log('🚀 Test de l\'endpoint de streaming simple...\n');

  const baseUrl = 'http://localhost:3001';

  try {
    // Test 1: Endpoint normal (non-streaming)
    console.log('🧪 Test 1: Mode normal...');
    
    const normalResponse = await fetch(`${baseUrl}/api/test/streaming`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ streaming: false })
    });

    if (normalResponse.ok) {
      const data = await normalResponse.json();
      console.log('✅ Mode normal réussi:', data.message);
    } else {
      console.log('❌ Mode normal échoué, Status:', normalResponse.status);
      return false;
    }

    // Test 2: Endpoint streaming
    console.log('\n🧪 Test 2: Mode streaming...');
    
    const streamResponse = await fetch(`${baseUrl}/api/test/streaming`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ streaming: true })
    });

    if (streamResponse.ok && streamResponse.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ Headers de streaming corrects');
      console.log('📡 Content-Type:', streamResponse.headers.get('content-type'));
      
      // Lire le stream
      const reader = streamResponse.body;
      let streamData = '';
      
      return new Promise((resolve) => {
        reader.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          streamData += chunkStr;
          console.log('📦 Chunk reçu:', chunkStr.trim());
        });
        
        reader.on('end', () => {
          console.log('\n✅ Stream terminé avec succès');
          console.log('📊 Données complètes reçues :', streamData.length, 'caractères');
          
          // Vérifier qu'on a reçu les messages attendus
          const hasStart = streamData.includes('message_start');
          const hasContent = streamData.includes('content_delta');
          const hasComplete = streamData.includes('message_complete');
          
          console.log('\n🔍 Validation du contenu:');
          console.log(`   Message start: ${hasStart ? '✅' : '❌'}`);
          console.log(`   Content delta: ${hasContent ? '✅' : '❌'}`);
          console.log(`   Message complete: ${hasComplete ? '✅' : '❌'}`);
          
          if (hasStart && hasContent && hasComplete) {
            console.log('\n🎉 TEST DE STREAMING RÉUSSI !');
            console.log('💡 Le feedback temps réel fonctionne parfaitement');
            resolve(true);
          } else {
            console.log('\n⚠️  Contenu du stream incomplet');
            resolve(false);
          }
        });
        
        reader.on('error', (error) => {
          console.log('❌ Erreur de stream:', error.message);
          resolve(false);
        });
      });
      
    } else {
      console.log('❌ Problème avec le streaming');
      console.log('Status:', streamResponse.status);
      console.log('Content-Type:', streamResponse.headers.get('content-type'));
      return false;
    }

  } catch (error) {
    console.log('❌ Erreur:', error.message);
    return false;
  }
}

// Exécuter le test
testStreamingEndpoint()
  .then(success => {
    if (success) {
      console.log('\n🚀 Prochaine étape: Tester l\'interface frontend avec streaming');
      console.log('📋 Le backend est prêt pour l\'intégration!');
    } else {
      console.log('\n⚠️  Des problèmes persistent. Vérifiez la configuration.');
    }
  })
  .catch(console.error); 
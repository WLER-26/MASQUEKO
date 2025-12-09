// Arquivo: back/config/firebaseConfig.js
const admin = require('firebase-admin');
const path = require('path');

// Caminho para sua chave de conta de serviço
// ESTE ARQUIVO PRECISA EXISTIR NESTA PASTA
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });

  const db = admin.firestore();
  const auth = admin.auth();

  console.log('✅ Conexão com Firebase Admin SDK estabelecida!');

  module.exports = { db, auth, admin };
} catch (error) {
  console.error(`❌ Erro ao conectar com Firebase Admin: ${error.message}`);
  console.error("---");
  console.error("VERIFIQUE SE O ARQUIVO 'firebase-service-account.json' ESTÁ NA PASTA 'back/config/'");
  console.error("---");
  process.exit(1);
}
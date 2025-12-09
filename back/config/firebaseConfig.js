const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadServiceAccount() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim() !== '') {
      console.log("⚡ Carregando credenciais Firebase via variável de ambiente.");
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    // fallback local apenas para desenvolvimento (não commitado)
    const localPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(localPath)) {
      console.log("⚠️ Carregando credenciais Firebase via arquivo local (DEV).");
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }

    throw new Error("Nenhuma credencial Firebase encontrada. Defina FIREBASE_SERVICE_ACCOUNT_JSON.");
  } catch (err) {
    console.error("❌ Erro ao carregar credenciais Firebase:", err);
    process.exit(1);
  }
}

const serviceAccount = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // storageBucket: process.env.FIREBASE_STORAGE_BUCKET // descomente se usar storage
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };

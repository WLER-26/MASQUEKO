// Arquivo: test-db.js

require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI;

console.log('------------------------------------');
console.log('INICIANDO TESTE DE CONEXÃO...');
console.log('URI que será usada:', mongoURI);
console.log('------------------------------------');

if (!mongoURI) {
    console.error('ERRO FATAL: A variável MONGO_URI não foi encontrada no seu arquivo .env!');
    process.exit(1); // Encerra o script
}

const connectDB = async () => {
    try {
        await mongoose.connect(mongoURI);
        
        console.log('✅ ✅ ✅ SUCESSO! A conexão com o MongoDB foi estabelecida com este script!');
        console.log('Isso prova que sua string de conexão, senha, IP e rede estão corretos.');
        console.log('Se este script funciona, mas o server.js não, o problema está no arquivo server.js.');

    } catch (error) {
        console.error('❌ ❌ ❌ FALHA NA CONEXÃO! O erro detalhado foi:');
        console.error(error);
        console.log('\nIsso prova que o problema NÃO está na lógica do seu app, mas sim na string de conexão, senha, lista de IPs ou um bloqueio de rede.');

    } finally {
        // Fecha a conexão para que o script possa terminar
        await mongoose.connection.close();
    }
};

connectDB();

// Arquivo: back/middleware/authMiddleware.js
const { auth, db } = require('../config/firebaseConfig');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obter token do header (formato: "Bearer TOKEN")
            token = req.headers.authorization.split(' ')[1];

            // Verificar o token usando o Firebase Admin
            const decodedToken = await auth.verifyIdToken(token);

            // Verifica se a rota atual é a de registro
            // Usamos .includes() para ser mais seguro contra barras no final ou prefixos de api
            const isRegisterRoute = req.originalUrl.includes('/auth/register');

            // Buscamos o perfil completo do usuário no Firestore
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();

            if (!userDoc.exists) {
                // CENÁRIO DE REGISTRO:
                // Se o usuário NÃO existe no banco, mas está tentando acessar a rota de registro,
                // permitimos que ele passe. O controller 'register' vai criar o documento.
                if (isRegisterRoute) {
                    req.user = { id: decodedToken.uid }; // Anexa apenas o ID para o controller usar
                    return next(); // DEIXA PASSAR para criar a conta
                }
                
                // Se não for rota de registro e não tiver perfil, bloqueia.
                return res.status(404).json({ message: 'Usuário não encontrado no Firestore. Termine seu cadastro.' });
            }

            // Se o usuário já existe, anexa os dados completos ao request
            req.user = {
                id: userDoc.id, // Este é o UID
                ...userDoc.data()
            };
            
            next();
        } catch (error) {
            console.error('Erro na verificação do token:', error);
            // Se o token expirou ou é inválido
            res.status(401).json({ message: 'Não autorizado, token inválido ou expirado.' });
        }
    }

    if (!token) {
        // Se não enviou token nenhum
        res.status(401).json({ message: 'Não autorizado, sem token.' });
    }
};
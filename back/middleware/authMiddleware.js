// Arquivo: back/middleware/authMiddleware.js
const { auth, db } = require('../config/firebaseConfig');

exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decodedToken = await auth.verifyIdToken(token);
            const isRegisterRoute = req.originalUrl.includes('/auth/register');
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();

            if (!userDoc.exists) {
                if (isRegisterRoute) {
                    req.user = { id: decodedToken.uid };
                    return next();
                }
                return res.status(404).json({ message: 'Usuário não encontrado.' });
            }

            // Injeta dados do usuário E se é admin
            const userData = userDoc.data();
            req.user = {
                id: userDoc.id,
                ...userData,
                isAdmin: !!userData.isAdmin // Garante booleano
            };
            
            next();
        } catch (error) {
            console.error('Erro auth:', error);
            res.status(401).json({ message: 'Não autorizado.' });
        }
    } else {
        res.status(401).json({ message: 'Sem token.' });
    }
};

// Middleware para garantir que é Admin
exports.adminOnly = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado: Apenas administradores.' });
    }
};
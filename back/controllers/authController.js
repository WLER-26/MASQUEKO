// Arquivo: back/controllers/authController.js
const { db } = require('../config/firebaseConfig');

// @desc    Registrar dados do usuário no Firestore (após o frontend criar no Firebase Auth)
// @route   POST /api/auth/register
// @access  Private (só o usuário recém-criado pode fazer isso)
exports.register = async (req, res) => {
    const { name, email } = req.body;
    // O ID vem do middleware (req.user.id), pois no registro req.user não tem os dados completos ainda
    const uid = req.user.id; 

    if (!name || !email) {
        return res.status(400).json({ message: 'Nome e Email são obrigatórios.' });
    }

    try {
        // Verifica se o usuário já tem um perfil (dupla checagem)
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (doc.exists) {
            return res.status(400).json({ message: 'Usuário já possui um perfil cadastrado.' });
        }

        // Dados padrão do novo usuário
        const newUser = {
            _id: uid, // Salva o ID explicitamente
            name,
            email,
            bio: 'Olá! Sou novo(a) na MASQUEKO!',
            avatar: 'assets/profile-pic.png', // Avatar padrão local
            friends: [],
            friendRequests: [],
            createdAt: new Date().toISOString()
        };

        // Cria o documento do usuário no Firestore usando o UID como chave
        await userRef.set(newUser);

        console.log(`Novo usuário registrado: ${name} (${email})`);
        res.status(201).json(newUser);

    } catch (error) {
        console.error("Erro ao registrar usuário no Firestore:", error);
        res.status(500).json({ message: 'Erro interno ao salvar perfil do usuário.' });
    }
};


// @desc    Login (obsoleto no backend, tratado pelo Firebase no frontend)
// @route   POST /api/auth/login
// @access  Public
exports.login = (req, res) => {
    res.status(400).json({ message: 'A rota de login é gerenciada pelo Firebase SDK no cliente.' });
};


// @desc    Obter dados do usuário logado
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    // req.user foi definido no middleware 'protect' e já contém os dados do Firestore
    if (!req.user) {
        return res.status(404).json({ message: 'Perfil de usuário não encontrado.' });
    }
    res.status(200).json(req.user);
};
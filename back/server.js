require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// --- CONFIGURAÇÕES DO FIREBASE ---
const { db, admin, auth } = require('./config/firebaseConfig');

// --- IMPORTAÇÃO DAS ROTAS ---
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const communityRoutes = require('./routes/communityRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const reportRoutes = require('./routes/reportRoutes'); // Denúncias
const sponsorRoutes = require('./routes/sponsorRoutes'); // Patrocínios

// --- JOBS ---
const startDigestJob = require('./jobs/digestCron');

// --- INICIALIZAÇÃO ---
const app = express();
const server = http.createServer(app);

// Configuração do Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, restrinja para o domínio do seu site
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Inicia Cron Job de Emails
if (process.env.ENABLE_CRON === 'true') {
    startDigestJob();
}

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve a pasta de uploads estática com permissões CORS
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', (req, res, next) => {
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
}, express.static(uploadsPath));

// Injeta 'io' em todas as requisições
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- DEFINIÇÃO DE ROTAS DA API ---
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes); // Rota de Denúncias
app.use('/api/sponsors', sponsorRoutes); // Rota de Patrocínios

// --- LÓGICA DO SOCKET.IO (TEMPO REAL) ---
const onlineUsers = new Map();

// Middleware de Autenticação do Socket
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Autenticação falhou: Sem token'));
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        next();
    } catch (error) {
        console.error("Erro socket auth:", error.message);
        next(new Error('Token inválido'));
    }
});

io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    // Rastreia usuário online
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId: userId, status: 'online' });

    // Entra na sala pessoal e sala global
    socket.join(userId); 
    socket.join('global_feed');

    // Entra nas salas das comunidades que participa
    try {
        const communitiesSnapshot = await db.collection('communities')
            .where('members', 'array-contains', userId)
            .get();
        communitiesSnapshot.forEach(doc => {
            socket.join(`community_${doc.id}`);
        });
    } catch (error) {
        console.error("Erro ao entrar nas salas de comunidade:", error);
    }

    // Evento: Solicitar quem está online
    socket.on('get_online_users', () => {
        const onlineList = Array.from(onlineUsers.keys());
        socket.emit('online_users_list', onlineList);
    });

    // Evento: Mensagem Privada
    socket.on('privateMessage', async ({ recipientId, text, audioUrl, sharedPost }) => {
        if (!recipientId || (!text && !audioUrl && !sharedPost)) return; 

        const messageData = {
            senderId: userId,
            recipientId: recipientId,
            text: text || '', 
            audioUrl: audioUrl || null, 
            sharedPost: sharedPost || null,
            createdAt: new Date().toISOString(),
        };

        try {
            // Salva no Firestore
            const docRef = await db.collection('messages').add(messageData);
            const newMessage = { _id: docRef.id, ...messageData };
            
            // Envia para o destinatário
            io.to(recipientId).emit('new_message_notification', newMessage);
            io.to(recipientId).emit('newMessage', newMessage); 
            
            // Envia de volta para o remetente
            if (recipientId !== userId) {
                io.to(userId).emit('newMessage', newMessage);
            }
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
        }
    });

    // Evento: Entrar em sala de comunidade específica
    socket.on('join_community_room', (communityId) => {
        socket.join(`community_${communityId}`);
    });

    // Desconexão
    socket.on('disconnect', () => {
        onlineUsers.delete(userId);
        io.emit('user_status', { userId: userId, status: 'offline' });
    });
});

// --- SERVIR O FRONTEND (SPA) ---
const frontEndPath = path.join(__dirname, '../front');
app.use(express.static(frontEndPath));

app.get('/', (req, res) => res.redirect('/pages/home.html'));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ message: 'Rota não encontrada' });
    }
    const file404 = path.join(frontEndPath, '404.html');
    if (fs.existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send('Página não encontrada');
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 9090;

server.listen(PORT, () => {
    console.log(`🚀 Servidor MASQUEKO rodando na porta ${PORT}`);
    console.log(`📂 Uploads servidos em /uploads`);
});
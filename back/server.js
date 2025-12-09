// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");

dotenv.config();

// ----------------------
// 🔥 IMPORTAÇÃO CORRIGIDA DO FIREBASE (SEM ARQUIVO FÍSICO)
// ----------------------
const admin = require('firebase-admin');

// Função segura para carregar as credenciais
function loadFirebaseCredentials() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim() !== "") {
            console.log("⚡ Carregando credenciais Firebase via variável de ambiente.");
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        }

        // fallback local (somente em desenvolvimento)
        const localPath = path.join(__dirname, 'config', 'firebase-service-account.json');
        if (fs.existsSync(localPath)) {
            console.log("⚠️ Carregando credenciais Firebase via arquivo local (DEV).");
            return JSON.parse(fs.readFileSync(localPath, 'utf8'));
        }

        throw new Error("Nenhuma credencial Firebase encontrada.");
    } catch (err) {
        console.error("❌ Erro ao carregar credenciais Firebase:", err);
        process.exit(1);
    }
}

const serviceAccount = loadFirebaseCredentials();

// Inicializando o Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();
// ---------------------------------------------------------

// Importa Cron Job de E-mails
const startDigestJob = require('./jobs/digestCron');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Inicia cron job
startDigestJob();

const onlineUsers = new Map();

// Middleware de autenticação do socket
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Autenticação falhou: Sem token'));
    try {
        const decodedToken = await auth.verifyIdToken(token);
        socket.userId = decodedToken.uid;
        next();
    } catch (error) {
        console.error("Erro socket auth:", error.message);
        next(new Error('Token inválido'));
    }
});

// Conexão dos sockets
io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔔 Socket conectado: ${userId}`);

    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, status: 'online' });

    socket.join(userId);
    socket.join('global_feed');

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

    socket.on('get_online_users', () => {
        const onlineList = Array.from(onlineUsers.keys());
        socket.emit('online_users_list', onlineList);
    });

    socket.on('privateMessage', async ({ recipientId, text, audioUrl, sharedPost }) => {
        if (!recipientId || (!text && !audioUrl && !sharedPost)) return;

        const messageData = {
            senderId: userId,
            recipientId,
            text: text || '',
            audioUrl: audioUrl || null,
            sharedPost: sharedPost || null,
            createdAt: new Date().toISOString(),
        };

        try {
            const docRef = await db.collection('messages').add(messageData);
            const newMessage = { _id: docRef.id, ...messageData };

            io.to(recipientId).emit('new_message_notification', newMessage);
            io.to(recipientId).emit('newMessage', newMessage);

            if (recipientId !== userId) {
                io.to(userId).emit('newMessage', newMessage);
            }
        } catch (error) {
            console.error("Erro mensagem:", error);
        }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(userId);
        io.emit('user_status', { userId, status: 'offline' });
        console.log(`🔕 Socket desconectado: ${userId}`);
    });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    req.io = io;
    next();
});

// Rota de arquivos enviados
app.get('/uploads/:folder/:file', (req, res) => {
    const { folder, file } = req.params;
    const filePath = path.join(__dirname, 'uploads', folder, file);
    if (fs.existsSync(filePath)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.sendFile(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', (req, res, next) => {
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
}, express.static(uploadsPath));

// Rotas da API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/communities', require('./routes/communityRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

const frontEndPath = path.join(__dirname, '../front');
app.use(express.static(frontEndPath));

app.get('/', (req, res) => res.redirect('/pages/home.html'));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ message: 'Rota não encontrada' });
    }
    const file = path.join(frontEndPath, '404.html');
    fs.existsSync(file) ? res.status(404).sendFile(file) : res.status(404).send('404');
});

// Porta fornecida pelo Render
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

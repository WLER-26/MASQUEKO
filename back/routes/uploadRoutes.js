// Arquivo: back/routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadType = req.body.uploadType || 'posts';
        if (file.mimetype.startsWith('audio/')) {
            uploadType = 'audios';
        }
        const dir = path.join(__dirname, '../uploads', uploadType);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        let finalName = `${uniqueSuffix}-${safeName}`;
        if (file.mimetype === 'audio/webm' && !finalName.endsWith('.webm')) {
            finalName += '.webm';
        }
        cb(null, finalName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp', 
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo inválido.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

router.post('/', protect, (req, res) => {
    // Aceita array de arquivos (até 5)
    const uploader = upload.array('files', 5); 

    uploader(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        
        const files = req.files || (req.file ? [req.file] : []);
        
        if (files.length === 0) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });

        const filePaths = files.map(file => {
            let uploadType = req.body.uploadType || 'posts';
            if (file.mimetype.startsWith('audio/')) uploadType = 'audios';
            return `uploads/${uploadType}/${file.filename}`;
        });

        console.log(`✅ Arquivos salvos:`, filePaths);

        res.status(201).json({
            message: 'Upload concluído!',
            filePaths: filePaths, 
            filePath: filePaths[0] // Compatibilidade legado
        });
    });
});

module.exports = router;
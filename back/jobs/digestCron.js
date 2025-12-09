// Arquivo: back/jobs/digestCron.js
const cron = require('node-cron');
const { db } = require('../config/firebaseConfig');
const { sendEmail } = require('../utils/emailService');

const startDigestJob = () => {
    console.log('⏰ Cron Job de Digest inicializado');

    // Agendamento: '0 9 * * *' = Todo dia às 09:00
    // Para TESTAR AGORA, mude para '*/1 * * * *' (roda a cada 1 minuto)
    cron.schedule('0 9 * * *', async () => {
        console.log('⏳ Iniciando processamento do Digest Diário...');
        
        try {
            const usersSnapshot = await db.collection('users').get();
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9090';
            
            // Define o intervalo de tempo (últimas 24h)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let emailsSent = 0;

            for (const userDoc of usersSnapshot.docs) {
                const user = userDoc.data();
                
                // Pula se usuário não tem e-mail cadastrado
                if (!user.email) continue;

                // Busca notificações não lidas e recentes (últimas 24h)
                const notifSnapshot = await db.collection('notifications')
                    .where('recipientId', '==', userDoc.id)
                    .where('read', '==', false)
                    .where('createdAt', '>=', yesterday.toISOString())
                    .get();

                if (!notifSnapshot.empty) {
                    const notifications = notifSnapshot.docs.map(d => d.data());
                    
                    // Monta o HTML do E-mail
                    const listItems = notifications.map(n => 
                        `<li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                            ${n.message} 
                            <a href="${frontendUrl}${n.link || '/pages/home.html'}" style="text-decoration: none; color: #7c3aed; font-size: 0.8em;">(Ver)</a>
                        </li>`
                    ).join('');

                    const htmlBody = `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #7c3aed; padding: 20px; text-align: center; color: white;">
                                <h1 style="margin: 0;">MASQUEKO</h1>
                                <p style="margin: 5px 0 0;">Seu resumo diário</p>
                            </div>
                            <div style="padding: 20px;">
                                <p>Olá <strong>${user.name}</strong>,</p>
                                <p>Você perdeu algumas coisas nas últimas 24 horas. Aqui está o que aconteceu:</p>
                                <ul style="list-style: none; padding: 0;">
                                    ${listItems}
                                </ul>
                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${frontendUrl}/pages/home.html" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir para o MASQUEKO</a>
                                </div>
                            </div>
                            <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 0.8em; color: #777;">
                                <p>Você recebeu este e-mail porque possui notificações não lidas.</p>
                            </div>
                        </div>
                    `;

                    // Envia o e-mail
                    const subject = `Resumo Diário: ${notifications.length} novidades no MASQUEKO`;
                    const success = await sendEmail(user.email, subject, htmlBody);
                    if (success) emailsSent++;
                }
            }
            console.log(`✅ Digest concluído. E-mails enviados: ${emailsSent}`);

        } catch (error) {
            console.error('❌ Erro fatal no Digest Cron:', error);
        }
    });
};

module.exports = startDigestJob;
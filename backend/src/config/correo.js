const nodemailer = require('nodemailer');

// Mismo servidor SMTP que usa el módulo de notificaciones (variables SMTP_* del .env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    family: 4,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const REMITENTE = process.env.SMTP_FROM || '"Club Valle Alto" <no-reply@club.com>';

module.exports = { transporter, REMITENTE };

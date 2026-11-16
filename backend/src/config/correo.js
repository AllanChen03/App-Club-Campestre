const nodemailer = require('nodemailer');

// Envío de correos del sistema.
// - Con BREVO_API_KEY: se envía por la API web de Brevo (HTTPS). Es lo que se usa
//   en Vercel, porque muchos hostings gratuitos bloquean los puertos SMTP.
// - Sin BREVO_API_KEY: se usa el servidor SMTP de las variables SMTP_* (por
//   ejemplo Ethereal para probar en local).

const NOMBRE_REMITENTE = 'Club Valle Alto';
const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';
const ESPERA_MAXIMA_MS = 15000;

let transporter = null;
function transporterSmtp() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            family: 4,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

function remitenteSmtp() {
    if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
    if (process.env.CORREO_REMITENTE) return `"${NOMBRE_REMITENTE}" <${process.env.CORREO_REMITENTE}>`;
    return `"${NOMBRE_REMITENTE}" <no-reply@club.com>`;
}

async function enviarPorBrevo({ para, asunto, texto }) {
    const remitente = process.env.CORREO_REMITENTE;
    if (!remitente) throw new Error('Falta CORREO_REMITENTE (el correo verificado en Brevo)');

    const respuesta = await fetch(URL_BREVO, {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify({
            sender: { name: NOMBRE_REMITENTE, email: remitente },
            to: [{ email: para }],
            subject: asunto,
            textContent: texto
        }),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS)
    });

    if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        throw new Error(`Brevo respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }
}

// Envía un correo de texto. Lanza un error si no se pudo enviar.
async function enviarCorreo({ para, asunto, texto }) {
    if (!para) throw new Error('El destinatario no tiene correo');

    if (process.env.BREVO_API_KEY) {
        return enviarPorBrevo({ para, asunto, texto });
    }

    await transporterSmtp().sendMail({ from: remitenteSmtp(), to: para, subject: asunto, text: texto });
}

const medioDeEnvio = () => (process.env.BREVO_API_KEY ? 'Brevo' : 'SMTP');

module.exports = { enviarCorreo, medioDeEnvio };

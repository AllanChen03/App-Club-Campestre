require('dotenv').config(); 

const express = require('express');
const cors = require('cors');

// Importar rutas existentes
const authRoutes = require('./src/routes/authRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');

// Importar tus rutas nuevas del módulo financiero y notificaciones
const finanzasRoutes = require('./src/routes/finanzasRoutes');
const notificacionesRoutes = require('./src/routes/notificacionesRoutes');

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Club Valle Alto funcionando'
    });
});

// Registrar rutas en la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

module.exports = app;
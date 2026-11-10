
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');

const usuariosRoutes = require('./src/routes/usuariosRoutes');

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

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

module.exports = app;

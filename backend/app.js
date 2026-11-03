
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Club Valle Alto funcionando'
    });
});

app.use('/api/auth', authRoutes);

module.exports = app;

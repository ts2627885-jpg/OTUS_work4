const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Middleware безопасности
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);

// Protected routes example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Protected route', user: req.user });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║      АЗС-Пульт Backend API v2.1       ║
║  Server running on port ${PORT}       ║
║  Environment: ${process.env.NODE_ENV || 'development'}          ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;

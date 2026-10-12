// Backend server with authentication
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Handle preflight requests
app.options('*', cors());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Demo users database
const demoUsers = {
  'admin': { id: 1, username: 'admin', email: 'admin@example.com', password: 'Admin123456', role: 'admin' },
  'user': { id: 2, username: 'user', email: 'user@example.com', password: 'User123456', role: 'user' },
  'demo': { id: 3, username: 'demo', email: 'demo@example.com', password: 'Demo123456', role: 'user' }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API root
app.get('/api', (req, res) => {
  res.json({ message: 'AZS Pult API v2.1.0' });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, email, password } = req.body;

  if ((!username && !email) || !password) {
    return res.status(400).json({ error: 'Username/Email and password required' });
  }

  // Find user by username or email
  let user;
  if (username) {
    user = demoUsers[username];
  } else if (email) {
    user = Object.values(demoUsers).find(u => u.email === email);
  }

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected route - get current user
app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Get users list
app.get('/api/users', (req, res) => {
  res.json({ users: Object.values(demoUsers).map(u => ({
    id: u.id,
    email: u.email,
    role: u.role
  })) });
});

// Demo route
app.get('/api/demo', (req, res) => {
  res.json({
    message: 'Demo endpoint',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Demo users:');
  console.log('  - admin / Admin123456');
  console.log('  - user / User123456');
  console.log('  - demo / Demo123456');
});

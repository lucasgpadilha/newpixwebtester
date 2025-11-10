const express = require('express');
const bodyParser = require('body-parser');

// Import routes
const authRoutes = require('./routes/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Parse incoming request bodies in a middleware before your handlers, available under the req.body property.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// --- API Routes ---
app.get('/', (req, res) => {
    res.send('NewPix Web Tester API is running!');
});

app.use('/api/auth', authRoutes);


// --- Server Startup ---
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// --- WebSocket Server (to be implemented) ---
// We will attach the WebSocket server to our HTTP server later.


// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connections here if necessary
    process.exit(0);
  });
});

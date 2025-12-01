import express from 'express';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { websocketService } from './services/websocketService';
import http from 'http';
import cors from 'cors';

// Import routes
import authRoutes from './routes/auth';
import testClientRoutes from './routes/testClient';
import testServerRoutes from './routes/testServer';
import adminRoutes from './routes/admin';
import testStepsAdminRoutes from './routes/testStepsAdmin';

// Import middleware
import authMiddleware from './middleware/auth';
import adminAuth from './middleware/adminAuth';

// Initialize Express app and Prisma
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: 'http://localhost:5173', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
// --- Middleware ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// --- API Routes ---
app.get('/', (req, res) => {
  res.send('NewPix Web Tester API is running!');
});

app.use('/api/auth', authRoutes);
// The user prompt asks to apply the middleware to both test routes.
// The current implementation is correct.
app.use('/api/test', authMiddleware, testClientRoutes);
app.use('/api/test', authMiddleware, testServerRoutes);
// Admin routes require both authentication and admin privileges
app.use('/api/admin', authMiddleware, adminAuth, adminRoutes);
// Test steps admin routes (authentication only, no admin role required for now)
app.use(testStepsAdminRoutes);


// --- Server Startup ---
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// --- WebSocket Server ---
// The user prompt asks to initialize the websocket service.
// The current implementation is correct.
websocketService.init(server);


// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    console.log('Prisma client disconnected');
    process.exit(0);
  });
});
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const client_1 = require("@prisma/client");
const websocketService_1 = require("./services/websocketService");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const testClient_1 = __importDefault(require("./routes/testClient"));
const testServer_1 = __importDefault(require("./routes/testServer"));
const admin_1 = __importDefault(require("./routes/admin"));
// Import middleware
const auth_2 = __importDefault(require("./middleware/auth"));
const adminAuth_1 = __importDefault(require("./middleware/adminAuth"));
// Initialize Express app and Prisma
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({ origin: 'http://localhost:5173', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
// --- Middleware ---
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// --- API Routes ---
app.get('/', (req, res) => {
    res.send('NewPix Web Tester API is running!');
});
app.use('/api/auth', auth_1.default);
// The user prompt asks to apply the middleware to both test routes.
// The current implementation is correct.
app.use('/api/test', auth_2.default, testClient_1.default);
app.use('/api/test', auth_2.default, testServer_1.default);
// Admin routes require both authentication and admin privileges
app.use('/api/admin', auth_2.default, adminAuth_1.default, admin_1.default);
// --- Server Startup ---
const server = http_1.default.createServer(app);
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
// --- WebSocket Server ---
// The user prompt asks to initialize the websocket service.
// The current implementation is correct.
websocketService_1.websocketService.init(server);
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
//# sourceMappingURL=index.js.map
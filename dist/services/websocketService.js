"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const connections = new Map();
const init = (server) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws) => {
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'auth' && data.token) {
                    try {
                        const payload = jsonwebtoken_1.default.verify(data.token, config_1.JWT_SECRET);
                        const ra = payload.user.ra;
                        if (ra) {
                            connections.set(ra, ws);
                            console.log(`WebSocket connection established and authenticated for RA: ${ra}`);
                            ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful' }));
                            ws.on('close', () => {
                                console.log(`WebSocket connection closed for RA: ${ra}`);
                                connections.delete(ra);
                            });
                        }
                        else {
                            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token or missing RA' }));
                        }
                    }
                    catch (error) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or token' }));
                    }
                }
            }
            catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });
        ws.send(JSON.stringify({ type: 'info', message: 'Please authenticate by sending { "type": "auth", "token": "your_jwt" }' }));
    });
    console.log('WebSocket service initialized');
};
const sendToUser = (ra, message) => {
    const ws = connections.get(ra);
    if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    console.log(`Could not send message to RA ${ra}, no active WebSocket connection found.`);
    return false;
};
exports.websocketService = {
    init,
    sendToUser,
};
//# sourceMappingURL=websocketService.js.map
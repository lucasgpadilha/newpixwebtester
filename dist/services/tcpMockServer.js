"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTcpMockServer = void 0;
const net_1 = __importDefault(require("net"));
const websocketService_1 = require("./websocketService");
const tempDbService_1 = require("./tempDbService");
const rules_1 = __importDefault(require("../rules"));
const validator_1 = require("../validator");
const startTcpMockServer = (testId, db, userRa) => {
    const server = net_1.default.createServer((socket) => {
        let currentState = 'AWAITING_CONNECT';
        let buffer = '';
        console.log(`[${testId}] Client connected.`);
        websocketService_1.websocketService.sendToUser(userRa, { event: 'info', message: 'Client connected to mock server.' });
        socket.on('data', (data) => {
            buffer += data.toString();
            // Process buffer line by line
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.substring(0, newlineIndex);
                buffer = buffer.substring(newlineIndex + 1);
                let json;
                try {
                    // The validator handles JSON parsing internally
                    (0, validator_1.validateClient)(line);
                    json = JSON.parse(line); // We parse again here, which is slightly inefficient but safe.
                    console.log(`[${testId}] Received:`, json);
                    // State machine logic
                    handleState(json);
                }
                catch (e) {
                    const errorMsg = e instanceof validator_1.ValidationError ? e.message : 'Invalid JSON or validation error.';
                    const errorResponse = { status: false, info: errorMsg };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                    websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'validation', status: 'FAIL', details: errorMsg });
                    console.error(`[${testId}] Validation failed:`, errorMsg);
                }
            }
        });
        const handleState = (json) => {
            // This will be a big switch statement
            switch (currentState) {
                case 'AWAITING_CONNECT':
                    if (json.operacao === rules_1.default.CONECTAR) {
                        const response = { status: true, info: 'Connection successful.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'connect', status: 'OK' });
                        currentState = 'AWAITING_REGISTER';
                    }
                    else {
                        const response = { status: false, info: 'Expected "conectar" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'connect', status: 'FAIL', details: 'Did not send "conectar" as first operation.' });
                    }
                    break;
                // ... other states will be implemented here
                default:
                    const response = { status: false, info: `Invalid operation for current state: ${currentState}` };
                    socket.write(JSON.stringify(response) + '\n');
            }
        };
        socket.on('close', () => {
            console.log(`[${testId}] Client disconnected.`);
            websocketService_1.websocketService.sendToUser(userRa, { event: 'info', message: 'Client disconnected.' });
            tempDbService_1.tempDbService.destroyTempDb(db, testId);
        });
        socket.on('error', (err) => {
            console.error(`[${testId}] Socket error:`, err);
            websocketService_1.websocketService.sendToUser(userRa, { event: 'error', message: `Socket error: ${err.message}` });
        });
    });
    return server;
};
exports.startTcpMockServer = startTcpMockServer;
//# sourceMappingURL=tcpMockServer.js.map
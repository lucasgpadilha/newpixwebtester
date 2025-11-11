"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerTest = void 0;
const net_1 = __importDefault(require("net"));
const websocketService_1 = require("./websocketService");
const rules_1 = __importDefault(require("../rules"));
const validator_1 = require("../validator");
// Helper to wait for the next full JSON message from the server
const waitForResponse = (client, buffer) => {
    return new Promise((resolve, reject) => {
        const onData = (data) => {
            buffer.data += data.toString();
            const newlineIndex = buffer.data.indexOf('\n');
            if (newlineIndex !== -1) {
                const line = buffer.data.substring(0, newlineIndex);
                buffer.data = buffer.data.substring(newlineIndex + 1);
                cleanup(); // Remove listeners once we have a message
                try {
                    const json = JSON.parse(line);
                    resolve(json);
                }
                catch (e) {
                    reject(new Error('Invalid JSON from server'));
                }
            }
        };
        const onError = (err) => {
            cleanup();
            reject(err);
        };
        const onClose = () => {
            cleanup();
            reject(new Error('Connection closed before response was received.'));
        };
        const cleanup = () => {
            client.removeListener('data', onData);
            client.removeListener('error', onError);
            client.removeListener('close', onClose);
        };
        client.on('data', onData);
        client.on('error', onError);
        client.on('close', onClose);
    });
};
const runServerTest = async (ip, port, ra) => {
    const testSteps = [];
    let client = null;
    const addStep = (step, status, details) => {
        testSteps.push({ step, status, details });
        websocketService_1.websocketService.sendToUser(ra, { event: 'test_step', step, status, details });
    };
    try {
        client = net_1.default.createConnection({ host: ip, port });
        const buffer = { data: '' }; // Use object to be mutable across promises
        await new Promise((resolve, reject) => {
            client?.on('connect', resolve);
            client?.on('error', reject);
        });
        addStep('Connection to Server', 'OK');
        // 1. Test 'conectar'
        if (!client)
            throw new Error("Client not connected"); // Type guard
        client.write(JSON.stringify({ operacao: rules_1.default.CONECTAR }) + '\n');
        const connectResponse = await waitForResponse(client, buffer);
        try {
            // The validator expects a string, not an object
            (0, validator_1.validateServer)(JSON.stringify(connectResponse));
            if (connectResponse.status === true) {
                addStep('Protocol: Conectar', 'OK');
            }
            else {
                addStep('Protocol: Conectar', 'FAIL', 'Server returned status: false');
                throw new Error('"Conectar" step failed.');
            }
        }
        catch (e) {
            const errorMsg = e instanceof validator_1.ValidationError ? e.message : 'Validation failed';
            addStep('Protocol: Conectar', 'FAIL', errorMsg);
            throw new Error(`"Conectar" step failed: ${errorMsg}`);
        }
        // ... More test steps will be added here
    }
    catch (error) {
        console.error(`[Test for ${ra}] Error: ${error.message}`);
        addStep('Test Execution', 'FAIL', error.message);
    }
    finally {
        if (client) {
            client.end();
        }
        console.log(`[Test for ${ra}] Test finished. Results:`, testSteps);
        // Here we would save the results to the persistent DB
        // scoringService.calculateAndSave(testSteps, 'SERVER');
        websocketService_1.websocketService.sendToUser(ra, { event: 'test_finished', results: testSteps });
    }
};
exports.runServerTest = runServerTest;
//# sourceMappingURL=tcpTestRunner.js.map
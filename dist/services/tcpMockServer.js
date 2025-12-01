"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTcpMockServer = void 0;
const net_1 = __importDefault(require("net"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const websocketService_1 = require("./websocketService");
const tempDbService_1 = require("./tempDbService");
const scoringService_1 = require("./scoringService");
const rules_1 = __importDefault(require("../rules"));
const validator_1 = require("../validator");
// Helper functions for database operations
const dbRun = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
};
const dbGet = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};
const dbAll = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
const startTcpMockServer = (testId, db, userRa) => {
    const server = net_1.default.createServer((socket) => {
        let currentState = 'AWAITING_CONNECT';
        let buffer = '';
        let currentToken = null;
        const testSteps = [];
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
                    // State machine logic (async, but we don't await to avoid blocking)
                    handleState(json).catch((err) => {
                        console.error(`[${testId}] Error in handleState:`, err);
                        const errorResponse = { operacao: json?.operacao || 'unknown', status: false, info: 'Internal server error.' };
                        socket.write(JSON.stringify(errorResponse) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'error', message: `State handler error: ${err.message}` });
                    });
                }
                catch (e) {
                    const errorMsg = e instanceof validator_1.ValidationError ? e.message : 'Invalid JSON or validation error.';
                    const errorResponse = { operacao: json?.operacao || 'unknown', status: false, info: errorMsg };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                    websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'validation', status: 'FAIL', details: errorMsg });
                    console.error(`[${testId}] Validation failed:`, errorMsg);
                }
            }
        });
        const handleState = async (json) => {
            switch (currentState) {
                case 'AWAITING_CONNECT':
                    if (json.operacao === rules_1.default.CONECTAR) {
                        const response = { operacao: rules_1.default.CONECTAR, status: true, info: 'Connection successful.' };
                        socket.write(JSON.stringify(response) + '\n');
                        testSteps.push({ step: 'connect', status: 'OK' });
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'connect', status: 'OK' });
                        currentState = 'AWAITING_REGISTER';
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "conectar" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'connect', status: 'FAIL', details: 'Did not send "conectar" as first operation.' });
                    }
                    break;
                case 'AWAITING_REGISTER':
                    if (json.operacao === rules_1.default.USUARIO_CRIAR) {
                        try {
                            const passwordHash = await bcrypt_1.default.hash(json.senha, 10);
                            await dbRun(db, 'INSERT INTO User (ra, password_hash, saldo) VALUES (?, ?, 0.0)', [json.cpf, passwordHash]);
                            const response = { operacao: rules_1.default.USUARIO_CRIAR, status: true, info: 'User created successfully.' };
                            socket.write(JSON.stringify(response) + '\n');
                            testSteps.push({ step: 'register', status: 'OK' });
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'register', status: 'OK' });
                            currentState = 'AWAITING_LOGIN';
                        }
                        catch (err) {
                            const errorMsg = err.message?.includes('UNIQUE') ? 'User already exists.' : 'Failed to create user.';
                            const response = { operacao: rules_1.default.USUARIO_CRIAR, status: false, info: errorMsg };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'register', status: 'FAIL', details: errorMsg });
                        }
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "usuario_criar" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'register', status: 'FAIL', details: 'Did not send "usuario_criar" operation.' });
                    }
                    break;
                case 'AWAITING_LOGIN':
                    if (json.operacao === rules_1.default.USUARIO_LOGIN) {
                        try {
                            const user = await dbGet(db, 'SELECT * FROM User WHERE ra = ?', [json.cpf]);
                            if (!user) {
                                const response = { operacao: rules_1.default.USUARIO_LOGIN, status: false, info: 'Invalid credentials.' };
                                socket.write(JSON.stringify(response) + '\n');
                                websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: 'User not found.' });
                                return;
                            }
                            const isValid = await bcrypt_1.default.compare(json.senha, user.password_hash);
                            if (!isValid) {
                                const response = { operacao: rules_1.default.USUARIO_LOGIN, status: false, info: 'Invalid credentials.' };
                                socket.write(JSON.stringify(response) + '\n');
                                websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: 'Invalid password.' });
                                return;
                            }
                            currentToken = generateToken();
                            await dbRun(db, 'UPDATE User SET token = ? WHERE id = ?', [currentToken, user.id]);
                            const response = { operacao: rules_1.default.USUARIO_LOGIN, status: true, info: 'Login successful.', token: currentToken };
                            socket.write(JSON.stringify(response) + '\n');
                            testSteps.push({ step: 'login', status: 'OK' });
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'OK' });
                            currentState = 'LOGGED_IN';
                        }
                        catch (err) {
                            const response = { operacao: rules_1.default.USUARIO_LOGIN, status: false, info: 'Login failed.' };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: err.message });
                        }
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "usuario_login" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: 'Did not send "usuario_login" operation.' });
                    }
                    break;
                case 'LOGGED_IN':
                    if (json.operacao === rules_1.default.DEPOSITAR) {
                        if (json.token !== currentToken) {
                            const response = { operacao: rules_1.default.DEPOSITAR, status: false, info: 'Invalid token.' };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'FAIL', details: 'Invalid token.' });
                            return;
                        }
                        try {
                            const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                            if (!user) {
                                const response = { operacao: rules_1.default.DEPOSITAR, status: false, info: 'User not found.' };
                                socket.write(JSON.stringify(response) + '\n');
                                websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'FAIL', details: 'User not found.' });
                                return;
                            }
                            const newBalance = (user.saldo || 0) + json.valor_enviado;
                            await dbRun(db, 'UPDATE User SET saldo = ? WHERE id = ?', [newBalance, user.id]);
                            await dbRun(db, 'INSERT INTO Transaction (user_id, type, amount) VALUES (?, ?, ?)', [user.id, 'DEPOSIT', json.valor_enviado]);
                            const response = { operacao: rules_1.default.DEPOSITAR, status: true, info: 'Deposit successful.' };
                            socket.write(JSON.stringify(response) + '\n');
                            testSteps.push({ step: 'deposit', status: 'OK' });
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'OK' });
                            currentState = 'AWAITING_STATEMENT';
                        }
                        catch (err) {
                            const response = { operacao: rules_1.default.DEPOSITAR, status: false, info: 'Deposit failed.' };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'FAIL', details: err.message });
                        }
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "depositar" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'FAIL', details: 'Did not send "depositar" operation.' });
                    }
                    break;
                case 'AWAITING_STATEMENT':
                    if (json.operacao === rules_1.default.TRANSACAO_LER) {
                        if (json.token !== currentToken) {
                            const response = { operacao: rules_1.default.TRANSACAO_LER, status: false, info: 'Invalid token.' };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'read_statement', status: 'FAIL', details: 'Invalid token.' });
                            return;
                        }
                        try {
                            const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                            if (!user) {
                                const response = { operacao: rules_1.default.TRANSACAO_LER, status: false, info: 'User not found.' };
                                socket.write(JSON.stringify(response) + '\n');
                                websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'read_statement', status: 'FAIL', details: 'User not found.' });
                                return;
                            }
                            const transactions = await dbAll(db, 'SELECT * FROM Transaction WHERE user_id = ? ORDER BY timestamp DESC', [user.id]);
                            const transacoes = transactions.map((t) => ({
                                id: t.id,
                                valor_enviado: t.amount,
                                usuario_enviador: { nome: user.ra, cpf: user.ra },
                                usuario_recebedor: { nome: user.ra, cpf: user.ra },
                                criado_em: new Date(t.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z'),
                                atualizado_em: new Date(t.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z'),
                            }));
                            const response = {
                                operacao: rules_1.default.TRANSACAO_LER,
                                status: true,
                                info: 'Transactions retrieved successfully.',
                                transacoes: transacoes
                            };
                            socket.write(JSON.stringify(response) + '\n');
                            testSteps.push({ step: 'read_statement', status: 'OK' });
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'read_statement', status: 'OK' });
                            currentState = 'AWAITING_ERROR_LOGIN_TEST';
                        }
                        catch (err) {
                            const response = { operacao: rules_1.default.TRANSACAO_LER, status: false, info: 'Failed to retrieve transactions.' };
                            socket.write(JSON.stringify(response) + '\n');
                            websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'read_statement', status: 'FAIL', details: err.message });
                        }
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "transacao_ler" operation.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'read_statement', status: 'FAIL', details: 'Did not send "transacao_ler" operation.' });
                    }
                    break;
                case 'AWAITING_ERROR_LOGIN_TEST':
                    if (json.operacao === rules_1.default.USUARIO_LOGIN) {
                        // Intentionally send error response to test client error handling (Item 'e')
                        const response = { operacao: rules_1.default.USUARIO_LOGIN, status: false, info: 'Erro de teste: Login falhou intencionalmente.' };
                        socket.write(JSON.stringify(response) + '\n');
                        testSteps.push({ step: 'error_login_test', status: 'OK', details: 'Error response sent for testing.' });
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'error_login_test', status: 'OK', details: 'Error response sent for testing.' });
                        currentState = 'AWAITING_ERROR_REGISTER_TEST';
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "usuario_login" operation for error test.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'error_login_test', status: 'FAIL', details: 'Did not send "usuario_login" operation.' });
                    }
                    break;
                case 'AWAITING_ERROR_REGISTER_TEST':
                    if (json.operacao === rules_1.default.USUARIO_CRIAR) {
                        // Intentionally send error response to test client error handling (Item 'd')
                        const response = { operacao: rules_1.default.USUARIO_CRIAR, status: false, info: 'Erro de teste: Cadastro falhou intencionalmente.' };
                        socket.write(JSON.stringify(response) + '\n');
                        testSteps.push({ step: 'error_register_test', status: 'OK', details: 'Error response sent for testing.' });
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'error_register_test', status: 'OK', details: 'Error response sent for testing.' });
                        currentState = 'DONE';
                        // Save test results (without self-assessments - those will be added via separate endpoint)
                        scoringService_1.scoringService.calculateAndSaveScore(userRa, testSteps, 'CLIENT').then((result) => {
                            websocketService_1.websocketService.sendToUser(userRa, {
                                event: 'test_finished',
                                message: 'Client test completed.',
                                results: testSteps,
                                final_score: result.final_score,
                                test_history_id: result.id,
                                note: 'Self-assessments (items c, d, e) can be submitted separately'
                            });
                        }).catch((err) => {
                            console.error(`[${testId}] Error saving test results:`, err);
                            websocketService_1.websocketService.sendToUser(userRa, {
                                event: 'test_finished',
                                message: 'Client test completed.',
                                results: testSteps,
                                error: 'Failed to save test results'
                            });
                        });
                    }
                    else {
                        const response = { operacao: json.operacao || 'unknown', status: false, info: 'Expected "usuario_criar" operation for error test.' };
                        socket.write(JSON.stringify(response) + '\n');
                        websocketService_1.websocketService.sendToUser(userRa, { event: 'test_step', step: 'error_register_test', status: 'FAIL', details: 'Did not send "usuario_criar" operation.' });
                    }
                    break;
                case 'DONE':
                    const response = { operacao: json.operacao || 'unknown', status: false, info: 'Test already completed.' };
                    socket.write(JSON.stringify(response) + '\n');
                    break;
                default:
                    const defaultResponse = { operacao: json.operacao || 'unknown', status: false, info: `Invalid operation for current state: ${currentState}` };
                    socket.write(JSON.stringify(defaultResponse) + '\n');
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
import net from 'net';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { websocketService } from './websocketService';
import { tempDbService } from './tempDbService';
import { scoringService, TestStepResult } from './scoringService';
import Rules from '../rules';
import { validateClient, ValidationError } from '../validator';

const prisma = new PrismaClient();

// Helper functions for database operations
const dbRun = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const dbGet = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const generateToken = (): string => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const startTcpMockServer = (testId: string, db: sqlite3.Database, userRa: string) => {
    const server = net.createServer(async (socket) => {
        // Load test steps from database
        const testSteps = await prisma.testStep.findMany({
            where: { test_type: 'CLIENT' },
            orderBy: { step_order: 'asc' }
        });

        let currentStepIndex = 0;
        let buffer = '';
        let currentToken: string | null = null;
        const completedSteps: { step: string, status: 'OK' | 'FAIL', details?: string }[] = [];

        console.log(`[${testId}] Client connected.`);
        websocketService.sendToUser(userRa, { event: 'info', message: 'Client connected to mock server.' });

        // Send first prompt
        if (testSteps[0]) {
            websocketService.sendToUser(userRa, {
                event: 'prompt',
                title: testSteps[0].prompt_title || 'Passo 1',
                hint: testSteps[0].prompt_hint || ''
            });
        }

        socket.on('data', (data) => {
            buffer += data.toString();
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.substring(0, newlineIndex);
                buffer = buffer.substring(newlineIndex + 1);

                try {
                    // Validate JSON and protocol structure
                    validateClient(line);
                    const json = JSON.parse(line);
                    console.log(`[${testId}] Received:`, json);

                    // Check if operation is out of sequence (but still process it!)
                    const expectedStep = testSteps[currentStepIndex];
                    if (expectedStep && json.operacao !== expectedStep.operation && currentStepIndex < testSteps.length) {
                        websocketService.sendToUser(userRa, {
                            event: 'warning',
                            message: `⚠️ Operação fora de sequência! Esperado: "${expectedStep.operation}", Recebido: "${json.operacao}". Processando mesmo assim...`
                        });
                    }

                    // Process the operation (async)
                    handleOperation(json).catch((err) => {
                        console.error(`[${testId}] Error in handleOperation:`, err);
                        const errorResponse = { operacao: json?.operacao || 'unknown', status: false, info: 'Internal server error.' };
                        socket.write(JSON.stringify(errorResponse) + '\n');
                        websocketService.sendToUser(userRa, { event: 'error', message: `Operation error: ${err.message}` });
                    });

                } catch (e) {
                    const errorMsg = e instanceof ValidationError ? e.message : 'Invalid JSON or validation error.';
                    const errorResponse = { operacao: 'unknown', status: false, info: errorMsg };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                    websocketService.sendToUser(userRa, { event: 'test_step', step: 'validation', status: 'FAIL', details: errorMsg });
                    console.error(`[${testId}] Validation failed:`, errorMsg);
                }
            }
        });

        // Helper to advance to next step
        const advanceToNextStep = (stepKey: string, status: 'OK' | 'FAIL') => {
            completedSteps.push({ step: stepKey, status });
            websocketService.sendToUser(userRa, { event: 'test_step', step: stepKey, status });

            currentStepIndex++;
            if (currentStepIndex < testSteps.length) {
                const nextStep = testSteps[currentStepIndex];
                websocketService.sendToUser(userRa, {
                    event: 'prompt',
                    title: nextStep.prompt_title || `Passo ${currentStepIndex + 1}`,
                    hint: nextStep.prompt_hint || ''
                });
            } else {
                finishTest();
            }
        };

        const handleOperation = async (json: any) => {
            const operacao = json.operacao;

            // Handle each operation type
            switch (operacao) {
                case Rules.CONECTAR:
                    await handleConectar();
                    break;
                case Rules.USUARIO_CRIAR:
                    await handleUsuarioCriar(json);
                    break;
                case Rules.USUARIO_LOGIN:
                    await handleUsuarioLogin(json);
                    break;
                case Rules.DEPOSITAR:
                    await handleDepositar(json);
                    break;
                case Rules.USUARIO_LER:
                    await handleUsuarioLer(json);
                    break;
                case Rules.USUARIO_ATUALIZAR:
                    await handleUsuarioAtualizar(json);
                    break;
                case Rules.USUARIO_DELETAR:
                    await handleUsuarioDeletar(json);
                    break;
                case Rules.USUARIO_LOGOUT:
                    await handleUsuarioLogout(json);
                    break;
                case Rules.TRANSACAO_CRIAR:
                    await handleTransacaoCriar(json);
                    break;
                case Rules.TRANSACAO_LER:
                    await handleTransacaoLer(json);
                    break;
                // Additional operations can be added here
                default:
                    const response = { operacao, status: false, info: `Operation "${operacao}" not recognized in protocol.` };
                    socket.write(JSON.stringify(response) + '\n');
                    websocketService.sendToUser(userRa, { event: 'error', message: `Unknown operation: "${operacao}"` });
            }
        };

        const handleConectar = async () => {
            const response = { operacao: Rules.CONECTAR, status: true, info: 'Servidor conectado com sucesso.' };
            socket.write(JSON.stringify(response) + '\n');

            const step = testSteps.find((s: any) => s.step_key === 'connect');
            if (step && currentStepIndex === testSteps.findIndex((s: any) => s.step_key === 'connect')) {
                advanceToNextStep('connect', 'OK');
            }
        };

        const handleUsuarioCriar = async (json: any) => {
            try {
                const passwordHash = await bcrypt.hash(json.senha, 10);
                await dbRun(db, 'INSERT INTO User (ra, password_hash, saldo) VALUES (?, ?, 0.0)', [json.cpf, passwordHash]);

                const response = { operacao: Rules.USUARIO_CRIAR, status: true, info: 'Usuário criado com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');

                const registerIdx = testSteps.findIndex((s: any) => s.step_key === 'register');
                const errorRegisterIdx = testSteps.findIndex((s: any) => s.step_key === 'error_register_test');

                if (currentStepIndex === registerIdx) {
                    advanceToNextStep('register', 'OK');
                } else if (currentStepIndex === errorRegisterIdx) {
                    // This shouldn't succeed in error test, but handle gracefully
                    advanceToNextStep('error_register_test', 'FAIL');
                }
            } catch (err: any) {
                const errorMsg = err.message?.includes('UNIQUE') ? 'Usuário já existe.' : 'Falha ao criar usuário.';
                const response = { operacao: Rules.USUARIO_CRIAR, status: false, info: errorMsg };
                socket.write(JSON.stringify(response) + '\n');

                const errorRegisterIdx = testSteps.findIndex((s: any) => s.step_key === 'error_register_test');
                if (currentStepIndex === errorRegisterIdx) {
                    // Expected error for error test
                    advanceToNextStep('error_register_test', 'OK');
                } else {
                    // Unexpected error
                    completedSteps.push({ step: 'register', status: 'FAIL', details: errorMsg });
                    websocketService.sendToUser(userRa, { event: 'test_step', step: 'register', status: 'FAIL', details: errorMsg });
                }
            }
        };

        const handleUsuarioLogin = async (json: any) => {
            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE ra = ?', [json.cpf]);
                const loginIdx = testSteps.findIndex((s: any) => s.step_key === 'login');
                const errorLoginIdx = testSteps.findIndex((s: any) => s.step_key === 'error_login_test');

                if (!user) {
                    const response = { operacao: Rules.USUARIO_LOGIN, status: false, info: 'Credenciais inválidas.' };
                    socket.write(JSON.stringify(response) + '\n');

                    if (currentStepIndex === errorLoginIdx) {
                        // Expected error for error test
                        advanceToNextStep('error_login_test', 'OK');
                    } else if (currentStepIndex === loginIdx) {
                        completedSteps.push({ step: 'login', status: 'FAIL', details: 'User not found.' });
                        websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: 'User not found.' });
                    }
                    return;
                }

                const isValid = await bcrypt.compare(json.senha, user.password_hash);
                if (!isValid) {
                    const response = { operacao: Rules.USUARIO_LOGIN, status: false, info: 'Credenciais inválidas.' };
                    socket.write(JSON.stringify(response) + '\n');

                    if (currentStepIndex === errorLoginIdx) {
                        // Expected error for error test
                        advanceToNextStep('error_login_test', 'OK');
                    } else if (currentStepIndex === loginIdx) {
                        completedSteps.push({ step: 'login', status: 'FAIL', details: 'Invalid password.' });
                        websocketService.sendToUser(userRa, { event: 'test_step', step: 'login', status: 'FAIL', details: 'Invalid password.' });
                    }
                    return;
                }

                // Successful login
                currentToken = generateToken();
                await dbRun(db, 'UPDATE User SET token = ? WHERE id = ?', [currentToken, user.id]);
                const response = { operacao: Rules.USUARIO_LOGIN, status: true, info: 'Login realizado com sucesso.', token: currentToken };
                socket.write(JSON.stringify(response) + '\n');

                if (currentStepIndex === loginIdx) {
                    advanceToNextStep('login', 'OK');
                } else if (currentStepIndex === errorLoginIdx) {
                    // Login succeeded but it was supposed to fail in error test
                    advanceToNextStep('error_login_test', 'FAIL');
                }
            } catch (err: any) {
                const response = { operacao: Rules.USUARIO_LOGIN, status: false, info: 'Falha no login.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleDepositar = async (json: any) => {
            if (json.token !== currentToken) {
                const response = { operacao: Rules.DEPOSITAR, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                const depositIdx = testSteps.findIndex((s: any) => s.step_key === 'deposit');
                if (currentStepIndex === depositIdx) {
                    completedSteps.push({ step: 'deposit', status: 'FAIL', details: 'Invalid token.' });
                    websocketService.sendToUser(userRa, { event: 'test_step', step: 'deposit', status: 'FAIL', details: 'Invalid token.' });
                }
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!user) {
                    const response = { operacao: Rules.DEPOSITAR, status: false, info: 'Usuário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                const newBalance = (user.saldo || 0) + json.valor_enviado;
                await dbRun(db, 'UPDATE User SET saldo = ? WHERE id = ?', [newBalance, user.id]);
                await dbRun(db, 'INSERT INTO Transactions (user_id, type, amount) VALUES (?, ?, ?)', [user.id, 'DEPOSIT', json.valor_enviado]);

                const response = { operacao: Rules.DEPOSITAR, status: true, info: 'Depósito realizado com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');

                const depositIdx = testSteps.findIndex((s: any) => s.step_key === 'deposit');
                if (currentStepIndex === depositIdx) {
                    advanceToNextStep('deposit', 'OK');
                }
            } catch (err: any) {
                const response = { operacao: Rules.DEPOSITAR, status: false, info: 'Falha no depósito.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleTransacaoLer = async (json: any) => {
            if (json.token !== currentToken) {
                const response = { operacao: Rules.TRANSACAO_LER, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!user) {
                    const response = { operacao: Rules.TRANSACAO_LER, status: false, info: 'Usuário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                const transactions = await dbAll(db, 'SELECT * FROM Transactions WHERE user_id = ? ORDER BY timestamp DESC', [user.id]);
                const transacoes = transactions.map((t: any) => ({
                    id: t.id,
                    valor_enviado: t.amount,
                    usuario_enviador: { nome: user.ra, cpf: user.ra },
                    usuario_recebedor: { nome: user.ra, cpf: user.ra },
                    criado_em: new Date(t.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z'),
                    atualizado_em: new Date(t.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z'),
                }));

                const response = { operacao: Rules.TRANSACAO_LER, status: true, info: 'Transações recuperadas com sucesso.', transacoes };
                socket.write(JSON.stringify(response) + '\n');

                const statementIdx = testSteps.findIndex((s: any) => s.step_key === 'read_statement');
                if (currentStepIndex === statementIdx) {
                    advanceToNextStep('read_statement', 'OK');
                }
            } catch (err: any) {
                const response = { operacao: Rules.TRANSACAO_LER, status: false, info: 'Falha ao ler transações.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleUsuarioLer = async (json: any) => {
            if (!json.token || json.token !== currentToken) {
                const response = { operacao: Rules.USUARIO_LER, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!user) {
                    const response = { operacao: Rules.USUARIO_LER, status: false, info: 'Usuário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                const response = {
                    operacao: Rules.USUARIO_LER,
                    status: true,
                    info: 'Dados do usuário recuperados com sucesso.',
                    usuario: {
                        cpf: user.ra,
                        saldo: user.saldo || 0,
                        nome: user.ra // Mock server uses RA as name
                    }
                };
                socket.write(JSON.stringify(response) + '\n');
            } catch (err: any) {
                const response = { operacao: Rules.USUARIO_LER, status: false, info: 'Erro ao ler dados do usuário.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleUsuarioAtualizar = async (json: any) => {
            if (!json.token || json.token !== currentToken) {
                const response = { operacao: Rules.USUARIO_ATUALIZAR, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!user) {
                    const response = { operacao: Rules.USUARIO_ATUALIZAR, status: false, info: 'Usuário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                // Update password if provided
                if (json.usuario?.senha) {
                    const passwordHash = await bcrypt.hash(json.usuario.senha, 10);
                    await dbRun(db, 'UPDATE User SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
                }

                // Note: In real implementation, you would update other fields like nome
                const response = { operacao: Rules.USUARIO_ATUALIZAR, status: true, info: 'Usuário atualizado com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');
            } catch (err: any) {
                const response = { operacao: Rules.USUARIO_ATUALIZAR, status: false, info: 'Erro ao atualizar usuário.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleUsuarioDeletar = async (json: any) => {
            if (!json.token || json.token !== currentToken) {
                const response = { operacao: Rules.USUARIO_DELETAR, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!user) {
                    const response = { operacao: Rules.USUARIO_DELETAR, status: false, info: 'Usuário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                await dbRun(db, 'DELETE FROM User WHERE id = ?', [user.id]);
                currentToken = null; // Invalidate token
                const response = { operacao: Rules.USUARIO_DELETAR, status: true, info: 'Usuário deletado com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');
            } catch (err: any) {
                const response = { operacao: Rules.USUARIO_DELETAR, status: false, info: 'Erro ao deletar usuário.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleUsuarioLogout = async (json: any) => {
            if (!json.token || json.token !== currentToken) {
                const response = { operacao: Rules.USUARIO_LOGOUT, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const user = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (user) {
                    await dbRun(db, 'UPDATE User SET token = NULL WHERE id = ?', [user.id]);
                }
                currentToken = null;
                const response = { operacao: Rules.USUARIO_LOGOUT, status: true, info: 'Logout realizado com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');

                // Advance to next step (logout)
                const logoutIdx = testSteps.findIndex((s: any) => s.step_key === 'logout');
                if (currentStepIndex === logoutIdx) {
                    advanceToNextStep('logout', 'OK');
                }
            } catch (err: any) {
                const response = { operacao: Rules.USUARIO_LOGOUT, status: false, info: 'Erro ao realizar logout.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const handleTransacaoCriar = async (json: any) => {
            if (!json.token || json.token !== currentToken) {
                const response = { operacao: Rules.TRANSACAO_CRIAR, status: false, info: 'Token inválido.' };
                socket.write(JSON.stringify(response) + '\n');
                return;
            }

            try {
                const sender = await dbGet(db, 'SELECT * FROM User WHERE token = ?', [currentToken]);
                if (!sender) {
                    const response = { operacao: Rules.TRANSACAO_CRIAR, status: false, info: 'Usuário remetente não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                const recipient = await dbGet(db, 'SELECT * FROM User WHERE ra = ?', [json.cpf_destino]);
                if (!recipient) {
                    const response = { operacao: Rules.TRANSACAO_CRIAR, status: false, info: 'Usuário destinatário não encontrado.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                if (sender.saldo < json.valor) {
                    const response = { operacao: Rules.TRANSACAO_CRIAR, status: false, info: 'Saldo insuficiente.' };
                    socket.write(JSON.stringify(response) + '\n');
                    return;
                }

                // Deduct from sender
                await dbRun(db, 'UPDATE User SET saldo = saldo - ? WHERE id = ?', [json.valor, sender.id]);
                // Add to recipient
                await dbRun(db, 'UPDATE User SET saldo = saldo + ? WHERE id = ?', [json.valor, recipient.id]);
                // Record transaction
                await dbRun(db, 'INSERT INTO Transactions (user_id, type, amount) VALUES (?, ?, ?)', [sender.id, 'TRANSFER', json.valor]);

                const response = { operacao: Rules.TRANSACAO_CRIAR, status: true, info: 'Transação realizada com sucesso.' };
                socket.write(JSON.stringify(response) + '\n');

                // Advance to next step (PIX transfer)
                const pixTransferIdx = testSteps.findIndex((s: any) => s.step_key === 'pix_transfer');
                if (currentStepIndex === pixTransferIdx) {
                    advanceToNextStep('pix_transfer', 'OK');
                }
            } catch (err: any) {
                const response = { operacao: Rules.TRANSACAO_CRIAR, status: false, info: 'Erro ao criar transação.' };
                socket.write(JSON.stringify(response) + '\n');
            }
        };

        const finishTest = async () => {
            scoringService.calculateAndSaveScore(userRa, completedSteps as TestStepResult[], 'CLIENT')
                .then((result) => {
                    websocketService.sendToUser(userRa, {
                        event: 'test_finished',
                        message: 'Client test completed.',
                        results: completedSteps,
                        final_score: result.final_score,
                        test_history_id: result.id,
                        note: 'Self-assessments (items c, d, e) can be submitted separately'
                    });
                    websocketService.sendToUser(userRa, {
                        event: 'prompt',
                        title: 'Teste concluido',
                        hint: 'O servidor de teste pode ser parado pelo painel (botao Parar teste).'
                    });
                }).catch((err) => {
                    console.error(`[${testId}] Error saving test results:`, err);
                    websocketService.sendToUser(userRa, {
                        event: 'test_finished',
                        message: 'Client test completed.',
                        results: completedSteps,
                        error: 'Failed to save test results'
                    });
                });
        };

        socket.on('close', () => {
            console.log(`[${testId}] Client disconnected.`);
            websocketService.sendToUser(userRa, { event: 'info', message: 'Client disconnected.' });
            tempDbService.destroyTempDb(db, testId);
        });

        socket.on('error', (err) => {
            console.error(`[${testId}] Socket error:`, err);
            websocketService.sendToUser(userRa, { event: 'error', message: `Socket error: ${err.message}` });
        });
    });

    return server;
};

export { startTcpMockServer };

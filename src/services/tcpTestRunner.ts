import net from 'net';
import { websocketService } from './websocketService';
import { scoringService, TestStepResult, TestType } from './scoringService';
import Rules from '../rules';
import { validateServer, ValidationError } from '../validator';

// Helper to wait for the next full JSON message from the server
const waitForResponse = (client: net.Socket, buffer: { data: string }): Promise<any> => {
    return new Promise((resolve, reject) => {
        const onData = (data: Buffer) => {
            buffer.data += data.toString();
            const newlineIndex = buffer.data.indexOf('\n');
            if (newlineIndex !== -1) {
                const line = buffer.data.substring(0, newlineIndex);
                buffer.data = buffer.data.substring(newlineIndex + 1);
                
                cleanup(); // Remove listeners once we have a message
                try {
                    const json = JSON.parse(line);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Invalid JSON from server'));
                }
            }
        };

        const onError = (err: Error) => {
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

const runServerTest = async (ip: string, port: number, ra: string) => {
    const testSteps: { step: string, status: 'OK' | 'FAIL', details?: string }[] = [];
    let client: net.Socket | null = null;

    const addStep = (step: string, status: 'OK' | 'FAIL', details?: string) => {
        testSteps.push({ step, status, details });
        websocketService.sendToUser(ra, { event: 'test_step', step, status, details });
    };

    try {
        client = net.createConnection({ host: ip, port });
        const buffer = { data: '' }; // Use object to be mutable across promises

        await new Promise<void>((resolve, reject) => {
            client?.on('connect', resolve);
            client?.on('error', reject);
        });

        addStep('Connection to Server', 'OK');

        // 1. Test 'conectar'
        if (!client) throw new Error("Client not connected"); // Type guard
        
        client.write(JSON.stringify({ operacao: Rules.CONECTAR }) + '\n');
        const connectResponse = await waitForResponse(client, buffer);
        
        try {
            // The validator expects a string, not an object
            validateServer(JSON.stringify(connectResponse));
            if (connectResponse.status === true) {
                addStep('Protocol: Conectar', 'OK');
            } else {
                addStep('Protocol: Conectar', 'FAIL', 'Server returned status: false');
                throw new Error('"Conectar" step failed.');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('Protocol: Conectar', 'FAIL', errorMsg);
            throw new Error(`"Conectar" step failed: ${errorMsg}`);
        }

        // 2. Test 'usuario_criar' (create user)
        const testCpf = '123.456.789-00';
        const testPassword = 'senha123';
        const testName = 'Test User';
        
        client.write(JSON.stringify({
            operacao: Rules.USUARIO_CRIAR,
            nome: testName,
            cpf: testCpf,
            senha: testPassword
        }) + '\n');
        const createUserResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(createUserResponse));
            if (createUserResponse.status === true) {
                addStep('Protocol: Criar Usuário', 'OK');
            } else {
                addStep('Protocol: Criar Usuário', 'FAIL', 'Server returned status: false');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('Protocol: Criar Usuário', 'FAIL', errorMsg);
        }

        // 3. Test 'usuario_login'
        client.write(JSON.stringify({
            operacao: Rules.USUARIO_LOGIN,
            cpf: testCpf,
            senha: testPassword
        }) + '\n');
        const loginResponse = await waitForResponse(client, buffer);
        
        let authToken: string | null = null;
        try {
            validateServer(JSON.stringify(loginResponse));
            if (loginResponse.status === true && loginResponse.token) {
                authToken = loginResponse.token;
                addStep('Protocol: Login', 'OK');
            } else {
                addStep('Protocol: Login', 'FAIL', 'Server returned status: false or missing token');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('Protocol: Login', 'FAIL', errorMsg);
        }

        if (!authToken) {
            throw new Error('Cannot continue tests without authentication token');
        }

        // 4. Test 'depositar' (Item 'f': Servidor recebe depósito)
        const depositAmount = 50.0;
        client.write(JSON.stringify({
            operacao: Rules.DEPOSITAR,
            token: authToken,
            valor_enviado: depositAmount
        }) + '\n');
        const depositResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(depositResponse));
            if (depositResponse.status === true) {
                addStep('f) Servidor recebe depósito', 'OK');
            } else {
                addStep('f) Servidor recebe depósito', 'FAIL', 'Server returned status: false');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('f) Servidor recebe depósito', 'FAIL', errorMsg);
        }

        // 5. Test 'usuario_ler' to check balance (Item 'g': Saldo correto após depósito)
        client.write(JSON.stringify({
            operacao: Rules.USUARIO_LER,
            token: authToken
        }) + '\n');
        const readUserResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(readUserResponse));
            if (readUserResponse.status === true && readUserResponse.usuario) {
                const balance = readUserResponse.usuario.saldo;
                if (balance === depositAmount) {
                    addStep('g) Saldo correto após depósito', 'OK');
                } else {
                    addStep('g) Saldo correto após depósito', 'FAIL', `Expected balance ${depositAmount}, got ${balance}`);
                }
            } else {
                addStep('g) Saldo correto após depósito', 'FAIL', 'Server returned status: false or missing usuario');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('g) Saldo correto após depósito', 'FAIL', errorMsg);
        }

        // 6. Test 'transacao_ler' (Item 'h': Servidor retorna extrato)
        const now = new Date();
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
        
        client.write(JSON.stringify({
            operacao: Rules.TRANSACAO_LER,
            token: authToken,
            data_inicial: startDate.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            data_final: endDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
        }) + '\n');
        const transactionReadResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(transactionReadResponse));
            if (transactionReadResponse.status === true && Array.isArray(transactionReadResponse.transacoes)) {
                addStep('h) Servidor retorna extrato', 'OK');
                
                // 7. Check if statement is correct (Item 'i': Extrato correto)
                const hasDeposit = transactionReadResponse.transacoes.some((t: any) => 
                    t.valor_enviado === depositAmount
                );
                if (hasDeposit) {
                    addStep('i) Extrato correto', 'OK');
                } else {
                    addStep('i) Extrato correto', 'FAIL', 'Deposit transaction not found in statement');
                }
            } else {
                addStep('h) Servidor retorna extrato', 'FAIL', 'Server returned status: false or missing transacoes array');
                addStep('i) Extrato correto', 'FAIL', 'Cannot verify - statement not received');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('h) Servidor retorna extrato', 'FAIL', errorMsg);
            addStep('i) Extrato correto', 'FAIL', errorMsg);
        }

        // 8. Test 'transacao_criar' (withdrawal/saque) (Item 'j': Saque com saldo)
        // First, we need to create another user to transfer to
        const recipientCpf = '987.654.321-00';
        client.write(JSON.stringify({
            operacao: Rules.USUARIO_CRIAR,
            nome: 'Recipient User',
            cpf: recipientCpf,
            senha: 'senha456'
        }) + '\n');
        await waitForResponse(client, buffer); // Ignore response for now

        const transferAmount = 20.0;
        client.write(JSON.stringify({
            operacao: Rules.TRANSACAO_CRIAR,
            token: authToken,
            valor: transferAmount,
            cpf_destino: recipientCpf
        }) + '\n');
        const transferResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(transferResponse));
            if (transferResponse.status === true) {
                addStep('j) Saque com saldo', 'OK');
            } else {
                addStep('j) Saque com saldo', 'FAIL', 'Server returned status: false');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('j) Saque com saldo', 'FAIL', errorMsg);
        }

        // 9. Test error: Invalid CPF format (Item 'k': Erro Cadastro - CPF inválido)
        client.write(JSON.stringify({
            operacao: Rules.USUARIO_CRIAR,
            nome: 'Invalid User',
            cpf: '12345678900', // Invalid format (missing dots and dash)
            senha: 'senha789'
        }) + '\n');
        const invalidCpfResponse = await waitForResponse(client, buffer);
        
        // The server should validate and reject this, but we're testing if the client sends it
        // The validator on our side would catch this, but we're testing the server's response
        try {
            validateServer(JSON.stringify(invalidCpfResponse));
            // If validation passes, check if server rejected it
            if (invalidCpfResponse.status === false) {
                addStep('k) Erro Cadastro (CPF inválido)', 'OK');
            } else {
                addStep('k) Erro Cadastro (CPF inválido)', 'FAIL', 'Server should have rejected invalid CPF format');
            }
        } catch (e) {
            // If our validator catches it, the server should have too
            addStep('k) Erro Cadastro (CPF inválido)', 'OK', 'Invalid CPF format correctly rejected');
        }

        // 10. Test error: Insufficient balance (Item 'l': Erro Saque - saldo insuficiente)
        // Try to transfer more than available balance
        const excessiveAmount = 1000.0;
        client.write(JSON.stringify({
            operacao: Rules.TRANSACAO_CRIAR,
            token: authToken,
            valor: excessiveAmount,
            cpf_destino: recipientCpf
        }) + '\n');
        const insufficientBalanceResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(insufficientBalanceResponse));
            if (insufficientBalanceResponse.status === false) {
                addStep('l) Erro Saque (saldo insuficiente)', 'OK');
            } else {
                addStep('l) Erro Saque (saldo insuficiente)', 'FAIL', 'Server should have rejected insufficient balance');
            }
        } catch (e) {
            const errorMsg = e instanceof ValidationError ? e.message : 'Validation failed';
            addStep('l) Erro Saque (saldo insuficiente)', 'FAIL', errorMsg);
        }

        // 11. Test error: Missing required keys
        client.write(JSON.stringify({
            operacao: Rules.DEPOSITAR,
            // Missing 'token' and 'valor_enviado'
        }) + '\n');
        const missingKeysResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(missingKeysResponse));
            if (missingKeysResponse.status === false) {
                addStep('m) Erro: Chaves faltando', 'OK');
            } else {
                addStep('m) Erro: Chaves faltando', 'FAIL', 'Server should have rejected missing keys');
            }
        } catch (e) {
            // If our validator catches it, that's also OK
            addStep('m) Erro: Chaves faltando', 'OK', 'Missing keys correctly rejected');
        }

        // 12. Test error: Invalid date format
        client.write(JSON.stringify({
            operacao: Rules.TRANSACAO_LER,
            token: authToken,
            data_inicial: '2024-01-01', // Invalid format (missing time part)
            data_final: '2024-01-02'
        }) + '\n');
        const invalidDateResponse = await waitForResponse(client, buffer);
        
        try {
            validateServer(JSON.stringify(invalidDateResponse));
            if (invalidDateResponse.status === false) {
                addStep('n) Erro: Data inválida', 'OK');
            } else {
                addStep('n) Erro: Data inválida', 'FAIL', 'Server should have rejected invalid date format');
            }
        } catch (e) {
            addStep('n) Erro: Data inválida', 'OK', 'Invalid date format correctly rejected');
        }

        // 13. Test error: Invalid JSON
        client.write('{"operacao": "depositar", "token": "invalid", "valor_enviado": }\n');
        try {
            await waitForResponse(client, buffer);
            addStep('o) Erro: JSON inválido', 'FAIL', 'Server should have rejected invalid JSON');
        } catch (e) {
            addStep('o) Erro: JSON inválido', 'OK', 'Invalid JSON correctly rejected');
        }

    } catch (error: any) {
        console.error(`[Test for ${ra}] Error: ${error.message}`);
        addStep('Test Execution', 'FAIL', error.message);
    } finally {
        if (client) {
            client.end();
        }
        console.log(`[Test for ${ra}] Test finished. Results:`, testSteps);
        
        // Save results to persistent DB
        try {
            const result = await scoringService.calculateAndSaveScore(ra, testSteps as TestStepResult[], 'SERVER' as TestType);
            websocketService.sendToUser(ra, { 
                event: 'test_finished', 
                results: testSteps,
                final_score: result.final_score,
                test_history_id: result.id
            });
        } catch (err: any) {
            console.error(`[Test for ${ra}] Error saving test results:`, err);
            websocketService.sendToUser(ra, { 
                event: 'test_finished', 
                results: testSteps,
                error: 'Failed to save test results'
            });
        }
    }
};

export { runServerTest };

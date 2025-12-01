import net from 'net';
import { websocketService } from './websocketService';
import { scoringService, TestStepResult } from './scoringService';
import Rules from '../rules';
import { validateServer, ValidationError } from '../validator';

type StepStatus = 'OK' | 'FAIL';

type Actor = {
  name: string;
  socket: net.Socket;
  buffer: { data: string };
  cpf: string;
  senha: string;
  token: string | null;
};

// Wait for next JSON message from the server (handles newline-delimited or full-buffer JSON)
const waitForResponse = (client: net.Socket, buffer: { data: string }): Promise<any> => {
  const tryParse = (text: string) => {
    try {
      return JSON.parse(text.trim());
    } catch {
      return null;
    }
  };

  return new Promise((resolve, reject) => {
    const onData = (data: Buffer) => {
      buffer.data += data.toString();
      const newlineIndex = buffer.data.indexOf('\n');
      if (newlineIndex !== -1) {
        const line = buffer.data.substring(0, newlineIndex);
        buffer.data = buffer.data.substring(newlineIndex + 1);
        cleanup();
        const parsed = tryParse(line);
        if (parsed) return resolve(parsed);
        return reject(new Error('Invalid JSON from server (newline-terminated chunk)'));
      }
      const parsed = tryParse(buffer.data);
      if (parsed) {
        buffer.data = '';
        cleanup();
        return resolve(parsed);
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatCpf = () => {
  const rand = () => Math.floor(100 + Math.random() * 900);
  const part1 = rand();
  const part2 = rand();
  const part3 = rand();
  const part4 = Math.floor(Math.random() * 90) + 10;
  return `${part1}.${part2}.${part3}-${part4}`;
};

const uniqueName = (label: string) => `${label} ${Math.floor(Math.random() * 10000)}`;
const uniquePass = () => `pw-${Math.random().toString(16).slice(2, 8)}`;

const createSocket = async (ip: string, port: number) => {
  const socket = net.createConnection({ host: ip, port });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('error', reject);
  });
  return { socket, buffer: { data: '' } };
};

const sendAndWait = async (actor: Actor, payload: object | string, label: string, timeoutMs = 5000) => {
  if (actor.socket.destroyed) {
    throw new Error(`Socket closed before sending (${label})`);
  }
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  actor.socket.write(message + '\n');

  const res = await Promise.race([
    waitForResponse(actor.socket, actor.buffer),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout waiting for ${label} response`)), timeoutMs)),
  ]);
  await sleep(200);
  return { res, sent: message };
};

const add = (
  steps: { step: string; status: StepStatus; details?: string }[],
  ra: string,
  step: string,
  status: StepStatus,
  details?: string
) => {
  const ts = new Date().toISOString();
  steps.push({ step, status, details });
  websocketService.sendToUser(ra, { event: 'test_step', step, status, details, ts });
};

const runServerTest = async (ip: string, port: number, ra: string) => {
  const steps: { step: string; status: StepStatus; details?: string }[] = [];

  const makeActor = async (label: string): Promise<Actor> => {
    const { socket, buffer } = await createSocket(ip, port);
    return { name: label, socket, buffer, cpf: formatCpf(), senha: uniquePass(), token: null };
  };

  const closeActor = (actor?: Actor) => {
    if (actor?.socket && !actor.socket.destroyed) actor.socket.end();
  };

  const runWithTemp = async (label: string, fn: (actor: Actor) => Promise<void>) => {
    const temp = await makeActor(label);
    try {
      await fn(temp);
    } finally {
      closeActor(temp);
    }
  };

  let clientA: Actor | undefined;
  let clientB: Actor | undefined;
  let clientC: Actor | undefined;

  try {
    // 1. Protocolo básico
    await runWithTemp('Handshake-login-sem-conectar', async (temp) => {
      const { res, sent } = await sendAndWait(temp, { operacao: Rules.USUARIO_LOGIN, cpf: formatCpf(), senha: 'x' }, 'login without connect');
      add(steps, ra, 'Protocolo: login sem conectar', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });
    await runWithTemp('Handshake-connect', async (temp) => {
      const { res, sent } = await sendAndWait(temp, { operacao: Rules.CONECTAR }, 'connect');
      add(steps, ra, 'Protocolo: conectar', res?.status === true ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });

    // 2. Validação de erros
    await runWithTemp('Cadastro-invalid-cpf', async (temp) => {
      const invalidCpfPayload = { operacao: Rules.USUARIO_CRIAR, nome: 'Bad CPF', cpf: '12345678900', senha: 'x' };
      const { res, sent } = await sendAndWait(temp, invalidCpfPayload, 'invalid cpf');
      add(steps, ra, 'Cadastro invalido: CPF', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });
    await runWithTemp('Cadastro-missing-fields', async (temp) => {
      const { res, sent } = await sendAndWait(temp, { operacao: Rules.USUARIO_CRIAR, nome: 'No Pass', cpf: formatCpf() }, 'missing fields');
      add(steps, ra, 'Cadastro invalido: campos faltando', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });
    await runWithTemp('Login-inexistente', async (temp) => {
      const { res, sent } = await sendAndWait(temp, { operacao: Rules.USUARIO_LOGIN, cpf: formatCpf(), senha: 'wrong' }, 'login inexistente');
      add(steps, ra, 'Login invalido: usuario inexistente', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });
    await runWithTemp('Login-senha-errada', async (temp) => {
      const wrongCpf = formatCpf();
      await sendAndWait(temp, { operacao: Rules.USUARIO_CRIAR, nome: 'WrongPwd', cpf: wrongCpf, senha: 'correct' }, 'prep wrong pwd create');
      const { res, sent } = await sendAndWait(temp, { operacao: Rules.USUARIO_LOGIN, cpf: wrongCpf, senha: 'incorrect' }, 'login wrong pwd');
      add(steps, ra, 'Login invalido: senha errada', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    });

    // 3. Clientes A/B/C conectados e autenticados
    const actorSetup = async (label: string): Promise<Actor> => {
      const actor = await makeActor(label);
      const connectRes = await sendAndWait(actor, { operacao: Rules.CONECTAR }, `${label} connect`);
      add(steps, ra, `${label}: conectar`, connectRes.res?.status === true ? 'OK' : 'FAIL', `req=${connectRes.sent}\nres=${JSON.stringify(connectRes.res)}`);

      const createRes = await sendAndWait(
        actor,
        { operacao: Rules.USUARIO_CRIAR, nome: uniqueName(label), cpf: actor.cpf, senha: actor.senha },
        `${label} create`
      );
      add(steps, ra, `${label}: criar usuario`, createRes.res?.status === true ? 'OK' : 'FAIL', `req=${createRes.sent}\nres=${JSON.stringify(createRes.res)}`);

      const loginRes = await sendAndWait(actor, { operacao: Rules.USUARIO_LOGIN, cpf: actor.cpf, senha: actor.senha }, `${label} login`);
      if (loginRes.res?.status === true && loginRes.res?.token) {
        actor.token = loginRes.res.token;
        add(steps, ra, `${label}: login`, 'OK', `req=${loginRes.sent}\nres=${JSON.stringify(loginRes.res)}`);
      } else {
        add(steps, ra, `${label}: login`, 'FAIL', `req=${loginRes.sent}\nres=${JSON.stringify(loginRes.res)}`);
      }
      return actor;
    };

    clientA = await actorSetup('Cliente A');
    clientB = await actorSetup('Cliente B');
    clientC = await actorSetup('Cliente C');

    const authenticated = async (actor: Actor, payload: object, label: string, timeout = 5000) => {
      const enriched = { ...payload, token: actor.token };
      return sendAndWait(actor, enriched, label, timeout);
    };

    // 4. Depositos A
    const depositAndCheck = async (amount: number, expected: number, label: string) => {
      const { res: depRes, sent: depSent } = await authenticated(clientA!, { operacao: Rules.DEPOSITAR, valor_enviado: amount }, `${label} deposit`);
      add(steps, ra, `${label}: deposito`, depRes?.status === true ? 'OK' : 'FAIL', `req=${depSent}\nres=${JSON.stringify(depRes)}`);

      const { res: readRes, sent: readSent } = await authenticated(clientA!, { operacao: Rules.USUARIO_LER }, `${label} balance`);
      if (readRes?.status === true && typeof readRes?.usuario?.saldo === 'number') {
        const ok = Math.abs(readRes.usuario.saldo - expected) < 0.0001;
        add(steps, ra, `${label}: saldo apos deposito`, ok ? 'OK' : 'FAIL', `req=${readSent}\nres=${JSON.stringify(readRes)}`);
      } else {
        add(steps, ra, `${label}: saldo apos deposito`, 'FAIL', `req=${readSent}\nres=${JSON.stringify(readRes)}`);
      }
    };
    await depositAndCheck(100, 100, 'Deposito inicial A');
    await depositAndCheck(50.5, 150.5, 'Deposito adicional A');

    // 5. Transferencias e extrato
    {
      const { res, sent } = await authenticated(clientA!, { operacao: Rules.TRANSACAO_CRIAR, valor: 50, cpf_destino: clientB!.cpf }, 'Transferencia A->B');
      add(steps, ra, 'Transferencia A->B', res?.status === true ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const { res, sent } = await authenticated(clientA!, { operacao: Rules.USUARIO_LER }, 'Saldo A pos transf');
      const ok = res?.status === true && Math.abs((res.usuario?.saldo ?? 0) - 100.5) < 0.001;
      add(steps, ra, 'Saldo A apos transferencia', ok ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const { res, sent } = await authenticated(clientB!, { operacao: Rules.USUARIO_LER }, 'Saldo B pos transf');
      const ok = res?.status === true && Math.abs((res.usuario?.saldo ?? 0) - 50) < 0.001;
      add(steps, ra, 'Saldo B apos receber', ok ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { res, sent } = await authenticated(
        clientA!,
        {
          operacao: Rules.TRANSACAO_LER,
          data_inicial: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          data_final: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
        'Extrato A'
      );
      add(steps, ra, 'Extrato dentro do periodo', res?.status === true && Array.isArray(res?.transacoes) ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const now = new Date();
      const start = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime());
      const { res, sent } = await authenticated(
        clientA!,
        {
          operacao: Rules.TRANSACAO_LER,
          data_inicial: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          data_final: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
        'Extrato 40 dias'
      );
      add(steps, ra, 'Extrato acima de 31 dias', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }

    // 6. Isolamento e seguranca
    {
      const { res, sent } = await authenticated(clientB!, { operacao: Rules.TRANSACAO_CRIAR, valor: 10, cpf_destino: clientC!.cpf }, 'Transferencia B->C');
      add(steps, ra, 'Transferencia B->C', res?.status === true ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { res, sent } = await authenticated(
        clientA!,
        {
          operacao: Rules.TRANSACAO_LER,
          data_inicial: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          data_final: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
        'Extrato A (isolamento)'
      );
      const leaks =
        Array.isArray(res?.transacoes) &&
        res.transacoes.some((t: any) => {
          const sender = t?.usuario_enviador?.cpf;
          const receiver = t?.usuario_recebedor?.cpf;
          return sender !== clientA!.cpf && receiver !== clientA!.cpf;
        });
      add(steps, ra, 'Isolamento: extrato A sem B/C', leaks ? 'FAIL' : 'OK', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const newNameA = `Updated ${clientA!.name}`;
      const { res, sent } = await authenticated(clientA!, { operacao: Rules.USUARIO_ATUALIZAR, usuario: { nome: newNameA } }, 'Atualizar nome A');
      add(steps, ra, 'Atualizar A', res?.status === true ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);

      const { res: readB, sent: sentB } = await authenticated(clientB!, { operacao: Rules.USUARIO_LER }, 'Ler B apos update A');
      const ok = readB?.usuario?.nome && !readB.usuario.nome.includes(newNameA);
      add(steps, ra, 'Isolamento: update A nao afeta B', ok ? 'OK' : 'FAIL', `req=${sentB}\nres=${JSON.stringify(readB)}`);
    }
    {
      const tampered = (clientA!.token || '') + 'x';
      const { res, sent } = await sendAndWait(clientA!, { operacao: Rules.USUARIO_LER, token: tampered }, 'Token adulterado');
      add(steps, ra, 'Token adulterado rejeitado', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    }
    {
      const { res } = await authenticated(clientA!, { operacao: Rules.USUARIO_LOGOUT }, 'Logout A');
      add(steps, ra, 'Logout A', res?.status === true ? 'OK' : 'FAIL', `res=${JSON.stringify(res)}`);
      const { res: delRes, sent: delSent } = await sendAndWait(clientA!, { operacao: Rules.USUARIO_DELETAR, token: clientA!.token }, 'Delete after logout');
      add(steps, ra, 'Delete com token invalido', delRes?.status === false ? 'OK' : 'FAIL', `req=${delSent}\nres=${JSON.stringify(delRes)}`);
    }

    // 7. Validator stress
    try {
      clientA!.socket.write('{"operacao": "depositar", "token": "invalid", "valor_enviado": }\n');
      const res = await waitForResponse(clientA!.socket, clientA!.buffer);
      add(steps, ra, 'JSON malformado', res?.status === false ? 'OK' : 'FAIL', `res=${JSON.stringify(res)}`);
    } catch (e: any) {
      add(steps, ra, 'JSON malformado', 'OK', e.message);
    }
    try {
      const { res, sent } = await sendAndWait(
        clientB!,
        { operacao: Rules.USUARIO_LOGIN, cpf: clientB!.cpf, senha: clientB!.senha, admin: true },
        'Login com chave extra'
      );
      add(steps, ra, 'Campos extras no login', res?.status === false ? 'OK' : 'FAIL', `req=${sent}\nres=${JSON.stringify(res)}`);
    } catch (e: any) {
      add(steps, ra, 'Campos extras no login', 'FAIL', e.message);
    }
  } catch (error: any) {
    console.error(`[Test for ${ra}] Error: ${error.message}`);
    add(steps, ra, 'Test Execution', 'FAIL', error.message);
  } finally {
    closeActor(clientA);
    closeActor(clientB);
    closeActor(clientC);
    try {
      const result = await scoringService.calculateAndSaveScore(ra, steps as TestStepResult[], 'SERVER');
      websocketService.sendToUser(ra, {
        event: 'test_finished',
        results: steps,
        final_score: result.final_score,
        test_history_id: result.id,
      });
    } catch (err: any) {
      console.error(`[Test for ${ra}] Error saving test results:`, err);
      websocketService.sendToUser(ra, {
        event: 'test_finished',
        results: steps,
        error: 'Failed to save test results',
      });
    }
  }
};

export { runServerTest };

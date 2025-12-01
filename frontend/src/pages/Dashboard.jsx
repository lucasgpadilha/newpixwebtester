import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('client'); // 'client' or 'server'

  // Client test state
  const [clientPort, setClientPort] = useState(null);
  const [currentTestId, setCurrentTestId] = useState(null);
  const [clientLogs, setClientLogs] = useState([]);
  const [clientChecklist, setClientChecklist] = useState([
    { id: 'connect', label: '1. Conectar', status: 'pending', operation: 'conectar' },
    { id: 'register', label: '2. Criar usuário', status: 'pending', operation: 'usuario_criar' },
    { id: 'login', label: '3. Fazer login', status: 'pending', operation: 'usuario_login' },
    { id: 'deposit', label: '4. Depositar', status: 'pending', operation: 'depositar' },
    { id: 'read_statement', label: '5. Ler extrato', status: 'pending', operation: 'transacao_ler' },
    { id: 'error_login_test', label: '6. Teste erro login', status: 'pending', operation: 'usuario_login (erro)' },
    { id: 'error_register_test', label: '7. Teste erro cadastro', status: 'pending', operation: 'usuario_criar (erro)' }
  ]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [currentWarning, setCurrentWarning] = useState(null);
  const [selfAssessments, setSelfAssessments] = useState({});
  const [testStep, setTestStep] = useState('');

  // Server test state
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [serverLogs, setServerLogs] = useState([]);
  const [serverRunning, setServerRunning] = useState(false);

  // Common state
  const [isAdmin, setIsAdmin] = useState(false);
  const [testHistory, setTestHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setIsAdmin(payload.user?.is_admin || false);
    } catch {
      setIsAdmin(false);
    }

    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      addClientLog('WebSocket conectado');
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'auth_success') {
        return;
      }

      if (data.event === 'test_step') {
        addClientLog(`[${data.step}] ${data.status}: ${data.details || ''}`);
        setTestStep(data.step);
        updateChecklist(data.step, data.status);
        return;
      }

      if (data.event === 'test_finished') {
        addClientLog('✅ Teste finalizado!');
        if (data.final_score !== undefined) {
          addClientLog(`Nota: ${data.final_score}`);
        }
        if (data.test_history_id) {
          setCurrentTestId(data.test_history_id);
        }
        fetchTestHistory();
        return;
      }

      if (data.event === 'warning') {
        setCurrentWarning(data.message);
        addClientLog(`⚠️ ${data.message}`);
        setTimeout(() => setCurrentWarning(null), 10000);
        return;
      }

      if (data.event === 'prompt') {
        setCurrentPrompt({ title: data.title, hint: data.hint });
        addClientLog(`📋 ${data.title}`);
        return;
      }

      if (data.event === 'info') {
        addClientLog(`ℹ️ ${data.message}`);
        return;
      }

      if (data.event === 'error') {
        addClientLog(`❌ ${data.message}`);
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
      addClientLog('Erro no WebSocket');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      addClientLog('WebSocket desconectado');
    };

    fetchTestHistory();
    fetchActiveServer();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [navigate]);

  const addClientLog = (message) => {
    setClientLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const addServerLog = (message) => {
    setServerLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const updateChecklist = (step, status) => {
    setClientChecklist((prev) =>
      prev.map((item) =>
        item.id === step ? { ...item, status: status === 'OK' ? 'completed' : 'failed' } : item
      )
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchTestHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/api/test/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestHistory(response.data);
    } catch (error) {
      console.error('Error fetching test history:', error);
    }
  };

  const fetchActiveServer = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/api/test/client/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.active) {
        setClientPort(response.data.port);
        setCurrentTestId(response.data.testId);
        addClientLog(`Servidor ativo encontrado na porta ${response.data.port}`);
      }
    } catch (error) {
      console.error('Error fetching active server:', error);
    }
  };

  const handleStartClientTest = async () => {
    setClientLogs([]);
    setClientChecklist(prev => prev.map(item => ({ ...item, status: 'pending' })));
    setClientPort(null);
    setTestStep('');
    setSelfAssessments({});
    setCurrentPrompt(null);
    setCurrentWarning(null);
    setCurrentTestId(null);
    addClientLog('Iniciando teste de cliente...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/test/client/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClientPort(response.data.port);
      setCurrentTestId(response.data.testId);
      addClientLog(`Servidor mock iniciado na porta ${response.data.port}`);
      addClientLog('Conecte seu cliente TCP a esta porta');
    } catch (error) {
      if (error.response?.status === 400) {
        addClientLog(`❌ ${error.response.data.message}`);
        if (error.response.data.existingPort) {
          addClientLog(`Servidor ativo na porta: ${error.response.data.existingPort}`);
        }
      } else {
        addClientLog(`❌ Erro: ${error.response?.data?.message || 'Falha ao iniciar teste'}`);
      }
    }
  };

  const handleStopClientTest = async () => {
    if (!currentTestId) {
      addClientLog('Nenhum teste ativo para parar');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/test/client/stop`,
        { testId: currentTestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addClientLog('✅ Teste parado com sucesso');
      setClientPort(null);
      setCurrentTestId(null);
      setCurrentPrompt(null);
    } catch (error) {
      addClientLog(`❌ Erro ao parar teste: ${error.response?.data?.message || 'Erro desconhecido'}`);
    }
  };

  const handleServerTest = async () => {
    if (!serverIp || !serverPort) {
      alert('Informe IP e Porta do servidor');
      return;
    }

    setServerLogs([]);
    setServerRunning(true);
    addServerLog('Iniciando teste de servidor...');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/test/server`,
        { ip: serverIp, port: parseInt(serverPort, 10) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addServerLog('Teste de servidor iniciado. Aguarde os resultados...');
    } catch (error) {
      addServerLog(`❌ Erro: ${error.response?.data?.message || 'Falha ao iniciar teste'}`);
      setServerRunning(false);
    }
  };

  const handleSelfAssessment = (item, value) => {
    setSelfAssessments((prev) => ({ ...prev, [item]: value }));
  };

  const submitSelfAssessments = async () => {
    if (!currentTestId) {
      alert('Nenhum ID de teste disponível');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/test/self-assessment`,
        {
          test_history_id: parseInt(currentTestId, 10),
          assessments: selfAssessments
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addClientLog(`✅ Autoavaliação enviada. Nota final: ${response.data.final_score}`);
      fetchTestHistory();
    } catch (error) {
      addClientLog(`❌ Erro ao enviar autoavaliação: ${error.response?.data?.message || 'Erro'}`);
    }
  };

  const getChecklistIcon = (status) => {
    if (status === 'completed') return '✅';
    if (status === 'failed') return '❌';
    return '⏳';
  };

  return (
    <div className="dashboard-wrapper">
      <div className="page-hero">
        <div>
          <p className="hero-kicker">Painel de Testes</p>
          <h1>NewPix Web Tester</h1>
          <div className="hero-meta">
            <span className={`status-pill ${wsStatus === 'connected' ? 'success' : 'danger'}`}>
              WS: {wsStatus}
            </span>
          </div>
        </div>
        <div className="dashboard-header-actions">
          {isAdmin && (
            <button className="ghost-button" onClick={() => navigate('/admin')}>
              Admin Panel
            </button>
          )}
          <button className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'client' ? 'active' : ''}`}
          onClick={() => setActiveTab('client')}
        >
          🧪 Teste de Cliente
        </button>
        <button
          className={`tab ${activeTab === 'server' ? 'active' : ''}`}
          onClick={() => setActiveTab('server')}
        >
          🖥️ Teste de Servidor
        </button>
      </div>

      {/* Client Test Tab */}
      {activeTab === 'client' && (
        <div className="tab-content">
          <section className="card">
            <div className="card-header">
              <h2>Teste do seu Cliente TCP</h2>
              <div>
                {!clientPort ? (
                  <button className="primary-button" onClick={handleStartClientTest}>
                    Iniciar Teste
                  </button>
                ) : (
                  <button className="danger-button" onClick={handleStopClientTest}>
                    Parar Teste
                  </button>
                )}
              </div>
            </div>

            {clientPort && (
              <div className="active-server-banner">
                <div className="server-info">
                  <span className="server-status">🟢 Servidor Ativo</span>
                  <span className="server-port">Porta: <strong>{clientPort}</strong></span>
                  <span className="server-id">ID: {currentTestId}</span>
                </div>
                <button className="danger-button-small" onClick={handleStopClientTest}>
                  🛑 Parar Servidor
                </button>
              </div>
            )}

            {!clientPort && (
              <div className="info-banner">
                <p>💡 Clique em "Iniciar Teste" para criar um servidor mock TCP e testar seu cliente.</p>
              </div>
            )}

            {clientPort && (
              <>
                {currentWarning && (
                  <div className="warning-banner">
                    <div>
                      <strong>⚠️ Aviso</strong>
                      <p>{currentWarning}</p>
                    </div>
                    <button onClick={() => setCurrentWarning(null)}>Dispensar</button>
                  </div>
                )}

                {currentPrompt && (
                  <div className="prompt-banner">
                    <h3>📋 {currentPrompt.title}</h3>
                    <p>💡 {currentPrompt.hint}</p>
                  </div>
                )}

                <div className="checklist-section">
                  <h3>Checklist de Testes</h3>
                  <div className="checklist">
                    {clientChecklist.map((item) => (
                      <div key={item.id} className={`checklist-item ${item.status}`}>
                        <span className="check-icon">{getChecklistIcon(item.status)}</span>
                        <div className="check-content">
                          <strong>{item.label}</strong>
                          <code>{item.operation}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {testStep === 'read_statement' && (
                  <div className="assessment-block">
                    <p>Seu cliente exibiu o extrato corretamente?</p>
                    <div className="button-row">
                      <button onClick={() => handleSelfAssessment('c) Extrato exibido corretamente', true)}>Sim</button>
                      <button onClick={() => handleSelfAssessment('c) Extrato exibido corretamente', false)}>Não</button>
                    </div>
                  </div>
                )}

                {testStep === 'error_login_test' && (
                  <div className="assessment-block">
                    <p>Seu cliente exibiu a mensagem de erro de login?</p>
                    <div className="button-row">
                      <button onClick={() => handleSelfAssessment('e) Erro de login exibido', true)}>Sim</button>
                      <button onClick={() => handleSelfAssessment('e) Erro de login exibido', false)}>Não</button>
                    </div>
                  </div>
                )}

                {testStep === 'error_register_test' && (
                  <div className="assessment-block">
                    <p>Seu cliente exibiu a mensagem de erro de cadastro?</p>
                    <div className="button-row">
                      <button onClick={() => handleSelfAssessment('d) Erro de cadastro exibido', true)}>Sim</button>
                      <button onClick={() => handleSelfAssessment('d) Erro de cadastro exibido', false)}>Não</button>
                    </div>
                  </div>
                )}

                {currentTestId && Object.keys(selfAssessments).length > 0 && (
                  <button className="primary-button" onClick={submitSelfAssessments}>
                    Enviar Autoavaliação
                  </button>
                )}
              </>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Logs do Teste de Cliente</h2>
              <button className="ghost-button" onClick={() => setClientLogs([])}>Limpar</button>
            </div>
            <div className="log-viewer">
              {clientLogs.length === 0 ? (
                <div className="empty-state">Logs aparecerão aqui...</div>
              ) : (
                clientLogs.map((log, index) => <div key={index}>{log}</div>)
              )}
            </div>
          </section>
        </div>
      )
      }

      {/* Server Test Tab */}
      {
        activeTab === 'server' && (
          <div className="tab-content">
            <section className="card">
              <div className="card-header">
                <h2>Teste do seu Servidor TCP</h2>
              </div>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Server IP"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  disabled={serverRunning}
                />
                <input
                  type="number"
                  placeholder="Server Port"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value)}
                  disabled={serverRunning}
                />
                <button
                  className="primary-button"
                  onClick={handleServerTest}
                  disabled={serverRunning}
                >
                  {serverRunning ? 'Executando...' : 'Iniciar Teste'}
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Logs do Teste de Servidor</h2>
                <button className="ghost-button" onClick={() => setServerLogs([])}>Limpar</button>
              </div>
              <div className="log-viewer">
                {serverLogs.length === 0 ? (
                  <div className="empty-state">Logs aparecerão aqui...</div>
                ) : (
                  serverLogs.map((log, index) => <div key={index}>{log}</div>)
                )}
              </div>
            </section>
          </div>
        )
      }

      {/* Test History */}
      <section className="card">
        <div className="card-header">
          <h2>Histórico de Testes</h2>
        </div>
        {testHistory.length === 0 ? (
          <div className="empty-state">Nenhum teste realizado ainda.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Etapas</th>
              </tr>
            </thead>
            <tbody>
              {testHistory.map((test) => (
                <tr key={test.id}>
                  <td>{new Date(test.created_at).toLocaleString()}</td>
                  <td>{test.test_type}</td>
                  <td>{test.final_score}</td>
                  <td>{test.TestStepResult?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div >
  );
}

export default Dashboard;

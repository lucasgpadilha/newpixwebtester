import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

function Dashboard() {
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [clientPort, setClientPort] = useState(null);
  const [logs, setLogs] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [currentTestType, setCurrentTestType] = useState(null);
  const [currentTestId, setCurrentTestId] = useState(null);
  const [testStep, setTestStep] = useState('');
  const [selfAssessments, setSelfAssessments] = useState({});
  const wsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Connect WebSocket
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket connected. Authenticating...');
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'auth_success') {
        addLog('WebSocket authenticated successfully.');
      } else if (data.event === 'test_step') {
        addLog(`[${data.step}] ${data.status}: ${data.details || ''}`);
        setTestStep(data.step);
      } else if (data.event === 'test_finished') {
        addLog('Test finished!');
        if (data.final_score !== undefined) {
          addLog(`Final Score: ${data.final_score}`);
        }
        if (data.test_history_id) {
          setCurrentTestId(data.test_history_id);
        }
        setCurrentTestType(null);
        fetchTestHistory();
      } else if (data.event === 'info') {
        addLog(`Info: ${data.message}`);
      } else if (data.event === 'error') {
        addLog(`Error: ${data.message}`);
      }
    };

    ws.onerror = (error) => {
      addLog('WebSocket error occurred.');
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      addLog('WebSocket disconnected.');
    };

    fetchTestHistory();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [navigate]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const fetchTestHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/test/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestHistory(response.data);
    } catch (error) {
      console.error('Error fetching test history:', error);
    }
  };

  const handleServerTest = async () => {
    if (!serverIp || !serverPort) {
      alert('Please enter IP and Port');
      return;
    }

    setLogs([]);
    setCurrentTestType('SERVER');
    addLog('Starting server test...');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/test/server`,
        { ip: serverIp, port: parseInt(serverPort, 10) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addLog('Server test started. Waiting for results...');
    } catch (error) {
      addLog(`Error: ${error.response?.data?.message || 'Failed to start server test'}`);
      setCurrentTestType(null);
    }
  };

  const handleClientTest = async () => {
    setLogs([]);
    setCurrentTestType('CLIENT');
    setClientPort(null);
    setTestStep('');
    setSelfAssessments({});
    addLog('Starting client test...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/test/client/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClientPort(response.data.port);
      addLog(`Mock server started on port ${response.data.port}`);
      addLog('Please connect your client to this port.');
    } catch (error) {
      addLog(`Error: ${error.response?.data?.message || 'Failed to start client test'}`);
      setCurrentTestType(null);
    }
  };

  const handleSelfAssessment = async (item: string, value: boolean) => {
    setSelfAssessments((prev) => ({ ...prev, [item]: value }));
  };

  const submitSelfAssessments = async () => {
    if (!currentTestId) {
      alert('No test ID available');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/test/self-assessment`,
        {
          test_history_id: currentTestId,
          assessments: selfAssessments,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addLog(`Self-assessments submitted. Final Score: ${response.data.final_score}`);
      fetchTestHistory();
    } catch (error) {
      addLog(`Error: ${error.response?.data?.message || 'Failed to submit self-assessments'}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>NewPix Web Tester - Dashboard</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Test My Server */}
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
          <h2>Test My Server</h2>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Server IP"
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              disabled={currentTestType === 'SERVER'}
            />
            <input
              type="number"
              placeholder="Server Port"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              disabled={currentTestType === 'SERVER'}
            />
            <button
              onClick={handleServerTest}
              disabled={currentTestType === 'SERVER'}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: currentTestType === 'SERVER' ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                cursor: currentTestType === 'SERVER' ? 'not-allowed' : 'pointer',
              }}
            >
              {currentTestType === 'SERVER' ? 'Test Running...' : 'Start Server Test'}
            </button>
          </div>
        </div>

        {/* Test My Client */}
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
          <h2>Test My Client</h2>
          {clientPort ? (
            <div>
              <p><strong>Connect your client to port: {clientPort}</strong></p>
              {testStep === 'read_statement' && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                  <p><strong>Passo 6: Seu cliente exibiu o extrato corretamente?</strong></p>
                  <button
                    onClick={() => handleSelfAssessment('c) Extrato exibido corretamente', true)}
                    style={{ marginRight: '10px', padding: '5px 15px' }}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => handleSelfAssessment('c) Extrato exibido corretamente', false)}
                    style={{ padding: '5px 15px' }}
                  >
                    Não
                  </button>
                </div>
              )}
              {testStep === 'error_register_test' && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                  <p><strong>Passo 8: Seu cliente exibiu a mensagem de erro de cadastro?</strong></p>
                  <button
                    onClick={() => handleSelfAssessment('d) Erro de cadastro exibido', true)}
                    style={{ marginRight: '10px', padding: '5px 15px' }}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => handleSelfAssessment('d) Erro de cadastro exibido', false)}
                    style={{ padding: '5px 15px' }}
                  >
                    Não
                  </button>
                </div>
              )}
              {testStep === 'error_login_test' && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                  <p><strong>Passo 7: Seu cliente exibiu a mensagem de erro de login?</strong></p>
                  <button
                    onClick={() => handleSelfAssessment('e) Erro de login exibido', true)}
                    style={{ marginRight: '10px', padding: '5px 15px' }}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => handleSelfAssessment('e) Erro de login exibido', false)}
                    style={{ padding: '5px 15px' }}
                  >
                    Não
                  </button>
                </div>
              )}
              {currentTestId && Object.keys(selfAssessments).length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={submitSelfAssessments}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Submit Self-Assessments
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleClientTest}
              disabled={currentTestType === 'CLIENT'}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: currentTestType === 'CLIENT' ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                cursor: currentTestType === 'CLIENT' ? 'not-allowed' : 'pointer',
              }}
            >
              {currentTestType === 'CLIENT' ? 'Test Running...' : 'Start Client Test'}
            </button>
          )}
        </div>
      </div>

      {/* Test Logs */}
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px', marginBottom: '20px' }}>
        <h2>Test Logs</h2>
        <div
          style={{
            height: '300px',
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {logs.length === 0 ? (
            <div>Logs will appear here...</div>
          ) : (
            logs.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>

      {/* Test History */}
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
        <h2>Test History</h2>
        {testHistory.length === 0 ? (
          <p>No test history available.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', border: '1px solid #ccc' }}>Date</th>
                <th style={{ padding: '10px', border: '1px solid #ccc' }}>Type</th>
                <th style={{ padding: '10px', border: '1px solid #ccc' }}>Score</th>
                <th style={{ padding: '10px', border: '1px solid #ccc' }}>Steps</th>
              </tr>
            </thead>
            <tbody>
              {testHistory.map((test) => (
                <tr key={test.id}>
                  <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                    {new Date(test.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ccc' }}>{test.test_type}</td>
                  <td style={{ padding: '10px', border: '1px solid #ccc' }}>{test.final_score}</td>
                  <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                    {test.TestStepResult?.length || 0} steps
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

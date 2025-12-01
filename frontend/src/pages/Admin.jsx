import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Admin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [whitelist, setWhitelist] = useState([]);
    const [users, setUsers] = useState([]);
    const [newRA, setNewRA] = useState('');
    const [activeTab, setActiveTab] = useState('whitelist');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [testDefinitions, setTestDefinitions] = useState({ SERVER: [], CLIENT: [] });
    const [testsLoading, setTestsLoading] = useState(false);
    const [testDrafts, setTestDrafts] = useState({});
    // Test Steps state
    const [testSteps, setTestSteps] = useState([]);
    const [testStepsLoading, setTestStepsLoading] = useState(false);
    const [showStepModal, setShowStepModal] = useState(false);
    const [editingTestStep, setEditingTestStep] = useState(null);
    const [stepFormData, setStepFormData] = useState({
        step_key: '',
        step_name: '',
        operation: '',
        weight: 0,
        is_auto_evaluated: true,
        requires_user_input: false,
        prompt_title: '',
        prompt_hint: ''
    });
    const [draggedStepIndex, setDraggedStepIndex] = useState(null);
    const [testStepsType, setTestStepsType] = useState('CLIENT');
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminStatus();
        if (activeTab === 'whitelist') {
            fetchWhitelist();
        } else if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'tests') {
            fetchTestDefinitions();
        } else if (activeTab === 'teststeps') {
            fetchTestSteps();
        }
    }, [activeTab, testStepsType]);

    const checkAdminStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const response = await axios.get(`${API_URL}/api/admin/whitelist`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setIsAdmin(true);
            setWhitelist(response.data);
        } catch (err) {
            if (err.response?.status === 403) {
                setIsAdmin(false);
                setError('Access denied. Admin privileges required.');
                setTimeout(() => navigate('/'), 2000);
            } else {
                setError('Failed to verify admin status');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchWhitelist = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/admin/whitelist`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setWhitelist(response.data);
        } catch (err) {
            setError('Failed to fetch whitelist');
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(response.data);
        } catch (err) {
            setError('Failed to fetch users');
        }
    };

    const fetchTestDefinitions = async () => {
        try {
            setTestsLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/admin/tests`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTestDefinitions(response.data);
            setTestDrafts({});
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch test definitions');
        } finally {
            setTestsLoading(false);
        }
    };

    const handleTestDraftChange = (key, field, value) => {
        setTestDrafts((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value,
            },
        }));
    };

    const handleSaveDefinition = async (definition) => {
        try {
            const token = localStorage.getItem('token');
            const draft = testDrafts[definition.key] || {};
            const payload = {
                key: definition.key,
                weight:
                    draft.weight !== undefined && draft.weight !== ''
                        ? Number(draft.weight)
                        : definition.weight,
                enabled:
                    draft.enabled !== undefined ? draft.enabled : definition.enabled,
                description: draft.description ?? definition.description,
                label: draft.label ?? definition.label,
            };

            await axios.put(`${API_URL}/api/admin/tests`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setSuccess(`Test ${definition.key} updated successfully`);
            fetchTestDefinitions();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update test definition');
        }
    };

    const handleAddRA = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newRA.trim()) {
            setError('RA cannot be empty');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/admin/whitelist`,
                { ra: newRA.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('RA added to whitelist successfully');
            setNewRA('');
            fetchWhitelist();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add RA');
        }
    };

    const handleRemoveRA = async (ra) => {
        if (!confirm(`Are you sure you want to remove ${ra} from the whitelist?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/whitelist/${ra}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSuccess('RA removed from whitelist successfully');
            fetchWhitelist();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove RA');
        }
    };

    const handlePromote = async (ra) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/admin/users/${ra}/promote`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('User promoted to admin successfully');
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to promote user');
        }
    };

    const handleDemote = async (ra) => {
        if (!confirm(`Are you sure you want to remove admin privileges from ${ra}?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/admin/users/${ra}/demote`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Admin privileges removed successfully');
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to demote user');
        }
    };

    // Test Steps Functions
    const fetchTestSteps = async () => {
        setTestStepsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_URL}/api/admin/test-steps?test_type=${testStepsType}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTestSteps(response.data);
        } catch (error) {
            setError('Falha ao carregar passos de teste');
        } finally {
            setTestStepsLoading(false);
        }
    };

    const openCreateStepModal = () => {
        setEditingTestStep(null);
        setStepFormData({
            step_key: '',
            step_name: '',
            operation: '',
            weight: 0,
            is_auto_evaluated: true,
            requires_user_input: false,
            prompt_title: '',
            prompt_hint: ''
        });
        setShowStepModal(true);
    };

    const openEditStepModal = (step) => {
        setEditingTestStep(step);
        setStepFormData({
            step_key: step.step_key,
            step_name: step.step_name,
            operation: step.operation,
            weight: step.weight,
            is_auto_evaluated: step.is_auto_evaluated,
            requires_user_input: step.requires_user_input,
            prompt_title: step.prompt_title || '',
            prompt_hint: step.prompt_hint || ''
        });
        setShowStepModal(true);
    };

    const handleStepInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setStepFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleStepSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        try {
            if (editingTestStep) {
                await axios.put(
                    `${API_URL}/api/admin/test-steps/${editingTestStep.id}`,
                    stepFormData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSuccess('Passo atualizado com sucesso!');
            } else {
                await axios.post(
                    `${API_URL}/api/admin/test-steps`,
                    { ...stepFormData, test_type: testStepsType },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSuccess('Passo criado com sucesso!');
            }
            setShowStepModal(false);
            fetchTestSteps();
        } catch (error) {
            setError(error.response?.data?.error || 'Erro ao salvar passo de teste');
        }
    };

    const handleDeleteStep = async (id) => {
        if (!confirm('Tem certeza que deseja deletar este passo de teste?')) {
            return;
        }

        const token = localStorage.getItem('token');
        try {
            await axios.delete(
                `${API_URL}/api/admin/test-steps/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Passo deletado com sucesso!');
            fetchTestSteps();
        } catch (error) {
            setError(error.response?.data?.error || 'Erro ao deletar passo de teste');
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedStepIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedStepIndex === null || draggedStepIndex === index) return;

        const newSteps = [...testSteps];
        const draggedStep = newSteps[draggedStepIndex];
        newSteps.splice(draggedStepIndex, 1);
        newSteps.splice(index, 0, draggedStep);

        setTestSteps(newSteps);
        setDraggedStepIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedStepIndex === null) return;

        const reordered = testSteps.map((step, index) => ({
            id: step.id,
            step_order: index + 1
        }));

        const token = localStorage.getItem('token');
        try {
            await axios.put(
                `${API_URL}/api/admin/test-steps/reorder`,
                { test_type: testStepsType, reordered },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            setError('Erro ao reordenar passos de teste');
            fetchTestSteps();
        }
        setDraggedStepIndex(null);
    };

    if (loading) {
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    if (!isAdmin) {
        return (
            <div style={{ padding: '20px' }}>
                <h1>Access Denied</h1>
                <p>{error || 'Admin privileges required'}</p>
                <button onClick={() => navigate('/')}>Go to Dashboard</button>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Admin Panel</h1>
                <button onClick={() => navigate('/')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Back to Dashboard
                </button>
            </div>

            {error && (
                <div style={{ padding: '10px', backgroundColor: '#fee', color: '#c00', marginBottom: '20px', borderRadius: '5px' }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{ padding: '10px', backgroundColor: '#efe', color: '#0c0', marginBottom: '20px', borderRadius: '5px' }}>
                    {success}
                </div>
            )}

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('whitelist')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        backgroundColor: activeTab === 'whitelist' ? '#007bff' : 'transparent',
                        color: activeTab === 'whitelist' ? 'white' : 'black',
                        cursor: 'pointer',
                        marginRight: '10px',
                    }}
                >
                    Whitelist Management
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        backgroundColor: activeTab === 'users' ? '#007bff' : 'transparent',
                        color: activeTab === 'users' ? 'white' : 'black',
                        cursor: 'pointer',
                        marginRight: '10px',
                    }}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('tests')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        backgroundColor: activeTab === 'tests' ? '#007bff' : 'transparent',
                        color: activeTab === 'tests' ? 'white' : 'black',
                        cursor: 'pointer',
                        marginRight: '10px',
                    }}
                >
                    Test Definitions
                </button>
                <button
                    onClick={() => setActiveTab('teststeps')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        backgroundColor: activeTab === 'teststeps' ? '#007bff' : 'transparent',
                        color: activeTab === 'teststeps' ? 'white' : 'black',
                        cursor: 'pointer',
                    }}
                >
                    Test Steps Config
                </button>
            </div>

            {/* Whitelist Tab */}
            {activeTab === 'whitelist' && (
                <div>
                    <h2>RA Whitelist Management</h2>

                    {/* Add RA Form */}
                    <form onSubmit={handleAddRA} style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
                        <h3>Add RA to Whitelist</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Enter RA"
                                value={newRA}
                                onChange={(e) => setNewRA(e.target.value)}
                                style={{ flex: 1, padding: '10px', fontSize: '16px' }}
                            />
                            <button
                                type="submit"
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                Add RA
                            </button>
                        </div>
                    </form>

                    {/* Whitelist Table */}
                    <div style={{ border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f0f0f0' }}>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>RA</th>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>Added Date</th>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {whitelist.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>
                                            No RAs in whitelist
                                        </td>
                                    </tr>
                                ) : (
                                    whitelist.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>{item.ra}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                {new Date(item.created_at).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                <button
                                                    onClick={() => handleRemoveRA(item.ra)}
                                                    style={{
                                                        padding: '5px 15px',
                                                        backgroundColor: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div>
                    <h2>User Management</h2>

                    <div style={{ border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f0f0f0' }}>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>RA</th>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>Admin</th>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>Tests</th>
                                    <th style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'left' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.ra}>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>{user.ra}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                {user.is_admin ? '✓ Yes' : 'No'}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>{user.test_count}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                {user.is_admin ? (
                                                    <button
                                                        onClick={() => handleDemote(user.ra)}
                                                        style={{
                                                            padding: '5px 15px',
                                                            backgroundColor: '#ffc107',
                                                            color: 'black',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Demote
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePromote(user.ra)}
                                                        style={{
                                                            padding: '5px 15px',
                                                            backgroundColor: '#007bff',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Promote to Admin
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tests Tab */}
            {activeTab === 'tests' && (
                <div>
                    <h2>Test Definitions</h2>
                    {testsLoading ? (
                        <p>Loading test definitions...</p>
                    ) : (
                        <>
                            {['SERVER', 'CLIENT'].map((type) => (
                                <div key={type} style={{ marginBottom: '30px' }}>
                                    <h3>{type === 'SERVER' ? 'Server tests' : 'Client tests'}</h3>
                                    <div style={{ border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f0f0f0' }}>
                                                    <th style={{ padding: '10px', border: '1px solid #ccc' }}>Key</th>
                                                    <th style={{ padding: '10px', border: '1px solid #ccc' }}>Weight</th>
                                                    <th style={{ padding: '10px', border: '1px solid #ccc' }}>Enabled</th>
                                                    <th style={{ padding: '10px', border: '1px solid #ccc' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(testDefinitions[type] || []).map((definition) => {
                                                    const draft = testDrafts[definition.key] || {};
                                                    return (
                                                        <tr key={definition.key}>
                                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                                <div style={{ fontWeight: 'bold' }}>{definition.key}</div>
                                                                <div style={{ fontSize: '12px', color: '#555' }}>{definition.description}</div>
                                                            </td>
                                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                                <input
                                                                    type="number"
                                                                    step="0.05"
                                                                    value={draft.weight ?? definition.weight}
                                                                    onChange={(e) => handleTestDraftChange(definition.key, 'weight', e.target.value)}
                                                                    style={{ width: '100%', padding: '6px' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                                <select
                                                                    value={(draft.enabled ?? definition.enabled) ? 'true' : 'false'}
                                                                    onChange={(e) =>
                                                                        handleTestDraftChange(definition.key, 'enabled', e.target.value === 'true')
                                                                    }
                                                                >
                                                                    <option value="true">Active</option>
                                                                    <option value="false">Disabled</option>
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                                <button
                                                                    onClick={() => handleSaveDefinition(definition)}
                                                                    style={{ padding: '6px 12px', cursor: 'pointer' }}
                                                                >
                                                                    Save
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {(testDefinitions[type] || []).length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" style={{ padding: '15px', textAlign: 'center' }}>
                                                            No tests found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Test Steps Config Tab */}
            {activeTab === 'teststeps' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Test Steps Configuration</h2>
                        <button
                            onClick={openCreateStepModal}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            + Create New Step
                        </button>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <button
                            onClick={() => setTestStepsType('CLIENT')}
                            style={{
                                padding: '10px 20px',
                                marginRight: '10px',
                                border: 'none',
                                backgroundColor: testStepsType === 'CLIENT' ? '#007bff' : '#e9ecef',
                                color: testStepsType === 'CLIENT' ? 'white' : 'black',
                                cursor: 'pointer',
                                borderRadius: '5px'
                            }}
                        >
                            Client Tests
                        </button>
                        <button
                            onClick={() => setTestStepsType('SERVER')}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                backgroundColor: testStepsType === 'SERVER' ? '#007bff' : '#e9ecef',
                                color: testStepsType === 'SERVER' ? 'white' : 'black',
                                cursor: 'pointer',
                                borderRadius: '5px'
                            }}
                        >
                            Server Tests
                        </button>
                    </div>

                    {testStepsLoading ? (
                        <p>Loading test steps...</p>
                    ) : (
                        <div style={{ border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Order</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Key</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Name</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Operation</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Weight</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Type</th>
                                        <th style={{ padding: '10px', border: '1px solid #ccc' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testSteps.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '20px', textAlign: 'center' }}>
                                                No test steps found. Create one to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        testSteps.map((step, index) => (
                                            <tr
                                                key={step.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={handleDragEnd}
                                                style={{
                                                    backgroundColor: draggedStepIndex === index ? '#e9ecef' : 'white',
                                                    cursor: 'move'
                                                }}
                                            >
                                                <td style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center' }}>
                                                    {index + 1}
                                                </td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{step.step_key}</td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{step.step_name}</td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{step.operation}</td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{step.weight}</td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                    {step.is_auto_evaluated ? 'Auto' : 'Manual'}
                                                </td>
                                                <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                                    <button
                                                        onClick={() => openEditStepModal(step)}
                                                        style={{
                                                            padding: '5px 10px',
                                                            marginRight: '5px',
                                                            backgroundColor: '#ffc107',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStep(step.id)}
                                                        style={{
                                                            padding: '5px 10px',
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Modal for Create/Edit Step */}
                    {showStepModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '5px',
                                width: '500px',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}>
                                <h2>{editingTestStep ? 'Edit Test Step' : 'Create New Test Step'}</h2>
                                <form onSubmit={handleStepSubmit}>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Step Key (Unique ID):</label>
                                        <input
                                            type="text"
                                            name="step_key"
                                            value={stepFormData.step_key}
                                            onChange={handleStepInputChange}
                                            required
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Step Name:</label>
                                        <input
                                            type="text"
                                            name="step_name"
                                            value={stepFormData.step_name}
                                            onChange={handleStepInputChange}
                                            required
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Operation:</label>
                                        <input
                                            type="text"
                                            name="operation"
                                            value={stepFormData.operation}
                                            onChange={handleStepInputChange}
                                            required
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Weight:</label>
                                        <input
                                            type="number"
                                            name="weight"
                                            step="0.1"
                                            value={stepFormData.weight}
                                            onChange={handleStepInputChange}
                                            required
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="checkbox"
                                                name="is_auto_evaluated"
                                                checked={stepFormData.is_auto_evaluated}
                                                onChange={handleStepInputChange}
                                            />
                                            Auto Evaluated
                                        </label>
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="checkbox"
                                                name="requires_user_input"
                                                checked={stepFormData.requires_user_input}
                                                onChange={handleStepInputChange}
                                            />
                                            Requires User Input (Self-Assessment)
                                        </label>
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Prompt Title:</label>
                                        <input
                                            type="text"
                                            name="prompt_title"
                                            value={stepFormData.prompt_title}
                                            onChange={handleStepInputChange}
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Prompt Hint:</label>
                                        <textarea
                                            name="prompt_hint"
                                            value={stepFormData.prompt_hint}
                                            onChange={handleStepInputChange}
                                            style={{ width: '100%', padding: '8px', minHeight: '80px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowStepModal(false)}
                                            style={{
                                                padding: '10px 20px',
                                                backgroundColor: '#6c757d',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '5px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            style={{
                                                padding: '10px 20px',
                                                backgroundColor: '#007bff',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '5px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {editingTestStep ? 'Save Changes' : 'Create Step'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Admin;

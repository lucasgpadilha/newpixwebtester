import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('CLIENT');
    const [testSteps, setTestSteps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingStep, setEditingStep] = useState(null);
    const [formData, setFormData] = useState({
        step_key: '',
        step_name: '',
        operation: '',
        weight: 0,
        is_auto_evaluated: true,
        requires_user_input: false,
        prompt_title: '',
        prompt_hint: ''
    });
    const [draggedItem, setDraggedItem] = useState(null);

    // Fetch test steps on mount and when tab changes
    useEffect(() => {
        fetchTestSteps();
    }, [activeTab]);

    const fetchTestSteps = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_URL}/api/admin/test-steps?test_type=${activeTab}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTestSteps(response.data);
        } catch (error) {
            console.error('Error fetching test steps:', error);
            alert('Falha ao carregar passos de teste');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingStep(null);
        setFormData({
            step_key: '',
            step_name: '',
            operation: '',
            weight: 0,
            is_auto_evaluated: true,
            requires_user_input: false,
            prompt_title: '',
            prompt_hint: ''
        });
        setShowModal(true);
    };

    const openEditModal = (step) => {
        setEditingStep(step);
        setFormData({
            step_key: step.step_key,
            step_name: step.step_name,
            operation: step.operation,
            weight: step.weight,
            is_auto_evaluated: step.is_auto_evaluated,
            requires_user_input: step.requires_user_input,
            prompt_title: step.prompt_title || '',
            prompt_hint: step.prompt_hint || ''
        });
        setShowModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        try {
            if (editingStep) {
                // Update existing step
                await axios.put(
                    `${API_URL}/api/admin/test-steps/${editingStep.id}`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                alert('Passo atualizado com sucesso!');
            } else {
                // Create new step
                await axios.post(
                    `${API_URL}/api/admin/test-steps`,
                    { ...formData, test_type: activeTab },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                alert('Passo criado com sucesso!');
            }
            setShowModal(false);
            fetchTestSteps();
        } catch (error) {
            console.error('Error saving test step:', error);
            alert(error.response?.data?.error || 'Erro ao salvar passo de teste');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja deletar este passo de teste?')) {
            return;
        }

        const token = localStorage.getItem('token');
        try {
            await axios.delete(
                `${API_URL}/api/admin/test-steps/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Passo deletado com sucesso!');
            fetchTestSteps();
        } catch (error) {
            console.error('Error deleting test step:', error);
            alert(error.response?.data?.error || 'Erro ao deletar passo de teste');
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedItem === null || draggedItem === index) return;

        // Reorder array
        const newSteps = [...testSteps];
        const draggedStep = newSteps[draggedItem];
        newSteps.splice(draggedItem, 1);
        newSteps.splice(index, 0, draggedStep);

        setTestSteps(newSteps);
        setDraggedItem(index);
    };

    const handleDragEnd = async () => {
        if (draggedItem === null) return;

        // Save new order to backend
        const reordered = testSteps.map((step, index) => ({
            id: step.id,
            step_order: index + 1
        }));

        const token = localStorage.getItem('token');
        try {
            await axios.put(
                `${API_URL}/api/admin/test-steps/reorder`,
                { test_type: activeTab, reordered },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Error reordering test steps:', error);
            alert('Erro ao reordenar passos de teste');
            fetchTestSteps(); // Reload to reset
        }
        setDraggedItem(null);
    };

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h1>Painel de Administração</h1>
                <p>Gerenciar configurações de passos de teste</p>
            </div>

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`tab ${activeTab === 'CLIENT' ? 'active' : ''}`}
                    onClick={() => setActiveTab('CLIENT')}
                >
                    Testes de Cliente
                </button>
                <button
                    className={`tab ${activeTab === 'SERVER' ? 'active' : ''}`}
                    onClick={() => setActiveTab('SERVER')}
                >
                    Testes de Servidor
                </button>
            </div>

            {/* Create button */}
            <div className="admin-actions">
                <button className="btn-create" onClick={openCreateModal}>
                    + Criar Novo Passo
                </button>
            </div>

            {/* Test steps list */}
            <div className="test-steps-list">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : testSteps.length === 0 ? (
                    <div className="empty-state">
                        Nenhum passo de teste encontrado. Clique em "Criar Novo Passo" para começar.
                    </div>
                ) : (
                    <table className="steps-table">
                        <thead>
                            <tr>
                                <th>Ordem</th>
                                <th>Chave</th>
                                <th>Nome</th>
                                <th>Operação</th>
                                <th>Peso</th>
                                <th>Tipo</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {testSteps.map((step, index) => (
                                <tr
                                    key={step.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={draggedItem === index ? 'dragging' : ''}
                                >
                                    <td>{step.step_order}</td>
                                    <td><code>{step.step_key}</code></td>
                                    <td>{step.step_name}</td>
                                    <td><code>{step.operation}</code></td>
                                    <td>{step.weight.toFixed(2)}</td>
                                    <td>
                                        {step.is_auto_evaluated ? (
                                            <span className="badge badge-auto">Auto</span>
                                        ) : step.requires_user_input ? (
                                            <span className="badge badge-manual">Manual</span>
                                        ) : (
                                            <span className="badge badge-none">N/A</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn-edit"
                                            onClick={() => openEditModal(step)}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDelete(step.id)}
                                        >
                                            Deletar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingStep ? 'Editar Passo' : 'Criar Novo Passo'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Chave do Passo *</label>
                                <input
                                    type="text"
                                    name="step_key"
                                    value={formData.step_key}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="ex: connect, register, login"
                                />
                            </div>

                            <div className="form-group">
                                <label>Nome do Passo *</label>
                                <input
                                    type="text"
                                    name="step_name"
                                    value={formData.step_name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="ex: 1. Conectar ao servidor"
                                />
                            </div>

                            <div className="form-group">
                                <label>Operação *</label>
                                <input
                                    type="text"
                                    name="operation"
                                    value={formData.operation}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="ex: conectar, usuario_criar"
                                />
                            </div>

                            <div className="form-group">
                                <label>Peso</label>
                                <input
                                    type="number"
                                    name="weight"
                                    value={formData.weight}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div className="form-group-row">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="is_auto_evaluated"
                                        checked={formData.is_auto_evaluated}
                                        onChange={handleInputChange}
                                    />
                                    Avaliado automaticamente
                                </label>

                                <label>
                                    <input
                                        type="checkbox"
                                        name="requires_user_input"
                                        checked={formData.requires_user_input}
                                        onChange={handleInputChange}
                                    />
                                    Requer autoavaliação
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Título do Prompt</label>
                                <input
                                    type="text"
                                    name="prompt_title"
                                    value={formData.prompt_title}
                                    onChange={handleInputChange}
                                    placeholder="Título exibido ao usuário"
                                />
                            </div>

                            <div className="form-group">
                                <label>Dica do Prompt</label>
                                <textarea
                                    name="prompt_hint"
                                    value={formData.prompt_hint}
                                    onChange={handleInputChange}
                                    rows="3"
                                    placeholder="Dica ou instrução para o usuário"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-save">
                                    {editingStep ? 'Salvar Alterações' : 'Criar Passo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Scoring map for SERVER tests (itens 'f' a 'o')
const serverTestScoreMap = new Map([
    ['Protocol: Conectar', 0.1],
    ['Protocol: Criar Usuário', 0.2],
    ['Protocol: Login', 0.2],
    ['f) Servidor recebe depósito', 0.3],
    ['g) Saldo correto após depósito', 0.3],
    ['h) Servidor retorna extrato', 0.3],
    ['i) Extrato correto', 0.3],
    ['j) Saque com saldo', 0.3],
    ['k) Erro Cadastro (CPF inválido)', 0.2],
    ['l) Erro Saque (saldo insuficiente)', 0.2],
    ['m) Erro: Chaves faltando', 0.1],
    ['n) Erro: Data inválida', 0.1],
    ['o) Erro: JSON inválido', 0.1],
    // Added coverage for remaining protocols
    ['Protocol: Atualizar Usuário', 0.2],
    ['Nome atualizado refletido', 0.2],
    ['Protocol: Logout', 0.1],
    ['Logout invalida token', 0.2],
    ['Protocol: Deletar Usuário (sem auth)', 0.1],
]);
// Scoring map for CLIENT tests (itens 'a' a 'e')
const clientTestScoreMap = new Map([
    ['connect', 0.1], // Connection step
    ['register', 0.1], // Register step
    ['login', 0.1], // Login step
    ['deposit', 0.2], // Item 'a': Depósito realizado
    ['read_statement', 0.2], // Item 'b': Extrato recebido
    // Items 'c', 'd', 'e' are self-assessed and will be handled separately
    ['error_login_test', 0.15], // Item 'e': Erro de login exibido (test sent)
    ['error_register_test', 0.15], // Item 'd': Erro de cadastro exibido (test sent)
]);
// Self-assessment scores (items 'c', 'd', 'e')
const selfAssessmentScoreMap = new Map([
    ['c) Extrato exibido corretamente', 0.2],
    ['d) Erro de cadastro exibido', 0.15],
    ['e) Erro de login exibido', 0.15],
]);
const calculateScore = (steps, testType, selfAssessments) => {
    const scoreMap = testType === 'SERVER' ? serverTestScoreMap : clientTestScoreMap;
    let totalScore = 0;
    // Calculate score from test steps
    for (const step of steps) {
        if (step.status === 'OK' && scoreMap.has(step.step)) {
            totalScore += scoreMap.get(step.step);
        }
    }
    // Add self-assessment scores for CLIENT tests
    if (testType === 'CLIENT' && selfAssessments) {
        for (const [key, value] of selfAssessments.entries()) {
            if (value && selfAssessmentScoreMap.has(key)) {
                totalScore += selfAssessmentScoreMap.get(key);
            }
        }
    }
    // Return a score rounded to two decimal places, capped at 10.0
    return Math.min(Math.round(totalScore * 100) / 100, 10.0);
};
const calculateAndSaveScore = async (userRa, steps, testType, selfAssessments) => {
    const finalScore = calculateScore(steps, testType, selfAssessments);
    // Create TestHistory with related TestStepResults
    const testHistory = await prisma.testHistory.create({
        data: {
            user_ra: userRa,
            test_type: testType,
            final_score: finalScore,
            TestStepResult: {
                create: steps.map(step => ({
                    step_name: step.step,
                    status: step.status,
                    details: step.details || '',
                })),
            },
        },
    });
    return {
        id: testHistory.id,
        final_score: finalScore,
    };
};
exports.scoringService = {
    calculateScore,
    calculateAndSaveScore,
};
//# sourceMappingURL=scoringService.js.map
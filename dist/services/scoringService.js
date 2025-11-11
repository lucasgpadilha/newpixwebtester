"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringService = void 0;
// Scoring map based on the (assumed) evaluation criteria from the user prompt.
// The actual keys and values would need to be adjusted based on the real evaluation image.
const serverTestScoreMap = new Map([
    // These keys should match the 'step' string from tcpTestRunner.ts
    ['Protocol: Conectar', 0.1],
    ['Protocol: Criar Usuário', 0.2],
    ['Protocol: Login', 0.2],
    ['f) Servidor recebe depósito', 0.3], // From prompt
    ['g) Saldo correto após depósito', 0.3], // Assumed
    ['h) Servidor retorna extrato', 0.3], // Assumed
    ['i) Extrato correto', 0.3], // Assumed
    ['j) Saque com saldo', 0.3], // Assumed
    ['k) Erro Cadastro (CPF inválido)', 0.2], // Assumed
    ['l) Erro Saque (saldo insuficiente)', 0.2], // Assumed
    // ... other server test steps
]);
const clientTestScoreMap = new Map([
    // These keys should match the 'step' string from tcpMockServer.ts
    ['a) Depósito realizado', 0.5], // Assumed
    ['b) Extrato recebido', 0.5], // Assumed
    ['c) Extrato exibido corretamente', 0.5], // Assumed (self-assessed)
    ['d) Erro de cadastro exibido', 0.5], // Assumed (self-assessed)
    ['e) Erro de login exibido', 0.5], // Assumed (self-assessed)
]);
const calculateScore = (steps, testType) => {
    const scoreMap = testType === 'SERVER' ? serverTestScoreMap : clientTestScoreMap;
    let totalScore = 0;
    for (const step of steps) {
        if (step.status === 'OK' && scoreMap.has(step.step)) {
            totalScore += scoreMap.get(step.step);
        }
    }
    // Return a score rounded to two decimal places
    return Math.round(totalScore * 100) / 100;
};
// In a real scenario, this service would also interact with Prisma to save the score.
// For example:
/*
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const calculateAndSaveScore = async (testHistoryId: number, steps: TestStepResult[], testType: TestType) => {
    const finalScore = calculateScore(steps, testType);

    await prisma.testHistory.update({
        where: { id: testHistoryId },
        data: { final_score: finalScore },
    });

    return finalScore;
}
*/
exports.scoringService = {
    calculateScore,
    // calculateAndSaveScore,
};
//# sourceMappingURL=scoringService.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const tempDbService_1 = require("../services/tempDbService");
const tcpMockServer_1 = require("../services/tcpMockServer");
const scoringService_1 = require("../services/scoringService");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.post('/client/start', async (req, res) => {
    const userRa = req.user?.ra;
    if (!userRa) {
        // This should not be reached if authMiddleware is working correctly
        return res.status(401).json({ message: 'User not authenticated.' });
    }
    const testId = `test-${crypto_1.default.randomBytes(8).toString('hex')}`;
    try {
        const db = await tempDbService_1.tempDbService.createTempDb(testId);
        const tcpServer = (0, tcpMockServer_1.startTcpMockServer)(testId, db, userRa);
        tcpServer.listen(0, () => {
            const address = tcpServer.address();
            if (typeof address === 'string' || address === null) {
                // This case is unlikely for a TCP server starting on a dynamic port
                tcpServer.close();
                res.status(500).json({ message: 'Failed to determine server port.' });
                return;
            }
            const port = address.port;
            console.log(`[${testId}] Mock TCP server started for RA ${userRa} on port ${port}`);
            res.status(200).json({ port });
        });
        tcpServer.on('error', (err) => {
            console.error(`[${testId}] Failed to start TCP Server:`, err);
            res.status(500).json({ message: `Failed to start TCP server: ${err.message}` });
        });
    }
    catch (error) {
        console.error(`[${testId}] Error during client test setup:`, error);
        res.status(500).json({ message: 'Failed to set up client test environment.' });
    }
});
// Get test history for authenticated user
router.get('/history', async (req, res) => {
    const userRa = req.user?.ra;
    if (!userRa) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }
    try {
        const history = await prisma.testHistory.findMany({
            where: { user_ra: userRa },
            include: {
                TestStepResult: true,
            },
            orderBy: {
                created_at: 'desc',
            },
        });
        res.status(200).json(history);
    }
    catch (error) {
        console.error('Error fetching test history:', error);
        res.status(500).json({ message: 'Failed to fetch test history.' });
    }
});
// Submit self-assessments for client test (items c, d, e)
router.post('/self-assessment', async (req, res) => {
    const userRa = req.user?.ra;
    if (!userRa) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }
    const { test_history_id, assessments } = req.body;
    if (!test_history_id || !assessments) {
        return res.status(400).json({ message: 'test_history_id and assessments are required.' });
    }
    try {
        // Get the test history
        const testHistory = await prisma.testHistory.findFirst({
            where: {
                id: parseInt(test_history_id, 10),
                user_ra: userRa,
                test_type: 'CLIENT',
            },
            include: {
                TestStepResult: true,
            },
        });
        if (!testHistory) {
            return res.status(404).json({ message: 'Test history not found.' });
        }
        // Convert assessments object to Map
        const selfAssessments = new Map();
        if (assessments['c) Extrato exibido corretamente'] !== undefined) {
            selfAssessments.set('c) Extrato exibido corretamente', assessments['c) Extrato exibido corretamente']);
        }
        if (assessments['d) Erro de cadastro exibido'] !== undefined) {
            selfAssessments.set('d) Erro de cadastro exibido', assessments['d) Erro de cadastro exibido']);
        }
        if (assessments['e) Erro de login exibido'] !== undefined) {
            selfAssessments.set('e) Erro de login exibido', assessments['e) Erro de login exibido']);
        }
        // Recalculate score with self-assessments
        const steps = testHistory.TestStepResult.map(step => ({
            step: step.step_name,
            status: step.status,
            details: step.details || undefined,
        }));
        const finalScore = scoringService_1.scoringService.calculateScore(steps, 'CLIENT', selfAssessments);
        // Update test history with new score
        await prisma.testHistory.update({
            where: { id: testHistory.id },
            data: { final_score: finalScore },
        });
        res.status(200).json({
            message: 'Self-assessments submitted successfully.',
            final_score: finalScore,
        });
    }
    catch (error) {
        console.error('Error submitting self-assessments:', error);
        res.status(500).json({ message: 'Failed to submit self-assessments.' });
    }
});
exports.default = router;
//# sourceMappingURL=testClient.js.map
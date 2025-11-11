"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const tempDbService_1 = require("../services/tempDbService");
const tcpMockServer_1 = require("../services/tcpMockServer");
const router = (0, express_1.Router)();
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
exports.default = router;
//# sourceMappingURL=testClient.js.map
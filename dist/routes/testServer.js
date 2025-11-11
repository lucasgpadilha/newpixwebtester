"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tcpTestRunner_1 = require("../services/tcpTestRunner");
const router = (0, express_1.Router)();
router.post('/server', (req, res) => {
    const { ip, port } = req.body;
    const userRa = req.user?.ra;
    if (!userRa) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }
    if (!ip || !port) {
        return res.status(400).json({ message: 'IP address and port are required.' });
    }
    // Validate port
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        return res.status(400).json({ message: 'Invalid port number.' });
    }
    // Run the test asynchronously (fire and forget from the HTTP request's perspective)
    (0, tcpTestRunner_1.runServerTest)(ip, portNum, userRa);
    // Immediately respond to the client
    res.status(202).json({ message: 'Test started. Check websockets for live results.' });
});
exports.default = router;
//# sourceMappingURL=testServer.js.map
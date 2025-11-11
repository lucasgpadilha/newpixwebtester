"use strict";
// This file contains configuration for the application.
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = exports.RA_WHITELIST = void 0;
// Whitelist of allowed RAs for registration.
exports.RA_WHITELIST = [
    'a1234567',
    'a2345678',
    'a3456789',
    'a2317974', // Example RA
];
// JWT secret key. In a real application, this should be stored securely
// and not hardcoded. For this project, we'll keep it here for simplicity.
exports.JWT_SECRET = 'your-super-secret-and-long-jwt-secret-key';
//# sourceMappingURL=config.js.map
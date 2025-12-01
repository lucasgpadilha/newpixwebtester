"use strict";
// This file contains configuration for the application.
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = exports.RA_WHITELIST_LEGACY = void 0;
// NOTE: RA Whitelist has been moved to the database (RAWhitelist table).
// The whitelist is now managed through the Admin Panel.
// This array is kept for reference during migration only.
// 
// To migrate existing RAs to the database, run:
// npx prisma db seed (if seed script is configured)
// OR manually insert via Admin Panel
exports.RA_WHITELIST_LEGACY = [
    'a1234567',
    'a2345678',
    'a3456789',
    'a2317974', // Example RA
];
// JWT secret key. In a real application, this should be stored securely
// and not hardcoded. For this project, we'll keep it here for simplicity.
exports.JWT_SECRET = 'your-super-secret-and-long-jwt-secret-key';
//# sourceMappingURL=config.js.map
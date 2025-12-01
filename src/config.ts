// This file contains configuration for the application.

// NOTE: RA Whitelist has been moved to the database (RAWhitelist table).
// The whitelist is now managed through the Admin Panel.
// This array is kept for reference during migration only.
// 
// To migrate existing RAs to the database, run:
// npx prisma db seed (if seed script is configured)
// OR manually insert via Admin Panel
export const RA_WHITELIST_LEGACY: string[] = [
  'a1234567',
  'a2345678',
  'a3456789',
  'a2317974', // Example RA
];

// JWT secret key. In a real application, this should be stored securely
// and not hardcoded. For this project, we'll keep it here for simplicity.
export const JWT_SECRET: string = 'your-super-secret-and-long-jwt-secret-key';

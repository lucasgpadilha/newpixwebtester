// This file contains configuration for the application.

// Whitelist of allowed RAs for registration.
export const RA_WHITELIST: string[] = [
  'a1234567',
  'a2345678',
  'a3456789',
  'a2317974', // Example RA
];

// JWT secret key. In a real application, this should be stored securely
// and not hardcoded. For this project, we'll keep it here for simplicity.
export const JWT_SECRET: string = 'your-super-secret-and-long-jwt-secret-key';

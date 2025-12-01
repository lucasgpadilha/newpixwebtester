"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// GET /api/admin/whitelist - List all RAs in whitelist
router.get('/whitelist', async (req, res) => {
    try {
        const whitelist = await prisma.rAWhitelist.findMany({
            orderBy: { created_at: 'desc' },
        });
        res.status(200).json(whitelist);
    }
    catch (error) {
        console.error('Error fetching whitelist:', error);
        res.status(500).json({ message: 'Failed to fetch whitelist' });
    }
});
// POST /api/admin/whitelist - Add RA to whitelist
router.post('/whitelist', async (req, res) => {
    const { ra } = req.body;
    const adminRa = req.user?.ra;
    if (!ra || typeof ra !== 'string') {
        return res.status(400).json({ message: 'RA is required and must be a string' });
    }
    // Validate RA format (basic validation - adjust as needed)
    if (ra.trim().length === 0) {
        return res.status(400).json({ message: 'RA cannot be empty' });
    }
    try {
        // Check if RA already exists in whitelist
        const existing = await prisma.rAWhitelist.findUnique({
            where: { ra: ra.trim() },
        });
        if (existing) {
            return res.status(409).json({ message: 'RA already exists in whitelist' });
        }
        const newEntry = await prisma.rAWhitelist.create({
            data: {
                ra: ra.trim(),
                created_by: adminRa || null,
            },
        });
        res.status(201).json({ message: 'RA added to whitelist successfully', data: newEntry });
    }
    catch (error) {
        console.error('Error adding RA to whitelist:', error);
        if (error.code === 'P2002') {
            // Unique constraint violation
            return res.status(409).json({ message: 'RA already exists in whitelist' });
        }
        res.status(500).json({ message: 'Failed to add RA to whitelist' });
    }
});
// DELETE /api/admin/whitelist/:ra - Remove RA from whitelist
router.delete('/whitelist/:ra', async (req, res) => {
    const { ra } = req.params;
    if (!ra) {
        return res.status(400).json({ message: 'RA parameter is required' });
    }
    try {
        // Check if RA exists in whitelist
        const existing = await prisma.rAWhitelist.findUnique({
            where: { ra },
        });
        if (!existing) {
            return res.status(404).json({ message: 'RA not found in whitelist' });
        }
        await prisma.rAWhitelist.delete({
            where: { ra },
        });
        res.status(200).json({ message: 'RA removed from whitelist successfully' });
    }
    catch (error) {
        console.error('Error removing RA from whitelist:', error);
        res.status(500).json({ message: 'Failed to remove RA from whitelist' });
    }
});
// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                ra: true,
                is_admin: true,
                TestHistory: {
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: { ra: 'asc' },
        });
        const usersWithStats = users.map((user) => ({
            ra: user.ra,
            is_admin: user.is_admin,
            test_count: user.TestHistory.length,
        }));
        res.status(200).json(usersWithStats);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});
// POST /api/admin/users/:ra/promote - Promote user to admin
router.post('/users/:ra/promote', async (req, res) => {
    const { ra } = req.params;
    const adminRa = req.user?.ra;
    if (!ra) {
        return res.status(400).json({ message: 'RA parameter is required' });
    }
    if (ra === adminRa) {
        return res.status(400).json({ message: 'You cannot promote yourself' });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { ra },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.is_admin) {
            return res.status(400).json({ message: 'User is already an admin' });
        }
        await prisma.user.update({
            where: { ra },
            data: { is_admin: true },
        });
        res.status(200).json({ message: 'User promoted to admin successfully' });
    }
    catch (error) {
        console.error('Error promoting user:', error);
        res.status(500).json({ message: 'Failed to promote user' });
    }
});
// POST /api/admin/users/:ra/demote - Remove admin privileges
router.post('/users/:ra/demote', async (req, res) => {
    const { ra } = req.params;
    const adminRa = req.user?.ra;
    if (!ra) {
        return res.status(400).json({ message: 'RA parameter is required' });
    }
    if (ra === adminRa) {
        return res.status(400).json({ message: 'You cannot demote yourself' });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { ra },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!user.is_admin) {
            return res.status(400).json({ message: 'User is not an admin' });
        }
        // Check if this is the last admin
        const adminCount = await prisma.user.count({
            where: { is_admin: true },
        });
        if (adminCount <= 1) {
            return res.status(400).json({ message: 'Cannot demote the last admin' });
        }
        await prisma.user.update({
            where: { ra },
            data: { is_admin: false },
        });
        res.status(200).json({ message: 'Admin privileges removed successfully' });
    }
    catch (error) {
        console.error('Error demoting user:', error);
        res.status(500).json({ message: 'Failed to demote user' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map
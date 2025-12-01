"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const adminAuth = async (req, res, next) => {
    const userRa = req.user?.ra;
    if (!userRa) {
        return res.status(401).json({ message: 'User not authenticated' });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { ra: userRa },
            select: { is_admin: true },
        });
        if (!user || !user.is_admin) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        return res.status(500).json({ message: 'Error verifying admin status' });
    }
};
exports.default = adminAuth;
//# sourceMappingURL=adminAuth.js.map
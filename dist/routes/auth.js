"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const saltRounds = 10;
/**
 * @route   POST /register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
    try {
        const { ra, password } = req.body;
        if (!ra || !password) {
            return res.status(400).json({ message: 'RA and password are required.' });
        }
        if (typeof ra !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'RA and password must be strings.' });
        }
        if (!config_1.RA_WHITELIST.includes(ra)) {
            return res.status(403).json({ message: 'RA not authorized for registration.' });
        }
        const existingUser = await prisma.user.findUnique({ where: { ra } });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this RA already exists.' });
        }
        const password_hash = await bcrypt_1.default.hash(password, saltRounds);
        const newUser = await prisma.user.create({
            data: {
                ra,
                password_hash,
            },
        });
        res.status(201).json({ message: 'User registered successfully.', user: { ra: newUser.ra } });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});
/**
 * @route   POST /login
 * @desc    Login a user and return a JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { ra, password } = req.body;
        if (!ra || !password) {
            return res.status(400).json({ message: 'RA and password are required.' });
        }
        const user = await prisma.user.findUnique({ where: { ra } });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const payload = {
            user: {
                ra: user.ra,
            },
        };
        const token = jsonwebtoken_1.default.sign(payload, config_1.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            message: 'Login successful.',
            token: token,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map
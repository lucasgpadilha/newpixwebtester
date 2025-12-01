import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { testDefinitionStore } from '../services/testDefinitionStore';

const router = Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { ra: string };
}

// GET /api/admin/whitelist - List all RAs in whitelist
router.get('/whitelist', async (req: AuthRequest, res: Response) => {
  try {
    const whitelist = await prisma.rAWhitelist.findMany({
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json(whitelist);
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ message: 'Failed to fetch whitelist' });
  }
});

// POST /api/admin/whitelist - Add RA to whitelist
router.post('/whitelist', async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    console.error('Error adding RA to whitelist:', error);
    if (error.code === 'P2002') {
      // Unique constraint violation
      return res.status(409).json({ message: 'RA already exists in whitelist' });
    }
    res.status(500).json({ message: 'Failed to add RA to whitelist' });
  }
});

// DELETE /api/admin/whitelist/:ra - Remove RA from whitelist
router.delete('/whitelist/:ra', async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    console.error('Error removing RA from whitelist:', error);
    res.status(500).json({ message: 'Failed to remove RA from whitelist' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:ra/promote - Promote user to admin
router.post('/users/:ra/promote', async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ message: 'Failed to promote user' });
  }
});

// POST /api/admin/users/:ra/demote - Remove admin privileges
router.post('/users/:ra/demote', async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).json({ message: 'Failed to demote user' });
  }
});

// --- Test Definitions Management ---

router.get('/tests', async (_req: AuthRequest, res: Response) => {
  try {
    const definitions = await testDefinitionStore.getDefinitionMetadata();
    res.status(200).json(definitions);
  } catch (error) {
    console.error('Error fetching test definitions:', error);
    res.status(500).json({ message: 'Failed to fetch test definitions' });
  }
});

router.put('/tests', async (req: AuthRequest, res: Response) => {
  const { key, label, weight, enabled, description } = req.body ?? {};

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ message: 'Key is required.' });
  }

  const updates: Record<string, unknown> = {};

  if (label !== undefined) {
    if (typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ message: 'Label must be a non-empty string.' });
    }
    updates.label = label.trim();
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      return res.status(400).json({ message: 'Description must be a string.' });
    }
    updates.description = description;
  }

  if (weight !== undefined) {
    const parsed = Number(weight);
    if (Number.isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ message: 'Weight must be a non-negative number.' });
    }
    updates.weight = parsed;
  }

  if (enabled !== undefined) {
    updates.enabled = Boolean(enabled);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'At least one field (label, weight, enabled, description) must be provided.' });
  }

  try {
    const updated = await testDefinitionStore.updateDefinition(key, updates);
    res.status(200).json(updated);
  } catch (error) {
    console.error(`Error updating test definition ${key}:`, error);
    res.status(500).json({ message: 'Failed to update test definition' });
  }
});

export default router;






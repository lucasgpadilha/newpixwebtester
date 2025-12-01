import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/test-steps - List all test steps with optional filtering
router.get('/api/admin/test-steps', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { test_type } = req.query;

        const where = test_type ? { test_type: test_type as string } : {};

        const testSteps = await prisma.testStep.findMany({
            where,
            orderBy: [
                { test_type: 'asc' },
                { step_order: 'asc' }
            ]
        });

        res.json(testSteps);
    } catch (error: any) {
        console.error('Error fetching test steps:', error);
        res.status(500).json({ error: 'Failed to fetch test steps' });
    }
});

// GET /api/admin/test-steps/:id - Get single test step by ID
router.get('/api/admin/test-steps/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const testStep = await prisma.testStep.findUnique({
            where: { id: parseInt(id, 10) }
        });

        if (!testStep) {
            return res.status(404).json({ error: 'Test step not found' });
        }

        res.json(testStep);
    } catch (error: any) {
        console.error('Error fetching test step:', error);
        res.status(500).json({ error: 'Failed to fetch test step' });
    }
});

// POST /api/admin/test-steps - Create new test step
router.post('/api/admin/test-steps', authMiddleware, async (req: Request, res: Response) => {
    try {
        const {
            test_type,
            step_key,
            step_name,
            operation,
            step_order,
            weight,
            is_auto_evaluated,
            requires_user_input,
            prompt_title,
            prompt_hint
        } = req.body;

        // Validation
        if (!test_type || !step_key || !step_name || !operation) {
            return res.status(400).json({
                error: 'Missing required fields: test_type, step_key, step_name, operation'
            });
        }

        if (!['CLIENT', 'SERVER'].includes(test_type)) {
            return res.status(400).json({
                error: 'test_type must be either CLIENT or SERVER'
            });
        }

        if (weight !== undefined && weight < 0) {
            return res.status(400).json({ error: 'weight must be non-negative' });
        }

        if (step_order !== undefined && step_order < 0) {
            return res.status(400).json({ error: 'step_order must be non-negative' });
        }

        // Check for duplicate step_key within the same test_type
        const existing = await prisma.testStep.findFirst({
            where: {
                test_type,
                step_key
            }
        });

        if (existing) {
            return res.status(409).json({
                error: `Test step with key '${step_key}' already exists for ${test_type} tests`
            });
        }

        // If step_order not provided, use the next available order
        let finalStepOrder = step_order;
        if (finalStepOrder === undefined) {
            const maxOrder = await prisma.testStep.findFirst({
                where: { test_type },
                orderBy: { step_order: 'desc' }
            });
            finalStepOrder = maxOrder ? maxOrder.step_order + 1 : 1;
        }

        const testStep = await prisma.testStep.create({
            data: {
                test_type,
                step_key,
                step_name,
                operation,
                step_order: finalStepOrder,
                weight: weight !== undefined ? weight : 0,
                is_auto_evaluated: is_auto_evaluated !== undefined ? is_auto_evaluated : true,
                requires_user_input: requires_user_input !== undefined ? requires_user_input : false,
                prompt_title: prompt_title || null,
                prompt_hint: prompt_hint || null
            }
        });

        res.status(201).json(testStep);
    } catch (error: any) {
        console.error('Error creating test step:', error);
        res.status(500).json({ error: 'Failed to create test step' });
    }
});

// PUT /api/admin/test-steps/:id - Update existing test step
router.put('/api/admin/test-steps/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            step_key,
            step_name,
            operation,
            step_order,
            weight,
            is_auto_evaluated,
            requires_user_input,
            prompt_title,
            prompt_hint
        } = req.body;

        // Check if test step exists
        const existing = await prisma.testStep.findUnique({
            where: { id: parseInt(id, 10) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Test step not found' });
        }

        // Validation
        if (weight !== undefined && weight < 0) {
            return res.status(400).json({ error: 'weight must be non-negative' });
        }

        if (step_order !== undefined && step_order < 0) {
            return res.status(400).json({ error: 'step_order must be non-negative' });
        }

        // If step_key is being changed, check for duplicates
        if (step_key && step_key !== existing.step_key) {
            const duplicate = await prisma.testStep.findFirst({
                where: {
                    test_type: existing.test_type,
                    step_key,
                    id: { not: parseInt(id, 10) }
                }
            });

            if (duplicate) {
                return res.status(409).json({
                    error: `Test step with key '${step_key}' already exists for ${existing.test_type} tests`
                });
            }
        }

        const updatedTestStep = await prisma.testStep.update({
            where: { id: parseInt(id, 10) },
            data: {
                step_key: step_key !== undefined ? step_key : existing.step_key,
                step_name: step_name !== undefined ? step_name : existing.step_name,
                operation: operation !== undefined ? operation : existing.operation,
                step_order: step_order !== undefined ? step_order : existing.step_order,
                weight: weight !== undefined ? weight : existing.weight,
                is_auto_evaluated: is_auto_evaluated !== undefined ? is_auto_evaluated : existing.is_auto_evaluated,
                requires_user_input: requires_user_input !== undefined ? requires_user_input : existing.requires_user_input,
                prompt_title: prompt_title !== undefined ? prompt_title : existing.prompt_title,
                prompt_hint: prompt_hint !== undefined ? prompt_hint : existing.prompt_hint
            }
        });

        res.json(updatedTestStep);
    } catch (error: any) {
        console.error('Error updating test step:', error);
        res.status(500).json({ error: 'Failed to update test step' });
    }
});

// DELETE /api/admin/test-steps/:id - Delete test step
router.delete('/api/admin/test-steps/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if test step exists
        const existing = await prisma.testStep.findUnique({
            where: { id: parseInt(id, 10) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Test step not found' });
        }

        // Safety check: Check if test step is referenced in test history
        // Note: This requires a relation in the schema, which we don't have yet
        // For now, we'll allow deletion

        await prisma.testStep.delete({
            where: { id: parseInt(id, 10) }
        });

        res.json({ message: 'Test step deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting test step:', error);
        res.status(500).json({ error: 'Failed to delete test step' });
    }
});

// PUT /api/admin/test-steps/reorder - Bulk update step_order
router.put('/api/admin/test-steps/reorder', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { test_type, reordered } = req.body;

        if (!test_type || !Array.isArray(reordered)) {
            return res.status(400).json({
                error: 'Missing required fields: test_type (string), reordered (array)'
            });
        }

        if (!['CLIENT', 'SERVER'].includes(test_type)) {
            return res.status(400).json({
                error: 'test_type must be either CLIENT or SERVER'
            });
        }

        // Validate reordered array
        for (const item of reordered) {
            if (!item.id || item.step_order === undefined) {
                return res.status(400).json({
                    error: 'Each reordered item must have id and step_order'
                });
            }
        }

        // Use transaction to update all orders atomically
        await prisma.$transaction(
            reordered.map((item: { id: number; step_order: number }) =>
                prisma.testStep.update({
                    where: { id: item.id },
                    data: { step_order: item.step_order }
                })
            )
        );

        // Fetch and return updated list
        const updatedSteps = await prisma.testStep.findMany({
            where: { test_type },
            orderBy: { step_order: 'asc' }
        });

        res.json(updatedSteps);
    } catch (error: any) {
        console.error('Error reordering test steps:', error);
        res.status(500).json({ error: 'Failed to reorder test steps' });
    }
});

export default router;

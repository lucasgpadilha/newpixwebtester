import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { tempDbService } from '../services/tempDbService';
import { startTcpMockServer } from '../services/tcpMockServer';
import { scoringService } from '../services/scoringService';

const router = Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { ra: string };
}

type ActiveClientServer = {
  server: import('net').Server;
  db: any;
};

const activeClientServers = new Map<string, ActiveClientServer>();
const activeServersByUser = new Map<string, string>(); // Maps userRa -> testId

router.post('/client/start', async (req: AuthRequest, res: Response) => {
  const userRa = req.user?.ra;
  if (!userRa) {
    // This should not be reached if authMiddleware is working correctly
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  // Check if user already has an active server
  if (activeServersByUser.has(userRa)) {
    const existingTestId = activeServersByUser.get(userRa)!;
    const existingServer = activeClientServers.get(existingTestId);
    if (existingServer) {
      const address = existingServer.server.address();
      let port;
      if (typeof address === 'object' && address !== null) {
        port = address.port;
      }
      return res.status(400).json({
        message: 'You already have an active mock server running. Please stop it first.',
        existingPort: port,
        existingTestId
      });
    } else {
      // Clean up stale reference
      activeServersByUser.delete(userRa);
    }
  }

  const testId = `test-${crypto.randomBytes(8).toString('hex')}`;
  let responded = false;
  const safeRespond = (status: number, body: object) => {
    if (!responded) {
      responded = true;
      res.status(status).json(body);
    }
  };

  let db: any;
  let tcpServer: any;
  try {
    db = await tempDbService.createTempDb(testId);
    tcpServer = startTcpMockServer(testId, db, userRa);

    tcpServer.listen(0, () => {
      const address = tcpServer.address();
      if (typeof address === 'string' || address === null) {
        // This case is unlikely for a TCP server starting on a dynamic port
        tcpServer.close();
        safeRespond(500, { message: 'Failed to determine server port.' });
        return;
      }

      const port = address.port;
      console.log(`[${testId}] Mock TCP server started for RA ${userRa} on port ${port}`);
      activeClientServers.set(testId, { server: tcpServer, db });
      activeServersByUser.set(userRa, testId);
      safeRespond(200, { port, testId });
    });

    tcpServer.on('error', (err: Error) => {
      console.error(`[${testId}] Failed to start TCP Server:`, err);
      safeRespond(500, { message: `Failed to start TCP server: ${err.message}` });
    });

  } catch (error) {
    console.error(`[${testId}] Error during client test setup:`, error);
    safeRespond(500, { message: 'Failed to set up client test environment.' });
    if (tcpServer) {
      try {
        tcpServer.close();
      } catch { }
    }
    if (db) {
      try {
        await tempDbService.destroyTempDb(db, testId);
      } catch { }
    }
  }
});

router.get('/client/active', async (req: AuthRequest, res: Response) => {
  const userRa = req.user?.ra;
  if (!userRa) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  const testId = activeServersByUser.get(userRa);
  if (!testId || !activeClientServers.has(testId)) {
    return res.status(200).json({ active: false });
  }

  const server = activeClientServers.get(testId)!;
  const address = server.server.address();
  let port = null;
  if (typeof address === 'object' && address !== null) {
    port = address.port;
  }

  return res.status(200).json({
    active: true,
    testId,
    port
  });
});

router.post('/client/stop', async (req: AuthRequest, res: Response) => {
  const userRa = req.user?.ra;
  if (!userRa) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }
  const { testId } = req.body || {};
  if (!testId || !activeClientServers.has(testId)) {
    return res.status(404).json({ message: 'No active client test found.' });
  }
  const entry = activeClientServers.get(testId)!;
  try {
    entry.server.close();
    await tempDbService.destroyTempDb(entry.db, testId);
  } catch (e: any) {
    console.error(`[${testId}] Error stopping client test:`, e);
    return res.status(500).json({ message: 'Failed to stop client test.' });
  } finally {
    activeClientServers.delete(testId);
    activeServersByUser.delete(userRa);
  }
  return res.status(200).json({ message: 'Client test stopped.' });
});

// Get test history for authenticated user
router.get('/history', async (req: AuthRequest, res: Response) => {
  const userRa = req.user?.ra;
  if (!userRa) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  try {
    const history = await prisma.testHistory.findMany({
      where: { user_ra: userRa },
      include: {
        TestStepResult: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({ message: 'Failed to fetch test history.' });
  }
});

// Submit self-assessments for client test (items c, d, e)
router.post('/self-assessment', async (req: AuthRequest, res: Response) => {
  const userRa = req.user?.ra;
  if (!userRa) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  const { test_history_id, assessments } = req.body;

  if (!test_history_id || !assessments) {
    return res.status(400).json({ message: 'test_history_id and assessments are required.' });
  }

  const testHistoryId = parseInt(test_history_id, 10);
  if (isNaN(testHistoryId)) {
    return res.status(400).json({ message: 'test_history_id must be a valid number.' });
  }

  try {
    // Get the test history
    const testHistory = await prisma.testHistory.findFirst({
      where: {
        id: testHistoryId,
        user_ra: userRa,
        test_type: 'CLIENT',
      },
      include: {
        TestStepResult: true,
      },
    });

    if (!testHistory) {
      return res.status(404).json({ message: 'Test history not found.' });
    }

    // Convert assessments object to Map
    const selfAssessments = new Map<string, boolean>();
    if (assessments['c) Extrato exibido corretamente'] !== undefined) {
      selfAssessments.set('c) Extrato exibido corretamente', assessments['c) Extrato exibido corretamente']);
    }
    if (assessments['d) Erro de cadastro exibido'] !== undefined) {
      selfAssessments.set('d) Erro de cadastro exibido', assessments['d) Erro de cadastro exibido']);
    }
    if (assessments['e) Erro de login exibido'] !== undefined) {
      selfAssessments.set('e) Erro de login exibido', assessments['e) Erro de login exibido']);
    }

    // Recalculate score with self-assessments
    const steps = testHistory.TestStepResult.map(step => ({
      step: step.step_name,
      status: step.status as 'OK' | 'FAIL',
      details: step.details || undefined,
    }));

    const scoreMaps = await scoringService.getScoreMaps('CLIENT');
    const finalScore = scoringService.calculateScore(steps, scoreMaps, selfAssessments);

    // Update test history with new score
    await prisma.testHistory.update({
      where: { id: testHistory.id },
      data: { final_score: finalScore },
    });

    res.status(200).json({
      message: 'Self-assessments submitted successfully.',
      final_score: finalScore,
    });
  } catch (error) {
    console.error('Error submitting self-assessments:', error);
    res.status(500).json({ message: 'Failed to submit self-assessments.' });
  }
});

export default router;

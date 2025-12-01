import { Router, Request, Response } from 'express';
import { runServerTest } from '../services/tcpTestRunner';
import Rules from '../rules';
import { testDefinitionStore } from '../services/testDefinitionStore';

const router = Router();

interface AuthRequest extends Request {
  user?: { ra: string };
}

router.post('/server', (req: AuthRequest, res) => {
  const { ip, port } = req.body;
  const userRa = req.user?.ra;

  if (!userRa) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  if (!ip || !port) {
    return res.status(400).json({ message: 'IP address and port are required.' });
  }

  // Validate port
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
    return res.status(400).json({ message: 'Invalid port number.' });
  }

  // Run the test asynchronously (fire and forget from the HTTP request's perspective)
  runServerTest(ip, portNum, userRa);

  // Immediately respond to the client
  res.status(202).json({ message: 'Test started. Check websockets for live results.' });
});

// List protocol coverage info for UI
router.get('/protocols', async (_req: Request, res: Response) => {
  try {
    const all = Object.values(Rules);
    const serverValidated = [Rules.USUARIO_LOGIN, Rules.USUARIO_LER, Rules.TRANSACAO_LER];
    const clientValidated = all;
    const definitions = await testDefinitionStore.getDefinitions('SERVER');

    res.json({
      rules: all,
      server_validated: serverValidated,
      client_validated: clientValidated,
      server_definitions: definitions,
    });
  } catch (error) {
    console.error('Error fetching protocol metadata:', error);
    res.status(500).json({ message: 'Failed to fetch protocol metadata' });
  }
});

export default router;

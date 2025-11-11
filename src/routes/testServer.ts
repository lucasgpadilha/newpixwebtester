import { Router, Request } from 'express';
import { runServerTest } from '../services/tcpTestRunner';

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

export default router;
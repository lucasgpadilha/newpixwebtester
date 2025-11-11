import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

const connections = new Map<string, WebSocket>();

const init = (server: Server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth' && data.token) {
          try {
            const payload = jwt.verify(data.token, JWT_SECRET) as { user: { ra: string } };
            const ra = payload.user.ra;
            
            if (ra) {
              connections.set(ra, ws);
              console.log(`WebSocket connection established and authenticated for RA: ${ra}`);
              ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful' }));

              ws.on('close', () => {
                console.log(`WebSocket connection closed for RA: ${ra}`);
                connections.delete(ra);
              });
            } else {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token or missing RA' }));
            }
          } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or token' }));
          }
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.send(JSON.stringify({ type: 'info', message: 'Please authenticate by sending { "type": "auth", "token": "your_jwt" }' }));
  });

  console.log('WebSocket service initialized');
};

const sendToUser = (ra: string, message: object) => {
  const ws = connections.get(ra);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  console.log(`Could not send message to RA ${ra}, no active WebSocket connection found.`);
  return false;
};

export const websocketService = {
  init,
  sendToUser,
};

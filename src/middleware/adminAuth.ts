import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { ra: string };
}

const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({ message: 'Error verifying admin status' });
  }
};

export default adminAuth;



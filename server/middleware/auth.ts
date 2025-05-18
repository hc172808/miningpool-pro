import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import * as bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    // Get security settings
    const settings = await storage.getSettings();
    
    // Check if IP is banned (too many failed attempts)
    const failedCount = await storage.getFailedLoginCount(ipAddress, settings.banDuration);
    if (settings.fail2banEnabled && failedCount >= settings.maxLoginAttempts) {
      await storage.recordLoginAttempt({
        username,
        ipAddress,
        successful: false,
        userId: null
      });
      
      return res.status(429).json({ message: 'Too many failed login attempts. Please try again later.' });
    }

    // Try to find the user
    const user = await storage.getUserByUsername(username);
    if (!user) {
      // Record failed attempt
      await storage.recordLoginAttempt({
        username,
        ipAddress,
        successful: false,
        userId: null
      });
      
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Record failed attempt
      await storage.recordLoginAttempt({
        username,
        ipAddress,
        successful: false,
        userId: user.id
      });
      
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Record successful login
    await storage.recordLoginAttempt({
      username,
      ipAddress,
      successful: true,
      userId: user.id
    });
    
    // Update last login
    await storage.updateUserLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}

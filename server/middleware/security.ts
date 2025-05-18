import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Clean up old login attempts periodically
export async function cleanupLoginAttempts() {
  try {
    // Keep records for 24 hours for audit purposes
    await storage.clearOldLoginAttempts(24 * 60);
  } catch (error) {
    console.error('Error cleaning up login attempts:', error);
  }
}

// Schedule cleanup every hour
setInterval(cleanupLoginAttempts, 60 * 60 * 1000);

// Middleware to block IPs with too many failed attempts
export async function fail2banMiddleware(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  
  try {
    // Get security settings
    const settings = await storage.getSettings();
    
    if (settings.fail2banEnabled) {
      // Check for failed login attempts
      const failedCount = await storage.getFailedLoginCount(ipAddress, settings.banDuration);
      
      if (failedCount >= settings.maxLoginAttempts) {
        return res.status(429).json({ 
          message: 'Too many failed login attempts. Please try again later.' 
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in fail2ban middleware:', error);
    next();
  }
}

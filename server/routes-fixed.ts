import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";
import { storage } from "./storage";
import { login, authenticate, requireAdmin } from "./middleware/auth";
import { fail2banMiddleware } from "./middleware/security";
import { insertUserSchema, insertWorkerSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketManager, createWebSocketManager, MessageType } from "./websocket";
import { config } from "./config";

// Set up multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
// Create the upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use original name but prevent file overrides
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname);
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check for allowed file types
    const allowedExtensions = ['.zip', '.tar.gz', '.sh', '.txt', '.apk'];
    const extname = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(extname)) {
      return cb(null, true);
    }
    
    return cb(new Error('Only zip, tar.gz, sh, txt, and apk files are allowed'));
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware
  app.use('/api/auth/login', fail2banMiddleware);
  
  // Auth routes
  app.post('/api/auth/login', login);
  
  // Set up HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket manager for real-time updates
  const webSocketManager = createWebSocketManager(httpServer);
  app.locals.webSocketManager = webSocketManager;
  
  // Create API router
  const apiRouter = Router();
  
  // Set up all routes under /api prefix
  app.use('/api', apiRouter);
  
  // Add node configuration routes
  try {
    const { setupNodeRoutes } = require('./routes/nodes');
    setupNodeRoutes(apiRouter);
    console.log("Node routes successfully set up");
  } catch (error) {
    console.error("Failed to setup node routes:", error);
  }
  
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const user = await storage.createUser(userData);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          walletAddress: user.walletAddress,
          role: user.role
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: fromZodError(error).message 
        });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // User routes (protected)
  app.get('/api/users/me', authenticate, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role
      });
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.patch('/api/users/me', authenticate, async (req: Request, res: Response) => {
    try {
      // Only allow updating certain fields
      const { email, walletAddress, password, profileImage } = req.body;
      const updateData: any = {};
      
      if (email) updateData.email = email;
      if (walletAddress) updateData.walletAddress = walletAddress;
      if (password) updateData.password = password;
      if (profileImage) updateData.profileImage = profileImage;
      
      const updatedUser = await storage.updateUser(req.user!.id, updateData);
      
      res.json({
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          walletAddress: updatedUser.walletAddress,
          profileImage: updatedUser.profileImage,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Worker routes
  app.get('/api/workers', authenticate, async (req: Request, res: Response) => {
    try {
      const workers = await storage.getWorkersByUserId(req.user!.id);
      res.json(workers);
    } catch (error) {
      console.error('Error fetching workers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/workers', authenticate, async (req: Request, res: Response) => {
    try {
      const workerData = insertWorkerSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      // Check if a worker with the same name already exists for this user
      const userWorkers = await storage.getWorkersByUserId(req.user!.id);
      const workerExists = userWorkers.some(w => w.name.toLowerCase() === workerData.name.toLowerCase());
      
      if (workerExists) {
        return res.status(400).json({ 
          message: 'Worker name already exists. Please choose a unique name for your worker.' 
        });
      }
      
      const worker = await storage.createWorker(workerData);
      
      // Generate mining script based on worker configuration
      try {
        // Get user data for wallet address
        const user = await storage.getUser(req.user!.id);
        if (user && user.walletAddress) {
          // Get mining settings
          const settings = await storage.getSettings();
          
          // Import the script generator
          const { generateMiningScript } = require('./utils/scriptGenerator');
          
          // Generate script for solo mining by default
          const scriptFilename = await generateMiningScript(
            worker, 
            settings, 
            'solo',
            user.walletAddress
          );
          
          // Include script download link in the response
          res.status(201).json({
            ...worker,
            scriptDownloadUrl: `/api/mining-scripts/${scriptFilename}`
          });
          return;
        }
      } catch (scriptError) {
        console.error('Error generating mining script:', scriptError);
        // Fall through to return the worker without a script
      }
      
      // If script generation fails, just return the worker
      res.status(201).json(worker);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: fromZodError(error).message 
        });
      }
      console.error('Error creating worker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.patch('/api/workers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const workerId = parseInt(req.params.id);
      
      // Verify that the worker belongs to the user
      const worker = await storage.getWorker(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }
      
      if (worker.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to update this worker' });
      }
      
      // Only allow updating certain fields
      const { name, status } = req.body;
      const updateData: any = {};
      
      // Check if the name is being updated and ensure it's unique for this user
      if (name && name !== worker.name) {
        const userWorkers = await storage.getWorkersByUserId(req.user!.id);
        const nameExists = userWorkers.some(w => 
          w.id !== workerId && w.name.toLowerCase() === name.toLowerCase()
        );
        
        if (nameExists) {
          return res.status(400).json({ 
            message: 'Worker name already exists. Please choose a unique name for your worker.' 
          });
        }
        
        updateData.name = name;
      }
      
      // Update status if provided
      if (status !== undefined) {
        updateData.status = status;
      }
      
      const updatedWorker = await storage.updateWorker(workerId, updateData);
      
      // If status changed, update WebSocket clients
      if (status !== undefined && status !== worker.status) {
        if (webSocketManager) {
          const workerUpdate = {
            ...updatedWorker,
            action: status === 'online' ? 'started' : 'stopped'
          };
          
          webSocketManager.sendToUser(
            req.user!.id,
            {
              type: MessageType.WORKER_CONNECTED,
              data: workerUpdate,
              timestamp: Date.now()
            }
          );
        }
      }
      
      res.json(updatedWorker);
    } catch (error) {
      console.error('Error updating worker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Delete worker endpoint
  app.delete('/api/workers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const workerId = parseInt(req.params.id);
      
      // Verify that the worker belongs to the user
      const worker = await storage.getWorker(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }
      
      if (worker.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to delete this worker' });
      }
      
      await storage.deleteWorker(workerId);
      
      // Notify connected clients
      if (webSocketManager) {
        webSocketManager.sendToUser(
          req.user!.id,
          {
            type: MessageType.WORKER_DISCONNECTED,
            data: { id: workerId },
            timestamp: Date.now()
          }
        );
      }
      
      res.json({ message: 'Worker deleted successfully' });
    } catch (error) {
      console.error('Error deleting worker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/mining/stats', authenticate, async (req: Request, res: Response) => {
    try {
      // Parse date range filters if provided
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }
      
      const miningStats = await storage.getMiningStats(req.user!.id, startDate, endDate);
      res.json(miningStats);
    } catch (error) {
      console.error('Error fetching mining stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/mining/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const { workerId, hashrate, shares, validShares, invalidShares, coin } = req.body;
      
      // Verify that the worker belongs to the user
      const worker = await storage.getWorker(parseInt(workerId));
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }
      
      if (worker.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to submit stats for this worker' });
      }
      
      const miningStat = await storage.createMiningStat({
        userId: req.user!.id,
        workerId: parseInt(workerId),
        timestamp: new Date(),
        hashrate: parseFloat(hashrate),
        shares: parseInt(shares) || 0,
        validShares: parseInt(validShares) || 0,
        invalidShares: parseInt(invalidShares) || 0,
        coin: coin || 'BTC' // Default to BTC if not specified
      });
      
      // Update worker status and hashrate
      await storage.updateWorker(parseInt(workerId), {
        status: 'online',
        hashrate: parseFloat(hashrate),
        lastSeen: new Date()
      });
      
      // Notify WebSocket clients about the hashrate update
      if (webSocketManager) {
        webSocketManager.sendToUser(
          req.user!.id,
          {
            type: MessageType.HASHRATE_UPDATE,
            data: {
              workerId: parseInt(workerId),
              hashrate: parseFloat(hashrate),
              timestamp: new Date()
            },
            timestamp: Date.now()
          }
        );
      }
      
      res.status(201).json(miningStat);
    } catch (error) {
      console.error('Error submitting mining stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/payouts', authenticate, async (req: Request, res: Response) => {
    try {
      const payouts = await storage.getPayouts(req.user!.id);
      res.json(payouts);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/settings', async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.patch('/api/settings', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const updatedSettings = await storage.updateSettings(req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
    
  app.get('/api/coins', async (_req: Request, res: Response) => {
    try {
      // Return supported coins with metadata
      const coins = [
        {
          id: 'bitcoin',
          name: 'Bitcoin',
          symbol: 'btc',
          logo: '/assets/btc-logo.svg',
          algorithm: 'SHA-256',
          minPayout: 0.001
        },
        {
          id: 'ethereum',
          name: 'Ethereum',
          symbol: 'eth',
          logo: '/assets/eth-logo.svg',
          algorithm: 'Ethash',
          minPayout: 0.01
        },
        {
          id: 'monero',
          name: 'Monero',
          symbol: 'xmr',
          logo: '/assets/xmr-logo.svg',
          algorithm: 'RandomX',
          minPayout: 0.1
        },
        {
          id: 'litecoin',
          name: 'Litecoin',
          symbol: 'ltc',
          logo: '/assets/ltc-logo.svg',
          algorithm: 'Scrypt',
          minPayout: 0.1
        },
        {
          id: 'ravencoin',
          name: 'Ravencoin',
          symbol: 'rvn',
          logo: '/assets/rvn-logo.svg',
          algorithm: 'KAWPOW',
          minPayout: 10
        },
        {
          id: 'zcash',
          name: 'Zcash',
          symbol: 'zec',
          logo: '/assets/zec-logo.svg',
          algorithm: 'Equihash',
          minPayout: 0.01
        },
        {
          id: 'bitcoincash',
          name: 'Bitcoin Cash',
          symbol: 'bch',
          logo: '/assets/bch-logo.svg',
          algorithm: 'SHA-256',
          minPayout: 0.01
        },
        {
          id: 'dogecoin',
          name: 'Dogecoin',
          symbol: 'doge',
          logo: '/assets/doge-logo.svg',
          algorithm: 'Scrypt',
          minPayout: 50
        },
        {
          id: 'dash',
          name: 'Dash',
          symbol: 'dash',
          logo: '/assets/dash-logo.svg',
          algorithm: 'X11',
          minPayout: 0.1
        }
      ];
      
      res.json(coins);
    } catch (error) {
      console.error('Error fetching coins:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
    
  app.post('/api/files/upload', authenticate, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileInfo = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedBy: req.user!.id,
        uploadedAt: new Date()
      };
      
      res.status(201).json(fileInfo);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/files/download/:filename', async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(uploadDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Send the file
      res.download(filePath);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/files', authenticate, async (req: Request, res: Response) => {
    try {
      // Get list of files in the uploads directory
      const files = fs.readdirSync(uploadDir).map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      });
      
      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
      
  return httpServer;
}
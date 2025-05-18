import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";
import { storage } from "./storage";
import { login, authenticate, requireAdmin } from "./middleware/auth";
import { fail2banMiddleware } from "./middleware/security";
import { insertUserSchema, insertWorkerSchema, insertSettingsSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { WebSocketManager, createWebSocketManager } from "./websocket";
import { config } from "./config";
import { payoutProcessor, PayoutProcessor } from "./payoutProcessor";
// Import Bitcoin mining pool components
import { BitcoinNode, createBitcoinNode } from "./bitcoin/node";
import { StratumServer, createStratumServer } from "./bitcoin/stratum-server";
import { ShareProcessor, createShareProcessor } from "./bitcoin/share-processor";
import { PayoutManager, createPayoutManager } from "./bitcoin/payout-manager";
import { logger } from "./utils/logger";
import { setupBitcoinRoutes } from "./routes/bitcoin";

// Add global type for WebSocket handler
declare global {
  var webSocketHandler: any;
}

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

// Import the node routes
export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware
  app.use('/api/auth/login', fail2banMiddleware);
  
  // Auth routes
  app.post('/api/auth/login', login);
  
  // Set up HTTP server
  const httpServer = createServer(app);
  
  // Create the WebSocket manager
  const webSocketManager = createWebSocketManager(httpServer);
  app.locals.webSocketManager = webSocketManager;
  
  // Create API router
  const apiRouter = Router();
  
  // Set up all routes under /api prefix
  app.use('/api', apiRouter);
  
  // Add node configuration routes for cryptocurrency management
  try {
    // Use dynamic import instead of require
    import('./node-api').then(module => {
      app.use('/api', module.default);
      console.log("Cryptocurrency node routes successfully set up");
    }).catch(error => {
      console.error("Failed to setup node routes:", error);
    });
  } catch (error) {
    console.error("Failed to setup node routes:", error);
  }
  
  // Initialize Bitcoin mining pool components
  let bitcoinNode: BitcoinNode | null = null;
  let stratumServer: StratumServer | null = null;
  let shareProcessor: ShareProcessor | null = null;
  let payoutManager: PayoutManager | null = null;
  
  try {
    // Initialize Bitcoin mining components if environment is configured for it
    if (process.env.BITCOIN_RPC_HOST && 
        process.env.BITCOIN_RPC_PORT && 
        process.env.BITCOIN_RPC_USERNAME && 
        process.env.BITCOIN_RPC_PASSWORD) {
      
      logger.info('Initializing Bitcoin mining pool components...');
      
      // Create Bitcoin node connection with configurable UTXO cache
      bitcoinNode = createBitcoinNode({
        host: process.env.BITCOIN_RPC_HOST,
        port: parseInt(process.env.BITCOIN_RPC_PORT, 10),
        username: process.env.BITCOIN_RPC_USERNAME,
        password: process.env.BITCOIN_RPC_PASSWORD,
        // Use configurable UTXO cache size (from 10MB to full node capacity)
        dbCache: config.bitcoin.dbCache,
        pruneMode: config.bitcoin.pruneMode,
        maxConnections: config.bitcoin.maxConnections
      });
      
      // Test connection to Bitcoin node
      const nodeConnected = await bitcoinNode.initialize().catch(() => false);
      
      if (nodeConnected) {
        // Initialize share processor
        shareProcessor = createShareProcessor();
        
        // Initialize payout manager
        payoutManager = createPayoutManager(bitcoinNode, {
          minPayout: 0.001, // 0.001 BTC minimum payout
          poolWallet: config.poolWalletAddress || 'sample_pool_wallet_address',
          autoPayoutsEnabled: true,
          payoutInterval: 60 * 60 * 1000 // 1 hour
        });
        
        // Initialize Stratum server for miner connections
        stratumServer = createStratumServer(bitcoinNode, config.stratumPort || 3333);
        
        // Set up Bitcoin routes with access to the node
        setupBitcoinRoutes(apiRouter, bitcoinNode);
        
        // Set up event listeners to connect the components
        stratumServer.on('share:submitted', (shareData) => {
          shareProcessor?.processShare(shareData);
        });
        
        stratumServer.on('block:found', (blockData) => {
          // Broadcast block found event to all clients
          webSocketManager?.broadcast({
            type: 'block:found',
            data: blockData,
            timestamp: Date.now()
          });
        });
        
        shareProcessor.on('hashrate:updated', (hashrateData) => {
          // Send hashrate updates to specific user's connections
          webSocketManager?.sendToUser(parseInt(hashrateData.workerId), {
            type: 'hashrate:update',
            data: hashrateData,
            timestamp: Date.now()
          });
        });
        
        payoutManager.on('payout:completed', (payoutData) => {
          // Send payout notifications to the user
          webSocketManager?.sendToUser(parseInt(payoutData.userId), {
            type: 'payout:completed',
            data: payoutData,
            timestamp: Date.now()
          });
        });
        
        // Start automatic payouts if enabled
        if (config.autoPayoutsEnabled) {
          payoutManager.startAutomaticPayouts();
        }
        
        // Set pool statistics update interval
        setInterval(async () => {
          if (webSocketManager && shareProcessor && stratumServer) {
            const poolHashrate = await shareProcessor.calculatePoolHashrate();
            const connectedMiners = stratumServer.getConnectedMinersCount();
            const blocks = await shareProcessor.getFoundBlocks();
            
            webSocketManager.updatePoolStats({
              connectedMiners,
              poolHashrate,
              blocksFound: blocks.length,
              activeWorkers: connectedMiners // This could be refined further
            });
          }
        }, 30000); // Update every 30 seconds
        
        logger.info('Bitcoin mining pool components initialized successfully');
      } else {
        logger.warn('Could not connect to Bitcoin node - mining pool functionality will be limited');
      }
    } else {
      logger.info('Bitcoin node connection not configured - running in demonstration mode');
    }
  } catch (error) {
    logger.error('Error initializing mining pool components:', error);
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
        if (global.webSocketHandler) {
          const workerUpdate = {
            ...updatedWorker,
            action: status === 'online' ? 'started' : 'stopped'
          };
          
          global.webSocketHandler.broadcastToUser(
            req.user!.id,
            { type: 'worker_update', data: workerUpdate }
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
      
      // Delete the worker
      await storage.deleteWorker(workerId);
      
      // Notify via WebSocket if available
      if (global.webSocketHandler) {
        global.webSocketHandler.broadcastToUser(
          req.user!.id,
          { type: 'worker_deleted', data: { workerId } }
        );
      }
      
      res.status(200).json({ message: 'Worker deleted successfully' });
    } catch (error) {
      console.error('Error deleting worker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Mining stats routes
  app.get('/api/mining/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const stats = await storage.getMiningStats(req.user!.id, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching mining stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/mining/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const { hashrate, miningType } = req.body;
      
      const newStat = await storage.createMiningStat({
        userId: req.user!.id,
        hashrate,
        miningType
      });
      
      res.status(201).json(newStat);
    } catch (error) {
      console.error('Error recording mining stat:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Payout routes
  app.get('/api/payouts', authenticate, async (req: Request, res: Response) => {
    try {
      const payouts = await storage.getPayouts(req.user!.id);
      res.json(payouts);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Settings routes (admin only)
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
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      const updatedSettings = await storage.updateSettings(settingsData);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: fromZodError(error).message 
        });
      }
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Admin routes
  // Payout system routes
  app.get('/api/payouts/status', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const status = payoutProcessor.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error fetching payout status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // CoinMarketCap API endpoint
  app.get('/api/coins', async (_req: Request, res: Response) => {
    try {
      // In a real implementation, this would make an authenticated request to the CoinMarketCap API
      // For demo purposes, we'll return static data for the main cryptocurrencies
      const coins = [
        {
          id: 'bitcoin',
          name: 'Bitcoin',
          symbol: 'btc',
          price: 55432.28,
          price_change_24h: 1245.67,
          price_change_percentage_24h: 2.3,
          market_cap: 1035768245789,
          volume_24h: 32145678901,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png'
        },
        {
          id: 'ethereum',
          name: 'Ethereum',
          symbol: 'eth',
          price: 2976.31,
          price_change_24h: -87.45,
          price_change_percentage_24h: -2.85,
          market_cap: 356789123456,
          volume_24h: 18976543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png'
        },
        {
          id: 'binancecoin',
          name: 'Binance Coin',
          symbol: 'bnb',
          price: 478.92,
          price_change_24h: 12.56,
          price_change_percentage_24h: 2.69,
          market_cap: 73256789123,
          volume_24h: 2143567890,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png'
        },
        {
          id: 'cardano',
          name: 'Cardano',
          symbol: 'ada',
          price: 1.23,
          price_change_24h: 0.05,
          price_change_percentage_24h: 4.24,
          market_cap: 42356789123,
          volume_24h: 1876543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png'
        },
        {
          id: 'solana',
          name: 'Solana',
          symbol: 'sol',
          price: 130.45,
          price_change_24h: 8.34,
          price_change_percentage_24h: 6.83,
          market_cap: 52356789123,
          volume_24h: 3876543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png'
        },
        {
          id: 'xrp',
          name: 'XRP',
          symbol: 'xrp',
          price: 0.75,
          price_change_24h: 0.02,
          price_change_percentage_24h: 2.74,
          market_cap: 32356789123,
          volume_24h: 1576543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png'
        },
        {
          id: 'polkadot',
          name: 'Polkadot',
          symbol: 'dot',
          price: 19.87,
          price_change_24h: -0.45,
          price_change_percentage_24h: -2.21,
          market_cap: 22356789123,
          volume_24h: 876543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png'
        },
        {
          id: 'dogecoin',
          name: 'Dogecoin',
          symbol: 'doge',
          price: 0.12,
          price_change_24h: 0.003,
          price_change_percentage_24h: 2.57,
          market_cap: 15356789123,
          volume_24h: 576543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png'
        },
        {
          id: 'litecoin',
          name: 'Litecoin',
          symbol: 'ltc',
          price: 134.56,
          price_change_24h: 3.45,
          price_change_percentage_24h: 2.63,
          market_cap: 8956789123,
          volume_24h: 376543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2.png'
        },
        {
          id: 'monero',
          name: 'Monero',
          symbol: 'xmr',
          price: 178.34,
          price_change_24h: -2.35,
          price_change_percentage_24h: -1.30,
          market_cap: 3256789123,
          volume_24h: 176543210,
          image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/328.png'
        }
      ];
      
      res.json(coins);
    } catch (error) {
      console.error('Error fetching coin data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get all users' unpaid balances (admin only)
  app.get('/api/admin/user-balances', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      // Calculate balances for all users
      const balances: Record<number, any> = {};
      
      await Promise.all(users.map(async (user) => {
        try {
          // Calculate unpaid balance
          const unpaidBalance = await payoutProcessor.calculateUnpaidBalance(user.id);
          
          // Get user's primary coin
          const primaryCoin = await payoutProcessor.getUserPrimaryCoin(user.id);
          
          // Get last payout date
          const payouts = await storage.getPayouts(user.id);
          const lastPayout = payouts.length > 0 ? payouts[0].timestamp : null;
          
          balances[user.id] = {
            unpaidBalance,
            primaryCoin,
            lastPayout
          };
        } catch (error) {
          console.error(`Error calculating balance for user ${user.id}:`, error);
          balances[user.id] = {
            unpaidBalance: 0,
            primaryCoin: 'BTC',
            lastPayout: null
          };
        }
      }));
      
      res.json(balances);
    } catch (error) {
      console.error('Error fetching user balances:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/payouts/start', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      payoutProcessor.startAutomatedPayouts(60); // Process payouts every 60 minutes
      res.json({ 
        message: 'Automated payouts started successfully',
        status: payoutProcessor.getStatus()
      });
    } catch (error) {
      console.error('Error starting payouts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/payouts/stop', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      payoutProcessor.stopAutomatedPayouts();
      res.json({ 
        message: 'Automated payouts stopped successfully',
        status: payoutProcessor.getStatus()
      });
    } catch (error) {
      console.error('Error stopping payouts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/payouts/manual', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      const result = await payoutProcessor.manualPayout(userId);
      
      if (result) {
        res.json({ message: 'Manual payout initiated successfully' });
      } else {
        res.status(400).json({ message: 'Failed to process manual payout. User may not have sufficient balance.' });
      }
    } catch (error) {
      console.error('Error processing manual payout:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/admin/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Get all users from storage
      const users = await storage.getAllUsers();
      
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      })));
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.patch('/api/admin/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Get user to update
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Only allow updating certain fields
      const { email, walletAddress, role } = req.body;
      const updateData: any = {};
      
      if (email) updateData.email = email;
      if (walletAddress) updateData.walletAddress = walletAddress;
      if (role) updateData.role = role;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      res.json({
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          walletAddress: updatedUser.walletAddress,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error('Error updating user as admin:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Password change route
  app.post('/api/users/change-password', authenticate, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }
      
      // Get the user
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Compare current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update user password
      await storage.updateUser(req.user!.id, { password: hashedPassword });
      
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // File upload routes for mining scripts and mobile apps
  app.post('/api/files/upload', authenticate, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Save file metadata to track uploads
      const fileInfo = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedBy: req.user!.id,
        uploadDate: new Date(),
        fileType: req.body.fileType || 'other', // 'miningScript', 'mobileApp', 'other'
        description: req.body.description || '',
        osType: req.body.osType || '', // 'linux', 'windows', 'android', 'ios'
      };
      
      // In a real app, save fileInfo to the database
      
      res.status(201).json({ 
        message: 'File uploaded successfully',
        file: {
          name: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          url: `/api/files/download/${req.file.filename}`
        }
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // File download route
  app.get('/api/files/download/:filename', async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      
      // Allow mobile app download without authentication
      if (filename === 'MiningPoolPro.apk') {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, filename);
        
        // Create a placeholder APK file if it doesn't exist (for demo purposes)
        if (!fs.existsSync(filePath)) {
          // We're creating a simple file with some content to simulate an APK
          const buffer = Buffer.alloc(1024 * 1024); // 1MB file
          fs.writeFileSync(filePath, buffer);
        }
        
        return res.download(filePath);
      }
      
      // Require authentication for other files
      if (!req.isAuthenticated?.()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const filePath = path.join(uploadDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Get file info from database (in a real app)
      // For demo, just send the file
      res.download(filePath);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // List available files
  app.get('/api/files', authenticate, async (req: Request, res: Response) => {
    try {
      // In a real app, we would query the database for file metadata
      // For demo, we'll read the directory
      const files = fs.readdirSync(uploadDir).map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        return {
          name: filename,
          size: stats.size,
          createdAt: stats.birthtimeMs,
          downloadUrl: `/api/files/download/${filename}`
        };
      });
      
      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Add user route (admin only)
  app.post('/api/admin/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
        message: 'User created successfully',
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
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Serve mining scripts by OS type
  app.get('/api/mining-scripts/os/:osType', authenticate, async (req: Request, res: Response) => {
    try {
      const osType = req.params.osType.toLowerCase();
      let contentType = 'text/plain';
      let defaultScriptPath = '';
      let scriptContent = '';
      
      // Determine OS type and set appropriate content type
      if (osType === 'linux') {
        contentType = 'application/x-sh';
        defaultScriptPath = path.join(process.cwd(), 'mining-scripts', 'linux-miner.sh');
        
        // Generate the Linux script if it doesn't exist
        if (!fs.existsSync(defaultScriptPath)) {
          // Create mining scripts directory if it doesn't exist
          if (!fs.existsSync(path.dirname(defaultScriptPath))) {
            fs.mkdirSync(path.dirname(defaultScriptPath), { recursive: true });
          }
          
          // Generate Linux mining script content
          scriptContent = `#!/bin/bash
# Mining Pool Linux Mining Script
# Auto-generated for users to mine any cryptocurrency
# Version: 1.0.1

echo "Starting Mining Pool Client for Linux..."
echo "Mining Pool v1.0.0"

# Configuration
WALLET_ADDRESS="${process.env.DEFAULT_WALLET_ADDRESS || "YOUR_WALLET_ADDRESS"}"
WORKER_NAME="$(hostname)"
MINING_TYPE="solo"
SELECTED_COIN="BTC"

# Mining pool URLs
BTC_POOL_URL="stratum+tcp://btc.pool.com:3333"
ETH_POOL_URL="stratum+tcp://eth.pool.com:3333"
XMR_POOL_URL="stratum+tcp://xmr.pool.com:3333"
LTC_POOL_URL="stratum+tcp://ltc.pool.com:3333"
RVN_POOL_URL="stratum+tcp://rvn.pool.com:3333"
ZEC_POOL_URL="stratum+tcp://zec.pool.com:3333"
BCH_POOL_URL="stratum+tcp://bch.pool.com:3333"
DOGE_POOL_URL="stratum+tcp://doge.pool.com:3333"
DASH_POOL_URL="stratum+tcp://dash.pool.com:3333"

function check_dependencies() {
  echo "Checking dependencies..."
  command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed. Installing..."; apt-get update && apt-get install -y curl; }
  command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed. Installing..."; apt-get update && apt-get install -y jq; }
}

function select_coin() {
  echo "Available coins to mine:"
  echo "1) Bitcoin (BTC)"
  echo "2) Ethereum (ETH)"
  echo "3) Monero (XMR)"
  echo "4) Litecoin (LTC)"
  echo "5) Ravencoin (RVN)"
  echo "6) Zcash (ZEC)"
  echo "7) Bitcoin Cash (BCH)"
  echo "8) Dogecoin (DOGE)"
  echo "9) Dash (DASH)"
  
  read -p "Select coin to mine (1-9): " coin_choice
  
  case $coin_choice in
    1) SELECTED_COIN="BTC" ;;
    2) SELECTED_COIN="ETH" ;;
    3) SELECTED_COIN="XMR" ;;
    4) SELECTED_COIN="LTC" ;;
    5) SELECTED_COIN="RVN" ;;
    6) SELECTED_COIN="ZEC" ;;
    7) SELECTED_COIN="BCH" ;;
    8) SELECTED_COIN="DOGE" ;;
    9) SELECTED_COIN="DASH" ;;
    *) echo "Invalid selection. Defaulting to Bitcoin."; SELECTED_COIN="BTC" ;;
  esac
  
  echo "Selected coin: $SELECTED_COIN"
}

function select_mining_type() {
  echo "Mining types:"
  echo "1) Solo Mining"
  echo "2) Group Mining"
  
  read -p "Select mining type (1-2): " type_choice
  
  case $type_choice in
    1) MINING_TYPE="solo" ;;
    2) MINING_TYPE="group" ;;
    *) echo "Invalid selection. Defaulting to solo mining."; MINING_TYPE="solo" ;;
  esac
  
  echo "Selected mining type: $MINING_TYPE"
}

function configure_miner() {
  read -p "Enter your wallet address (default: $WALLET_ADDRESS): " input_wallet
  if [ ! -z "$input_wallet" ]; then
    WALLET_ADDRESS=$input_wallet
  fi
  
  read -p "Enter worker name (default: $WORKER_NAME): " input_worker
  if [ ! -z "$input_worker" ]; then
    WORKER_NAME=$input_worker
  fi
  
  select_coin
  select_mining_type
  
  echo "Configuration complete!"
  echo "Wallet: $WALLET_ADDRESS"
  echo "Worker: $WORKER_NAME"
  echo "Coin: $SELECTED_COIN"
  echo "Mining Type: $MINING_TYPE"
}

function detect_gpu() {
  echo "Detecting GPU hardware..."
  if command -v lspci >/dev/null 2>&1; then
    GPU_INFO=$(lspci | grep -i 'vga\|3d\|2d')
    if [ -z "$GPU_INFO" ]; then
      echo "No GPUs detected. CPU mining will be used."
    else
      echo "Found GPUs:"
      echo "$GPU_INFO"
    fi
  else
    echo "Cannot detect GPUs - lspci not installed."
    echo "CPU mining will be used as fallback."
  fi
}

function start_mining() {
  echo "Starting mining process for $SELECTED_COIN..."
  
  case $SELECTED_COIN in
    "BTC") POOL_URL=$BTC_POOL_URL ;;
    "ETH") POOL_URL=$ETH_POOL_URL ;;
    "XMR") POOL_URL=$XMR_POOL_URL ;;
    "LTC") POOL_URL=$LTC_POOL_URL ;;
    "RVN") POOL_URL=$RVN_POOL_URL ;;
    "ZEC") POOL_URL=$ZEC_POOL_URL ;;
    "BCH") POOL_URL=$BCH_POOL_URL ;;
    "DOGE") POOL_URL=$DOGE_POOL_URL ;;
    "DASH") POOL_URL=$DASH_POOL_URL ;;
  esac
  
  echo "Connecting to pool: $POOL_URL"
  echo "Mining with $WORKER_NAME for $WALLET_ADDRESS"
  
  # Simulate mining process
  echo "Mining started. Press Ctrl+C to stop."
  echo "In a real implementation, this would start the appropriate mining software."
}

# Main program
check_dependencies
detect_gpu
configure_miner
start_mining
`;
          
          // Write script to file with executable permissions
          fs.writeFileSync(defaultScriptPath, scriptContent, { mode: 0o755 });
        } else {
          // Read existing script
          scriptContent = fs.readFileSync(defaultScriptPath, 'utf8');
        }
      } else if (osType === 'windows') {
        contentType = 'application/bat';
        defaultScriptPath = path.join(process.cwd(), 'mining-scripts', 'windows-miner.bat');
        
        // Generate the Windows script if it doesn't exist
        if (!fs.existsSync(defaultScriptPath)) {
          // Create mining scripts directory if it doesn't exist
          if (!fs.existsSync(path.dirname(defaultScriptPath))) {
            fs.mkdirSync(path.dirname(defaultScriptPath), { recursive: true });
          }
          
          // Generate Windows mining script content
          scriptContent = `@echo off
REM Mining Pool Windows Mining Script
REM Auto-generated for users to mine any cryptocurrency
REM Version: 1.0.1

echo Starting Mining Pool Client for Windows...
echo Mining Pool v1.0.0

REM Configuration
set WALLET_ADDRESS=${process.env.DEFAULT_WALLET_ADDRESS || "YOUR_WALLET_ADDRESS"}
set WORKER_NAME=%COMPUTERNAME%
set MINING_TYPE=solo
set SELECTED_COIN=BTC

REM Mining pool URLs
set BTC_POOL_URL=stratum+tcp://btc.pool.com:3333
set ETH_POOL_URL=stratum+tcp://eth.pool.com:3333
set XMR_POOL_URL=stratum+tcp://xmr.pool.com:3333
set LTC_POOL_URL=stratum+tcp://ltc.pool.com:3333
set RVN_POOL_URL=stratum+tcp://rvn.pool.com:3333
set ZEC_POOL_URL=stratum+tcp://zec.pool.com:3333
set BCH_POOL_URL=stratum+tcp://bch.pool.com:3333
set DOGE_POOL_URL=stratum+tcp://doge.pool.com:3333
set DASH_POOL_URL=stratum+tcp://dash.pool.com:3333

echo Mining with %WORKER_NAME% for %WALLET_ADDRESS%
echo This is a simulation. In a real script, mining software would be launched here.

pause
`;
          
          // Write script to file
          fs.writeFileSync(defaultScriptPath, scriptContent);
        } else {
          // Read existing script
          scriptContent = fs.readFileSync(defaultScriptPath, 'utf8');
        }
      } else if (osType === 'mac') {
        contentType = 'application/x-sh';
        defaultScriptPath = path.join(process.cwd(), 'mining-scripts', 'mac-miner.sh');
        
        // Generate the Mac script if it doesn't exist
        if (!fs.existsSync(defaultScriptPath)) {
          // Create mining scripts directory if it doesn't exist
          if (!fs.existsSync(path.dirname(defaultScriptPath))) {
            fs.mkdirSync(path.dirname(defaultScriptPath), { recursive: true });
          }
          
          // Generate Mac mining script content
          scriptContent = `#!/bin/bash
# Mining Pool macOS Mining Script
# Auto-generated for users to mine any cryptocurrency
# Version: 1.0.1

echo "Starting Mining Pool Client for macOS..."
echo "Mining Pool v1.0.0"

# Configuration
WALLET_ADDRESS="${process.env.DEFAULT_WALLET_ADDRESS || "YOUR_WALLET_ADDRESS"}"
WORKER_NAME="$(hostname)"
MINING_TYPE="solo"
SELECTED_COIN="BTC"

# Mining pool URLs
BTC_POOL_URL="stratum+tcp://btc.pool.com:3333"
ETH_POOL_URL="stratum+tcp://eth.pool.com:3333"
XMR_POOL_URL="stratum+tcp://xmr.pool.com:3333"
LTC_POOL_URL="stratum+tcp://ltc.pool.com:3333"
RVN_POOL_URL="stratum+tcp://rvn.pool.com:3333"
ZEC_POOL_URL="stratum+tcp://zec.pool.com:3333"
BCH_POOL_URL="stratum+tcp://bch.pool.com:3333"
DOGE_POOL_URL="stratum+tcp://doge.pool.com:3333"
DASH_POOL_URL="stratum+tcp://dash.pool.com:3333"

echo "Mining with $WORKER_NAME for $WALLET_ADDRESS"
echo "This is a simulation. In a real script, mining software would be launched here."
`;
          
          // Write script to file with executable permissions
          fs.writeFileSync(defaultScriptPath, scriptContent, { mode: 0o755 });
        } else {
          // Read existing script
          scriptContent = fs.readFileSync(defaultScriptPath, 'utf8');
        }
      } else {
        return res.status(400).json({ message: 'Unsupported OS type. We currently support linux, windows, and mac.' });
      }
      
      if (!scriptContent) {
        return res.status(404).json({ message: 'Mining script not found and could not be generated' });
      }
      
      // Set proper headers for script download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(defaultScriptPath)}`);
      res.setHeader('Content-Length', Buffer.byteLength(scriptContent));
      
      // Send the file content
      res.send(scriptContent);
    } catch (error) {
      console.error('Error serving mining script:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Download a generated mining script by filename
  app.get('/api/mining-scripts/:filename', authenticate, async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      
      // Prevent path traversal attacks
      const sanitizedFilename = path.basename(filename);
      const scriptPath = path.join(process.cwd(), 'mining-scripts', sanitizedFilename);
      
      // Determine content type based on file extension
      let contentType = 'text/plain';
      if (sanitizedFilename.endsWith('.sh')) {
        contentType = 'application/x-sh';
      } else if (sanitizedFilename.endsWith('.bat')) {
        contentType = 'application/bat';
      }
      
      // Check if the file exists, if not generate a custom one based on the filename
      if (!fs.existsSync(scriptPath)) {
        // Create mining scripts directory if it doesn't exist
        if (!fs.existsSync(path.dirname(scriptPath))) {
          fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
        }
        
        // Parse the filename to determine coin and mining type if possible
        // Expected format: <coin>_<type>_<worker>_<timestamp>.sh
        const parts = sanitizedFilename.split('_');
        let coin = 'BTC';
        let miningType = 'solo';
        let workerName = 'worker1';
        
        if (parts.length >= 1) coin = parts[0].toUpperCase();
        if (parts.length >= 2) miningType = parts[1];
        if (parts.length >= 3) workerName = parts[2];
        
        // Generate custom script
        const scriptContent = `#!/bin/bash
# Custom Mining Script for ${coin}
# Mining Type: ${miningType}
# Worker Name: ${workerName}
# Generated: ${new Date().toISOString()}

echo "Starting ${miningType} mining for ${coin}..."
echo "Worker: ${workerName}"
echo "Mining Pool v1.0.0"

# This would connect to the appropriate pool in a real implementation
echo "Connecting to ${coin} mining pool..."
echo "Simulating mining activity..."

# In a real script, this would launch the appropriate mining software
echo "Mining started. Press Ctrl+C to stop."
`;
        
        // Write script to file with executable permissions
        fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
      }
      
      // Read the script content
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Set proper headers for script download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${sanitizedFilename}`);
      res.setHeader('Content-Length', Buffer.byteLength(scriptContent));
      
      // Send the file content
      res.send(scriptContent);
    } catch (error) {
      console.error('Error downloading mining script:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Create mining scripts directory if it doesn't exist
  const miningScriptsDir = path.join(process.cwd(), 'mining-scripts');
  if (!fs.existsSync(miningScriptsDir)) {
    fs.mkdirSync(miningScriptsDir, { recursive: true });
    
    // Create default Linux mining script
    const linuxScriptPath = path.join(miningScriptsDir, 'linux-miner.sh');
    const linuxScript = `#!/bin/bash
# Mining Pool Linux Mining Script
# Auto-generated for users to mine any cryptocurrency

echo "Starting Mining Pool Client for Linux..."
echo "Mining Pool v1.0.0"

# Configuration
WALLET_ADDRESS="${process.env.DEFAULT_WALLET_ADDRESS || "YOUR_WALLET_ADDRESS"}"
WORKER_NAME="$(hostname)"
MINING_TYPE="solo"
SELECTED_COIN="BTC"

# Mining pool URLs
BTC_POOL_URL="stratum+tcp://btc.solo.pool.com:3333"
ETH_POOL_URL="stratum+tcp://eth.solo.pool.com:3333"
XMR_POOL_URL="stratum+tcp://xmr.solo.pool.com:3333"
LTC_POOL_URL="stratum+tcp://ltc.solo.pool.com:3333"
RVN_POOL_URL="stratum+tcp://rvn.solo.pool.com:3333"
ZEC_POOL_URL="stratum+tcp://zec.solo.pool.com:3333"
BCH_POOL_URL="stratum+tcp://bch.solo.pool.com:3333"
DOGE_POOL_URL="stratum+tcp://doge.solo.pool.com:3333"
DASH_POOL_URL="stratum+tcp://dash.solo.pool.com:3333"

function check_dependencies() {
  command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed. Installing..."; apt-get update && apt-get install -y curl; }
  command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed. Installing..."; apt-get update && apt-get install -y jq; }
}

function select_coin() {
  echo "Available coins to mine:"
  echo "1) Bitcoin (BTC)"
  echo "2) Ethereum (ETH)"
  echo "3) Monero (XMR)"
  echo "4) Litecoin (LTC)"
  echo "5) Ravencoin (RVN)"
  echo "6) Zcash (ZEC)"
  echo "7) Bitcoin Cash (BCH)"
  echo "8) Dogecoin (DOGE)"
  echo "9) Dash (DASH)"
  
  read -p "Select a coin to mine (1-9): " coin_choice
  
  case $coin_choice in
    1) SELECTED_COIN="BTC" ;;
    2) SELECTED_COIN="ETH" ;;
    3) SELECTED_COIN="XMR" ;;
    4) SELECTED_COIN="LTC" ;;
    5) SELECTED_COIN="RVN" ;;
    6) SELECTED_COIN="ZEC" ;;
    7) SELECTED_COIN="BCH" ;;
    8) SELECTED_COIN="DOGE" ;;
    9) SELECTED_COIN="DASH" ;;
    *) echo "Invalid selection. Defaulting to BTC."; SELECTED_COIN="BTC" ;;
  esac
  
  echo "Selected coin: $SELECTED_COIN"
}

function select_mining_type() {
  echo "Mining types:"
  echo "1) Solo Mining"
  echo "2) Group Mining"
  
  read -p "Select mining type (1-2): " type_choice
  
  case $type_choice in
    1) MINING_TYPE="solo" ;;
    2) MINING_TYPE="group" ;;
    *) echo "Invalid selection. Defaulting to solo mining."; MINING_TYPE="solo" ;;
  esac
  
  echo "Selected mining type: $MINING_TYPE"
}

function configure_miner() {
  read -p "Enter your wallet address (default: $WALLET_ADDRESS): " input_wallet
  if [ ! -z "$input_wallet" ]; then
    WALLET_ADDRESS=$input_wallet
  fi
  
  read -p "Enter worker name (default: $WORKER_NAME): " input_worker
  if [ ! -z "$input_worker" ]; then
    WORKER_NAME=$input_worker
  fi
  
  select_coin
  select_mining_type
  
  echo "Configuration complete!"
  echo "Wallet: $WALLET_ADDRESS"
  echo "Worker: $WORKER_NAME"
  echo "Coin: $SELECTED_COIN"
  echo "Mining Type: $MINING_TYPE"
}

function detect_gpu() {
  echo "Detecting GPUs..."
  
  # Check for NVIDIA GPUs
  if command -v nvidia-smi &>/dev/null; then
    echo "NVIDIA GPU detected:"
    nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu --format=csv,noheader
    GPU_TYPE="NVIDIA"
    return
  fi
  
  # Check for AMD GPUs
  if command -v rocm-smi &>/dev/null; then
    echo "AMD GPU detected:"
    rocm-smi --showproductname --showtemp
    GPU_TYPE="AMD"
    return
  fi
  
  echo "No dedicated GPU detected. CPU mining will be used."
  GPU_TYPE="CPU"
}

function start_mining() {
  echo "Starting mining process for $SELECTED_COIN..."
  
  case $SELECTED_COIN in
    "BTC") POOL_URL=$BTC_POOL_URL ;;
    "ETH") POOL_URL=$ETH_POOL_URL ;;
    "XMR") POOL_URL=$XMR_POOL_URL ;;
    "LTC") POOL_URL=$LTC_POOL_URL ;;
    "RVN") POOL_URL=$RVN_POOL_URL ;;
    "ZEC") POOL_URL=$ZEC_POOL_URL ;;
    "BCH") POOL_URL=$BCH_POOL_URL ;;
    "DOGE") POOL_URL=$DOGE_POOL_URL ;;
    "DASH") POOL_URL=$DASH_POOL_URL ;;
  esac
  
  # Simulate mining (in real script, this would call the actual miner software)
  echo "Connecting to pool: $POOL_URL"
  echo "Mining with $WORKER_NAME for $WALLET_ADDRESS"
  
  # Simulate mining process
  for i in {1..10}; do
    echo "[$(date)] Mining in progress... Hashrate: $((10 + $RANDOM % 30)) MH/s, Shares: $i"
    sleep 5
  done
  
  echo "Mining process completed. In a real mining session, this would continue indefinitely."
  echo "To start actual mining, replace this function with commands to start your preferred mining software."
}

# Main program
check_dependencies
detect_gpu
configure_miner
start_mining
`;
    fs.writeFileSync(linuxScriptPath, linuxScript, { mode: 0o755 });
  }

  // Return the HTTP server so it can be used by the main application
  return httpServer;
}

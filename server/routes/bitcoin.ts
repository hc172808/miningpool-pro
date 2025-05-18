import { Router } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { authenticate, requireAdmin } from '../middleware/auth';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BitcoinNode } from '../bitcoin/node';

// Bitcoin settings validation schema
const bitcoinSettingsSchema = z.object({
  dbCache: z.number().min(10).max(16384).optional(),
  pruneMode: z.boolean().optional(),
  maxConnections: z.number().min(1).max(1000).optional(),
  autoPayoutsEnabled: z.boolean().optional(),
  stratumPort: z.number().min(1024).max(65535).optional(),
  poolWalletAddress: z.string().min(1).optional(),
});

// Global reference to the Bitcoin node
let bitcoinNode: BitcoinNode | null = null;

// Set up Bitcoin routes
export function setupBitcoinRoutes(router: Router, node: BitcoinNode | null) {
  // Store reference to the Bitcoin node
  bitcoinNode = node;

  // Get Bitcoin node settings
  router.get('/bitcoin/settings', authenticate, requireAdmin, async (req, res) => {
    try {
      // Return current settings from config
      res.json({
        bitcoin: config.bitcoin,
        poolWalletAddress: config.poolWalletAddress,
        stratumPort: config.stratumPort,
        autoPayoutsEnabled: config.autoPayoutsEnabled,
      });
    } catch (error) {
      logger.error('Error fetching Bitcoin settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update Bitcoin node settings
  router.patch('/bitcoin/settings', authenticate, requireAdmin, async (req, res) => {
    try {
      // Validate settings update
      const updatedSettings = bitcoinSettingsSchema.parse(req.body);
      
      // Update configuration (in a real implementation, this would persist to environment variables or database)
      if (updatedSettings.dbCache !== undefined) {
        config.bitcoin.dbCache = updatedSettings.dbCache;
      }
      
      if (updatedSettings.pruneMode !== undefined) {
        config.bitcoin.pruneMode = updatedSettings.pruneMode;
      }
      
      if (updatedSettings.maxConnections !== undefined) {
        config.bitcoin.maxConnections = updatedSettings.maxConnections;
      }
      
      if (updatedSettings.autoPayoutsEnabled !== undefined) {
        config.autoPayoutsEnabled = updatedSettings.autoPayoutsEnabled;
      }
      
      if (updatedSettings.stratumPort !== undefined) {
        config.stratumPort = updatedSettings.stratumPort;
      }
      
      if (updatedSettings.poolWalletAddress !== undefined) {
        config.poolWalletAddress = updatedSettings.poolWalletAddress;
      }
      
      // Log update
      logger.info('Bitcoin settings updated by administrator', { settings: updatedSettings });
      
      // Return updated settings
      res.json({
        message: 'Settings updated successfully',
        settings: {
          bitcoin: config.bitcoin,
          poolWalletAddress: config.poolWalletAddress,
          stratumPort: config.stratumPort,
          autoPayoutsEnabled: config.autoPayoutsEnabled,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: fromZodError(error).message 
        });
      }
      
      logger.error('Error updating Bitcoin settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Bitcoin node status
  router.get('/bitcoin/status', authenticate, requireAdmin, async (req, res) => {
    try {
      if (!bitcoinNode || !bitcoinNode.isConnected()) {
        return res.json({
          connected: false,
          version: 'Unknown',
          blocks: 0,
          peers: 0,
          memoryUsage: 0,
          uptime: 0,
          chain: 'main',
          dbCacheSize: config.bitcoin.dbCache,
          pruned: config.bitcoin.pruneMode,
        });
      }
      
      // Get status information from the Bitcoin node
      const info = await bitcoinNode.getClient().getBlockchainInfo().catch(() => null);
      const networkInfo = await bitcoinNode.getClient().getNetworkInfo().catch(() => null);
      const memoryInfo = await bitcoinNode.getClient().getMemoryInfo().catch(() => null);
      const miningInfo = await bitcoinNode.getClient().getMiningInfo().catch(() => null);
      
      res.json({
        connected: bitcoinNode.isConnected(),
        version: networkInfo ? networkInfo.version : 'Unknown',
        blocks: info ? info.blocks : 0,
        peers: networkInfo ? networkInfo.connections : 0,
        memoryUsage: memoryInfo ? memoryInfo.used : 0,
        uptime: networkInfo ? networkInfo.uptime : 0,
        chain: info ? info.chain : 'main',
        dbCacheSize: config.bitcoin.dbCache,
        pruned: info ? (info.pruned || false) : config.bitcoin.pruneMode,
      });
    } catch (error) {
      logger.error('Error fetching Bitcoin node status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Restart Bitcoin node
  router.post('/bitcoin/restart', authenticate, requireAdmin, async (req, res) => {
    try {
      if (!bitcoinNode) {
        return res.status(400).json({ message: 'Bitcoin node is not initialized' });
      }
      
      logger.info('Bitcoin node restart requested by administrator');
      
      // Here we would handle the restart of the Bitcoin node
      // In a real environment, this would need to properly shut down and restart the node
      // For demonstration, we'll simulate this by setting up a reconnection
      
      // First disconnect from the node
      bitcoinNode = null;
      
      // Create a new Bitcoin node with updated settings
      const newNode = new BitcoinNode({
        host: process.env.BITCOIN_RPC_HOST || '',
        port: parseInt(process.env.BITCOIN_RPC_PORT || '8332', 10),
        username: process.env.BITCOIN_RPC_USERNAME || '',
        password: process.env.BITCOIN_RPC_PASSWORD || '',
        dbCache: config.bitcoin.dbCache,
        pruneMode: config.bitcoin.pruneMode,
        maxConnections: config.bitcoin.maxConnections
      });
      
      // Initialize the new node (this would be an async process in reality)
      // For demo, we'll just set a timeout to simulate the restart time
      setTimeout(async () => {
        try {
          await newNode.initialize();
          bitcoinNode = newNode;
          logger.info('Bitcoin node restarted successfully');
        } catch (error) {
          logger.error('Error restarting Bitcoin node:', error);
        }
      }, 5000);
      
      // Return success immediately
      res.json({ message: 'Bitcoin node restart initiated' });
    } catch (error) {
      logger.error('Error restarting Bitcoin node:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return router;
}
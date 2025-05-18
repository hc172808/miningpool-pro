import express from 'express';
import { authenticate, requireAdmin } from './middleware/auth';
import { db } from './db';
import { nodeConfigurations, insertNodeConfigurationSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

// Get all node configurations
router.get('/node-configurations', async (req, res) => {
  try {
    // Make sure the content type is set to JSON
    res.setHeader('Content-Type', 'application/json');
    const configs = await db.select().from(nodeConfigurations);
    
    // Send the JSON response
    res.status(200).json(configs);
  } catch (error) {
    console.error('Error fetching node configurations:', error);
    res.status(500).json({ error: 'Failed to fetch node configurations' });
  }
});

// Get a specific node configuration
router.get('/node-configurations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));

    if (!config) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching node configuration:', error);
    res.status(500).json({ error: 'Failed to fetch node configuration' });
  }
});

// Create a new node configuration
router.post('/node-configurations', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = insertNodeConfigurationSchema.parse(req.body);
    
    // Check if configuration for this coin already exists
    const [existingConfig] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.coin, data.coin));
    
    if (existingConfig) {
      return res.status(400).json({ error: `Configuration for ${data.coin} already exists` });
    }
    
    const [newConfig] = await db.insert(nodeConfigurations).values(data).returning();
    res.status(201).json(newConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating node configuration:', error);
    res.status(500).json({ error: 'Failed to create node configuration' });
  }
});

// Update a node configuration
router.patch('/node-configurations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = insertNodeConfigurationSchema.partial().parse(req.body);
    
    const [updatedConfig] = await db
      .update(nodeConfigurations)
      .set(data)
      .where(eq(nodeConfigurations.id, parseInt(id)))
      .returning();
      
    if (!updatedConfig) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }
    
    res.json(updatedConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating node configuration:', error);
    res.status(500).json({ error: 'Failed to update node configuration' });
  }
});

// Delete a node configuration
router.delete('/node-configurations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if the node is running
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));
      
    if (!config) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }
    
    if (config.isRunning) {
      return res.status(400).json({ error: 'Node is currently running. Please stop it first.' });
    }
    
    await db
      .delete(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));
      
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting node configuration:', error);
    res.status(500).json({ error: 'Failed to delete node configuration' });
  }
});

// Start a node
router.post('/node-configurations/:id/start', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the configuration
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));
      
    if (!config) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }
    
    if (config.isRunning) {
      return res.status(400).json({ error: 'Node is already running' });
    }
    
    if (!config.enabled) {
      return res.status(400).json({ error: 'Node is disabled. Enable it before starting.' });
    }
    
    // For demonstration purposes, we'll just update the isRunning flag
    // In a real implementation, this would actually start the node process
    const [updatedConfig] = await db
      .update(nodeConfigurations)
      .set({ 
        isRunning: true,
        syncPercentage: 0,
        memoryUsageMb: Math.round(config.cacheSize * 0.8),
        lastUpdated: new Date()
      })
      .where(eq(nodeConfigurations.id, parseInt(id)))
      .returning();
    
    // In a real-world scenario you would do something like this:
    // const command = `../crypto/start-node.sh ${config.coin} ${config.cacheSize} ${config.network}`;
    // await execAsync(command);
    
    res.json(updatedConfig);
  } catch (error) {
    console.error('Error starting node:', error);
    res.status(500).json({ error: 'Failed to start node' });
  }
});

// Stop a node
router.post('/node-configurations/:id/stop', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the configuration
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));
      
    if (!config) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }
    
    if (!config.isRunning) {
      return res.status(400).json({ error: 'Node is not running' });
    }
    
    // For demonstration purposes, we'll just update the isRunning flag
    const [updatedConfig] = await db
      .update(nodeConfigurations)
      .set({ 
        isRunning: false,
        memoryUsageMb: 0,
        lastUpdated: new Date()
      })
      .where(eq(nodeConfigurations.id, parseInt(id)))
      .returning();
    
    // In a real-world scenario you would do something like this:
    // const command = `../crypto/stop-node.sh ${config.coin}`;
    // await execAsync(command);
    
    res.json(updatedConfig);
  } catch (error) {
    console.error('Error stopping node:', error);
    res.status(500).json({ error: 'Failed to stop node' });
  }
});

// Get node status
router.get('/node-configurations/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the configuration
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, parseInt(id)));
      
    if (!config) {
      return res.status(404).json({ error: 'Node configuration not found' });
    }
    
    // For demonstration, we'll simulate updating some status fields
    // In a real implementation, you would query the actual node
    if (config.isRunning) {
      // Simulate progress in sync percentage
      let syncPercentage = config.syncPercentage || 0;
      syncPercentage = Math.min(100, syncPercentage + Math.random() * 5);
      
      // Simulate varying memory usage
      const memoryUsage = Math.round(config.cacheSize * (0.7 + Math.random() * 0.3));
      
      // Simulate connections
      const connections = Math.floor(5 + Math.random() * 20);
      
      const [updatedConfig] = await db
        .update(nodeConfigurations)
        .set({ 
          syncPercentage,
          memoryUsageMb: memoryUsage,
          connections,
          lastSyncedBlock: syncPercentage === 100 ? 800000 : Math.floor(800000 * (syncPercentage / 100)),
          totalBlocks: 800000,
          lastUpdated: new Date()
        })
        .where(eq(nodeConfigurations.id, parseInt(id)))
        .returning();
        
      res.json(updatedConfig);
    } else {
      res.json(config);
    }
  } catch (error) {
    console.error('Error getting node status:', error);
    res.status(500).json({ error: 'Failed to get node status' });
  }
});

// Initialize node configurations for all supported cryptocurrencies
router.post('/initialize-node-configs', async (req, res) => {
  try {
    const cryptos = [
      { coin: 'BTC', rpcPort: 8332, network: 'main' },
      { coin: 'ETH', rpcPort: 8545, network: 'main' },
      { coin: 'XMR', rpcPort: 18081, network: 'main' },
      { coin: 'LTC', rpcPort: 9332, network: 'main' },
      { coin: 'RVN', rpcPort: 8766, network: 'main' },
      { coin: 'ZEC', rpcPort: 8232, network: 'main' },
      { coin: 'BCH', rpcPort: 8332, network: 'main' },
      { coin: 'DOGE', rpcPort: 22555, network: 'main' },
      { coin: 'DASH', rpcPort: 9998, network: 'main' },
    ];
    
    // Remove any existing configurations
    await db.delete(nodeConfigurations);
    
    // Insert default configurations for all cryptocurrencies
    const inserted = await Promise.all(cryptos.map(async (crypto) => {
      const [config] = await db.insert(nodeConfigurations).values({
        coin: crypto.coin,
        enabled: false,
        cacheSize: 10,
        rpcHost: 'localhost',
        rpcPort: crypto.rpcPort,
        rpcUsername: 'miningpooluseradmin',
        rpcPassword: 'password123secure',
        network: crypto.network,
        autoStart: true,
        isPruned: true,
        dataDir: `/var/lib/mining/${crypto.coin.toLowerCase()}`
      }).returning();
      return config;
    }));
    
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Error initializing node configurations:', error);
    res.status(500).json({ error: 'Failed to initialize node configurations' });
  }
});

export default router;
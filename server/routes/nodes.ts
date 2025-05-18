import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { storage } from '../storage';
import { createCryptoNode, stopCryptoNode, getCryptoNodeStatus, isNodeRunning } from '../crypto/node-manager';
import { MessageType } from '../websocket';

// Set up node configuration routes
export function setupNodeRoutes(router: Router) {
  // Get all node configurations
  router.get("/node-configurations", async (req, res) => {
    try {
      const nodeConfigs = await storage.getAllNodeConfigurations();
      res.json(nodeConfigs);
    } catch (error) {
      console.error("Error getting node configurations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get node configuration by ID
  router.get("/node-configurations/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const nodeConfig = await storage.getNodeConfiguration(id);
      
      if (!nodeConfig) {
        return res.status(404).json({ error: "Node configuration not found" });
      }
      
      res.json(nodeConfig);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get node configuration by cryptocurrency
  router.get("/node-configurations/coin/:coin", authenticate, requireAdmin, async (req, res) => {
    try {
      const { coin } = req.params;
      const nodeConfig = await storage.getNodeConfigurationByCoin(coin);
      
      if (!nodeConfig) {
        return res.status(404).json({ error: "Node configuration not found for this cryptocurrency" });
      }
      
      res.json(nodeConfig);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start a node
  router.post("/node-configurations/:id/start", authenticate, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const nodeConfig = await storage.getNodeConfiguration(id);
      
      if (!nodeConfig) {
        return res.status(404).json({ error: "Node configuration not found" });
      }
      
      if (nodeConfig.isRunning) {
        return res.status(400).json({ error: "Node is already running" });
      }
      
      console.log(`Starting ${nodeConfig.coin} node (ID: ${id})...`);
      
      try {
        // Start the node using the node manager
        const updatedConfig = await createCryptoNode(nodeConfig);
        
        // Update the node status in the database
        await storage.updateNodeConfiguration(id, { 
          isRunning: true,
          lastUpdated: new Date()
        });
        
        console.log(`Successfully started ${nodeConfig.coin} node`);
        
        // If there's a WebSocket manager available, send a notification
        const wsManager = req.app.locals.webSocketManager;
        if (wsManager) {
          wsManager.broadcast({
            type: MessageType.POOL_STATS_UPDATE,
            data: {
              nodeStatus: {
                id: nodeConfig.id,
                coin: nodeConfig.coin,
                isRunning: true,
                lastStarted: new Date()
              }
            },
            timestamp: Date.now()
          });
        }
        
        res.json(updatedConfig);
      } catch (startError) {
        console.error(`Error starting node: ${startError.message}`);
        // If node failed to start, ensure it's marked as not running
        await storage.updateNodeConfiguration(id, { isRunning: false });
        throw startError;
      }
    } catch (error) {
      console.error(`Failed to start node: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop a node
  router.post("/node-configurations/:id/stop", authenticate, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const nodeConfig = await storage.getNodeConfiguration(id);
      
      if (!nodeConfig) {
        return res.status(404).json({ error: "Node configuration not found" });
      }
      
      if (!nodeConfig.isRunning) {
        return res.status(400).json({ error: "Node is not running" });
      }
      
      console.log(`Stopping ${nodeConfig.coin} node (ID: ${id})...`);
      
      try {
        // Stop the node
        await stopCryptoNode(nodeConfig);
        
        // Update the node status
        await storage.updateNodeConfiguration(id, { 
          isRunning: false,
          lastUpdated: new Date()
        });
        
        console.log(`Successfully stopped ${nodeConfig.coin} node`);
        
        // If there's a WebSocket manager available, send a notification
        const wsManager = req.app.locals.webSocketManager;
        if (wsManager) {
          wsManager.broadcast({
            type: MessageType.POOL_STATS_UPDATE,
            data: {
              nodeStatus: {
                id: nodeConfig.id,
                coin: nodeConfig.coin,
                isRunning: false,
                lastStopped: new Date()
              }
            },
            timestamp: Date.now()
          });
        }
        
        res.json({ 
          ...nodeConfig,
          isRunning: false,
          lastUpdated: new Date()
        });
      } catch (stopError) {
        console.error(`Error stopping node: ${stopError.message}`);
        throw stopError;
      }
    } catch (error) {
      console.error(`Failed to stop node: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Get node status
  router.get("/node-configurations/:id/status", authenticate, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const nodeConfig = await storage.getNodeConfiguration(id);
      
      if (!nodeConfig) {
        return res.status(404).json({ error: "Node configuration not found" });
      }
      
      if (!nodeConfig.isRunning) {
        return res.json({ 
          status: "stopped",
          lastUpdated: nodeConfig.lastUpdated
        });
      }
      
      try {
        // Get the node status
        const status = await getCryptoNodeStatus(nodeConfig);
        
        // Update the node status in the database
        await storage.updateNodeStatus(id, {
          lastSyncedBlock: status.lastSyncedBlock,
          totalBlocks: status.totalBlocks,
          connections: status.connections,
          syncPercentage: status.syncPercentage,
          memoryUsageMb: status.memoryUsageMb,
          lastUpdated: new Date()
        });
        
        res.json({ 
          status: "running",
          ...status,
          lastUpdated: new Date()
        });
      } catch (statusError) {
        console.error(`Error getting node status: ${statusError.message}`);
        
        // If we can't get the status, the node might have crashed
        // Check if we can still find it in the node manager
        const isActuallyRunning = isNodeRunning(id);
        
        if (!isActuallyRunning) {
          // Update the node status to not running
          await storage.updateNodeConfiguration(id, { isRunning: false });
          
          return res.json({
            status: "crashed",
            error: statusError.message,
            lastUpdated: new Date()
          });
        }
        
        // If it's running but we can't get status, return an error status
        res.json({
          status: "error",
          error: statusError.message,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      console.error(`Failed to get node status: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
}
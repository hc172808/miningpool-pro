import { NodeConfiguration } from "@shared/schema";
import Client from 'bitcoin-core';
import { exec, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Track running nodes
interface RunningNode {
  process: ChildProcess;
  config: NodeConfiguration;
  client?: any; // RPC client
}

// Map of node ID to running node instance
const runningNodes: Map<number, RunningNode> = new Map();

/**
 * Create and start a cryptocurrency node
 * @param config Node configuration from database
 * @returns Updated node configuration
 */
export async function createCryptoNode(config: NodeConfiguration): Promise<NodeConfiguration> {
  console.log(`Starting ${config.coin} node with config:`, config);
  
  // If node is already running, stop it first
  if (runningNodes.has(config.id)) {
    await stopCryptoNode(config);
  }
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'data', config.coin.toLowerCase());
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Choose appropriate start command based on coin type
  let startCommand: string;
  let rpcClient: any = null;
  
  try {
    // Use rpcUsername/rpcPassword and rpcPort from the node configuration
    switch (config.coin) {
      case 'BTC':
        startCommand = `bitcoind -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        
        // Create RPC client for Bitcoin
        rpcClient = new Client({
          host: config.rpcHost || 'localhost',
          port: config.rpcPort || 8332,
          username: config.rpcUsername || '',
          password: config.rpcPassword || '',
          timeout: 30000
        });
        break;
        
      case 'ETH':
        // For Ethereum, use Geth with appropriate cache size
        startCommand = `geth --datadir=${dataDir} --http --http.port=${config.rpcPort} --http.api=eth,net,web3,personal --cache=${config.cacheSize} --${config.network === 'main' ? 'mainnet' : 'goerli'}`;
        break;
        
      case 'XMR':
        // For Monero, use monerod
        startCommand = `monerod --data-dir=${dataDir} --rpc-bind-ip=${config.rpcHost || '127.0.0.1'} --rpc-bind-port=${config.rpcPort} --rpc-login=${config.rpcUsername}:${config.rpcPassword} --${config.network === 'test' ? 'stagenet' : 'mainnet'} --db-cache-size=${config.cacheSize}`;
        break;
        
      case 'LTC':
        // For Litecoin
        startCommand = `litecoind -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      case 'RVN':
        // For Ravencoin
        startCommand = `ravend -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      case 'ZEC':
        // For Zcash
        startCommand = `zcashd -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      case 'BCH':
        // For Bitcoin Cash
        startCommand = `bitcoind -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      case 'DOGE':
        // For Dogecoin
        startCommand = `dogecoind -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      case 'DASH':
        // For Dash
        startCommand = `dashd -datadir=${dataDir} -server -rpcuser=${config.rpcUsername} -rpcpassword=${config.rpcPassword} -rpcport=${config.rpcPort} -dbcache=${config.cacheSize} -${config.network.toLowerCase()}`;
        break;
        
      default:
        throw new Error(`Unsupported cryptocurrency: ${config.coin}`);
    }
    
    // For simulation purposes, we'll just pretend to start the node
    // In a real implementation, you would execute the command
    console.log(`[SIMULATION] Starting ${config.coin} node with command: ${startCommand}`);
    
    // Store node details - in a real environment, this would be the actual process
    const mockProcess = {
      pid: Math.floor(Math.random() * 10000),
      kill: (signal?: string) => console.log(`[SIMULATION] Killing ${config.coin} node with signal ${signal}`),
      // Add other necessary process methods/properties as needed
    } as unknown as ChildProcess;
    
    runningNodes.set(config.id, {
      process: mockProcess,
      config: config,
      client: rpcClient
    });
    
    // Update the config to reflect the running state
    return {
      ...config,
      isRunning: true,
      lastSyncedBlock: 0,
      totalBlocks: 0,
      connections: 0,
      syncPercentage: 0,
      memoryUsageMb: config.cacheSize,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error(`Error starting ${config.coin} node:`, error);
    throw error;
  }
}

/**
 * Stop a running cryptocurrency node
 * @param config Node configuration
 */
export async function stopCryptoNode(config: NodeConfiguration): Promise<void> {
  console.log(`Stopping ${config.coin} node (ID: ${config.id})`);
  
  const runningNode = runningNodes.get(config.id);
  if (!runningNode) {
    console.log(`Node ${config.id} is not running`);
    return;
  }
  
  try {
    // Close the RPC client if it exists
    if (runningNode.client) {
      // Most RPC clients have a method to close the connection
      if (typeof runningNode.client.close === 'function') {
        await runningNode.client.close();
      } else if (typeof runningNode.client.shutdown === 'function') {
        await runningNode.client.shutdown();
      }
    }
    
    // Terminate the node process
    if (runningNode.process) {
      runningNode.process.kill('SIGTERM');
      
      // Wait for process to terminate
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // If process is still running, force kill
          if (runningNode.process.killed === false) {
            runningNode.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }
    
    // Remove from running nodes map
    runningNodes.delete(config.id);
    console.log(`Successfully stopped ${config.coin} node`);
  } catch (error) {
    console.error(`Error stopping ${config.coin} node:`, error);
    throw error;
  }
}

/**
 * Get status of a running cryptocurrency node
 * @param config Node configuration
 * @returns Node status information
 */
export async function getCryptoNodeStatus(config: NodeConfiguration): Promise<{
  lastSyncedBlock: number;
  totalBlocks: number;
  connections: number;
  syncPercentage: number;
  memoryUsageMb: number;
}> {
  console.log(`Getting status for ${config.coin} node (ID: ${config.id})`);
  
  const runningNode = runningNodes.get(config.id);
  if (!runningNode) {
    throw new Error(`Node ${config.id} is not running`);
  }
  
  try {
    // For simulation purposes, generate mock status data
    // In a real implementation, you would query the RPC interface
    const mockStatus = {
      lastSyncedBlock: Math.floor(Math.random() * 700000),
      totalBlocks: 800000,
      connections: Math.floor(Math.random() * 20) + 5,
      syncPercentage: Math.min(Math.random() * 100, 99.9),
      memoryUsageMb: Math.floor(Math.random() * config.cacheSize)
    };
    
    console.log(`Status for ${config.coin} node:`, mockStatus);
    return mockStatus;
  } catch (error) {
    console.error(`Error getting status for ${config.coin} node:`, error);
    throw error;
  }
}

/**
 * Check if a node is currently running
 * @param nodeId Node ID to check
 * @returns True if node is running
 */
export function isNodeRunning(nodeId: number): boolean {
  return runningNodes.has(nodeId);
}

/**
 * Get list of all running nodes
 * @returns Array of running node IDs
 */
export function getRunningNodes(): number[] {
  return Array.from(runningNodes.keys());
}

/**
 * Safely shutdown all running nodes on application exit
 */
export async function shutdownAllNodes(): Promise<void> {
  console.log(`Shutting down all cryptocurrency nodes (${runningNodes.size} nodes)`);
  
  const shutdownPromises = Array.from(runningNodes.values()).map(node => {
    return stopCryptoNode(node.config).catch(error => {
      console.error(`Error shutting down ${node.config.coin} node:`, error);
    });
  });
  
  await Promise.all(shutdownPromises);
  console.log('All nodes shut down successfully');
}

// Register shutdown handler to clean up nodes
process.on('SIGINT', async () => {
  console.log('Received SIGINT signal, shutting down nodes...');
  await shutdownAllNodes();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal, shutting down nodes...');
  await shutdownAllNodes();
  process.exit(0);
});
import Client from 'bitcoin-core';
import { logger } from '../utils/logger';

/**
 * Bitcoin node connection manager
 * Handles connections to Bitcoin Core node for mining pool operations
 */
export class BitcoinNode {
  private client: Client;
  private connected: boolean = false;

  constructor(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    timeout?: number;
    dbCache?: number; // UTXO cache size in megabytes
    pruneMode?: boolean; // Whether to run in pruned mode
    maxConnections?: number; // Maximum peer connections
  }) {
    // Convert configuration to Bitcoin Core client options
    this.client = new Client({
      host: config.host,
      network: 'mainnet', // Default to mainnet
      username: config.username,
      password: config.password,
      timeout: config.timeout || 30000,
      version: '0.21.0', // Specify Bitcoin Core version
      
      // Additional RPC parameters for Bitcoin Core
      extra: {
        // If dbCache is provided, set the cache size in megabytes
        ...(config.dbCache && { dbcache: config.dbCache }),
        
        // If pruneMode is enabled, set pruning mode
        ...(config.pruneMode && { prune: 1 }),
        
        // Set max connections if provided
        ...(config.maxConnections && { maxconnections: config.maxConnections }),
        
        // Set server mode
        server: true,
        
        // Enable transaction index
        txindex: true,
        
        // Enable RPC server
        rpcallowip: '0.0.0.0/0',
        rpcbind: '0.0.0.0',
        
        // Mining-specific settings
        rpcthreads: 4, // Number of threads for RPC
        rpcworkqueue: 100, // Size of work queue for RPC
        
        // Listen for connections
        listen: true
      }
    });

    logger.info(`Bitcoin node configuration set up with ${config.dbCache || 450}MB UTXO cache`);
  }

  /**
   * Initialize and test the connection to the Bitcoin node
   */
  async initialize(): Promise<boolean> {
    try {
      // Test connection by getting blockchain info
      const info = await this.client.getBlockchainInfo();
      
      logger.info(`Connected to Bitcoin node: v${info.version}`);
      logger.info(`Current block height: ${info.blocks}`);
      logger.info(`Chain: ${info.chain}`);
      
      this.connected = true;
      return true;
    } catch (error) {
      logger.error('Failed to connect to Bitcoin node:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Get the latest block template for mining
   */
  async getBlockTemplate(): Promise<any> {
    try {
      // Rules specify which capabilities the server supports
      const rules = ["segwit"];
      
      // Get the block template for mining
      const blockTemplate = await this.client.getBlockTemplate({
        rules,
        capabilities: ["coinbasetxn", "workid", "coinbase/append"]
      });
      
      return blockTemplate;
    } catch (error) {
      logger.error('Failed to get block template:', error);
      throw error;
    }
  }

  /**
   * Submit a solved block to the Bitcoin network
   */
  async submitBlock(blockHex: string): Promise<boolean> {
    try {
      const result = await this.client.submitBlock(blockHex);
      
      // If no error is thrown and result is null, the submission was successful
      if (result === null) {
        logger.info('Successfully submitted block to Bitcoin network');
        return true;
      }
      
      logger.error('Block submission failed:', result);
      return false;
    } catch (error) {
      logger.error('Error submitting block:', error);
      return false;
    }
  }

  /**
   * Get the current difficulty of the Bitcoin network
   */
  async getDifficulty(): Promise<number> {
    try {
      const difficulty = await this.client.getDifficulty();
      return difficulty;
    } catch (error) {
      logger.error('Failed to get network difficulty:', error);
      throw error;
    }
  }

  /**
   * Get wallet information for payment processing
   */
  async getWalletInfo(): Promise<any> {
    try {
      const walletInfo = await this.client.getWalletInfo();
      return walletInfo;
    } catch (error) {
      logger.error('Failed to get wallet info:', error);
      throw error;
    }
  }

  /**
   * Create a raw transaction for payout
   */
  async createRawTransaction(outputs: Record<string, number>): Promise<string> {
    try {
      // Create inputs by getting unspent transaction outputs
      const utxos = await this.client.listUnspent();
      
      // Filter UTXOs to get enough funds for the transaction
      const totalPayoutAmount = Object.values(outputs).reduce((sum, amount) => sum + amount, 0);
      let inputAmount = 0;
      const inputs = [];
      
      for (const utxo of utxos) {
        inputs.push({
          txid: utxo.txid,
          vout: utxo.vout
        });
        
        inputAmount += utxo.amount;
        if (inputAmount >= totalPayoutAmount) {
          break;
        }
      }
      
      if (inputAmount < totalPayoutAmount) {
        throw new Error('Not enough funds for payout');
      }
      
      // Create raw transaction
      const rawTx = await this.client.createRawTransaction(inputs, outputs);
      return rawTx;
    } catch (error) {
      logger.error('Failed to create raw transaction:', error);
      throw error;
    }
  }

  /**
   * Sign and send a raw transaction
   */
  async signAndSendRawTransaction(rawTx: string): Promise<string> {
    try {
      // Sign the transaction
      const signedTx = await this.client.signRawTransaction(rawTx);
      
      // Broadcast the transaction
      const txid = await this.client.sendRawTransaction(signedTx.hex);
      
      logger.info(`Transaction sent: ${txid}`);
      return txid;
    } catch (error) {
      logger.error('Failed to sign and send transaction:', error);
      throw error;
    }
  }

  /**
   * Check if connected to Bitcoin node
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the Bitcoin Core client
   */
  getClient(): Client {
    return this.client;
  }
}

/**
 * Create a Bitcoin node instance
 */
export function createBitcoinNode(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}): BitcoinNode {
  return new BitcoinNode(config);
}
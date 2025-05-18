import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { BitcoinNode } from './node';

/**
 * Interface representing a payout record
 */
export interface Payout {
  id: string;               // Unique payout ID
  userId: string;           // User ID or wallet address receiving the payout
  amount: number;           // BTC amount
  fee: number;              // Transaction fee
  status: PayoutStatus;     // Status of the payout
  transactionId?: string;   // Bitcoin transaction ID once processed
  timestamp: Date;          // When the payout was created
  processedAt?: Date;       // When the payout was processed
}

/**
 * Payout status enum
 */
export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Interface for payout storage systems
 */
export interface PayoutStorage {
  savePayout(payout: Payout): Promise<Payout>;
  updatePayoutStatus(id: string, status: PayoutStatus, transactionId?: string): Promise<Payout>;
  getPayoutsByUser(userId: string): Promise<Payout[]>;
  getPendingPayouts(): Promise<Payout[]>;
  getPayoutById(id: string): Promise<Payout | null>;
  getAllPayouts(limit?: number, offset?: number): Promise<Payout[]>;
}

/**
 * In-memory implementation of payout storage
 * In a production system, this would be replaced with a database
 */
export class MemoryPayoutStorage implements PayoutStorage {
  private payouts: Payout[] = [];
  
  async savePayout(payout: Payout): Promise<Payout> {
    this.payouts.push(payout);
    return payout;
  }
  
  async updatePayoutStatus(id: string, status: PayoutStatus, transactionId?: string): Promise<Payout> {
    const payout = this.payouts.find(p => p.id === id);
    
    if (!payout) {
      throw new Error(`Payout with ID ${id} not found`);
    }
    
    payout.status = status;
    
    if (transactionId) {
      payout.transactionId = transactionId;
    }
    
    if (status === PayoutStatus.COMPLETED || status === PayoutStatus.FAILED) {
      payout.processedAt = new Date();
    }
    
    return payout;
  }
  
  async getPayoutsByUser(userId: string): Promise<Payout[]> {
    return this.payouts.filter(p => p.userId === userId);
  }
  
  async getPendingPayouts(): Promise<Payout[]> {
    return this.payouts.filter(p => p.status === PayoutStatus.PENDING);
  }
  
  async getPayoutById(id: string): Promise<Payout | null> {
    return this.payouts.find(p => p.id === id) || null;
  }
  
  async getAllPayouts(limit: number = 100, offset: number = 0): Promise<Payout[]> {
    return this.payouts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }
}

/**
 * Config options for the payout manager
 */
export interface PayoutManagerConfig {
  minPayout: number;             // Minimum amount for automatic payouts (in BTC)
  poolWallet: string;            // Pool wallet address
  autoPayoutsEnabled: boolean;   // Whether automatic payouts are enabled
  payoutInterval: number;        // Interval between automatic payouts (in milliseconds)
  maxPayoutsPerBatch: number;    // Maximum number of payouts to process in one batch
}

/**
 * Manages cryptocurrency payouts to miners
 */
export class PayoutManager extends EventEmitter {
  private bitcoinNode: BitcoinNode;
  private storage: PayoutStorage;
  private config: PayoutManagerConfig;
  private payoutInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  
  constructor(bitcoinNode: BitcoinNode, storage: PayoutStorage, config: PayoutManagerConfig) {
    super();
    this.bitcoinNode = bitcoinNode;
    this.storage = storage;
    this.config = config;
  }
  
  /**
   * Start automatic payouts
   */
  public startAutomaticPayouts(): void {
    if (this.payoutInterval) {
      clearInterval(this.payoutInterval);
    }
    
    this.config.autoPayoutsEnabled = true;
    
    this.payoutInterval = setInterval(() => {
      this.processPayouts().catch(error => {
        logger.error('Error in automatic payout processing:', error);
      });
    }, this.config.payoutInterval);
    
    logger.info(`Automatic payouts started with interval of ${this.config.payoutInterval}ms`);
    
    // Start an initial payout process
    this.processPayouts().catch(error => {
      logger.error('Error in initial payout processing:', error);
    });
  }
  
  /**
   * Stop automatic payouts
   */
  public stopAutomaticPayouts(): void {
    if (this.payoutInterval) {
      clearInterval(this.payoutInterval);
      this.payoutInterval = null;
    }
    
    this.config.autoPayoutsEnabled = false;
    logger.info('Automatic payouts stopped');
  }
  
  /**
   * Create a payout request for a user
   */
  public async createPayout(userId: string, amount: number): Promise<Payout> {
    if (amount < this.config.minPayout) {
      throw new Error(`Amount ${amount} BTC is below minimum payout threshold of ${this.config.minPayout} BTC`);
    }
    
    const payoutId = this.generatePayoutId();
    
    const payout: Payout = {
      id: payoutId,
      userId,
      amount,
      fee: 0, // Will be set during processing
      status: PayoutStatus.PENDING,
      timestamp: new Date()
    };
    
    await this.storage.savePayout(payout);
    
    logger.info(`Created payout ${payoutId} for user ${userId} of ${amount} BTC`);
    
    // Emit payout created event
    this.emit('payout:created', payout);
    
    return payout;
  }
  
  /**
   * Process pending payouts
   */
  public async processPayouts(): Promise<number> {
    if (this.isProcessing) {
      logger.info('Payout processing already in progress, skipping');
      return 0;
    }
    
    this.isProcessing = true;
    
    try {
      // Get pending payouts
      const pendingPayouts = await this.storage.getPendingPayouts();
      
      if (pendingPayouts.length === 0) {
        logger.info('No pending payouts to process');
        this.isProcessing = false;
        return 0;
      }
      
      logger.info(`Processing ${pendingPayouts.length} pending payouts`);
      
      // Process payouts in batches to avoid creating too large transactions
      const batches: Payout[][] = [];
      let currentBatch: Payout[] = [];
      
      for (const payout of pendingPayouts) {
        currentBatch.push(payout);
        
        if (currentBatch.length >= this.config.maxPayoutsPerBatch) {
          batches.push(currentBatch);
          currentBatch = [];
        }
      }
      
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      
      // Process each batch
      let processedCount = 0;
      for (const batch of batches) {
        const result = await this.processBatch(batch);
        processedCount += result;
      }
      
      logger.info(`Processed ${processedCount} payouts`);
      
      return processedCount;
    } catch (error) {
      logger.error('Error processing payouts:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a batch of payouts
   */
  private async processBatch(payouts: Payout[]): Promise<number> {
    try {
      // Mark payouts as processing
      for (const payout of payouts) {
        await this.storage.updatePayoutStatus(payout.id, PayoutStatus.PROCESSING);
      }
      
      // Create outputs object for the transaction
      const outputs: Record<string, number> = {};
      
      for (const payout of payouts) {
        outputs[payout.userId] = payout.amount;
      }
      
      // Create and send transaction
      const rawTx = await this.bitcoinNode.createRawTransaction(outputs);
      const txid = await this.bitcoinNode.signAndSendRawTransaction(rawTx);
      
      // Update payout statuses
      for (const payout of payouts) {
        await this.storage.updatePayoutStatus(payout.id, PayoutStatus.COMPLETED, txid);
        
        // Emit payout completed event
        this.emit('payout:completed', {
          ...payout,
          status: PayoutStatus.COMPLETED,
          transactionId: txid,
          processedAt: new Date()
        });
      }
      
      logger.info(`Batch payment successful, txid: ${txid}`);
      
      return payouts.length;
    } catch (error) {
      logger.error('Error processing payout batch:', error);
      
      // Mark payouts as failed
      for (const payout of payouts) {
        await this.storage.updatePayoutStatus(payout.id, PayoutStatus.FAILED);
        
        // Emit payout failed event
        this.emit('payout:failed', {
          ...payout,
          status: PayoutStatus.FAILED,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      return 0;
    }
  }
  
  /**
   * Get a user's pending payout amount
   */
  public async getPendingAmount(userId: string): Promise<number> {
    const pendingPayouts = await this.storage.getPayoutsByUser(userId);
    let pendingAmount = 0;
    
    for (const payout of pendingPayouts) {
      if (payout.status === PayoutStatus.PENDING || payout.status === PayoutStatus.PROCESSING) {
        pendingAmount += payout.amount;
      }
    }
    
    return pendingAmount;
  }
  
  /**
   * Get a user's payout history
   */
  public async getUserPayouts(userId: string): Promise<Payout[]> {
    return this.storage.getPayoutsByUser(userId);
  }
  
  /**
   * Get payout details by ID
   */
  public async getPayoutById(id: string): Promise<Payout | null> {
    return this.storage.getPayoutById(id);
  }
  
  /**
   * Get all payouts (for admin)
   */
  public async getAllPayouts(limit?: number, offset?: number): Promise<Payout[]> {
    return this.storage.getAllPayouts(limit, offset);
  }
  
  /**
   * Update payout configuration
   */
  public updateConfig(config: Partial<PayoutManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart automatic payouts if interval changed
    if (config.payoutInterval !== undefined && this.payoutInterval) {
      this.stopAutomaticPayouts();
      this.startAutomaticPayouts();
    }
    
    logger.info('Payout configuration updated', this.config);
  }
  
  /**
   * Generate a unique payout ID
   */
  private generatePayoutId(): string {
    return `payout_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
  
  /**
   * Get the current configuration
   */
  public getConfig(): PayoutManagerConfig {
    return { ...this.config };
  }
  
  /**
   * Get the current status
   */
  public getStatus(): {
    isProcessing: boolean;
    autoPayoutsEnabled: boolean;
    minPayout: number;
    payoutInterval: number;
  } {
    return {
      isProcessing: this.isProcessing,
      autoPayoutsEnabled: this.config.autoPayoutsEnabled,
      minPayout: this.config.minPayout,
      payoutInterval: this.config.payoutInterval
    };
  }
}

/**
 * Create a payout manager with in-memory storage
 */
export function createPayoutManager(
  bitcoinNode: BitcoinNode,
  config: Partial<PayoutManagerConfig> = {}
): PayoutManager {
  const defaultConfig: PayoutManagerConfig = {
    minPayout: 0.001, // 0.001 BTC minimum payout
    poolWallet: 'pool_wallet_address_here',
    autoPayoutsEnabled: true,
    payoutInterval: 1 * 60 * 60 * 1000, // 1 hour
    maxPayoutsPerBatch: 50
  };
  
  const storage = new MemoryPayoutStorage();
  return new PayoutManager(bitcoinNode, storage, { ...defaultConfig, ...config });
}
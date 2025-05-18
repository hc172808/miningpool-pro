import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Interface representing a mining share submission
 */
export interface Share {
  workerId: string;       // Worker/miner identifier
  ip: string;             // IP address of the miner
  timestamp: Date;        // When the share was submitted
  difficulty: number;     // Difficulty of the share
  isValid: boolean;       // Whether the share was valid
  isBlock?: boolean;      // Whether the share resulted in a block
  blockHeight?: number;   // Block height if this share found a block
  blockHash?: string;     // Block hash if this share found a block
}

/**
 * Interface for share storage systems
 */
export interface ShareStorage {
  saveShare(share: Share): Promise<void>;
  getWorkerShares(workerId: string, startTime: Date, endTime: Date): Promise<Share[]>;
  getWorkerValidShares(workerId: string, startTime: Date, endTime: Date): Promise<Share[]>;
  getPoolShares(startTime: Date, endTime: Date): Promise<Share[]>;
  getPoolValidShares(startTime: Date, endTime: Date): Promise<Share[]>;
  getFoundBlocks(startTime: Date, endTime: Date): Promise<Share[]>;
}

/**
 * In-memory implementation of share storage
 * In a production system, this would be replaced with a database
 */
export class MemoryShareStorage implements ShareStorage {
  private shares: Share[] = [];
  
  async saveShare(share: Share): Promise<void> {
    this.shares.push(share);
    
    // In a real system, we'd eventually prune old shares to prevent memory growth
    // This is just a simple in-memory implementation for demonstration
  }
  
  async getWorkerShares(workerId: string, startTime: Date, endTime: Date): Promise<Share[]> {
    return this.shares.filter(share => 
      share.workerId === workerId &&
      share.timestamp >= startTime &&
      share.timestamp <= endTime
    );
  }
  
  async getWorkerValidShares(workerId: string, startTime: Date, endTime: Date): Promise<Share[]> {
    return this.shares.filter(share => 
      share.workerId === workerId &&
      share.isValid &&
      share.timestamp >= startTime &&
      share.timestamp <= endTime
    );
  }
  
  async getPoolShares(startTime: Date, endTime: Date): Promise<Share[]> {
    return this.shares.filter(share => 
      share.timestamp >= startTime &&
      share.timestamp <= endTime
    );
  }
  
  async getPoolValidShares(startTime: Date, endTime: Date): Promise<Share[]> {
    return this.shares.filter(share => 
      share.isValid &&
      share.timestamp >= startTime &&
      share.timestamp <= endTime
    );
  }
  
  async getFoundBlocks(startTime: Date, endTime: Date): Promise<Share[]> {
    return this.shares.filter(share => 
      share.isBlock &&
      share.timestamp >= startTime &&
      share.timestamp <= endTime
    );
  }
}

/**
 * Share processor that handles incoming shares, calculates hashrates,
 * and manages reward accounting
 */
export class ShareProcessor extends EventEmitter {
  private storage: ShareStorage;
  private blockReward: number = 6.25; // Current Bitcoin block reward in BTC
  private poolFeePercent: number = 1.0; // Pool fee percentage
  
  constructor(storage: ShareStorage) {
    super();
    this.storage = storage;
  }
  
  /**
   * Process a new share submission
   */
  public async processShare(share: Share): Promise<void> {
    try {
      // Save the share to storage
      await this.storage.saveShare(share);
      
      // Calculate and emit hashrate updates
      await this.calculateHashrates(share.workerId);
      
      // If this share found a block, calculate rewards
      if (share.isBlock) {
        await this.calculateBlockRewards(share);
      }
      
      // Emit share processed event
      this.emit('share:processed', {
        workerId: share.workerId,
        isValid: share.isValid,
        difficulty: share.difficulty,
        timestamp: share.timestamp
      });
    } catch (error) {
      logger.error('Error processing share:', error);
    }
  }
  
  /**
   * Calculate a worker's recent hashrate based on submitted shares
   */
  private async calculateHashrates(workerId: string): Promise<void> {
    try {
      // Calculate hashrate over the last 10 minutes
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);
      
      // Get valid shares for the worker in the time window
      const shares = await this.storage.getWorkerValidShares(workerId, startTime, endTime);
      
      if (shares.length === 0) {
        return;
      }
      
      // Calculate hashrate: shares * difficulty * 2^32 / time in seconds
      const totalDifficulty = shares.reduce((sum, share) => sum + share.difficulty, 0);
      const timeWindowSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
      
      // 2^32 shares at difficulty 1 = 4.295 billion hashes
      const hashrate = totalDifficulty * 4.295e9 / timeWindowSeconds;
      
      // Emit hashrate update event
      this.emit('hashrate:updated', {
        workerId,
        hashrate,
        shares: shares.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Error calculating hashrate for worker ${workerId}:`, error);
    }
  }
  
  /**
   * Calculate pool hashrate based on all submitted shares
   */
  public async calculatePoolHashrate(): Promise<number> {
    try {
      // Calculate hashrate over the last 10 minutes
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);
      
      // Get all valid shares in the time window
      const shares = await this.storage.getPoolValidShares(startTime, endTime);
      
      if (shares.length === 0) {
        return 0;
      }
      
      // Calculate hashrate
      const totalDifficulty = shares.reduce((sum, share) => sum + share.difficulty, 0);
      const timeWindowSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
      
      return totalDifficulty * 4.295e9 / timeWindowSeconds;
    } catch (error) {
      logger.error('Error calculating pool hashrate:', error);
      return 0;
    }
  }
  
  /**
   * Calculate rewards for a found block
   */
  private async calculateBlockRewards(blockShare: Share): Promise<void> {
    try {
      // In a real implementation, this would use the PPLNS (Pay Per Last N Shares)
      // or another reward distribution algorithm
      
      // Simplified version here using proportional reward distribution
      // based on shares from the last hour
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
      
      // Get all valid shares from all workers in the time window
      const allShares = await this.storage.getPoolValidShares(startTime, endTime);
      
      if (allShares.length === 0) {
        logger.warn('No shares found for reward calculation');
        return;
      }
      
      // Calculate the total difficulty of all shares
      const totalDifficulty = allShares.reduce((sum, share) => sum + share.difficulty, 0);
      
      // Calculate pool fee
      const poolFee = this.blockReward * (this.poolFeePercent / 100);
      const rewardAfterFee = this.blockReward - poolFee;
      
      // Group shares by worker
      const workerShares: Record<string, Share[]> = {};
      for (const share of allShares) {
        if (!workerShares[share.workerId]) {
          workerShares[share.workerId] = [];
        }
        workerShares[share.workerId].push(share);
      }
      
      // Calculate reward for each worker
      const rewards: Record<string, number> = {};
      for (const workerId in workerShares) {
        const workerTotalDifficulty = workerShares[workerId].reduce(
          (sum, share) => sum + share.difficulty, 0
        );
        
        // Worker's proportion of the reward based on their share of difficulty
        const proportion = workerTotalDifficulty / totalDifficulty;
        rewards[workerId] = rewardAfterFee * proportion;
      }
      
      // Log the rewards
      logger.info(`Block rewards calculated for height ${blockShare.blockHeight}:`);
      for (const workerId in rewards) {
        logger.info(`  ${workerId}: ${rewards[workerId]} BTC`);
      }
      
      // Emit reward calculated event
      this.emit('reward:calculated', {
        blockHeight: blockShare.blockHeight,
        blockHash: blockShare.blockHash,
        totalReward: this.blockReward,
        poolFee,
        workerRewards: rewards,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error calculating block rewards:', error);
    }
  }
  
  /**
   * Get recent shares for a worker
   */
  public async getWorkerShares(workerId: string, minutes: number = 60): Promise<Share[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);
    return this.storage.getWorkerShares(workerId, startTime, endTime);
  }
  
  /**
   * Get recent valid shares for a worker
   */
  public async getWorkerValidShares(workerId: string, minutes: number = 60): Promise<Share[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);
    return this.storage.getWorkerValidShares(workerId, startTime, endTime);
  }
  
  /**
   * Set the current block reward
   */
  public setBlockReward(reward: number): void {
    this.blockReward = reward;
    logger.info(`Block reward updated to ${reward} BTC`);
  }
  
  /**
   * Set the pool fee percentage
   */
  public setPoolFeePercent(percent: number): void {
    this.poolFeePercent = percent;
    logger.info(`Pool fee updated to ${percent}%`);
  }
  
  /**
   * Get blocks found in the given time range
   */
  public async getFoundBlocks(days: number = 7): Promise<Share[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
    return this.storage.getFoundBlocks(startTime, endTime);
  }
}

/**
 * Create a new share processor with in-memory storage
 */
export function createShareProcessor(): ShareProcessor {
  const storage = new MemoryShareStorage();
  return new ShareProcessor(storage);
}
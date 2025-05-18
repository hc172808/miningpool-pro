import { storage } from './storage';
import { User, Settings, Worker } from '@shared/schema';
import { log } from './vite';

// Define a crypto transaction interface
interface CryptoTransaction {
  txId: string;
  amount: number;
  fee: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
}

// Mock cryptocurrency interface to be replaced with real API calls
interface CryptoAPI {
  getBalance(address: string, coin: string): Promise<number>;
  sendTransaction(fromAddress: string, toAddress: string, amount: number, coin: string): Promise<CryptoTransaction>;
  getTransactionStatus(txId: string, coin: string): Promise<'pending' | 'confirmed' | 'failed'>;
}

// Temporary mock implementation - would be replaced with actual blockchain API calls
class CryptoAPIClient implements CryptoAPI {
  async getBalance(address: string, coin: string): Promise<number> {
    // This would connect to a real blockchain API to get address balance
    // For testing, we return a mock balance
    log(`Checking ${coin} balance for ${address}`, 'payout');
    return Math.random() * 1.5; // Mock balance between 0 and 1.5
  }

  async sendTransaction(fromAddress: string, toAddress: string, amount: number, coin: string): Promise<CryptoTransaction> {
    // This would connect to a real blockchain API to send a transaction
    log(`Sending ${amount} ${coin} from ${fromAddress} to ${toAddress}`, 'payout');
    
    // Mock transaction
    return {
      txId: `tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      amount,
      fee: amount * 0.001,
      status: 'pending',
      timestamp: new Date()
    };
  }

  async getTransactionStatus(txId: string, coin: string): Promise<'pending' | 'confirmed' | 'failed'> {
    // This would connect to a real blockchain API to check transaction status
    log(`Checking transaction status for ${txId} (${coin})`, 'payout');
    
    // Simulate 80% success rate, 15% pending, 5% failed
    const rand = Math.random();
    if (rand < 0.8) return 'confirmed';
    if (rand < 0.95) return 'pending';
    return 'failed';
  }
}

export class PayoutProcessor {
  private cryptoClient: CryptoAPI;
  private isProcessing: boolean = false;
  private lastRunTime: Date | null = null;
  private payoutInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.cryptoClient = new CryptoAPIClient();
  }
  
  /**
   * Start automated payout processing at regular intervals
   * @param intervalMinutes How often to run the payout process (in minutes)
   */
  startAutomatedPayouts(intervalMinutes: number = 60) {
    if (this.payoutInterval) {
      clearInterval(this.payoutInterval);
    }
    
    log(`Starting automated payouts every ${intervalMinutes} minutes`, 'payout');
    
    // Run payouts on a schedule
    this.payoutInterval = setInterval(() => {
      this.processAllPendingPayouts()
        .catch(err => log(`Error processing payouts: ${err}`, 'payout-error'));
    }, intervalMinutes * 60 * 1000);
    
    // Run once immediately
    this.processAllPendingPayouts()
      .catch(err => log(`Error processing initial payouts: ${err}`, 'payout-error'));
  }
  
  /**
   * Stop the automated payout process
   */
  stopAutomatedPayouts() {
    if (this.payoutInterval) {
      clearInterval(this.payoutInterval);
      this.payoutInterval = null;
      log('Automated payouts stopped', 'payout');
    }
  }
  
  /**
   * Process all pending payouts for eligible users
   */
  async processAllPendingPayouts() {
    if (this.isProcessing) {
      log('Payout processing already in progress, skipping', 'payout');
      return;
    }
    
    try {
      this.isProcessing = true;
      this.lastRunTime = new Date();
      
      // Get system settings (including minimum payout threshold)
      const settings = await storage.getSettings();
      if (!settings.rewardAddress || !settings.rewardSeedPhrase) {
        log('Admin wallet not configured. Payouts skipped.', 'payout-error');
        return;
      }
      
      // Get all users
      const users = await storage.getAllUsers();
      log(`Processing payouts for ${users.length} users`, 'payout');
      
      // Process each user's pending rewards
      const processedUsers = await Promise.all(
        users.map(user => this.processUserPayout(user, settings))
      );
      
      const successCount = processedUsers.filter(Boolean).length;
      log(`Completed payout processing. ${successCount}/${users.length} users received payouts`, 'payout');
    } catch (error) {
      log(`Error in payout processing: ${error}`, 'payout-error');
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process pending payout for a single user if they've reached the threshold
   */
  async processUserPayout(user: User, settings: Settings): Promise<boolean> {
    try {
      if (!user.walletAddress) {
        log(`User ${user.username} has no wallet address configured`, 'payout');
        return false;
      }
      
      // Get user's current unpaid balance
      const unpaidBalance = await this.calculateUnpaidBalance(user.id);
      if (unpaidBalance <= 0) {
        return false;
      }
      
      // Check if balance meets minimum payout threshold
      if (unpaidBalance < settings.minPayout) {
        log(`User ${user.username} balance (${unpaidBalance.toFixed(8)}) below minimum payout threshold (${settings.minPayout})`, 'payout');
        return false;
      }
      
      // Get user's primary coin for payout
      const primaryCoin = await this.getUserPrimaryCoin(user.id);
      
      // Execute the payout transaction
      log(`Processing payout of ${unpaidBalance} ${primaryCoin} to ${user.username}`, 'payout');
      
      // This would use a real wallet with the seed phrase to send funds
      const transaction = await this.cryptoClient.sendTransaction(
        settings.rewardAddress,
        user.walletAddress,
        unpaidBalance,
        primaryCoin
      );
      
      // Record the payout in our system
      const payout = await storage.createPayout({
        userId: user.id,
        amount: unpaidBalance,
        miningType: 'solo', // Default to solo, could be determined by mining history
        transactionId: transaction.txId,
        coin: primaryCoin
      });
      
      // Set the status after creation since it has a default value of 'pending'
      
      log(`Created payout record #${payout.id} with transaction ${transaction.txId}`, 'payout');
      
      // In a real system, we would monitor the transaction status and update when confirmed
      // For demo, we'll simulate checking the transaction status after a delay
      setTimeout(async () => {
        try {
          const status = await this.cryptoClient.getTransactionStatus(transaction.txId, primaryCoin);
          await storage.updatePayoutStatus(payout.id, status, transaction.txId);
          log(`Updated payout #${payout.id} status to ${status}`, 'payout');
          
          // Notify user via WebSocket if available
          if (global.webSocketHandler) {
            global.webSocketHandler.broadcastToUser(
              user.id,
              { 
                type: 'payout_update',
                data: {
                  payoutId: payout.id,
                  amount: unpaidBalance,
                  status,
                  timestamp: new Date(),
                  coin: primaryCoin
                }
              }
            );
          }
        } catch (error) {
          log(`Error checking transaction status: ${error}`, 'payout-error');
        }
      }, 5000); // Check after 5 seconds for demo purposes
      
      return true;
    } catch (error) {
      log(`Error processing payout for user ${user.username}: ${error}`, 'payout-error');
      return false;
    }
  }
  
  /**
   * Calculate a user's current unpaid mining balance
   */
  async calculateUnpaidBalance(userId: number): Promise<number> {
    // In a real system, this would calculate based on:
    // 1. User's hashrate contribution
    // 2. Blocks found by the pool
    // 3. Previous payouts already made
    // 4. Mining pool fees
    
    try {
      // For demo, we'll use a simplified calculation based on recent hashrate
      const recentStats = await storage.getMiningStats(userId);
      if (!recentStats.length) {
        return 0;
      }
      
      // Get average hashrate from the last 24 hours
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      
      const recentHashrates = recentStats
        .filter(stat => new Date(stat.timestamp) > last24Hours)
        .map(stat => stat.hashrate);
      
      if (!recentHashrates.length) {
        return 0;
      }
      
      const avgHashrate = recentHashrates.reduce((sum, rate) => sum + rate, 0) / recentHashrates.length;
      
      // Get total hours mined
      const miningHours = recentHashrates.length / 6; // Assuming one stat every 10 minutes
      
      // Mock calculation based on hashrate and time
      // In real world, this would be based on actual shares and blocks found
      const estimatedReward = (avgHashrate * miningHours * 0.000001);
      
      // Subtract previous payouts
      const previousPayouts = await storage.getPayouts(userId);
      const totalPaid = previousPayouts
        .filter(payout => payout.status === 'confirmed')
        .reduce((sum, payout) => sum + payout.amount, 0);
      
      // Calculate unpaid balance
      return Math.max(0, estimatedReward - totalPaid);
    } catch (error) {
      log(`Error calculating unpaid balance: ${error}`, 'payout-error');
      return 0;
    }
  }
  
  /**
   * Get the primary cryptocurrency a user mines with
   */
  async getUserPrimaryCoin(userId: number): Promise<'BTC' | 'ETH' | 'XMR' | 'LTC' | 'RVN' | 'ZEC' | 'BCH' | 'DOGE' | 'DASH'> {
    try {
      // Get user's workers
      const workers = await storage.getWorkersByUserId(userId);
      if (!workers.length) {
        return 'BTC'; // Default to BTC if no workers
      }
      
      // Count occurrences of each coin
      const coinCounts: Record<string, number> = {};
      workers.forEach(worker => {
        coinCounts[worker.coin] = (coinCounts[worker.coin] || 0) + 1;
      });
      
      // Find the most used coin
      let mostUsedCoin = 'BTC';
      let highestCount = 0;
      
      Object.entries(coinCounts).forEach(([coin, count]) => {
        if (count > highestCount) {
          highestCount = count;
          mostUsedCoin = coin;
        }
      });
      
      return mostUsedCoin as any;
    } catch (error) {
      log(`Error determining primary coin: ${error}`, 'payout-error');
      return 'BTC'; // Default to BTC on error
    }
  }
  
  /**
   * Get the current status of the payout processor
   */
  getStatus() {
    return {
      isActive: this.payoutInterval !== null,
      isProcessing: this.isProcessing,
      lastRunTime: this.lastRunTime,
    };
  }
  
  /**
   * Manually trigger payout for a specific user
   */
  async manualPayout(userId: number): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        log(`User not found for manual payout: ${userId}`, 'payout-error');
        return false;
      }
      
      const settings = await storage.getSettings();
      return await this.processUserPayout(user, settings);
    } catch (error) {
      log(`Error processing manual payout: ${error}`, 'payout-error');
      return false;
    }
  }
}

// Create a singleton instance
export const payoutProcessor = new PayoutProcessor();
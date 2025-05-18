import { 
  users, User, InsertUser, 
  workers, Worker, InsertWorker,
  miningStats, MiningStat, InsertMiningStat,
  payouts, Payout, InsertPayout,
  settings, Settings, InsertSettings,
  loginAttempts, LoginAttempt, InsertLoginAttempt,
  nodeConfigurations, NodeConfiguration, InsertNodeConfiguration
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import * as bcrypt from 'bcrypt';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  updateUserLastLogin(id: number): Promise<User>;
  
  // Worker methods
  getWorker(id: number): Promise<Worker | undefined>;
  getWorkersByUserId(userId: number): Promise<Worker[]>;
  createWorker(worker: InsertWorker): Promise<Worker>;
  updateWorker(id: number, data: Partial<Worker>): Promise<Worker>;
  updateWorkerStatus(id: number, status: 'online' | 'offline'): Promise<Worker>;
  deleteWorker(id: number): Promise<void>;
  
  // Mining stats methods
  getMiningStats(userId: number, startDate?: Date, endDate?: Date): Promise<MiningStat[]>;
  createMiningStat(stat: InsertMiningStat): Promise<MiningStat>;
  getLatestUserHashrate(userId: number): Promise<number>;
  
  // Payout methods
  getPayouts(userId: number): Promise<Payout[]>;
  createPayout(payout: InsertPayout): Promise<Payout>;
  updatePayoutStatus(id: number, status: 'pending' | 'confirmed' | 'failed', transactionId?: string): Promise<Payout>;
  
  // Settings methods
  getSettings(): Promise<Settings>;
  updateSettings(data: Partial<Settings>): Promise<Settings>;
  
  // Node Configuration methods
  getNodeConfiguration(id: number): Promise<NodeConfiguration | undefined>;
  getNodeConfigurationByCoin(coin: string): Promise<NodeConfiguration | undefined>;
  getAllNodeConfigurations(): Promise<NodeConfiguration[]>;
  createNodeConfiguration(config: InsertNodeConfiguration): Promise<NodeConfiguration>;
  updateNodeConfiguration(id: number, data: Partial<NodeConfiguration>): Promise<NodeConfiguration>;
  updateNodeStatus(id: number, status: Partial<NodeConfiguration>): Promise<NodeConfiguration>;
  deleteNodeConfiguration(id: number): Promise<void>;
  isNodeActuallyRunning(id: number): Promise<boolean>;
  
  // Security methods
  recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getLoginAttempts(ipAddress: string, minutes: number): Promise<LoginAttempt[]>;
  getFailedLoginCount(ipAddress: string, minutes: number): Promise<number>;
  clearOldLoginAttempts(minutes: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.id);
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const [user] = await db.insert(users)
      .values({
        ...userData,
        password: hashedPassword
      })
      .returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    // Check if there's any data to update
    if (Object.keys(data).length === 0) {
      // If no data to update, just return the current user
      const user = await this.getUser(id);
      return user!;
    }
    
    // If password is being updated, hash it
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    const [updatedUser] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserLastLogin(id: number): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Worker methods
  async getWorker(id: number): Promise<Worker | undefined> {
    const [worker] = await db.select().from(workers).where(eq(workers.id, id));
    return worker;
  }

  async getWorkersByUserId(userId: number): Promise<Worker[]> {
    return db.select().from(workers).where(eq(workers.userId, userId));
  }

  async createWorker(worker: InsertWorker): Promise<Worker> {
    const [newWorker] = await db.insert(workers).values(worker).returning();
    return newWorker;
  }

  async updateWorker(id: number, data: Partial<Worker>): Promise<Worker> {
    const [updatedWorker] = await db.update(workers)
      .set(data)
      .where(eq(workers.id, id))
      .returning();
    return updatedWorker;
  }

  async updateWorkerStatus(id: number, status: 'online' | 'offline'): Promise<Worker> {
    const now = new Date();
    const [updatedWorker] = await db.update(workers)
      .set({ 
        status,
        lastSeen: now,
      })
      .where(eq(workers.id, id))
      .returning();
    return updatedWorker;
  }
  
  async deleteWorker(id: number): Promise<void> {
    await db.delete(workers)
      .where(eq(workers.id, id));
  }

  // Mining stats methods
  async getMiningStats(userId: number, startDate?: Date, endDate?: Date): Promise<MiningStat[]> {
    let query = db.select().from(miningStats).where(eq(miningStats.userId, userId));
    
    // Create a where condition array
    const whereConditions = [eq(miningStats.userId, userId)];
    
    if (startDate) {
      whereConditions.push(gte(miningStats.timestamp, startDate));
    }
    
    if (endDate) {
      whereConditions.push(lte(miningStats.timestamp, endDate));
    }
    
    // Apply all conditions with 'and'
    return db.select()
      .from(miningStats)
      .where(and(...whereConditions))
      .orderBy(miningStats.timestamp);
  }

  async createMiningStat(stat: InsertMiningStat): Promise<MiningStat> {
    const [newStat] = await db.insert(miningStats).values(stat).returning();
    return newStat;
  }

  async getLatestUserHashrate(userId: number): Promise<number> {
    const [result] = await db.select({ hashrate: miningStats.hashrate })
      .from(miningStats)
      .where(eq(miningStats.userId, userId))
      .orderBy(desc(miningStats.timestamp))
      .limit(1);
    
    return result?.hashrate || 0;
  }

  // Payout methods
  async getPayouts(userId: number): Promise<Payout[]> {
    return db.select().from(payouts)
      .where(eq(payouts.userId, userId))
      .orderBy(desc(payouts.timestamp));
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const [newPayout] = await db.insert(payouts).values(payout).returning();
    return newPayout;
  }

  async updatePayoutStatus(id: number, status: 'pending' | 'confirmed' | 'failed', transactionId?: string): Promise<Payout> {
    const [updatedPayout] = await db.update(payouts)
      .set({ 
        status,
        ...(transactionId && { transactionId })
      })
      .where(eq(payouts.id, id))
      .returning();
    return updatedPayout;
  }

  // Settings methods
  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).limit(1);
    
    if (!setting) {
      // Create default settings if none exist
      const [newSetting] = await db.insert(settings)
        .values({})
        .returning();
      return newSetting;
    }
    
    return setting;
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    // Get current settings or create if doesn't exist
    const currentSettings = await this.getSettings();
    
    const [updatedSettings] = await db.update(settings)
      .set(data)
      .where(eq(settings.id, currentSettings.id))
      .returning();
    
    return updatedSettings;
  }

  // Security methods
  async recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt> {
    const [newAttempt] = await db.insert(loginAttempts).values(attempt).returning();
    return newAttempt;
  }

  async getLoginAttempts(ipAddress: string, minutes: number): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    return db.select().from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          gte(loginAttempts.timestamp, cutoffTime)
        )
      );
  }

  async getFailedLoginCount(ipAddress: string, minutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    const [result] = await db.select({
      count: count()
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipAddress, ipAddress),
        eq(loginAttempts.successful, false),
        gte(loginAttempts.timestamp, cutoffTime)
      )
    );
    
    return result?.count || 0;
  }

  async clearOldLoginAttempts(minutes: number): Promise<void> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    await db.delete(loginAttempts)
      .where(lte(loginAttempts.timestamp, cutoffTime));
  }

  // Node Configuration methods
  async getNodeConfiguration(id: number): Promise<NodeConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.id, id));
    return config;
  }

  async getNodeConfigurationByCoin(coin: string): Promise<NodeConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(nodeConfigurations)
      .where(eq(nodeConfigurations.coin, coin));
    return config;
  }

  async getAllNodeConfigurations(): Promise<NodeConfiguration[]> {
    return await db.select().from(nodeConfigurations);
  }

  async createNodeConfiguration(config: InsertNodeConfiguration): Promise<NodeConfiguration> {
    const [newConfig] = await db
      .insert(nodeConfigurations)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateNodeConfiguration(id: number, data: Partial<NodeConfiguration>): Promise<NodeConfiguration> {
    const [updatedConfig] = await db
      .update(nodeConfigurations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(nodeConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  async updateNodeStatus(id: number, status: Partial<NodeConfiguration>): Promise<NodeConfiguration> {
    const [updatedConfig] = await db
      .update(nodeConfigurations)
      .set({
        ...status,
        lastUpdated: new Date()
      })
      .where(eq(nodeConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteNodeConfiguration(id: number): Promise<void> {
    await db
      .delete(nodeConfigurations)
      .where(eq(nodeConfigurations.id, id));
  }
  
  /**
   * Check if a node is actually running (beyond just database state)
   * This interacts with the node process tracking system
   */
  async isNodeActuallyRunning(id: number): Promise<boolean> {
    // Import the isNodeRunning function from node-manager.ts
    const { isNodeRunning } = require('../crypto/node-manager');
    
    try {
      // Check if the node is actually running in the node manager
      return isNodeRunning(id);
    } catch (error) {
      console.error(`Error checking if node ${id} is running:`, error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();

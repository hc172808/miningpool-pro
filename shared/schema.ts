import { pgTable, text, serial, integer, boolean, doublePrecision, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const miningTypeEnum = pgEnum('mining_type', ['solo', 'group']);
export const cryptoCoinEnum = pgEnum('crypto_coin', ['BTC', 'ETH', 'XMR', 'LTC', 'RVN', 'ZEC', 'BCH', 'DOGE', 'DASH']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'confirmed', 'failed']);
export const workerStatusEnum = pgEnum('worker_status', ['online', 'offline']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  walletAddress: text("wallet_address").notNull(),
  profileImage: text("profile_image"),
  role: userRoleEnum("role").notNull().default('user'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const usersRelations = relations(users, ({ many }) => ({
  workers: many(workers),
  payouts: many(payouts),
  loginAttempts: many(loginAttempts),
}));

// Workers table
export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  status: workerStatusEnum("status").notNull().default('offline'),
  hashrate: doublePrecision("hashrate").notNull().default(0),
  temperature: integer("temperature"),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  uptime: integer("uptime").notNull().default(0), // in minutes
  coin: cryptoCoinEnum("coin").notNull().default('BTC'),
});

export const workersRelations = relations(workers, ({ one }) => ({
  user: one(users, {
    fields: [workers.userId],
    references: [users.id],
  }),
}));

// Mining Stats table
export const miningStats = pgTable("mining_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  hashrate: doublePrecision("hashrate").notNull(),
  miningType: miningTypeEnum("mining_type").notNull(),
  coin: cryptoCoinEnum("coin").notNull().default('BTC'),
});

export const miningStatsRelations = relations(miningStats, ({ one }) => ({
  user: one(users, {
    fields: [miningStats.userId],
    references: [users.id],
  }),
}));

// Payouts table
export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: doublePrecision("amount").notNull(),
  miningType: miningTypeEnum("mining_type").notNull(),
  status: payoutStatusEnum("status").notNull().default('pending'),
  transactionId: text("transaction_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  coin: cryptoCoinEnum("coin").notNull().default('BTC'),
});

export const payoutsRelations = relations(payouts, ({ one }) => ({
  user: one(users, {
    fields: [payouts.userId],
    references: [users.id],
  }),
}));

// Settings table
export const nodeConfigurations = pgTable("node_configurations", {
  id: serial("id").primaryKey(),
  coin: cryptoCoinEnum("coin").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  cacheSize: integer("cache_size").notNull().default(10), // Cache size in MB
  rpcHost: text("rpc_host"),
  rpcPort: integer("rpc_port"),
  rpcUsername: text("rpc_username"),
  rpcPassword: text("rpc_password"),
  network: text("network").notNull().default("main"), // main, test, or regtest
  autoStart: boolean("auto_start").notNull().default(true),
  dataDir: text("data_dir"),
  lastSyncedBlock: integer("last_synced_block"),
  totalBlocks: integer("total_blocks"),
  connections: integer("connections"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isRunning: boolean("is_running").notNull().default(false),
  isPruned: boolean("is_pruned").notNull().default(true),
  syncPercentage: doublePrecision("sync_percentage").default(0),
  memoryUsageMb: integer("memory_usage_mb").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const nodeConfigurationsRelations = relations(nodeConfigurations, ({ }) => ({
}));

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  soloMiningFee: doublePrecision("solo_mining_fee").notNull().default(0.5),
  groupMiningFee: doublePrecision("group_mining_fee").notNull().default(1.5),
  minPayout: doublePrecision("min_payout").notNull().default(0.005),
  fail2banEnabled: boolean("fail2ban_enabled").notNull().default(true),
  maxLoginAttempts: integer("max_login_attempts").notNull().default(5),
  banDuration: integer("ban_duration").notNull().default(30), // in minutes
  rewardSeedPhrase: text("reward_seed_phrase"),
  rewardAddress: text("reward_address"),
});

// Login attempts for security
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  successful: boolean("successful").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const loginAttemptsRelations = relations(loginAttempts, ({ one }) => ({
  user: one(users, {
    fields: [loginAttempts.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  lastLogin: true 
});

export const insertWorkerSchema = createInsertSchema(workers).omit({ 
  id: true, 
  status: true, 
  hashrate: true, 
  temperature: true, 
  lastSeen: true, 
  uptime: true 
});

export const insertMiningStatSchema = createInsertSchema(miningStats).omit({ 
  id: true, 
  timestamp: true 
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({ 
  id: true, 
  status: true, 
  timestamp: true 
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true }).extend({
  rewardSeedPhrase: z.string().optional(),
  rewardAddress: z.string().optional(),
});

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({ 
  id: true, 
  timestamp: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = z.infer<typeof insertWorkerSchema>;

export type MiningStat = typeof miningStats.$inferSelect;
export type InsertMiningStat = z.infer<typeof insertMiningStatSchema>;

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;

export const insertNodeConfigurationSchema = createInsertSchema(nodeConfigurations).omit({ 
  id: true,
  lastUpdated: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedBlock: true,
  totalBlocks: true,
  connections: true,
  isRunning: true,
  syncPercentage: true,
  memoryUsageMb: true
});

export type NodeConfiguration = typeof nodeConfigurations.$inferSelect;
export type InsertNodeConfiguration = z.infer<typeof insertNodeConfigurationSchema>;

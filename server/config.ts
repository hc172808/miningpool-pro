export const config = {
  // Bitcoin mining pool configuration
  poolWalletAddress: process.env.POOL_WALLET_ADDRESS || 'sample_pool_wallet_address',
  stratumPort: parseInt(process.env.STRATUM_PORT || '3333', 10),
  autoPayoutsEnabled: process.env.AUTO_PAYOUTS_ENABLED !== 'false',
  bitcoin: {
    // Bitcoin node configuration
    dbCache: parseInt(process.env.BITCOIN_DB_CACHE || '450', 10), // UTXO cache size in MB (default 450MB)
    pruneMode: process.env.BITCOIN_PRUNE_MODE === 'true',
    maxConnections: parseInt(process.env.BITCOIN_MAX_CONNECTIONS || '125', 10),
  },
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: '7d',
  dbUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxLoginAttempts: 5,
  loginLockoutTime: 15, // minutes
  uploadDir: './uploads',
  miningScriptsDir: './mining-scripts'
};
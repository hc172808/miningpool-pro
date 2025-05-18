import { db } from './db';
import { nodeConfigurations } from '@shared/schema';

/**
 * Initialize the database with default cryptocurrency node configurations
 */
async function initializeDb() {
  console.log('Initializing database with default node configurations...');
  
  try {
    // Check if we already have node configurations
    const existing = await db.select().from(nodeConfigurations);
    
    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing node configurations. Skipping initialization.`);
      return;
    }
    
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
    
    for (const crypto of cryptos) {
      await db.insert(nodeConfigurations).values({
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
      });
      console.log(`Created configuration for ${crypto.coin}`);
    }
    
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    process.exit(0);
  }
}

// Run the initialization
initializeDb();
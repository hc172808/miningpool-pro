import fs from 'fs';
import path from 'path';
import { Worker, Settings } from '@shared/schema';

/**
 * Generates a mining script based on worker configuration
 * @param worker Worker configuration
 * @param settings Mining settings
 * @param miningType Whether it's 'solo' or 'group' mining
 * @returns The path to the generated script
 */
export async function generateMiningScript(
  worker: Worker,
  settings: Settings,
  miningType: 'solo' | 'group',
  walletAddress: string
): Promise<string> {
  // Read the template script
  const templatePath = path.join(process.cwd(), 'mining-scripts', 'template.sh');
  const scriptTemplate = fs.readFileSync(templatePath, 'utf-8');
  
  // Get the appropriate mining fee based on type
  const miningFee = miningType === 'solo' 
    ? settings.soloMiningFee.toString() 
    : settings.groupMiningFee.toString();
  
  // Generate pool URL based on coin and mining type
  const poolUrl = `stratum+tcp://${worker.coin.toLowerCase()}.${miningType}.pool.example.com:3333`;
  
  // Replace placeholders in the template
  let scriptContent = scriptTemplate
    .replace(/%DATE%/g, new Date().toISOString())
    .replace(/%TYPE%/g, miningType)
    .replace(/%COIN%/g, worker.coin)
    .replace(/%WORKER_NAME%/g, worker.name)
    .replace(/%WALLET_ADDRESS%/g, walletAddress)
    .replace(/%POOL_URL%/g, poolUrl)
    .replace(/%MINING_FEE%/g, miningFee);
  
  // Create a unique filename
  const filename = `${worker.coin.toLowerCase()}_${miningType}_${worker.name}_${Date.now()}.sh`;
  const scriptPath = path.join(process.cwd(), 'mining-scripts', filename);
  
  // Write the script to disk
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 }); // Make executable
  
  return filename;
}
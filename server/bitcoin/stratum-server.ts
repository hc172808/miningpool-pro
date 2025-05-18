import * as net from 'net';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { BitcoinNode } from './node';

/**
 * Implementation of the Stratum mining protocol for Bitcoin
 * This allows miners to connect to our pool and receive work
 */
export class StratumServer extends EventEmitter {
  private server: net.Server;
  private clients: Map<string, StratumClient> = new Map();
  private bitcoinNode: BitcoinNode;
  private difficulty: number = 1;
  private jobId: number = 0;
  private currentBlockTemplate: any = null;
  private extraNonce1Size: number = 4; // Size in bytes
  private extraNonce2Size: number = 4; // Size in bytes
  
  constructor(bitcoinNode: BitcoinNode, port: number = 3333) {
    super();
    this.bitcoinNode = bitcoinNode;
    this.server = net.createServer(socket => this.handleConnection(socket));
    this.server.listen(port, () => {
      logger.info(`Stratum server listening on port ${port}`);
    });
    
    this.initializeBlockPolling();
  }
  
  /**
   * Handle a new miner connection
   */
  private handleConnection(socket: net.Socket): void {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info(`New miner connection from ${clientId}`);
    
    // Generate unique extraNonce1 for this client
    const extraNonce1 = this.generateExtraNonce1();
    
    // Create a new client instance
    const client = new StratumClient(socket, clientId, extraNonce1, this.extraNonce2Size);
    this.clients.set(clientId, client);
    
    // Set up event listeners
    client.on('subscription', () => this.handleSubscription(client));
    client.on('authorization', (username, password) => this.handleAuthorization(client, username, password));
    client.on('submit', (params) => this.handleSubmit(client, params));
    client.on('close', () => this.handleDisconnect(client));
    
    // Start processing client messages
    client.start();
  }
  
  /**
   * Handle subscription request from a miner
   */
  private handleSubscription(client: StratumClient): void {
    // Send subscription response
    client.sendSubscriptionResponse(client.extraNonce1, this.extraNonce2Size);
    
    // If we have a current block template, send initial job
    if (this.currentBlockTemplate) {
      this.sendJob(client);
    }
  }
  
  /**
   * Handle authorization request from a miner
   */
  private handleAuthorization(client: StratumClient, username: string, password: string): void {
    // In a real implementation, we would validate username/password against our database
    // For this example, we'll accept all connections
    client.authorize(true, username);
    logger.info(`Miner ${client.id} authorized as ${username}`);
    
    // Emit worker connected event for tracking
    this.emit('worker:connected', {
      workerId: username,
      ip: client.getIp(),
      timestamp: new Date()
    });
  }
  
  /**
   * Handle share submission from a miner
   */
  private handleSubmit(client: StratumClient, params: any): void {
    // Extract submission parameters
    const [workername, jobId, extraNonce2, nTime, nonce] = params;
    
    // Validate submission (in a real implementation, this would be much more complex)
    const isValid = this.validateShare(client, jobId, extraNonce2, nTime, nonce);
    
    // Record share in database (in real implementation)
    const shareData = {
      workerId: workername,
      ip: client.getIp(),
      timestamp: new Date(),
      difficulty: this.difficulty,
      isValid
    };
    
    // Emit share submitted event for tracking
    this.emit('share:submitted', shareData);
    
    // Respond to client
    client.shareResponse(isValid);
    
    if (isValid) {
      logger.info(`Valid share submitted by ${client.id}, worker: ${workername}`);
      
      // Check if this share meets the network difficulty and could be a block
      const isBlock = this.checkBlockSolution(jobId, extraNonce2, nTime, nonce);
      if (isBlock) {
        logger.info(`BLOCK FOUND by ${client.id}, worker: ${workername}!!!`);
        
        // Submit block to Bitcoin network (in real implementation)
        this.submitBlockToNetwork(jobId, extraNonce2, nTime, nonce);
        
        // Emit block found event
        this.emit('block:found', {
          workerId: workername,
          height: this.currentBlockTemplate?.height,
          hash: 'block_hash_would_be_here', // In real implementation
          timestamp: new Date()
        });
      }
    } else {
      logger.warn(`Invalid share submitted by ${client.id}, worker: ${workername}`);
    }
  }
  
  /**
   * Handle client disconnection
   */
  private handleDisconnect(client: StratumClient): void {
    this.clients.delete(client.id);
    logger.info(`Miner ${client.id} disconnected`);
    
    // Emit worker disconnected event for tracking
    this.emit('worker:disconnected', {
      workerId: client.username,
      ip: client.getIp(),
      timestamp: new Date()
    });
  }
  
  /**
   * Poll for new block templates periodically
   */
  private initializeBlockPolling(): void {
    // Poll for new block templates every 5 seconds
    setInterval(async () => {
      try {
        const blockTemplate = await this.bitcoinNode.getBlockTemplate();
        
        // Check if this is a new template
        if (!this.currentBlockTemplate || 
            this.currentBlockTemplate.previousblockhash !== blockTemplate.previousblockhash) {
          logger.info(`New block template received, height: ${blockTemplate.height}`);
          
          this.currentBlockTemplate = blockTemplate;
          this.jobId++;
          
          // Send new jobs to all connected miners
          this.broadcastJob();
        }
      } catch (error) {
        logger.error('Failed to get new block template:', error);
      }
    }, 5000);
    
    // Update network difficulty periodically
    setInterval(async () => {
      try {
        this.difficulty = await this.bitcoinNode.getDifficulty();
        logger.info(`Updated network difficulty: ${this.difficulty}`);
      } catch (error) {
        logger.error('Failed to update network difficulty:', error);
      }
    }, 60000);
  }
  
  /**
   * Send job to all connected clients
   */
  private broadcastJob(): void {
    for (const client of this.clients.values()) {
      if (client.isSubscribed) {
        this.sendJob(client);
      }
    }
  }
  
  /**
   * Send job to a specific client
   */
  private sendJob(client: StratumClient): void {
    // In a real implementation, we would create proper job parameters
    // based on the current block template
    const jobParams = this.createJobParams();
    client.sendJob(jobParams);
  }
  
  /**
   * Create mining job parameters from current block template
   */
  private createJobParams(): any[] {
    // In a real implementation, this would create the actual mining job
    // parameters based on the block template
    const jobParams = [
      `${this.jobId}`,                  // Job ID
      this.currentBlockTemplate.previousblockhash, // Previous block hash
      '01000000010000000000000000000000000000000000000000000000000000000000000000', // Coinbase part 1
      '0000000000000000000000000000000000000000000000000000000000000000', // Coinbase part 2
      [                              // Merkle branch
        '51c3d0c6072ff0354d37b9f71850f8764e34bac2671362279495a7f1be2f55f7'
      ],
      '00000002',                    // Version
      '1a44b9f2',                    // Bits (difficulty target)
      this.currentBlockTemplate.curtime,  // Current time
      false                          // Clean jobs flag
    ];
    
    return jobParams;
  }
  
  /**
   * Validate a share submission
   */
  private validateShare(client: StratumClient, jobId: string, extraNonce2: string, nTime: string, nonce: string): boolean {
    // In a real implementation, this would perform actual validation
    // of the submitted share against the job parameters
    
    // For this example, we'll do minimal validation
    if (jobId !== `${this.jobId}`) {
      logger.warn(`Invalid job ID in share: ${jobId}, current: ${this.jobId}`);
      return false;
    }
    
    // Here we would check the proof of work, but that requires full implementation
    // For demo, randomly accept ~95% of shares
    return Math.random() > 0.05;
  }
  
  /**
   * Check if a share meets the network difficulty to be a block
   */
  private checkBlockSolution(jobId: string, extraNonce2: string, nTime: string, nonce: string): boolean {
    // In a real implementation, this would check if the share meets
    // the full network difficulty
    
    // For this example, we'll simulate a low chance of finding a block
    return Math.random() < 0.001; // 0.1% chance
  }
  
  /**
   * Submit a block to the Bitcoin network
   */
  private async submitBlockToNetwork(jobId: string, extraNonce2: string, nTime: string, nonce: string): Promise<void> {
    try {
      // In a real implementation, we would reconstruct the full block
      // from the submission parameters and submit it to the network
      
      // This is a placeholder for demonstration purposes
      const blockHex = 'block_hex_would_be_constructed_here';
      await this.bitcoinNode.submitBlock(blockHex);
    } catch (error) {
      logger.error('Failed to submit block to network:', error);
    }
  }
  
  /**
   * Generate a unique extraNonce1 for a client
   */
  private generateExtraNonce1(): string {
    // Generate a random extraNonce1 in hexadecimal
    return crypto.randomBytes(this.extraNonce1Size).toString('hex');
  }
  
  /**
   * Get count of connected miners
   */
  public getConnectedMinersCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get information about connected miners
   */
  public getConnectedMiners(): any[] {
    const miners = [];
    for (const client of this.clients.values()) {
      miners.push({
        id: client.id,
        ip: client.getIp(),
        username: client.username,
        authorized: client.isAuthorized,
        connected: client.isConnected,
        lastActivity: client.lastActivity
      });
    }
    return miners;
  }
  
  /**
   * Stop the Stratum server
   */
  public stop(): void {
    this.server.close(() => {
      logger.info('Stratum server stopped');
    });
    
    // Close all client connections
    for (const client of this.clients.values()) {
      client.disconnect();
    }
  }
}

/**
 * Class representing a connected Stratum miner
 */
class StratumClient extends EventEmitter {
  public id: string;
  public extraNonce1: string;
  public extraNonce2Size: number;
  public isSubscribed: boolean = false;
  public isAuthorized: boolean = false;
  public username: string = '';
  public isConnected: boolean = true;
  public lastActivity: Date = new Date();
  
  private socket: net.Socket;
  private buffer: string = '';
  private messageId: number = 1;
  
  constructor(socket: net.Socket, id: string, extraNonce1: string, extraNonce2Size: number) {
    super();
    this.socket = socket;
    this.id = id;
    this.extraNonce1 = extraNonce1;
    this.extraNonce2Size = extraNonce2Size;
    
    // Set up event handlers
    this.socket.on('data', data => this.handleData(data));
    this.socket.on('close', () => this.handleClose());
    this.socket.on('error', error => this.handleError(error));
  }
  
  /**
   * Start processing client messages
   */
  public start(): void {
    // Send mining.notify subscription first to establish the session
    this.sendNotification('mining.set_difficulty', [8]);
  }
  
  /**
   * Handle incoming data from client
   */
  private handleData(data: Buffer): void {
    this.lastActivity = new Date();
    this.buffer += data.toString();
    
    // Process complete messages
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const message = this.buffer.substring(0, newlineIndex);
      this.buffer = this.buffer.substring(newlineIndex + 1);
      
      if (message.trim()) {
        this.handleMessage(message);
      }
    }
  }
  
  /**
   * Handle a complete JSON-RPC message
   */
  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      
      // Handle different message types
      if (parsed.method === 'mining.subscribe') {
        this.isSubscribed = true;
        this.emit('subscription');
      } else if (parsed.method === 'mining.authorize') {
        const [username, password] = parsed.params;
        this.emit('authorization', username, password);
      } else if (parsed.method === 'mining.submit') {
        this.emit('submit', parsed.params);
      } else {
        logger.warn(`Unknown method from ${this.id}: ${parsed.method}`);
      }
    } catch (error) {
      logger.error(`Failed to parse message from ${this.id}: ${message}`, error);
    }
  }
  
  /**
   * Handle socket close event
   */
  private handleClose(): void {
    this.isConnected = false;
    this.emit('close');
  }
  
  /**
   * Handle socket error event
   */
  private handleError(error: Error): void {
    logger.error(`Socket error for ${this.id}:`, error);
  }
  
  /**
   * Send subscription response
   */
  public sendSubscriptionResponse(extraNonce1: string, extraNonce2Size: number): void {
    this.sendResponse('mining.subscribe', [
      [
        ["mining.set_difficulty", "1"],
        ["mining.notify", "1"]
      ],
      extraNonce1,
      extraNonce2Size
    ]);
  }
  
  /**
   * Set authorization status
   */
  public authorize(authorized: boolean, username: string): void {
    this.isAuthorized = authorized;
    this.username = username;
    this.sendResponse('mining.authorize', authorized);
  }
  
  /**
   * Send share response
   */
  public shareResponse(accepted: boolean): void {
    this.sendResponse('mining.submit', accepted);
  }
  
  /**
   * Send job notification
   */
  public sendJob(params: any[]): void {
    this.sendNotification('mining.notify', params);
  }
  
  /**
   * Send JSON-RPC response
   */
  public sendResponse(method: string, result: any): void {
    const response = {
      id: this.messageId++,
      result: result,
      error: null
    };
    
    this.send(response);
  }
  
  /**
   * Send JSON-RPC notification
   */
  public sendNotification(method: string, params: any[]): void {
    const notification = {
      id: null,
      method: method,
      params: params
    };
    
    this.send(notification);
  }
  
  /**
   * Send data to client
   */
  private send(data: any): void {
    if (this.isConnected) {
      const message = JSON.stringify(data) + '\n';
      this.socket.write(message);
    }
  }
  
  /**
   * Disconnect the client
   */
  public disconnect(): void {
    if (this.isConnected) {
      this.socket.end();
      this.isConnected = false;
    }
  }
  
  /**
   * Get client IP address
   */
  public getIp(): string {
    return this.socket.remoteAddress || 'unknown';
  }
}

/**
 * Create a new Stratum server instance
 */
export function createStratumServer(bitcoinNode: BitcoinNode, port: number = 3333): StratumServer {
  return new StratumServer(bitcoinNode, port);
}
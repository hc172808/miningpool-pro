import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './utils/logger';

// Define message types
export enum MessageType {
  WORKER_CONNECTED = 'worker:connected',
  WORKER_DISCONNECTED = 'worker:disconnected',
  SHARE_SUBMITTED = 'share:submitted',
  HASHRATE_UPDATE = 'hashrate:update',
  BLOCK_FOUND = 'block:found',
  PAYOUT_CREATED = 'payout:created',
  PAYOUT_COMPLETED = 'payout:completed',
  PAYOUT_FAILED = 'payout:failed',
  POOL_STATS_UPDATE = 'pool:stats'
}

// Interface for websocket messages
export interface WebSocketMessage {
  type: MessageType;
  data: any;
  timestamp: number;
}

/**
 * Manages WebSocket connections for real-time updates
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private authTokens: Map<string, number> = new Map(); // Map token to userId

  constructor(server: Server) {
    // Create WebSocket server on a separate path from Vite's HMR websocket
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      clientTracking: true 
    });

    this.setupEventHandlers();
    logger.info('WebSocket server initialized');
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
      logger.info(`New WebSocket connection: ${clientId}`);

      // Create client connection
      const client = new ClientConnection(ws, clientId);
      this.clients.set(clientId, client);

      // Handle client messages
      ws.on('message', (message) => {
        this.handleClientMessage(client, message.toString());
      });

      // Handle client disconnection
      ws.on('close', () => {
        logger.info(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });

      // Send initial connection confirmation
      client.send({
        type: MessageType.POOL_STATS_UPDATE,
        data: {
          connected: true,
          miners: this.clients.size,
          poolHashrate: 0, // This would be fetched from the pool stats
          blocksFound: 0,  // This would be fetched from the pool stats
        },
        timestamp: Date.now()
      });
    });
  }

  /**
   * Handle incoming client message
   */
  private handleClientMessage(client: ClientConnection, messageData: string): void {
    try {
      const message = JSON.parse(messageData);

      if (message.type === 'auth') {
        // Handle authentication (in a real implementation, verify token against your auth system)
        if (message.token && this.authTokens.has(message.token)) {
          const userId = this.authTokens.get(message.token);
          client.setUserId(userId!);
          client.setAuthenticated(true);
          logger.info(`Client ${client.id} authenticated for user ${userId}`);
          
          client.send({
            type: 'auth:success',
            data: { userId },
            timestamp: Date.now()
          });
        } else {
          client.send({
            type: 'auth:failed',
            data: { error: 'Invalid authentication token' },
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'subscribe') {
        // Handle subscription to specific events
        if (Array.isArray(message.channels)) {
          client.setSubscriptions(message.channels);
          logger.info(`Client ${client.id} subscribed to channels: ${message.channels.join(', ')}`);
          
          client.send({
            type: 'subscribe:success',
            data: { channels: message.channels },
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Register an authentication token for a user
   */
  public registerAuthToken(token: string, userId: number): void {
    this.authTokens.set(token, userId);
  }

  /**
   * Revoke an authentication token
   */
  public revokeAuthToken(token: string): void {
    this.authTokens.delete(token);
  }

  /**
   * Broadcast a message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    const serialized = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.isConnected() && client.isSubscribedTo(message.type)) {
        client.getSocket().send(serialized);
      }
    }
  }

  /**
   * Send a message to a specific user's connections
   */
  public sendToUser(userId: number, message: WebSocketMessage): void {
    const serialized = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.isConnected() && 
          client.isAuthenticated() && 
          client.getUserId() === userId &&
          client.isSubscribedTo(message.type)) {
        client.getSocket().send(serialized);
      }
    }
  }

  /**
   * Update pool statistics
   */
  public updatePoolStats(stats: {
    connectedMiners: number;
    poolHashrate: number;
    blocksFound: number;
    activeWorkers: number;
  }): void {
    this.broadcast({
      type: MessageType.POOL_STATS_UPDATE,
      data: stats,
      timestamp: Date.now()
    });
  }

  /**
   * Close the WebSocket server
   */
  public close(): void {
    this.wss.close((err) => {
      if (err) {
        logger.error('Error closing WebSocket server:', err);
      } else {
        logger.info('WebSocket server closed');
      }
    });
  }

  /**
   * Get count of connected clients
   */
  public getConnectedCount(): number {
    return this.clients.size;
  }
}

/**
 * Represents a connected WebSocket client
 */
class ClientConnection {
  private socket: WebSocket;
  private authenticated: boolean = false;
  private userId: number | null = null;
  private subscriptions: string[] = []; // Channels the client is subscribed to

  constructor(socket: WebSocket, public id: string) {
    this.socket = socket;
  }

  /**
   * Send a message to the client
   */
  public send(message: WebSocketMessage): void {
    if (this.isConnected()) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Check if the client is connected
   */
  public isConnected(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Set the user ID for this connection
   */
  public setUserId(userId: number): void {
    this.userId = userId;
  }

  /**
   * Get the user ID for this connection
   */
  public getUserId(): number | null {
    return this.userId;
  }

  /**
   * Set whether this connection is authenticated
   */
  public setAuthenticated(authenticated: boolean): void {
    this.authenticated = authenticated;
  }

  /**
   * Check if this connection is authenticated
   */
  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Set the channels this client is subscribed to
   */
  public setSubscriptions(channels: string[]): void {
    this.subscriptions = channels;
  }

  /**
   * Add a subscription to a channel
   */
  public addSubscription(channel: string): void {
    if (!this.subscriptions.includes(channel)) {
      this.subscriptions.push(channel);
    }
  }

  /**
   * Remove a subscription to a channel
   */
  public removeSubscription(channel: string): void {
    this.subscriptions = this.subscriptions.filter(c => c !== channel);
  }

  /**
   * Check if this client is subscribed to a channel
   */
  public isSubscribedTo(channel: string): boolean {
    return this.subscriptions.length === 0 || this.subscriptions.includes(channel);
  }

  /**
   * Get the WebSocket for this connection
   */
  public getSocket(): WebSocket {
    return this.socket;
  }
}

/**
 * Create a WebSocket manager
 */
export function createWebSocketManager(server: Server): WebSocketManager {
  return new WebSocketManager(server);
}
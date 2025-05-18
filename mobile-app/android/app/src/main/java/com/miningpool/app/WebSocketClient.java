package com.miningpool.app;

import android.util.Log;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * WebSocket client for real-time communication with the mining server
 */
public class WebSocketClient {
    private static final String TAG = "WebSocketClient";
    private static final int NORMAL_CLOSURE_STATUS = 1000;
    
    private OkHttpClient client;
    private WebSocket webSocket;
    private URI serverUri;
    private boolean connected = false;
    
    public WebSocketClient(URI serverUri) {
        this.serverUri = serverUri;
        
        // Configure OkHttp client with appropriate timeouts
        client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .pingInterval(25, TimeUnit.SECONDS) // Keep connection alive
                .build();
    }
    
    /**
     * Connect to the WebSocket server
     */
    public void connect() {
        Request request = new Request.Builder()
                .url(serverUri.toString())
                .build();
        
        WebSocketListener listener = new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                connected = true;
                onOpen();
            }
            
            @Override
            public void onMessage(WebSocket webSocket, String text) {
                onMessage(text);
            }
            
            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                // Not handling binary messages in this implementation
            }
            
            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                connected = false;
                onClose(code, reason);
            }
            
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                connected = false;
                onError(new Exception(t));
            }
        };
        
        webSocket = client.newWebSocket(request, listener);
    }
    
    /**
     * Send a text message to the server
     */
    public void send(String message) {
        if (webSocket != null && connected) {
            webSocket.send(message);
        } else {
            Log.w(TAG, "Cannot send message: WebSocket not connected");
        }
    }
    
    /**
     * Send a binary message to the server
     */
    public void send(ByteBuffer bytes) {
        if (webSocket != null && connected) {
            webSocket.send(ByteString.of(bytes));
        } else {
            Log.w(TAG, "Cannot send binary message: WebSocket not connected");
        }
    }
    
    /**
     * Close the WebSocket connection
     */
    public void close() {
        if (webSocket != null) {
            webSocket.close(NORMAL_CLOSURE_STATUS, "Closed by user");
        }
        connected = false;
    }
    
    /**
     * Check if the WebSocket is connected
     */
    public boolean isConnected() {
        return connected;
    }
    
    // These methods should be overridden by subclasses
    
    /**
     * Called when the connection is established
     */
    public void onOpen() {
        Log.d(TAG, "WebSocket connection opened");
    }
    
    /**
     * Called when a message is received
     */
    public void onMessage(String message) {
        Log.d(TAG, "WebSocket message received: " + message);
    }
    
    /**
     * Called when the connection is closed
     */
    public void onClose(int code, String reason) {
        Log.d(TAG, "WebSocket connection closed: " + reason);
    }
    
    /**
     * Called when an error occurs
     */
    public void onError(Exception e) {
        Log.e(TAG, "WebSocket error: " + e.getMessage());
    }
}
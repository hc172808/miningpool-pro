package com.miningpool.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Handles buffering of mining results when operating in offline mode
 * When the connection is restored, the buffered data is sent to the server
 */
public class OfflineMiningBuffer {
    private static final String TAG = "OfflineMiningBuffer";
    private static final String BUFFER_FILENAME = "offline_mining_buffer.json";
    private static final String PREFS_NAME = "mining_buffer_prefs";
    private static final int MAX_BUFFER_SIZE = 1000; // Maximum number of results to buffer
    
    private Context context;
    private List<JSONObject> resultsBuffer;
    private SharedPreferences prefs;
    
    public OfflineMiningBuffer(Context context) {
        this.context = context;
        this.resultsBuffer = new ArrayList<>();
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        // Load any existing buffer from disk
        loadBuffer();
    }
    
    /**
     * Add a mining result to the buffer
     */
    public void addResult(String coin, float hashrate, boolean accepted) {
        try {
            JSONObject result = new JSONObject();
            result.put("coin", coin);
            result.put("hashrate", hashrate);
            result.put("accepted", accepted);
            result.put("timestamp", System.currentTimeMillis());
            
            // Add to buffer
            resultsBuffer.add(result);
            
            // Enforce buffer size limit
            if (resultsBuffer.size() > MAX_BUFFER_SIZE) {
                resultsBuffer.remove(0); // Remove oldest entry
            }
            
            // Save the updated buffer
            saveBuffer();
            
            Log.d(TAG, "Added result to offline buffer: " + result.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error adding result to buffer", e);
        }
    }
    
    /**
     * Send all buffered data to the server via WebSocket
     */
    public void sendBufferedData(WebSocketClient client) {
        if (client == null || !client.isConnected() || resultsBuffer.isEmpty()) {
            return;
        }
        
        try {
            // Create a bulk update message
            JSONObject message = new JSONObject();
            message.put("type", "BULK_MINING_RESULTS");
            
            // Add all buffered results
            JSONArray resultsArray = new JSONArray();
            for (JSONObject result : resultsBuffer) {
                resultsArray.put(result);
            }
            message.put("data", resultsArray);
            
            // Send the message
            client.send(message.toString());
            
            Log.d(TAG, "Sent " + resultsBuffer.size() + " buffered results to server");
            
            // Clear the buffer after successful send
            resultsBuffer.clear();
            saveBuffer();
        } catch (JSONException e) {
            Log.e(TAG, "Error sending buffered data", e);
        }
    }
    
    /**
     * Save the buffer to disk
     */
    private void saveBuffer() {
        try {
            // Convert buffer to JSON
            JSONArray bufferArray = new JSONArray();
            for (JSONObject result : resultsBuffer) {
                bufferArray.put(result);
            }
            
            // Save to file
            File bufferFile = new File(context.getFilesDir(), BUFFER_FILENAME);
            FileOutputStream fos = new FileOutputStream(bufferFile);
            fos.write(bufferArray.toString().getBytes(StandardCharsets.UTF_8));
            fos.close();
            
            // Update last save time
            prefs.edit().putLong("last_buffer_save", System.currentTimeMillis()).apply();
        } catch (IOException | JSONException e) {
            Log.e(TAG, "Error saving buffer", e);
        }
    }
    
    /**
     * Load the buffer from disk
     */
    private void loadBuffer() {
        try {
            File bufferFile = new File(context.getFilesDir(), BUFFER_FILENAME);
            if (!bufferFile.exists()) {
                return;
            }
            
            // Read file
            FileInputStream fis = new FileInputStream(bufferFile);
            byte[] data = new byte[(int) bufferFile.length()];
            fis.read(data);
            fis.close();
            
            // Parse JSON
            String json = new String(data, StandardCharsets.UTF_8);
            JSONArray bufferArray = new JSONArray(json);
            
            // Load into buffer
            resultsBuffer.clear();
            for (int i = 0; i < bufferArray.length(); i++) {
                resultsBuffer.add(bufferArray.getJSONObject(i));
            }
            
            Log.d(TAG, "Loaded " + resultsBuffer.size() + " results from buffer");
        } catch (IOException | JSONException e) {
            Log.e(TAG, "Error loading buffer", e);
        }
    }
    
    /**
     * Get the current buffer size
     */
    public int getBufferSize() {
        return resultsBuffer.size();
    }
    
    /**
     * Clear the buffer
     */
    public void clearBuffer() {
        resultsBuffer.clear();
        saveBuffer();
    }
    
    /**
     * Get the estimated earnings from buffered results
     */
    public double getEstimatedEarnings(String coin, double coinPrice) {
        // Calculate earnings based on accepted shares
        double totalShares = 0;
        
        for (JSONObject result : resultsBuffer) {
            try {
                if (result.getString("coin").equals(coin) && result.getBoolean("accepted")) {
                    totalShares++;
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error calculating earnings", e);
            }
        }
        
        // Simple estimate: each share is worth a fraction of the coin
        // In a real implementation, this would use difficulty and network hashrate
        return totalShares * 0.0001 * coinPrice;
    }
}
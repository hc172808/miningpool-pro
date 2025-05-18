package com.miningpool.app;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.util.Log;

/**
 * Manages battery monitoring and optimization for mobile mining
 */
public class BatteryManager {
    private static final String TAG = "BatteryManager";
    
    private Context context;
    private boolean monitoring = false;
    private int batteryLevel = 100;
    private boolean isCharging = false;
    private float batteryTemperature = 0;
    
    private static final int LOW_BATTERY_THRESHOLD = 20; // 20% battery level
    private static final int CRITICAL_BATTERY_THRESHOLD = 10; // 10% battery level
    private static final float HIGH_TEMPERATURE_THRESHOLD = 40.0f; // 40°C
    
    public BatteryManager(Context context) {
        this.context = context;
    }
    
    /**
     * Start monitoring battery status
     */
    public void startMonitoring() {
        monitoring = true;
        updateBatteryInfo();
        Log.d(TAG, "Battery monitoring started");
    }
    
    /**
     * Stop monitoring battery status
     */
    public void stopMonitoring() {
        monitoring = false;
        Log.d(TAG, "Battery monitoring stopped");
    }
    
    /**
     * Update battery information
     */
    public void updateBatteryInfo() {
        if (!monitoring) {
            return;
        }
        
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent batteryStatus = context.registerReceiver(null, ifilter);
        
        if (batteryStatus != null) {
            // Get battery level
            int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            batteryLevel = (int) ((level / (float) scale) * 100);
            
            // Get charging status
            int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || 
                         status == BatteryManager.BATTERY_STATUS_FULL;
            
            // Get battery temperature
            int temp = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1);
            batteryTemperature = temp / 10.0f; // Convert to degrees Celsius
            
            Log.d(TAG, "Battery update: Level=" + batteryLevel + "%, Charging=" + isCharging + 
                      ", Temperature=" + batteryTemperature + "°C");
        }
    }
    
    /**
     * Check if power should be reduced based on battery state
     */
    public boolean shouldReducePower() {
        updateBatteryInfo();
        
        // Don't reduce power if charging
        if (isCharging) {
            return false;
        }
        
        // Reduce power if battery is low or temperature is high
        return batteryLevel <= LOW_BATTERY_THRESHOLD || batteryTemperature >= HIGH_TEMPERATURE_THRESHOLD;
    }
    
    /**
     * Check if mining should be stopped to protect the battery
     */
    public boolean shouldStopMining() {
        updateBatteryInfo();
        
        // Don't stop if charging, unless temperature is critically high
        if (isCharging && batteryTemperature < 45.0f) {
            return false;
        }
        
        // Stop if battery is critically low or temperature is very high
        return batteryLevel <= CRITICAL_BATTERY_THRESHOLD || batteryTemperature >= 45.0f;
    }
    
    /**
     * Get the current battery level
     */
    public int getBatteryLevel() {
        return batteryLevel;
    }
    
    /**
     * Check if the device is currently charging
     */
    public boolean isCharging() {
        return isCharging;
    }
    
    /**
     * Get the current battery temperature
     */
    public float getBatteryTemperature() {
        return batteryTemperature;
    }
}
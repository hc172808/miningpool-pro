package com.miningpool.app;

import android.os.Bundle;
import android.content.Intent;
import android.view.WindowManager;
import android.os.PowerManager;
import android.content.Context;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class MainActivity extends AppCompatActivity {
    private static final String CHANNEL_ID = "mining_channel";
    private static final int NOTIFICATION_ID = 1;
    private PowerManager.WakeLock wakeLock;
    private MiningService miningService;
    private boolean miningActive = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Create notification channel for mining service
        createNotificationChannel();
        
        // Initialize mining service
        miningService = new MiningService();
        
        // Keep screen on while mining
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        
        // Acquire wake lock to keep CPU running when screen is off
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiningPool:MiningWakeLock");
    }

    // Start mining with specific settings
    public void startMining(String coin, String walletAddress, boolean soloMining) {
        if (!miningActive) {
            // Acquire wake lock to prevent CPU sleep during mining
            wakeLock.acquire();
            
            // Start mining service in background
            Intent serviceIntent = new Intent(this, MiningService.class);
            serviceIntent.putExtra("coin", coin);
            serviceIntent.putExtra("wallet", walletAddress);
            serviceIntent.putExtra("solo", soloMining);
            startService(serviceIntent);
            
            // Show notification
            showMiningNotification(coin);
            
            miningActive = true;
            
            // Detect hardware capabilities for optimal mining
            HardwareAnalyzer.analyzeHardware(this, result -> {
                // Adjust mining parameters based on hardware
                miningService.optimizeForHardware(result);
                
                // Show hardware details to user
                Toast.makeText(this, "Mining optimized for: " + result.getGpuModel(), Toast.LENGTH_LONG).show();
            });
        }
    }

    // Stop mining
    public void stopMining() {
        if (miningActive) {
            // Release wake lock
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
            
            // Stop service
            Intent serviceIntent = new Intent(this, MiningService.class);
            stopService(serviceIntent);
            
            // Cancel notification
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            notificationManager.cancel(NOTIFICATION_ID);
            
            miningActive = false;
        }
    }
    
    // Create notification channel for Android 8.0+
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Mining Service";
            String description = "Notifications for the cryptocurrency mining service";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
    
    // Show persistent notification while mining
    private void showMiningNotification(String coin) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_mining)
            .setContentTitle("Mining " + coin)
            .setContentText("Mining in progress. Tap to view stats.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOngoing(true);
            
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopMining();
    }
}
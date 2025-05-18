package com.miningpool.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.AsyncTask;
import android.os.Build;
import android.util.Log;
import java.util.List;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * This class analyzes the hardware capabilities of the device to optimize mining performance
 */
public class HardwareAnalyzer {
    private static final String TAG = "HardwareAnalyzer";
    
    /**
     * Interface for callback when hardware analysis is complete
     */
    public interface HardwareAnalysisCallback {
        void onAnalysisComplete(Result result);
    }
    
    /**
     * Result class containing the hardware information
     */
    public static class Result {
        private String gpuModel = "Unknown";
        private String cpuModel = "Unknown";
        private int cpuCores = 1;
        private int memory = 0; // in MB
        private int gpuMemory = 0; // in MB
        private boolean supportsCuda = false;
        private boolean supportsOpenCL = false;
        private String processingUnit = "CPU"; // "CPU" or "GPU"
        
        public String getGpuModel() {
            return gpuModel;
        }
        
        public String getCpuModel() {
            return cpuModel;
        }
        
        public int getCpuCores() {
            return cpuCores;
        }
        
        public int getMemory() {
            return memory;
        }
        
        public int getGpuMemory() {
            return gpuMemory;
        }
        
        public boolean supportsCuda() {
            return supportsCuda;
        }
        
        public boolean supportsOpenCL() {
            return supportsOpenCL;
        }
        
        public String getProcessingUnit() {
            return processingUnit;
        }
        
        @Override
        public String toString() {
            return "HardwareAnalyzer.Result{" +
                    "gpuModel='" + gpuModel + '\'' +
                    ", cpuModel='" + cpuModel + '\'' +
                    ", cpuCores=" + cpuCores +
                    ", memory=" + memory + "MB" +
                    ", gpuMemory=" + gpuMemory + "MB" +
                    ", supportsCuda=" + supportsCuda +
                    ", supportsOpenCL=" + supportsOpenCL +
                    ", processingUnit='" + processingUnit + '\'' +
                    '}';
        }
    }
    
    /**
     * Analyzes the hardware capabilities of the device
     */
    public static void analyzeHardware(Context context, HardwareAnalysisCallback callback) {
        new HardwareAnalysisTask(context, callback).execute();
    }
    
    private static class HardwareAnalysisTask extends AsyncTask<Void, Void, Result> {
        private Context context;
        private HardwareAnalysisCallback callback;
        
        public HardwareAnalysisTask(Context context, HardwareAnalysisCallback callback) {
            this.context = context;
            this.callback = callback;
        }
        
        @Override
        protected Result doInBackground(Void... params) {
            Result result = new Result();
            
            // Analyze CPU
            analyzeCPU(result);
            
            // Analyze memory
            analyzeMemory(result);
            
            // Analyze GPU
            analyzeGPU(context, result);
            
            // Determine best processing unit for mining
            if (result.gpuModel.contains("Adreno") || 
                result.gpuModel.contains("Mali") || 
                result.gpuModel.contains("PowerVR")) {
                result.processingUnit = "GPU";
                result.supportsOpenCL = true;
            } else {
                result.processingUnit = "CPU";
            }
            
            return result;
        }
        
        @Override
        protected void onPostExecute(Result result) {
            if (callback != null) {
                callback.onAnalysisComplete(result);
            }
        }
        
        private void analyzeCPU(Result result) {
            // Get CPU model from /proc/cpuinfo
            try {
                BufferedReader br = new BufferedReader(new FileReader(new File("/proc/cpuinfo")));
                String line;
                Pattern modelPattern = Pattern.compile("model name\\s*:\\s*(.*)");
                Pattern processorPattern = Pattern.compile("processor\\s*:\\s*(.*)");
                int coreCount = 0;
                
                while ((line = br.readLine()) != null) {
                    Matcher modelMatcher = modelPattern.matcher(line);
                    if (modelMatcher.find()) {
                        result.cpuModel = modelMatcher.group(1).trim();
                    }
                    
                    Matcher processorMatcher = processorPattern.matcher(line);
                    if (processorMatcher.find()) {
                        coreCount++;
                    }
                }
                
                result.cpuCores = coreCount > 0 ? coreCount : Runtime.getRuntime().availableProcessors();
                br.close();
            } catch (IOException e) {
                Log.e(TAG, "Error reading CPU info", e);
                // Fallback to Runtime
                result.cpuCores = Runtime.getRuntime().availableProcessors();
                result.cpuModel = Build.HARDWARE;
            }
        }
        
        private void analyzeMemory(Result result) {
            // Get total memory
            try {
                BufferedReader br = new BufferedReader(new FileReader(new File("/proc/meminfo")));
                String line;
                Pattern memPattern = Pattern.compile("MemTotal:\\s*(\\d+)\\s*kB");
                
                while ((line = br.readLine()) != null) {
                    Matcher memMatcher = memPattern.matcher(line);
                    if (memMatcher.find()) {
                        long memKb = Long.parseLong(memMatcher.group(1));
                        result.memory = (int)(memKb / 1024); // Convert to MB
                        break;
                    }
                }
                
                br.close();
            } catch (IOException e) {
                Log.e(TAG, "Error reading memory info", e);
                // Fallback to Runtime
                result.memory = (int)(Runtime.getRuntime().maxMemory() / (1024 * 1024));
            }
        }
        
        private void analyzeGPU(Context context, Result result) {
            // Try to get GPU info from OpenGL
            try {
                PackageManager pm = context.getPackageManager();
                
                // Check for required features
                boolean hasOpenGLES2 = pm.hasSystemFeature(PackageManager.FEATURE_OPENGLES_EXTENSION_PACK);
                
                if (hasOpenGLES2) {
                    if (Build.DEVICE.toLowerCase().contains("mali")) {
                        result.gpuModel = "ARM Mali GPU";
                        result.supportsOpenCL = true;
                    } else if (Build.DEVICE.toLowerCase().contains("adreno")) {
                        result.gpuModel = "Qualcomm Adreno GPU";
                        result.supportsOpenCL = true;
                    } else if (Build.DEVICE.toLowerCase().contains("powervr")) {
                        result.gpuModel = "PowerVR GPU";
                        result.supportsOpenCL = true;
                    } else {
                        // Try to determine from Build.HARDWARE
                        result.gpuModel = "Integrated GPU (" + Build.HARDWARE + ")";
                    }
                    
                    // Estimate GPU memory (very rough estimate)
                    result.gpuMemory = result.memory / 4; // Assume 1/4 of system memory is used for GPU
                } else {
                    result.gpuModel = "Basic GPU (OpenGL ES 1.x)";
                    result.gpuMemory = 128; // Minimum assumption
                }
            } catch (Exception e) {
                Log.e(TAG, "Error analyzing GPU", e);
                result.gpuModel = "Unknown GPU";
            }
        }
    }
}
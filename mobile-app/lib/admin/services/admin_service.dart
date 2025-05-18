import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AdminService extends ChangeNotifier {
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic> _poolStats = {};
  List<Map<String, dynamic>> _activeWorkers = [];
  Map<String, dynamic> _profitStats = {};
  bool _isOfflineMode = false;

  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic> get poolStats => _poolStats;
  List<Map<String, dynamic>> get activeWorkers => _activeWorkers;
  Map<String, dynamic> get profitStats => _profitStats;
  bool get isOfflineMode => _isOfflineMode;

  // Load pool statistics
  Future<void> loadPoolStats() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Load from cache
        await _loadPoolStatsFromCache();
      } else {
        // In a real app, this would fetch from API
        await Future.delayed(const Duration(seconds: 1));
        
        _poolStats = {
          'totalHashrate': '12.5 PH/s',
          'activeWorkers': 1248,
          'activeMiners': 385,
          'blocksFound24h': 18,
          'hashrateTrend': '+5.2%',
          'networkDifficulty': '48.78T',
          'poolFee': '1.5%',
          'minPayout': '0.01 BTC',
        };
        
        // Save to cache for offline use
        await _savePoolStatsToCache();
      }
    } catch (e) {
      _error = 'Failed to load pool stats: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Load active workers
  Future<void> loadActiveWorkers() async {
    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Load from cache
        await _loadWorkersFromCache();
      } else {
        // In a real app, this would fetch from API
        await Future.delayed(const Duration(seconds: 1));
        
        _activeWorkers = [
          {
            'id': 'worker1',
            'name': 'RTX3090-Rig4',
            'status': 'online',
            'hashrate': 120.5,
            'temperature': 89,
            'coin': 'ETH',
            'lastSeen': DateTime.now().subtract(const Duration(minutes: 5)),
            'uptime': 13825, // minutes
            'deviceType': 'NVIDIA RTX 3090',
            'deviceCount': 6,
            'powerUsage': 1620, // watts
            'fanSpeed': 85, // percentage
            'overclockProfile': 'Performance',
            'efficiency': 0.49, // hashrate/watt
          },
          {
            'id': 'worker2',
            'name': 'RTX3080-Rig2',
            'status': 'offline',
            'hashrate': 0,
            'temperature': null,
            'coin': 'BTC',
            'lastSeen': DateTime.now().subtract(const Duration(hours: 2, minutes: 15)),
            'uptime': 0, // minutes
            'deviceType': 'NVIDIA RTX 3080',
            'deviceCount': 8,
            'powerUsage': 0, // watts
            'fanSpeed': 0, // percentage
            'overclockProfile': 'Balanced',
            'efficiency': 0, // hashrate/watt
          },
          {
            'id': 'worker3',
            'name': 'RX6800-Rig7',
            'status': 'degraded',
            'hashrate': 45.2,
            'temperature': 72,
            'coin': 'ETH',
            'lastSeen': DateTime.now().subtract(const Duration(minutes: 1)),
            'uptime': 4896, // minutes
            'deviceType': 'AMD RX 6800',
            'deviceCount': 6,
            'powerUsage': 960, // watts
            'fanSpeed': 65, // percentage
            'overclockProfile': 'Efficiency',
            'efficiency': 0.28, // hashrate/watt
          },
          {
            'id': 'worker4',
            'name': 'RTX3070-Rig9',
            'status': 'online',
            'hashrate': 62.3,
            'temperature': 68,
            'coin': 'ETH',
            'lastSeen': DateTime.now(),
            'uptime': 27643, // minutes
            'deviceType': 'NVIDIA RTX 3070',
            'deviceCount': 8,
            'powerUsage': 1120, // watts
            'fanSpeed': 70, // percentage
            'overclockProfile': 'Balanced',
            'efficiency': 0.56, // hashrate/watt
          },
          {
            'id': 'worker5',
            'name': 'RTX3060-Rig1',
            'status': 'online',
            'hashrate': 48.1,
            'temperature': 65,
            'coin': 'RVN',
            'lastSeen': DateTime.now().subtract(const Duration(minutes: 3)),
            'uptime': 18732, // minutes
            'deviceType': 'NVIDIA RTX 3060',
            'deviceCount': 10,
            'powerUsage': 1150, // watts
            'fanSpeed': 60, // percentage
            'overclockProfile': 'Efficiency',
            'efficiency': 0.42, // hashrate/watt
          },
        ];
        
        // Save to cache for offline use
        await _saveWorkersToCache();
      }
    } catch (e) {
      _error = 'Failed to load workers: $e';
    } finally {
      notifyListeners();
    }
  }

  // Load profit statistics
  Future<void> loadProfitStats() async {
    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Load from cache
        await _loadProfitStatsFromCache();
      } else {
        // In a real app, this would fetch from API
        await Future.delayed(const Duration(seconds: 1));
        
        _profitStats = {
          'revenue24h': 4258.75,
          'operatingCosts': 1872.30,
          'netProfit': 2386.45,
          'revenueTrend': '+12.4%',
          'costTrend': '+3.2%',
          'profitTrend': '+18.7%',
          'coinStats': [
            {
              'coin': 'BTC',
              'name': 'Bitcoin',
              'hashrate': '8.2 PH/s',
              'revenue': 2845.63,
              'workers': 42,
            },
            {
              'coin': 'ETH',
              'name': 'Ethereum',
              'hashrate': '625 TH/s',
              'revenue': 1413.12,
              'workers': 85,
            },
          ],
        };
        
        // Save to cache for offline use
        await _saveProfitStatsToCache();
      }
    } catch (e) {
      _error = 'Failed to load profit stats: $e';
    } finally {
      notifyListeners();
    }
  }

  // Get a worker's overclocking profile
  Future<Map<String, dynamic>> getWorkerOverclockSettings(String workerId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Load from cache
        return await _loadWorkerSettingsFromCache(workerId);
      } else {
        // In a real app, this would fetch from API
        await Future.delayed(const Duration(seconds: 1));
        
        // Mock data for worker overclocking settings
        final Map<String, dynamic> settings = {
          'coreClock': 1200.0,
          'memoryClock': 2000.0,
          'powerLimit': 75.0,
          'fanSpeed': 65.0,
          'autoFan': true,
          'profileName': 'Balanced',
          'deviceType': 'NVIDIA RTX 3080',
          'lastUpdated': DateTime.now().subtract(const Duration(hours: 6)).toIso8601String(),
        };
        
        // Save to cache for offline use
        await _saveWorkerSettingsToCache(workerId, settings);
        
        return settings;
      }
    } catch (e) {
      _error = 'Failed to load worker settings: $e';
      return {};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Apply overclocking settings to a worker
  Future<bool> applyOverclockSettings(String workerId, Map<String, dynamic> settings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Store pending changes for when connectivity is restored
        await _storePendingOverclockChanges(workerId, settings);
        return false;
      } else {
        // In a real app, this would call the API
        await Future.delayed(const Duration(seconds: 2));
        
        // Save to cache for offline use
        await _saveWorkerSettingsToCache(workerId, settings);
        
        return true;
      }
    } catch (e) {
      _error = 'Failed to apply settings: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Remote reboot a worker
  Future<bool> rebootWorker(String workerId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Store pending reboot request
        await _storePendingRebootRequest(workerId);
        return false;
      } else {
        // In a real app, this would call the API
        await Future.delayed(const Duration(seconds: 2));
        return true;
      }
    } catch (e) {
      _error = 'Failed to reboot worker: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Batch reboot workers
  Future<bool> batchRebootWorkers(List<String> workerIds) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Store pending batch reboot request
        await _storePendingBatchRebootRequest(workerIds);
        return false;
      } else {
        // In a real app, this would call the API
        await Future.delayed(const Duration(seconds: 2));
        return true;
      }
    } catch (e) {
      _error = 'Failed to reboot workers: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Apply emergency power limit to all workers
  Future<bool> applyEmergencyPowerLimit(double powerLimit) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Store pending emergency power limit
        await _storePendingEmergencyPowerLimit(powerLimit);
        return false;
      } else {
        // In a real app, this would call the API
        await Future.delayed(const Duration(seconds: 2));
        return true;
      }
    } catch (e) {
      _error = 'Failed to apply emergency power limit: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Set pool maintenance mode
  Future<bool> setMaintenanceMode(bool enabled, {DateTime? scheduledTime}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for internet connection
      bool isConnected = await _checkConnectivity();

      if (!isConnected) {
        _isOfflineMode = true;
        // Store pending maintenance mode request
        await _storePendingMaintenanceMode(enabled, scheduledTime);
        return false;
      } else {
        // In a real app, this would call the API
        await Future.delayed(const Duration(seconds: 2));
        return true;
      }
    } catch (e) {
      _error = 'Failed to set maintenance mode: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Process all pending offline changes when connectivity is restored
  Future<void> syncPendingChanges() async {
    if (!_isOfflineMode) return;

    _isLoading = true;
    notifyListeners();

    try {
      // Check if we have connectivity now
      bool isConnected = await _checkConnectivity();
      
      if (isConnected) {
        // Get all pending changes
        final pendingChanges = await _getPendingChanges();
        
        // Process each change
        for (var change in pendingChanges) {
          switch (change['type']) {
            case 'overclock':
              await applyOverclockSettings(
                change['workerId'],
                change['settings'],
              );
              break;
            case 'reboot':
              await rebootWorker(change['workerId']);
              break;
            case 'batchReboot':
              await batchRebootWorkers(List<String>.from(change['workerIds']));
              break;
            case 'emergencyPowerLimit':
              await applyEmergencyPowerLimit(change['powerLimit']);
              break;
            case 'maintenanceMode':
              await setMaintenanceMode(
                change['enabled'],
                scheduledTime: change['scheduledTime'] != null
                    ? DateTime.parse(change['scheduledTime'])
                    : null,
              );
              break;
          }
        }
        
        // Clear pending changes
        await _clearPendingChanges();
        
        _isOfflineMode = false;
      }
    } catch (e) {
      _error = 'Failed to sync pending changes: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Check connectivity
  Future<bool> _checkConnectivity() async {
    try {
      // In a real app, this would make a lightweight API call
      // or use a connectivity plugin to check network status
      await Future.delayed(const Duration(milliseconds: 500));
      return true;  // Simulate always having connection
      
      // For testing offline mode, return false
      // return false;
    } catch (e) {
      return false;
    }
  }

  // Cache management methods
  Future<void> _savePoolStatsToCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pool_stats_cache', json.encode(_poolStats));
    await prefs.setString('pool_stats_timestamp', DateTime.now().toIso8601String());
  }

  Future<void> _loadPoolStatsFromCache() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('pool_stats_cache');
    
    if (cachedData != null) {
      _poolStats = json.decode(cachedData);
    }
  }

  Future<void> _saveWorkersToCache() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Convert DateTime objects to strings for serialization
    final serializedWorkers = _activeWorkers.map((worker) {
      final Map<String, dynamic> serialized = Map.from(worker);
      
      if (serialized['lastSeen'] is DateTime) {
        serialized['lastSeen'] = (serialized['lastSeen'] as DateTime).toIso8601String();
      }
      
      return serialized;
    }).toList();
    
    await prefs.setString('workers_cache', json.encode(serializedWorkers));
    await prefs.setString('workers_timestamp', DateTime.now().toIso8601String());
  }

  Future<void> _loadWorkersFromCache() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('workers_cache');
    
    if (cachedData != null) {
      final List<dynamic> decodedData = json.decode(cachedData);
      
      // Convert date strings back to DateTime objects
      _activeWorkers = decodedData.map((worker) {
        final Map<String, dynamic> workerMap = Map.from(worker);
        
        if (workerMap['lastSeen'] is String) {
          workerMap['lastSeen'] = DateTime.parse(workerMap['lastSeen']);
        }
        
        return workerMap;
      }).toList();
    }
  }

  Future<void> _saveProfitStatsToCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('profit_stats_cache', json.encode(_profitStats));
    await prefs.setString('profit_stats_timestamp', DateTime.now().toIso8601String());
  }

  Future<void> _loadProfitStatsFromCache() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('profit_stats_cache');
    
    if (cachedData != null) {
      _profitStats = json.decode(cachedData);
    }
  }

  Future<void> _saveWorkerSettingsToCache(String workerId, Map<String, dynamic> settings) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'worker_settings_${workerId}';
    await prefs.setString(key, json.encode(settings));
    await prefs.setString('${key}_timestamp', DateTime.now().toIso8601String());
  }

  Future<Map<String, dynamic>> _loadWorkerSettingsFromCache(String workerId) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'worker_settings_${workerId}';
    final cachedData = prefs.getString(key);
    
    if (cachedData != null) {
      return json.decode(cachedData);
    }
    
    return {};
  }

  // Pending changes for offline mode
  Future<void> _storePendingOverclockChanges(String workerId, Map<String, dynamic> settings) async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChanges = await _getPendingChanges();
    
    pendingChanges.add({
      'type': 'overclock',
      'workerId': workerId,
      'settings': settings,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    await prefs.setString('pending_changes', json.encode(pendingChanges));
  }

  Future<void> _storePendingRebootRequest(String workerId) async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChanges = await _getPendingChanges();
    
    pendingChanges.add({
      'type': 'reboot',
      'workerId': workerId,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    await prefs.setString('pending_changes', json.encode(pendingChanges));
  }

  Future<void> _storePendingBatchRebootRequest(List<String> workerIds) async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChanges = await _getPendingChanges();
    
    pendingChanges.add({
      'type': 'batchReboot',
      'workerIds': workerIds,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    await prefs.setString('pending_changes', json.encode(pendingChanges));
  }

  Future<void> _storePendingEmergencyPowerLimit(double powerLimit) async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChanges = await _getPendingChanges();
    
    pendingChanges.add({
      'type': 'emergencyPowerLimit',
      'powerLimit': powerLimit,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    await prefs.setString('pending_changes', json.encode(pendingChanges));
  }

  Future<void> _storePendingMaintenanceMode(bool enabled, DateTime? scheduledTime) async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChanges = await _getPendingChanges();
    
    pendingChanges.add({
      'type': 'maintenanceMode',
      'enabled': enabled,
      'scheduledTime': scheduledTime?.toIso8601String(),
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    await prefs.setString('pending_changes', json.encode(pendingChanges));
  }

  Future<List<Map<String, dynamic>>> _getPendingChanges() async {
    final prefs = await SharedPreferences.getInstance();
    final pendingChangesJson = prefs.getString('pending_changes');
    
    if (pendingChangesJson != null) {
      final List<dynamic> decodedData = json.decode(pendingChangesJson);
      return decodedData.map((item) => Map<String, dynamic>.from(item)).toList();
    }
    
    return [];
  }

  Future<void> _clearPendingChanges() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pending_changes');
  }
}
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'package:crypto_mining_wallet/models/wallet.dart';
import 'package:crypto_mining_wallet/services/wallet_service.dart';

class OverclockingScreen extends StatefulWidget {
  final String workerId;
  final String workerName;
  
  const OverclockingScreen({
    Key? key,
    required this.workerId,
    required this.workerName,
  }) : super(key: key);

  @override
  _OverclockingScreenState createState() => _OverclockingScreenState();
}

class _OverclockingScreenState extends State<OverclockingScreen> {
  // Default overclocking settings
  double _coreClock = 1200.0;
  double _memoryClock = 2000.0;
  double _powerLimit = 75.0;
  double _fanSpeed = 65.0;
  
  bool _autoFanEnabled = true;
  bool _isSaving = false;
  bool _isApplying = false;
  bool _hasUnsavedChanges = false;
  bool _isOfflineMode = false;
  
  // Original values to detect changes
  double _originalCoreClock = 1200.0;
  double _originalMemoryClock = 2000.0;
  double _originalPowerLimit = 75.0;
  double _originalFanSpeed = 65.0;
  bool _originalAutoFanEnabled = true;
  
  // GPU temperature simulation (would come from API)
  double _gpuTemperature = 62.0;
  Timer? _tempSimulationTimer;
  
  // Presets
  final Map<String, Map<String, dynamic>> _presets = {
    "Efficiency": {
      "coreClock": 1050.0,
      "memoryClock": 2100.0,
      "powerLimit": 65.0,
      "fanSpeed": 60.0,
      "autoFan": true,
    },
    "Balanced": {
      "coreClock": 1200.0,
      "memoryClock": 2000.0,
      "powerLimit": 75.0,
      "fanSpeed": 65.0,
      "autoFan": true,
    },
    "Performance": {
      "coreClock": 1350.0,
      "memoryClock": 2200.0,
      "powerLimit": 90.0,
      "fanSpeed": 75.0,
      "autoFan": false,
    },
    "Aggressive": {
      "coreClock": 1400.0,
      "memoryClock": 2400.0,
      "powerLimit": 100.0,
      "fanSpeed": 85.0,
      "autoFan": false,
    },
  };
  
  String _currentPreset = "Balanced";
  
  @override
  void initState() {
    super.initState();
    _loadSettings();
    _startTemperatureSimulation();
  }
  
  @override
  void dispose() {
    _tempSimulationTimer?.cancel();
    super.dispose();
  }
  
  void _startTemperatureSimulation() {
    // Simulate temperature fluctuations (in a real app would come from API)
    _tempSimulationTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (mounted) {
        setState(() {
          // Temperature will fluctuate based on fan speed and power limit
          final baseTempChange = (_powerLimit / 100) * 2 - (_fanSpeed / 100);
          _gpuTemperature += (baseTempChange * (0.5 - (0.5 * _isApplying ? 1 : 0))) + (Math.random() * 2 - 1);
          
          // Clamp temperature to realistic values
          _gpuTemperature = _gpuTemperature.clamp(55.0, 90.0);
        });
      }
    });
  }
  
  Future<void> _loadSettings() async {
    setState(() {
      _isApplying = true;
    });
    
    try {
      // In a real app, we'd load from an API or local storage
      // For demo purposes, we'll use the balanced preset
      await Future.delayed(const Duration(seconds: 1));
      
      // Simulate network error for offline mode demo
      final isConnected = await _checkConnectionStatus();
      
      if (!isConnected) {
        setState(() {
          _isOfflineMode = true;
        });
        
        // Load from cached settings
        final Map<String, dynamic> cachedSettings = _loadFromLocalCache();
        _applySettings(cachedSettings);
      } else {
        // Apply preset settings (simulating API response)
        _applySettings(_presets[_currentPreset]!);
      }
      
      // Store original values for comparison
      _saveOriginalValues();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error loading settings: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isApplying = false;
      });
    }
  }
  
  Future<bool> _checkConnectionStatus() async {
    // Simulate a check of connectivity
    await Future.delayed(const Duration(seconds: 1));
    return true; // Change to false to test offline mode
  }
  
  Map<String, dynamic> _loadFromLocalCache() {
    // In a real app, this would load from SharedPreferences or SQLite
    // For demo purposes, return balanced preset
    return _presets["Balanced"]!;
  }
  
  void _applySettings(Map<String, dynamic> settings) {
    setState(() {
      _coreClock = settings["coreClock"];
      _memoryClock = settings["memoryClock"];
      _powerLimit = settings["powerLimit"];
      _fanSpeed = settings["fanSpeed"];
      _autoFanEnabled = settings["autoFan"];
    });
  }
  
  void _saveOriginalValues() {
    _originalCoreClock = _coreClock;
    _originalMemoryClock = _memoryClock;
    _originalPowerLimit = _powerLimit;
    _originalFanSpeed = _fanSpeed;
    _originalAutoFanEnabled = _autoFanEnabled;
  }
  
  void _checkForChanges() {
    final hasChanges = 
        _coreClock != _originalCoreClock ||
        _memoryClock != _originalMemoryClock ||
        _powerLimit != _originalPowerLimit ||
        _fanSpeed != _originalFanSpeed ||
        _autoFanEnabled != _originalAutoFanEnabled;
    
    setState(() {
      _hasUnsavedChanges = hasChanges;
    });
  }
  
  void _applyPreset(String presetName) {
    if (_presets.containsKey(presetName)) {
      setState(() {
        _currentPreset = presetName;
        
        Map<String, dynamic> preset = _presets[presetName]!;
        _coreClock = preset["coreClock"];
        _memoryClock = preset["memoryClock"];
        _powerLimit = preset["powerLimit"];
        _fanSpeed = preset["fanSpeed"];
        _autoFanEnabled = preset["autoFan"];
        
        _checkForChanges();
      });
    }
  }
  
  Future<void> _saveSettings() async {
    setState(() {
      _isSaving = true;
    });
    
    try {
      // In a real app, this would call an API to update settings
      await Future.delayed(const Duration(seconds: 2));
      
      // Save original values once changes are committed
      _saveOriginalValues();
      
      setState(() {
        _hasUnsavedChanges = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Overclocking settings saved successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error saving settings: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isSaving = false;
      });
    }
  }
  
  Future<void> _applyOverclockSettings() async {
    // Show confirmation dialog for potentially dangerous operation
    final shouldApply = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Apply Overclocking Settings'),
        content: const Text('Applying aggressive overclocking settings may damage your hardware if not properly configured. Do you want to continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Apply Settings'),
          ),
        ],
      ),
    );
    
    if (shouldApply != true) {
      return;
    }
    
    setState(() {
      _isApplying = true;
    });
    
    try {
      // In a real app, this would apply settings to the miner
      await Future.delayed(const Duration(seconds: 3));
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Overclocking settings applied to miner'),
          backgroundColor: Colors.green,
        ),
      );
      
      // Save settings to server after applying
      await _saveSettings();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error applying settings: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isApplying = false;
      });
    }
  }
  
  Color _getTemperatureColor(double temp) {
    if (temp < 65) {
      return Colors.green;
    } else if (temp < 75) {
      return Colors.orange;
    } else {
      return Colors.red;
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Overclock ${widget.workerName}'),
        actions: [
          if (_isOfflineMode)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0),
              child: Chip(
                backgroundColor: Colors.orange.shade100,
                avatar: const Icon(Icons.wifi_off, color: Colors.orange, size: 16),
                label: const Text('Offline Mode', style: TextStyle(fontSize: 12, color: Colors.orange)),
              ),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Worker Status Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'GPU: NVIDIA RTX 3080',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Driver: 470.94',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.green.shade100,
                            borderRadius: BorderRadius.circular(50),
                          ),
                          child: const Text(
                            'Online',
                            style: TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    
                    // Temperature and Utilization
                    Row(
                      children: [
                        Expanded(
                          child: _buildStatCard(
                            'Temperature',
                            '${_gpuTemperature.toStringAsFixed(1)}°C',
                            Icons.thermostat,
                            _getTemperatureColor(_gpuTemperature),
                          ),
                        ),
                        Expanded(
                          child: _buildStatCard(
                            'GPU Utilization',
                            '95%',
                            Icons.speed,
                            Colors.blue,
                          ),
                        ),
                        Expanded(
                          child: _buildStatCard(
                            'Memory Utilization',
                            '87%',
                            Icons.memory,
                            Colors.purple,
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 4),
                    
                    // Power Consumption
                    Row(
                      children: [
                        Expanded(
                          child: _buildStatCard(
                            'Power Draw',
                            '${_powerLimit.toInt()} W',
                            Icons.bolt,
                            Colors.amber,
                          ),
                        ),
                        Expanded(
                          child: _buildStatCard(
                            'Fan Speed',
                            '${_fanSpeed.toInt()} %',
                            Icons.cyclone,
                            Colors.lightBlue,
                          ),
                        ),
                        Expanded(
                          child: _buildStatCard(
                            'Hashrate',
                            '68.5 MH/s',
                            Icons.trending_up,
                            Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Preset selection
            Text(
              'Overclocking Presets',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Container(
              height: 60,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _presets.keys.map((presetName) {
                  final isSelected = _currentPreset == presetName;
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: ChoiceChip(
                      label: Text(presetName),
                      selected: isSelected,
                      onSelected: (selected) {
                        if (selected) {
                          _applyPreset(presetName);
                        }
                      },
                      backgroundColor: Colors.grey.shade200,
                      selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                    ),
                  );
                }).toList(),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Overclocking sliders
            Text(
              'Manual Overclocking',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            
            // Core Clock Slider
            _buildSliderSetting(
              'Core Clock',
              '${_coreClock.toInt()} MHz',
              _coreClock,
              800.0,
              1600.0,
              (value) {
                setState(() {
                  _coreClock = value;
                  _checkForChanges();
                });
              },
            ),
            
            // Memory Clock Slider
            _buildSliderSetting(
              'Memory Clock',
              '${_memoryClock.toInt()} MHz',
              _memoryClock,
              1500.0,
              2500.0,
              (value) {
                setState(() {
                  _memoryClock = value;
                  _checkForChanges();
                });
              },
            ),
            
            // Power Limit Slider
            _buildSliderSetting(
              'Power Limit',
              '${_powerLimit.toInt()} W',
              _powerLimit,
              50.0,
              120.0,
              (value) {
                setState(() {
                  _powerLimit = value;
                  _checkForChanges();
                });
              },
            ),
            
            // Fan Speed Slider
            _buildSliderSetting(
              'Fan Speed',
              '${_fanSpeed.toInt()} %',
              _fanSpeed,
              30.0,
              100.0,
              (value) {
                setState(() {
                  _fanSpeed = value;
                  _checkForChanges();
                });
              },
              enabled: !_autoFanEnabled,
            ),
            
            // Auto Fan Control
            SwitchListTile(
              title: const Text('Auto Fan Control'),
              subtitle: const Text('Automatically adjust fan speed based on temperature'),
              value: _autoFanEnabled,
              onChanged: (value) {
                setState(() {
                  _autoFanEnabled = value;
                  _checkForChanges();
                });
              },
              secondary: const Icon(Icons.auto_mode),
            ),
            
            const SizedBox(height: 16),
            
            // Warning messages
            if (_powerLimit > 95)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.red.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'High power limit may cause system instability and hardware damage. Proceed with caution.',
                        style: TextStyle(color: Colors.red.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              
            if (_coreClock > 1350)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.amber.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'High core clock may cause system crashes or artifacts. Monitor your system closely.',
                        style: TextStyle(color: Colors.amber.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              
            const SizedBox(height: 24),
            
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _hasUnsavedChanges && !_isSaving && !_isApplying 
                        ? () {
                            // Reset to original values
                            setState(() {
                              _coreClock = _originalCoreClock;
                              _memoryClock = _originalMemoryClock;
                              _powerLimit = _originalPowerLimit;
                              _fanSpeed = _originalFanSpeed;
                              _autoFanEnabled = _originalAutoFanEnabled;
                              _hasUnsavedChanges = false;
                            });
                          }
                        : null,
                    child: const Text('Reset'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _hasUnsavedChanges && !_isSaving && !_isApplying 
                        ? _applyOverclockSettings 
                        : null,
                    child: _isApplying
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Apply'),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
  
  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.all(4.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                color: color,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildSliderSetting(
    String title,
    String value,
    double currentValue,
    double min,
    double max,
    Function(double) onChanged, {
    bool enabled = true,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title),
              Text(
                value,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          Slider(
            value: currentValue,
            min: min,
            max: max,
            divisions: ((max - min) / 5).round(),
            onChanged: enabled ? onChanged : null,
            activeColor: enabled ? Theme.of(context).colorScheme.primary : Colors.grey,
          ),
        ],
      ),
    );
  }
}

// Mock class for Math.random()
class Math {
  static double random() {
    return DateTime.now().millisecondsSinceEpoch % 100 / 100;
  }
}
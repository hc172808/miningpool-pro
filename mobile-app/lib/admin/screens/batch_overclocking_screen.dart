import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:crypto_mining_wallet/admin/services/admin_service.dart';

class BatchOverclockingScreen extends StatefulWidget {
  final List<String> workerIds;
  final List<String> workerNames;
  
  const BatchOverclockingScreen({
    Key? key,
    required this.workerIds,
    required this.workerNames,
  }) : super(key: key);

  @override
  _BatchOverclockingScreenState createState() => _BatchOverclockingScreenState();
}

class _BatchOverclockingScreenState extends State<BatchOverclockingScreen> {
  // Default overclocking settings
  double _coreClock = 1200.0;
  double _memoryClock = 2000.0;
  double _powerLimit = 75.0;
  double _fanSpeed = 65.0;
  
  bool _autoFanEnabled = true;
  bool _isSaving = false;
  bool _isApplying = false;
  
  // Preset profiles
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
    _applyPreset(_currentPreset);
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
      });
    }
  }
  
  Future<void> _applyToAllWorkers() async {
    final shouldApply = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Apply to All Workers'),
        content: Text(
          'Are you sure you want to apply these settings to all ${widget.workerIds.length} selected workers? '
          'This operation cannot be undone and may affect mining performance.',
        ),
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
            child: const Text('Apply'),
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
      final adminService = Provider.of<AdminService>(context, listen: false);
      
      // Prepare the settings to apply
      final settings = {
        "coreClock": _coreClock,
        "memoryClock": _memoryClock,
        "powerLimit": _powerLimit,
        "fanSpeed": _fanSpeed,
        "autoFan": _autoFanEnabled,
        "profileName": _currentPreset,
      };
      
      int successCount = 0;
      
      // Apply to each worker
      for (final workerId in widget.workerIds) {
        final success = await adminService.applyOverclockSettings(workerId, settings);
        if (success) successCount++;
      }
      
      if (successCount == widget.workerIds.length) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Overclocking settings applied to all workers'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Navigate back
        Navigator.of(context).pop();
      } else if (adminService.isOfflineMode) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Settings saved and will be applied when online'),
            backgroundColor: Colors.orange,
          ),
        );
        
        // Navigate back
        Navigator.of(context).pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Applied to $successCount/${widget.workerIds.length} workers'),
            backgroundColor: Colors.orange,
          ),
        );
      }
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
  
  @override
  Widget build(BuildContext context) {
    final adminService = Provider.of<AdminService>(context);
    final isOfflineMode = adminService.isOfflineMode;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Batch Overclocking'),
        actions: [
          if (isOfflineMode)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
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
            // Workers section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.computer,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Selected Workers',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    
                    // Worker list
                    for (var i = 0; i < widget.workerNames.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle, color: Colors.green, size: 16),
                            const SizedBox(width: 8),
                            Text(widget.workerNames[i]),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Preset selection
            Text(
              'Overclocking Preset',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SizedBox(
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
            
            const SizedBox(height: 24),
            
            // Overclocking sliders
            Text(
              'Overclocking Settings',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
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
                        });
                      },
                      secondary: const Icon(Icons.auto_mode),
                    ),
                  ],
                ),
              ),
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
                        'High core clock may cause system crashes or artifacts. Monitor your systems closely.',
                        style: TextStyle(color: Colors.amber.shade700),
                      ),
                    ),
                  ],
                ),
              ),
            
            if (isOfflineMode)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info, color: Colors.blue.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'You are in offline mode. Settings will be saved locally and applied when connection is restored.',
                        style: TextStyle(color: Colors.blue.shade700),
                      ),
                    ),
                  ],
                ),
              ),
            
            const SizedBox(height: 24),
            
            // Apply button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isApplying ? null : _applyToAllWorkers,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isApplying
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text('Apply to ${widget.workerIds.length} Workers'),
              ),
            ),
          ],
        ),
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
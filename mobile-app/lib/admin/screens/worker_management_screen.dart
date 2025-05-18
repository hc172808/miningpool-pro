import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:crypto_mining_wallet/admin/services/admin_service.dart';
import 'package:crypto_mining_wallet/screens/overclocking_screen.dart';

class WorkerManagementScreen extends StatefulWidget {
  const WorkerManagementScreen({Key? key}) : super(key: key);

  @override
  _WorkerManagementScreenState createState() => _WorkerManagementScreenState();
}

class _WorkerManagementScreenState extends State<WorkerManagementScreen> {
  final List<String> _selectedWorkers = [];
  String _filterStatus = 'All';
  String _filterCoin = 'All';
  String _sortBy = 'Name';
  final TextEditingController _searchController = TextEditingController();
  bool _isOfflineMode = false;
  
  @override
  void initState() {
    super.initState();
    _refreshWorkers();
    _checkOfflineStatus();
  }
  
  Future<void> _checkOfflineStatus() async {
    final adminService = Provider.of<AdminService>(context, listen: false);
    setState(() {
      _isOfflineMode = adminService.isOfflineMode;
    });
  }
  
  Future<void> _refreshWorkers() async {
    final adminService = Provider.of<AdminService>(context, listen: false);
    await adminService.loadActiveWorkers();
    await _checkOfflineStatus();
  }
  
  List<Map<String, dynamic>> _getFilteredWorkers() {
    final adminService = Provider.of<AdminService>(context);
    
    return adminService.activeWorkers.where((worker) {
      // Apply status filter
      if (_filterStatus != 'All' && worker['status'] != _filterStatus.toLowerCase()) {
        return false;
      }
      
      // Apply coin filter
      if (_filterCoin != 'All' && worker['coin'] != _filterCoin) {
        return false;
      }
      
      // Apply search query
      if (_searchController.text.isNotEmpty) {
        final searchQuery = _searchController.text.toLowerCase();
        return worker['name'].toLowerCase().contains(searchQuery) ||
               worker['deviceType'].toLowerCase().contains(searchQuery);
      }
      
      return true;
    }).toList()
      ..sort((a, b) {
        // Apply sorting
        switch (_sortBy) {
          case 'Name':
            return a['name'].compareTo(b['name']);
          case 'Status':
            return a['status'].compareTo(b['status']);
          case 'Hashrate':
            return (b['hashrate'] ?? 0).compareTo(a['hashrate'] ?? 0); // Descending
          case 'Temperature':
            final aTemp = a['temperature'] ?? -1;
            final bTemp = b['temperature'] ?? -1;
            return bTemp.compareTo(aTemp); // Descending
          default:
            return a['name'].compareTo(b['name']);
        }
      });
  }
  
  void _toggleSelectWorker(String workerId) {
    setState(() {
      if (_selectedWorkers.contains(workerId)) {
        _selectedWorkers.remove(workerId);
      } else {
        _selectedWorkers.add(workerId);
      }
    });
  }
  
  void _selectAllWorkers() {
    final workers = _getFilteredWorkers();
    
    setState(() {
      if (_selectedWorkers.length == workers.length) {
        // If all are selected, deselect all
        _selectedWorkers.clear();
      } else {
        // Otherwise, select all
        _selectedWorkers.clear();
        _selectedWorkers.addAll(workers.map((w) => w['id']));
      }
    });
  }
  
  Future<void> _applyBatchOverclocking() async {
    if (_selectedWorkers.isEmpty) {
      _showSnackBar('No workers selected');
      return;
    }
    
    _showOverclockingDialog();
  }
  
  Future<void> _rebootSelectedWorkers() async {
    if (_selectedWorkers.isEmpty) {
      _showSnackBar('No workers selected');
      return;
    }
    
    final confirmed = await _showConfirmationDialog(
      'Reboot Selected Workers',
      'Are you sure you want to reboot ${_selectedWorkers.length} selected workers? This will temporarily stop mining operations.',
    );
    
    if (confirmed) {
      final adminService = Provider.of<AdminService>(context, listen: false);
      final success = await adminService.batchRebootWorkers(_selectedWorkers);
      
      if (success) {
        _showSnackBar('Reboot command sent to ${_selectedWorkers.length} workers');
      } else if (adminService.isOfflineMode) {
        _showSnackBar('Reboot requests will be sent when online');
      } else {
        _showSnackBar('Failed to reboot some workers. Please try again.');
      }
    }
  }
  
  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    final adminService = Provider.of<AdminService>(context);
    final isLoading = adminService.isLoading;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Worker Management'),
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
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: isLoading ? null : _refreshWorkers,
            tooltip: 'Refresh Workers',
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter and search bar
          _buildFilterBar(),
          
          // Worker list
          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator())
                : _buildWorkerList(),
          ),
        ],
      ),
      bottomNavigationBar: _selectedWorkers.isNotEmpty
          ? _buildActionBar()
          : null,
    );
  }
  
  Widget _buildFilterBar() {
    return Card(
      margin: const EdgeInsets.all(8.0),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          children: [
            // Search bar
            TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search workers...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8.0),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            
            // Filter options
            Row(
              children: [
                // Status filter
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    value: _filterStatus,
                    items: const [
                      DropdownMenuItem(value: 'All', child: Text('All Statuses')),
                      DropdownMenuItem(value: 'Online', child: Text('Online')),
                      DropdownMenuItem(value: 'Offline', child: Text('Offline')),
                      DropdownMenuItem(value: 'Degraded', child: Text('Degraded')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          _filterStatus = value;
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                
                // Cryptocurrency filter
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Coin',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    value: _filterCoin,
                    items: const [
                      DropdownMenuItem(value: 'All', child: Text('All Coins')),
                      DropdownMenuItem(value: 'BTC', child: Text('Bitcoin')),
                      DropdownMenuItem(value: 'ETH', child: Text('Ethereum')),
                      DropdownMenuItem(value: 'XMR', child: Text('Monero')),
                      DropdownMenuItem(value: 'RVN', child: Text('Ravencoin')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          _filterCoin = value;
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                
                // Sort option
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Sort By',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    value: _sortBy,
                    items: const [
                      DropdownMenuItem(value: 'Name', child: Text('Name')),
                      DropdownMenuItem(value: 'Status', child: Text('Status')),
                      DropdownMenuItem(value: 'Hashrate', child: Text('Hashrate')),
                      DropdownMenuItem(value: 'Temperature', child: Text('Temperature')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          _sortBy = value;
                        });
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            // Selected count and select all
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_getFilteredWorkers().length} workers found',
                  style: TextStyle(
                    color: Colors.grey.shade600,
                  ),
                ),
                TextButton.icon(
                  icon: Icon(
                    _selectedWorkers.length == _getFilteredWorkers().length
                        ? Icons.deselect
                        : Icons.select_all,
                  ),
                  label: Text(
                    _selectedWorkers.length == _getFilteredWorkers().length
                        ? 'Deselect All'
                        : 'Select All',
                  ),
                  onPressed: _selectAllWorkers,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildWorkerList() {
    final filteredWorkers = _getFilteredWorkers();
    
    if (filteredWorkers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.computer_outlined,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'No workers found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Try changing your filter settings',
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      );
    }
    
    return ListView.separated(
      padding: const EdgeInsets.all(8.0),
      itemCount: filteredWorkers.length,
      separatorBuilder: (context, index) => const Divider(),
      itemBuilder: (context, index) {
        final worker = filteredWorkers[index];
        return _buildWorkerListItem(worker);
      },
    );
  }
  
  Widget _buildWorkerListItem(Map<String, dynamic> worker) {
    final isSelected = _selectedWorkers.contains(worker['id']);
    final statusColor = _getStatusColor(worker['status']);
    
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4.0),
      color: isSelected ? Colors.blue.shade50 : null,
      child: InkWell(
        onTap: () => _toggleSelectWorker(worker['id']),
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Row(
            children: [
              // Checkbox for selection
              Checkbox(
                value: isSelected,
                onChanged: (_) => _toggleSelectWorker(worker['id']),
              ),
              
              // Status indicator
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              
              // Worker info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          worker['name'],
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: _getCoinColor(worker['coin']).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: _getCoinColor(worker['coin']).withOpacity(0.5),
                            ),
                          ),
                          child: Text(
                            worker['coin'],
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _getCoinColor(worker['coin']),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      worker['deviceType'] + ' (x' + worker['deviceCount'].toString() + ')',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Worker stats
                    Row(
                      children: [
                        _buildWorkerStat(
                          'Hashrate', 
                          worker['status'] == 'online' ? '${worker['hashrate']} MH/s' : 'N/A'
                        ),
                        _buildWorkerStat(
                          'Temp', 
                          worker['temperature'] != null ? '${worker['temperature']}°C' : 'N/A',
                          getValueColor: () => _getTemperatureColor(worker['temperature']),
                        ),
                        _buildWorkerStat(
                          'Power',
                          worker['status'] == 'online' ? '${worker['powerUsage']}W' : 'N/A',
                        ),
                        _buildWorkerStat(
                          'Fan',
                          worker['status'] == 'online' ? '${worker['fanSpeed']}%' : 'N/A',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Action buttons
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert),
                onSelected: (value) => _handleWorkerAction(value, worker),
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'details',
                    child: Text('View Details'),
                  ),
                  const PopupMenuItem(
                    value: 'overclock',
                    child: Text('Adjust Overclocking'),
                  ),
                  const PopupMenuItem(
                    value: 'reboot',
                    child: Text('Reboot Worker'),
                  ),
                  const PopupMenuItem(
                    value: 'shutdown',
                    child: Text('Shutdown Worker'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildWorkerStat(String label, String value, {Color Function()? getValueColor}) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: getValueColor != null ? getValueColor() : null,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade300,
            blurRadius: 5,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Row(
        children: [
          Text(
            '${_selectedWorkers.length} selected',
            style: const TextStyle(
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          TextButton.icon(
            icon: const Icon(Icons.speed),
            label: const Text('Overclock'),
            onPressed: _applyBatchOverclocking,
          ),
          TextButton.icon(
            icon: const Icon(Icons.restart_alt),
            label: const Text('Reboot'),
            onPressed: _rebootSelectedWorkers,
          ),
          TextButton.icon(
            icon: const Icon(Icons.close),
            label: const Text('Clear'),
            onPressed: () {
              setState(() {
                _selectedWorkers.clear();
              });
            },
          ),
        ],
      ),
    );
  }
  
  Future<bool> _showConfirmationDialog(String title, String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Confirm'),
              ),
            ],
          ),
        ) ??
        false;
  }
  
  void _showOverclockingDialog() {
    // Get selected worker names for display
    final adminService = Provider.of<AdminService>(context, listen: false);
    final selectedWorkerNames = adminService.activeWorkers
        .where((w) => _selectedWorkers.contains(w['id']))
        .map((w) => w['name'])
        .toList();
    
    showDialog(
      context: context,
      builder: (context) {
        String selectedProfile = 'Balanced';
        
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Batch Overclocking'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Apply overclocking profile to ${selectedWorkerNames.length} workers:'),
                  const SizedBox(height: 8),
                  for (var name in selectedWorkerNames.take(3)) Text('• $name'),
                  if (selectedWorkerNames.length > 3)
                    Text('• And ${selectedWorkerNames.length - 3} more...'),
                  const SizedBox(height: 16),
                  const Text('Select overclocking profile:'),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    value: selectedProfile,
                    items: const [
                      DropdownMenuItem(value: 'Efficiency', child: Text('Efficiency')),
                      DropdownMenuItem(value: 'Balanced', child: Text('Balanced')),
                      DropdownMenuItem(value: 'Performance', child: Text('Performance')),
                      DropdownMenuItem(value: 'Aggressive', child: Text('Aggressive')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          selectedProfile = value;
                        });
                      }
                    },
                  ),
                  if (selectedProfile == 'Aggressive')
                    Container(
                      margin: const EdgeInsets.only(top: 16),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: const Text(
                        'Warning: Aggressive profile may cause system instability',
                        style: TextStyle(color: Colors.red),
                      ),
                    ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _applyOverclockProfile(selectedProfile);
                  },
                  child: const Text('Apply'),
                ),
              ],
            );
          },
        );
      },
    );
  }
  
  Future<void> _applyOverclockProfile(String profileName) async {
    if (_selectedWorkers.isEmpty) return;
    
    final adminService = Provider.of<AdminService>(context, listen: false);
    
    // In a real app, this would get the profile settings and apply to all workers
    // For now, just show a snackbar
    _showSnackBar('Applying $profileName profile to ${_selectedWorkers.length} workers');
    
    // For demo, we'll show what would happen in offline mode
    if (adminService.isOfflineMode) {
      _showSnackBar('Changes will be applied when online');
    }
  }
  
  void _handleWorkerAction(String action, Map<String, dynamic> worker) async {
    switch (action) {
      case 'details':
        // Navigate to worker details
        _showSnackBar('Viewing details for ${worker['name']}');
        break;
        
      case 'overclock':
        // Navigate to overclocking screen
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OverclockingScreen(
              workerId: worker['id'],
              workerName: worker['name'],
            ),
          ),
        );
        break;
        
      case 'reboot':
        final confirmed = await _showConfirmationDialog(
          'Reboot Worker',
          'Are you sure you want to reboot ${worker['name']}? This will temporarily stop mining operations.',
        );
        
        if (confirmed) {
          final adminService = Provider.of<AdminService>(context, listen: false);
          final success = await adminService.rebootWorker(worker['id']);
          
          if (success) {
            _showSnackBar('Reboot command sent to ${worker['name']}');
          } else if (adminService.isOfflineMode) {
            _showSnackBar('Reboot request will be sent when online');
          } else {
            _showSnackBar('Failed to reboot worker. Please try again.');
          }
        }
        break;
        
      case 'shutdown':
        final confirmed = await _showConfirmationDialog(
          'Shutdown Worker',
          'Are you sure you want to shutdown ${worker['name']}? This will stop mining operations until manually restarted.',
        );
        
        if (confirmed) {
          _showSnackBar('Shutdown command sent to ${worker['name']}');
        }
        break;
    }
  }
  
  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'online':
        return Colors.green;
      case 'offline':
        return Colors.red;
      case 'degraded':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }
  
  Color _getCoinColor(String coin) {
    switch (coin) {
      case 'BTC':
        return const Color(0xFFF7931A);
      case 'ETH':
        return const Color(0xFF627EEA);
      case 'XMR':
        return const Color(0xFFFF6600);
      case 'LTC':
        return const Color(0xFF345D9D);
      case 'RVN':
        return const Color(0xFF384182);
      default:
        return Colors.grey;
    }
  }
  
  Color _getTemperatureColor(int? temperature) {
    if (temperature == null) return Colors.grey;
    
    if (temperature < 65) {
      return Colors.green;
    } else if (temperature < 80) {
      return Colors.orange;
    } else {
      return Colors.red;
    }
  }
  
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
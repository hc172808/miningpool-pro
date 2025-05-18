import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:crypto_mining_wallet/services/wallet_service.dart';
import 'package:intl/intl.dart';

class MiningScreen extends StatefulWidget {
  const MiningScreen({Key? key}) : super(key: key);

  @override
  State<MiningScreen> createState() => _MiningScreenState();
}

class _MiningScreenState extends State<MiningScreen> {
  bool _isMining = false;
  String _selectedCoin = 'BTC';
  String _miningType = 'solo';
  final _workerNameController = TextEditingController(text: 'worker1');
  
  // Mock data for hashrate history
  final List<FlSpot> _hashrateData = List.generate(
    24,
    (index) => FlSpot(
      index.toDouble(),
      (index * 0.4 + 10 + (index % 3 == 0 ? 2 : 0)),
    ),
  );

  @override
  void dispose() {
    _workerNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Mining stats card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mining Statistics',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 24),
                  
                  // Stats grid
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          'Current Hashrate',
                          '18.5 MH/s',
                          Icons.speed,
                          Colors.blue,
                        ),
                      ),
                      Expanded(
                        child: _buildStatCard(
                          'Active Workers',
                          '2',
                          Icons.computer,
                          Colors.green,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          'Today Earnings',
                          '0.0005 BTC',
                          Icons.monetization_on,
                          Colors.amber,
                        ),
                      ),
                      Expanded(
                        child: _buildStatCard(
                          'Unpaid Balance',
                          '0.0012 BTC',
                          Icons.account_balance_wallet,
                          Colors.purple,
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Hashrate chart
                  Container(
                    height: 200,
                    padding: const EdgeInsets.only(top: 16, right: 16),
                    child: LineChart(
                      LineChartData(
                        gridData: FlGridData(
                          show: true,
                          drawVerticalLine: false,
                          horizontalInterval: 10,
                          getDrawingHorizontalLine: (value) {
                            return FlLine(
                              color: Colors.grey.shade200,
                              strokeWidth: 1,
                            );
                          },
                        ),
                        titlesData: FlTitlesData(
                          show: true,
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 30,
                              getTitlesWidget: (value, meta) {
                                final hours = DateTime.now()
                                    .subtract(Duration(hours: 24 - value.toInt()))
                                    .hour;
                                if (value.toInt() % 4 == 0) {
                                  return Padding(
                                    padding: const EdgeInsets.only(top: 8.0),
                                    child: Text(
                                      '$hours:00',
                                      style: TextStyle(
                                        color: Colors.grey.shade600,
                                        fontSize: 12,
                                      ),
                                    ),
                                  );
                                }
                                return const SizedBox.shrink();
                              },
                            ),
                          ),
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 40,
                              getTitlesWidget: (value, meta) {
                                return Text(
                                  '${value.toInt()} MH/s',
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 12,
                                  ),
                                );
                              },
                            ),
                          ),
                          rightTitles: AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          topTitles: AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        lineBarsData: [
                          LineChartBarData(
                            spots: _hashrateData,
                            isCurved: true,
                            color: Theme.of(context).colorScheme.primary,
                            barWidth: 3,
                            isStrokeCapRound: true,
                            dotData: FlDotData(show: false),
                            belowBarData: BarAreaData(
                              show: true,
                              color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Hashrate (Last 24 hours)',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Mining controls card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mining Controls',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 16),
                  
                  // Coin selection
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Cryptocurrency'),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _selectedCoin,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'BTC', child: Text('Bitcoin (BTC)')),
                                DropdownMenuItem(value: 'ETH', child: Text('Ethereum (ETH)')),
                                DropdownMenuItem(value: 'XMR', child: Text('Monero (XMR)')),
                                DropdownMenuItem(value: 'LTC', child: Text('Litecoin (LTC)')),
                                DropdownMenuItem(value: 'DOGE', child: Text('Dogecoin (DOGE)')),
                              ],
                              onChanged: (value) {
                                if (value != null) {
                                  setState(() {
                                    _selectedCoin = value;
                                  });
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Mining type
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Mining Type'),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _buildMiningTypeButton(
                              'Solo',
                              'solo',
                              'Mine individually with full rewards',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildMiningTypeButton(
                              'Pool',
                              'pool',
                              'Mine with others and share rewards',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Worker name
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Worker Name'),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _workerNameController,
                        decoration: InputDecoration(
                          hintText: 'Enter worker name',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  
                  // Mining info
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: Colors.amber.shade800,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Mining will use your device resources and may drain battery faster.',
                            style: TextStyle(
                              color: Colors.amber.shade800,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Start/Stop mining button
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _isMining = !_isMining;
                      });
                      
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(_isMining 
                            ? 'Mining started' 
                            : 'Mining stopped'
                          ),
                          backgroundColor: _isMining 
                            ? Colors.green 
                            : Colors.red,
                        ),
                      );
                    },
                    icon: Icon(_isMining ? Icons.stop : Icons.play_arrow),
                    label: Text(_isMining ? 'Stop Mining' : 'Start Mining'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isMining ? Colors.red : Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Active workers card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Active Workers',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      IconButton(
                        icon: const Icon(Icons.add),
                        onPressed: () {
                          // Show add worker dialog
                        },
                        tooltip: 'Add Worker',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Worker list
                  _buildWorkerItem(
                    'worker1',
                    'online',
                    '10.5 MH/s',
                    DateTime.now().subtract(const Duration(minutes: 5)),
                  ),
                  const Divider(),
                  _buildWorkerItem(
                    'laptop',
                    'online',
                    '8.0 MH/s',
                    DateTime.now().subtract(const Duration(minutes: 12)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  icon,
                  color: color,
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
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

  Widget _buildMiningTypeButton(String title, String value, String description) {
    final isSelected = _miningType == value;
    
    return GestureDetector(
      onTap: () {
        setState(() {
          _miningType = value;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected 
              ? Theme.of(context).colorScheme.primary.withOpacity(0.1) 
              : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected 
                ? Theme.of(context).colorScheme.primary 
                : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isSelected 
                      ? Icons.radio_button_checked 
                      : Icons.radio_button_unchecked,
                  color: isSelected 
                      ? Theme.of(context).colorScheme.primary 
                      : Colors.grey,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isSelected 
                        ? Theme.of(context).colorScheme.primary 
                        : Colors.black,
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(left: 24),
              child: Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkerItem(String name, String status, String hashrate, DateTime lastSeen) {
    final isOnline = status == 'online';
    final color = isOnline ? Colors.green : Colors.red;
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  'Last seen: ${_formatLastSeen(lastSeen)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                hashrate,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                isOnline ? 'Online' : 'Offline',
                style: TextStyle(
                  fontSize: 12,
                  color: color,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatLastSeen(DateTime lastSeen) {
    final now = DateTime.now();
    final difference = now.difference(lastSeen);
    
    if (difference.inSeconds < 60) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} min ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} hours ago';
    } else {
      return DateFormat('MMM dd, HH:mm').format(lastSeen);
    }
  }
}
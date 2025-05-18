import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:crypto_mining_wallet/services/auth_service.dart';
import 'package:crypto_mining_wallet/services/wallet_service.dart';
import 'package:crypto_mining_wallet/models/wallet.dart';
import 'package:crypto_mining_wallet/screens/login_screen.dart';
import 'package:crypto_mining_wallet/screens/send_screen.dart';
import 'package:crypto_mining_wallet/screens/receive_screen.dart';
import 'package:crypto_mining_wallet/screens/mining_screen.dart';
import 'package:crypto_mining_wallet/screens/settings_screen.dart';
import 'package:fl_chart/fl_chart.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  final DateFormat _dateFormat = DateFormat('MMM dd, yyyy');

  @override
  void initState() {
    super.initState();
    // Refresh wallet data when the screen loads
    Future.microtask(() {
      Provider.of<WalletService>(context, listen: false).loadWallets();
    });
  }

  void _navigateToSend(BuildContext context, Wallet wallet) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => SendScreen(wallet: wallet),
      ),
    );
  }

  void _navigateToReceive(BuildContext context, Wallet wallet) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ReceiveScreen(wallet: wallet),
      ),
    );
  }

  Widget _buildWalletCard(BuildContext context, Wallet wallet) {
    final color = wallet.coin == 'BTC' 
        ? const Color(0xFFF7931A) 
        : wallet.coin == 'ETH' 
            ? const Color(0xFF627EEA)
            : Theme.of(context).colorScheme.primary;

    // Get the last 2 transactions for the recent activity
    final recentTransactions = wallet.transactions.take(2).toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Wallet header with coin and balance
            Row(
              children: [
                // Coin icon
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      wallet.coin,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                
                // Coin name and address
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _getCoinFullName(wallet.coin),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        _shortenAddress(wallet.address),
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                
                // Balance
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${wallet.balance} ${wallet.coin}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    Text(
                      '\$${_calculateFiatValue(wallet).toStringAsFixed(2)} USD',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Send and Receive buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _navigateToSend(context, wallet),
                    icon: const Icon(Icons.arrow_upward, size: 18),
                    label: const Text('Send'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _navigateToReceive(context, wallet),
                    icon: const Icon(Icons.arrow_downward, size: 18),
                    label: const Text('Receive'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.secondary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Recent activity heading
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Activity',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                TextButton(
                  onPressed: () {
                    // Navigate to transactions history
                  },
                  child: const Text('View All'),
                ),
              ],
            ),
            
            // Recent transactions list
            ...recentTransactions.map((transaction) => _buildTransactionItem(context, transaction)),
            
            if (recentTransactions.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: Text('No recent transactions'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionItem(BuildContext context, Transaction transaction) {
    final isIncoming = transaction.type == 'receive' || transaction.type == 'mining_reward';
    final icon = isIncoming 
      ? Icons.arrow_downward 
      : Icons.arrow_upward;
    final color = isIncoming 
      ? Theme.of(context).colorScheme.secondary 
      : Colors.redAccent;
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          // Transaction icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          
          // Transaction details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _getTransactionTypeLabel(transaction.type),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  _dateFormat.format(transaction.timestamp),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          
          // Transaction amount
          Text(
            '${isIncoming ? '+' : '-'} ${transaction.amount} ${transaction.coin}',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final walletService = Provider.of<WalletService>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Crypto Mining Wallet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: _selectedIndex == 0 
        ? _buildWalletTab(context, walletService)
        : _selectedIndex == 1
          ? const MiningScreen()
          : Center(child: Text('Profile')),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet_outlined),
            activeIcon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.trending_up_outlined),
            activeIcon: Icon(Icons.trending_up),
            label: 'Mining',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  Widget _buildWalletTab(BuildContext context, WalletService walletService) {
    if (walletService.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    
    if (walletService.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              color: Colors.red,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'Error loading wallets',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              walletService.error!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                walletService.loadWallets();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (walletService.wallets.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.account_balance_wallet_outlined,
              color: Colors.grey,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'No wallets found',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'You don\'t have any wallets yet.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => walletService.refreshWallets(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Balances overview card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total Balance',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '\$${_calculateTotalFiatBalance(walletService.wallets).toStringAsFixed(2)} USD',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    height: 150,
                    width: double.infinity,
                    child: BarChart(
                      BarChartData(
                        alignment: BarChartAlignment.center,
                        maxY: _getMaxBalance(walletService.wallets) * 1.2,
                        titlesData: FlTitlesData(
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          topTitles: AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                if (value.toInt() >= walletService.wallets.length) {
                                  return const SizedBox.shrink();
                                }
                                return Padding(
                                  padding: const EdgeInsets.only(top: 8.0),
                                  child: Text(
                                    walletService.wallets[value.toInt()].coin,
                                    style: const TextStyle(
                                      color: Colors.grey,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        barGroups: _createBarGroups(walletService.wallets),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),
          
          // Wallet cards
          ...walletService.wallets.map((wallet) => _buildWalletCard(context, wallet)),
        ],
      ),
    );
  }

  // Helper methods
  String _getCoinFullName(String coin) {
    switch (coin) {
      case 'BTC': return 'Bitcoin';
      case 'ETH': return 'Ethereum';
      case 'XMR': return 'Monero';
      case 'LTC': return 'Litecoin';
      case 'RVN': return 'Ravencoin';
      case 'ZEC': return 'Zcash';
      case 'BCH': return 'Bitcoin Cash';
      case 'DOGE': return 'Dogecoin';
      case 'DASH': return 'Dash';
      default: return coin;
    }
  }

  String _shortenAddress(String address) {
    if (address.length <= 12) return address;
    return '${address.substring(0, 6)}...${address.substring(address.length - 6)}';
  }

  String _getTransactionTypeLabel(String type) {
    switch (type) {
      case 'send': return 'Sent';
      case 'receive': return 'Received';
      case 'mining_reward': return 'Mining Reward';
      default: return type;
    }
  }

  double _calculateFiatValue(Wallet wallet) {
    // Mock conversion rates
    final rates = {
      'BTC': 50000.0,
      'ETH': 2500.0,
      'XMR': 150.0,
      'LTC': 75.0,
      'RVN': 0.05,
      'ZEC': 100.0,
      'BCH': 300.0,
      'DOGE': 0.15,
      'DASH': 110.0,
    };
    
    final rate = rates[wallet.coin] ?? 0.0;
    return wallet.balance * rate;
  }

  double _calculateTotalFiatBalance(List<Wallet> wallets) {
    return wallets.fold(0, (sum, wallet) => sum + _calculateFiatValue(wallet));
  }

  double _getMaxBalance(List<Wallet> wallets) {
    if (wallets.isEmpty) return 0;
    return wallets.map((w) => _calculateFiatValue(w)).reduce((a, b) => a > b ? a : b);
  }

  List<BarChartGroupData> _createBarGroups(List<Wallet> wallets) {
    return List.generate(wallets.length, (index) {
      final wallet = wallets[index];
      final value = _calculateFiatValue(wallet);
      final color = wallet.coin == 'BTC' 
          ? const Color(0xFFF7931A) 
          : wallet.coin == 'ETH' 
              ? const Color(0xFF627EEA)
              : Theme.of(context).colorScheme.primary;
              
      return BarChartGroupData(
        x: index,
        barRods: [
          BarChartRodData(
            toY: value,
            color: color,
            width: 15,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(6),
              topRight: Radius.circular(6),
            ),
          ),
        ],
      );
    });
  }
}
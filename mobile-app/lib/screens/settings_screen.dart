import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:crypto_mining_wallet/services/auth_service.dart';
import 'package:crypto_mining_wallet/screens/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  _SettingsScreenState createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  bool _biometricAuthEnabled = false;
  String _currency = 'USD';
  String _theme = 'System';

  Future<void> _logout() async {
    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Logout'),
        content: const Text('Are you sure you want to log out?'),
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
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final authService = Provider.of<AuthService>(context, listen: false);
      await authService.logout();
      
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final userData = authService.userData;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User profile section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                    child: Text(
                      userData?['username']?.substring(0, 1).toUpperCase() ?? 'U',
                      style: TextStyle(
                        fontSize: 24,
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          userData?['username'] ?? 'User',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          userData?['email'] ?? 'user@example.com',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: () {
                      // Navigate to profile edit screen
                    },
                    tooltip: 'Edit Profile',
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 16),
          
          // App settings
          Text(
            'Application Settings',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          
          Card(
            child: Column(
              children: [
                // Notifications
                SwitchListTile(
                  title: const Text('Push Notifications'),
                  subtitle: const Text('Receive alerts for mining rewards and security'),
                  value: _notificationsEnabled,
                  onChanged: (value) {
                    setState(() {
                      _notificationsEnabled = value;
                    });
                  },
                  secondary: const Icon(Icons.notifications_outlined),
                ),
                const Divider(),
                
                // Biometric authentication
                SwitchListTile(
                  title: const Text('Biometric Authentication'),
                  subtitle: const Text('Use fingerprint or face ID to log in'),
                  value: _biometricAuthEnabled,
                  onChanged: (value) {
                    setState(() {
                      _biometricAuthEnabled = value;
                    });
                  },
                  secondary: const Icon(Icons.fingerprint),
                ),
                const Divider(),
                
                // Currency settings
                ListTile(
                  title: const Text('Default Currency'),
                  subtitle: Text(_currency),
                  leading: const Icon(Icons.attach_money),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    _showCurrencySelector();
                  },
                ),
                const Divider(),
                
                // Theme settings
                ListTile(
                  title: const Text('App Theme'),
                  subtitle: Text(_theme),
                  leading: const Icon(Icons.brightness_6_outlined),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    _showThemeSelector();
                  },
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Security section
          Text(
            'Security & Privacy',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          
          Card(
            child: Column(
              children: [
                ListTile(
                  title: const Text('Change Password'),
                  leading: const Icon(Icons.lock_outline),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    // Navigate to change password screen
                  },
                ),
                const Divider(),
                
                ListTile(
                  title: const Text('Security Settings'),
                  leading: const Icon(Icons.security),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    // Navigate to security settings screen
                  },
                ),
                const Divider(),
                
                ListTile(
                  title: const Text('Privacy Policy'),
                  leading: const Icon(Icons.privacy_tip_outlined),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    // Navigate to privacy policy screen
                  },
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Support section
          Text(
            'Support & About',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          
          Card(
            child: Column(
              children: [
                ListTile(
                  title: const Text('Help & Support'),
                  leading: const Icon(Icons.help_outline),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    // Navigate to help screen
                  },
                ),
                const Divider(),
                
                ListTile(
                  title: const Text('About'),
                  leading: const Icon(Icons.info_outline),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () {
                    // Navigate to about screen
                  },
                ),
                const Divider(),
                
                ListTile(
                  title: const Text('App Version'),
                  subtitle: const Text('1.0.0'),
                  leading: const Icon(Icons.system_update_outlined),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 32),
          
          // Logout button
          ElevatedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            label: const Text('Logout'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
          ),
          
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showCurrencySelector() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select Default Currency',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              ListTile(
                title: const Text('US Dollar (USD)'),
                trailing: _currency == 'USD' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _currency = 'USD';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Euro (EUR)'),
                trailing: _currency == 'EUR' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _currency = 'EUR';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('British Pound (GBP)'),
                trailing: _currency == 'GBP' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _currency = 'GBP';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Japanese Yen (JPY)'),
                trailing: _currency == 'JPY' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _currency = 'JPY';
                  });
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showThemeSelector() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select App Theme',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              ListTile(
                title: const Text('System Default'),
                trailing: _theme == 'System' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _theme = 'System';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Light Theme'),
                trailing: _theme == 'Light' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _theme = 'Light';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Dark Theme'),
                trailing: _theme == 'Dark' ? const Icon(Icons.check, color: Colors.green) : null,
                onTap: () {
                  setState(() {
                    _theme = 'Dark';
                  });
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
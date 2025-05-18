import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:crypto_mining_wallet/services/auth_service.dart';
import 'package:crypto_mining_wallet/screens/login_screen.dart';
import 'package:crypto_mining_wallet/screens/home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthentication();
  }

  Future<void> _checkAuthentication() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    
    // Wait a bit to show the splash screen
    await Future.delayed(const Duration(seconds: 2));
    
    if (mounted) {
      if (authService.isAuthenticated) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const HomeScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App logo
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.currency_bitcoin,
                size: 64,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 24),
            
            // App name
            Text(
              'Crypto Mining Wallet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            
            const SizedBox(height: 48),
            
            // Loading indicator
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
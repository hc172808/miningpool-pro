import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:crypto_mining_wallet/models/wallet.dart';

class WalletService extends ChangeNotifier {
  List<Wallet> _wallets = [];
  bool _isLoading = false;
  String? _error;

  List<Wallet> get wallets => _wallets;
  bool get isLoading => _isLoading;
  String? get error => _error;

  WalletService() {
    loadWallets();
  }

  Future<void> loadWallets() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // In a real app, this would be loaded from your API
      // For demo purposes, we're creating mock data
      await Future.delayed(const Duration(seconds: 1));
      
      _wallets = [
        Wallet(
          id: '1',
          address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          coin: 'BTC',
          balance: 0.025,
          transactions: [
            Transaction(
              id: 'tx1',
              type: 'mining_reward',
              status: 'confirmed',
              amount: 0.005,
              timestamp: DateTime.now().subtract(const Duration(days: 1)),
              coin: 'BTC',
              transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            ),
            Transaction(
              id: 'tx2',
              type: 'receive',
              status: 'confirmed',
              amount: 0.02,
              fromAddress: '0x9876543210FEDCBA9876543210FEDCBA98765432',
              timestamp: DateTime.now().subtract(const Duration(days: 3)),
              coin: 'BTC',
              transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            ),
          ],
        ),
        Wallet(
          id: '2',
          address: '0x9876543210FEDCBA9876543210FEDCBA98765432',
          coin: 'ETH',
          balance: 0.5,
          transactions: [
            Transaction(
              id: 'tx3',
              type: 'mining_reward',
              status: 'confirmed',
              amount: 0.1,
              timestamp: DateTime.now().subtract(const Duration(days: 2)),
              coin: 'ETH',
              transactionHash: '0x2468135790abcdef2468135790abcdef2468135790abcdef2468135790abcdef',
            ),
            Transaction(
              id: 'tx4',
              type: 'send',
              status: 'confirmed',
              amount: 0.05,
              toAddress: '0xFEDCBA9876543210FEDCBA9876543210FEDCBA98',
              timestamp: DateTime.now().subtract(const Duration(days: 5)),
              coin: 'ETH',
              transactionHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
            ),
          ],
        ),
      ];
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load wallets: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendTransaction({
    required String walletId, 
    required String toAddress, 
    required double amount,
    required String coin
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // In a real app, this would call your API
      await Future.delayed(const Duration(seconds: 2));
      
      // Find the wallet and update its data
      final walletIndex = _wallets.indexWhere((w) => w.id == walletId);
      if (walletIndex == -1) {
        throw Exception('Wallet not found');
      }
      
      final wallet = _wallets[walletIndex];
      if (wallet.balance < amount) {
        throw Exception('Insufficient balance');
      }
      
      // Create a new transaction
      final newTransaction = Transaction(
        id: 'tx${DateTime.now().millisecondsSinceEpoch}',
        type: 'send',
        status: 'pending',
        amount: amount,
        toAddress: toAddress,
        timestamp: DateTime.now(),
        coin: coin,
      );
      
      // Update the wallet with the new transaction and reduced balance
      final updatedWallet = Wallet(
        id: wallet.id,
        address: wallet.address,
        coin: wallet.coin,
        balance: wallet.balance - amount,
        transactions: [newTransaction, ...wallet.transactions],
      );
      
      _wallets[walletIndex] = updatedWallet;
      _isLoading = false;
      notifyListeners();
      
      return true;
    } catch (e) {
      _error = 'Failed to send transaction: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
  
  Future<void> refreshWallets() async {
    await loadWallets();
  }
}
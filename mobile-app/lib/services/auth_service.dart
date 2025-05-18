import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService extends ChangeNotifier {
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _error;
  String? _token;
  Map<String, dynamic>? _userData;
  
  final _secureStorage = const FlutterSecureStorage();

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get token => _token;
  Map<String, dynamic>? get userData => _userData;

  AuthService() {
    checkAuthentication();
  }

  Future<void> checkAuthentication() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Check if token exists in secure storage
      final storedToken = await _secureStorage.read(key: 'token');
      if (storedToken != null) {
        _token = storedToken;
        
        // Get user data from shared preferences
        final prefs = await SharedPreferences.getInstance();
        final storedUserData = prefs.getString('userData');
        
        if (storedUserData != null) {
          _userData = json.decode(storedUserData);
          _isAuthenticated = true;
        } else {
          // If we have token but no user data, fetch user data
          await _fetchUserData();
        }
      }
    } catch (e) {
      _error = 'Authentication check failed: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // In a real app, this would call your API endpoint
      // For demo purposes, we're simulating a successful login
      await Future.delayed(const Duration(seconds: 2));
      
      if (username == 'user' && password == 'password') {
        _token = 'demo_token_12345';
        await _secureStorage.write(key: 'token', value: _token);
        
        _userData = {
          'id': '1',
          'username': username,
          'email': 'user@example.com',
          'walletAddress': '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        };
        
        // Store user data in shared preferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('userData', json.encode(_userData));
        
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        throw Exception('Invalid username or password');
      }
    } catch (e) {
      _error = 'Login failed: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String username, String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // In a real app, this would call your API endpoint
      await Future.delayed(const Duration(seconds: 2));
      
      // Simulate registration
      _token = 'demo_token_for_new_user';
      await _secureStorage.write(key: 'token', value: _token);
      
      _userData = {
        'id': '2',
        'username': username,
        'email': email,
        'walletAddress': '0x9876543210FEDCBA9876543210FEDCBA98765432',
      };
      
      // Store user data in shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('userData', json.encode(_userData));
      
      _isAuthenticated = true;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Registration failed: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Clear local storage
      await _secureStorage.delete(key: 'token');
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('userData');
      
      _isAuthenticated = false;
      _token = null;
      _userData = null;
    } catch (e) {
      _error = 'Logout failed: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _fetchUserData() async {
    try {
      // In a real app, this would call your API endpoint
      await Future.delayed(const Duration(seconds: 1));
      
      // Simulate fetching user data
      _userData = {
        'id': '1',
        'username': 'user',
        'email': 'user@example.com',
        'walletAddress': '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      };
      
      // Store user data in shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('userData', json.encode(_userData));
      
      _isAuthenticated = true;
    } catch (e) {
      await _secureStorage.delete(key: 'token');
      _token = null;
      _isAuthenticated = false;
      _error = 'Failed to fetch user data: $e';
    }
  }
}
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:crypto_mining_wallet/models/wallet.dart';
import 'package:crypto_mining_wallet/services/wallet_service.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class SendScreen extends StatefulWidget {
  final Wallet wallet;

  const SendScreen({Key? key, required this.wallet}) : super(key: key);

  @override
  _SendScreenState createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _formKey = GlobalKey<FormState>();
  final _addressController = TextEditingController();
  final _amountController = TextEditingController();
  bool _isScannerVisible = false;
  String _scannerError = '';

  @override
  void dispose() {
    _addressController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submitTransaction() async {
    if (_formKey.currentState!.validate()) {
      // Show confirmation dialog
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirm Transaction'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Are you sure you want to send ${_amountController.text} ${widget.wallet.coin}?'),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Text('To: ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Expanded(
                    child: Text(
                      _addressController.text,
                      style: const TextStyle(fontFamily: 'monospace'),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('Amount: ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('${_amountController.text} ${widget.wallet.coin}'),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('Fee: ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('0.0001 ${widget.wallet.coin}'),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'This transaction cannot be reversed once confirmed.',
                style: TextStyle(color: Colors.red),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Confirm'),
            ),
          ],
        ),
      );

      if (confirmed == true) {
        final walletService = Provider.of<WalletService>(context, listen: false);
        
        final success = await walletService.sendTransaction(
          walletId: widget.wallet.id,
          toAddress: _addressController.text.trim(),
          amount: double.parse(_amountController.text),
          coin: widget.wallet.coin,
        );
        
        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Transaction sent successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        }
      }
    }
  }

  void _toggleScanner() {
    setState(() {
      _isScannerVisible = !_isScannerVisible;
      _scannerError = '';
    });
  }

  Widget _buildScanner() {
    return Column(
      children: [
        SizedBox(
          height: 300,
          child: MobileScanner(
            onDetect: (capture) {
              final List<Barcode> barcodes = capture.barcodes;
              if (barcodes.isNotEmpty && barcodes[0].rawValue != null) {
                final String code = barcodes[0].rawValue!;
                
                // Parse cryptocurrency address from QR code
                // In a real app, this would validate the address format
                setState(() {
                  _addressController.text = code;
                  _isScannerVisible = false;
                });
              }
            },
            errorBuilder: (context, error, child) {
              setState(() {
                _scannerError = 'Failed to initialize scanner: $error';
              });
              return Center(
                child: Text(
                  _scannerError,
                  style: const TextStyle(color: Colors.red),
                ),
              );
            },
          ),
        ),
        if (_scannerError.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Text(
              _scannerError,
              style: const TextStyle(color: Colors.red),
            ),
          ),
        TextButton.icon(
          onPressed: _toggleScanner,
          icon: const Icon(Icons.close),
          label: const Text('Close Scanner'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final walletService = Provider.of<WalletService>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Send ${widget.wallet.coin}'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Balance info
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_wallet, size: 24),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Current Balance',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey,
                            ),
                          ),
                          Text(
                            '${widget.wallet.balance} ${widget.wallet.coin}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // QR scanner section
              if (_isScannerVisible) _buildScanner(),
              
              // Recipient address
              if (!_isScannerVisible) ...[
                Text(
                  'Recipient Address',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _addressController,
                  decoration: InputDecoration(
                    hintText: 'Enter wallet address',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.qr_code_scanner),
                      onPressed: _toggleScanner,
                      tooltip: 'Scan QR Code',
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Recipient address is required';
                    }
                    // In a real app, you would validate the address format here
                    if (value.length < 10) {
                      return 'Invalid wallet address';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                
                // Amount
                Text(
                  'Amount',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,8}$')),
                  ],
                  decoration: InputDecoration(
                    hintText: 'Enter amount',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    suffixText: widget.wallet.coin,
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Amount is required';
                    }
                    
                    try {
                      final amount = double.parse(value);
                      if (amount <= 0) {
                        return 'Amount must be greater than 0';
                      }
                      if (amount > widget.wallet.balance) {
                        return 'Insufficient balance';
                      }
                    } catch (e) {
                      return 'Invalid amount';
                    }
                    
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Available: ${widget.wallet.balance} ${widget.wallet.coin}',
                      style: const TextStyle(color: Colors.grey),
                    ),
                    TextButton(
                      onPressed: () {
                        _amountController.text = widget.wallet.balance.toString();
                      },
                      child: const Text('MAX'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Fee info
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 20, color: Colors.grey),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Network fee: 0.0001 ${widget.wallet.coin}',
                          style: TextStyle(color: Colors.grey.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const Spacer(),
                
                // Send button
                ElevatedButton(
                  onPressed: walletService.isLoading ? null : _submitTransaction,
                  child: walletService.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Send'),
                ),
                
                if (walletService.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        walletService.error!,
                        style: TextStyle(color: Colors.red.shade800),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:crypto_mining_wallet/models/wallet.dart';

class ReceiveScreen extends StatefulWidget {
  final Wallet wallet;

  const ReceiveScreen({Key? key, required this.wallet}) : super(key: key);

  @override
  _ReceiveScreenState createState() => _ReceiveScreenState();
}

class _ReceiveScreenState extends State<ReceiveScreen> {
  bool _addressCopied = false;

  void _copyAddressToClipboard() {
    Clipboard.setData(ClipboardData(text: widget.wallet.address));
    setState(() {
      _addressCopied = true;
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Wallet address copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
    
    // Reset the copied state after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _addressCopied = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Receive ${widget.wallet.coin}'),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Wallet type info
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Text(
                  widget.wallet.coin,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // QR code
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: QrImageView(
                          data: widget.wallet.address,
                          version: QrVersions.auto,
                          size: 200,
                          backgroundColor: Colors.white,
                          errorStateBuilder: (context, err) {
                            return const Center(
                              child: Text(
                                'Error generating QR code',
                                style: TextStyle(color: Colors.red),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Warning text
                      RichText(
                        textAlign: TextAlign.center,
                        text: TextSpan(
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade700,
                          ),
                          children: [
                            TextSpan(
                              text: 'Only send ',
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                            TextSpan(
                              text: widget.wallet.coin,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            TextSpan(
                              text: ' to this address',
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              
              // Address display
              Column(
                children: [
                  Text(
                    'Your ${widget.wallet.coin} Address',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.wallet.address,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 14,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Copy button
                  ElevatedButton.icon(
                    onPressed: _copyAddressToClipboard,
                    icon: Icon(
                      _addressCopied ? Icons.check : Icons.copy,
                      size: 18,
                    ),
                    label: Text(_addressCopied ? 'Copied!' : 'Copy Address'),
                    style: ElevatedButton.styleFrom(
                      foregroundColor: _addressCopied 
                          ? Colors.white 
                          : Theme.of(context).colorScheme.primary,
                      backgroundColor: _addressCopied 
                          ? Theme.of(context).colorScheme.secondary 
                          : Colors.white,
                      side: BorderSide(
                        color: _addressCopied 
                            ? Theme.of(context).colorScheme.secondary
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              
              // Additional info
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.blue.shade100),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: Colors.blue.shade700,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Important Information',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.blue.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'This address is specific to your ${widget.wallet.coin} wallet. '
                      'Sending any other cryptocurrency to this address may result in permanent loss of funds.',
                      style: TextStyle(
                        color: Colors.blue.shade700,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Share button
              TextButton.icon(
                onPressed: () {
                  // In a real app, this would use a share plugin
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Share functionality would be implemented here'),
                    ),
                  );
                },
                icon: const Icon(Icons.share),
                label: const Text('Share Address'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
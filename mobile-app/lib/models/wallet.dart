class Wallet {
  final String id;
  final String address;
  final String coin;
  final double balance;
  final List<Transaction> transactions;

  Wallet({
    required this.id,
    required this.address,
    required this.coin,
    required this.balance,
    required this.transactions,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'],
      address: json['address'],
      coin: json['coin'],
      balance: json['balance'].toDouble(),
      transactions: (json['transactions'] as List)
          .map((txn) => Transaction.fromJson(txn))
          .toList(),
    );
  }
}

class Transaction {
  final String id;
  final String type; // send, receive, mining_reward
  final String status; // pending, confirmed, failed
  final double amount;
  final String? toAddress;
  final String? fromAddress;
  final DateTime timestamp;
  final String coin;
  final String? transactionHash;

  Transaction({
    required this.id,
    required this.type,
    required this.status,
    required this.amount,
    this.toAddress,
    this.fromAddress,
    required this.timestamp,
    required this.coin,
    this.transactionHash,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'],
      type: json['type'],
      status: json['status'],
      amount: json['amount'].toDouble(),
      toAddress: json['toAddress'],
      fromAddress: json['fromAddress'],
      timestamp: DateTime.parse(json['timestamp']),
      coin: json['coin'],
      transactionHash: json['transactionHash'],
    );
  }
}
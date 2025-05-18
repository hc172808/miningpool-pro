# Crypto Mining Wallet Mobile App

A mobile application for your cryptocurrency mining pool with send and receive functionality.

## Features

- **Multi-cryptocurrency Support**: Mine and manage BTC, ETH, XMR, LTC, RVN, ZEC, BCH, DOGE, and DASH
- **Wallet Management**: View balances and transaction history
- **Send & Receive Functionality**: Easy cryptocurrency transfers with QR code support
- **Mining Controls**: Start and stop mining operations directly from your phone
- **Real-time Statistics**: Monitor your hashrate, workers, and earnings
- **Security**: Secure authentication and transaction confirmations

## Getting Started

### Prerequisites

- Flutter SDK (2.10.0 or higher)
- Android Studio or VS Code with Flutter extensions
- iOS development requires Xcode (for Mac users)

### Installation

1. Unzip this package to your development directory
2. Open a terminal in the project directory
3. Run `flutter pub get` to install dependencies
4. Connect a device or start an emulator
5. Run `flutter run` to start the application

## Connecting to Your Mining Pool

This mobile app is designed to connect to your existing cryptocurrency mining pool backend. 
You'll need to configure the API endpoints in the app to match your server's configuration.

### Configuration

Update the API base URL in `lib/services/api_service.dart` to point to your mining pool server:

```dart
// Replace with your mining pool server address
static const String baseUrl = 'https://your-mining-pool-api.com';
```

## Login Credentials

For demo purposes, you can use these credentials:

- Username: `user`
- Password: `password`

In a production environment, you should implement proper authentication against your backend API.

## Screenshots

Screenshots of the app's key screens are included in the `screenshots` directory.

## Customization

You can customize the app's colors, fonts, and theme by modifying the `lib/main.dart` file.

## Support

For support with this mobile app, please contact your mining pool administrator.

## License

This mobile application is provided for use with your mining pool software.
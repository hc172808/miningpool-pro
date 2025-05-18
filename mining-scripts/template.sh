#!/bin/bash

# Mining configuration script for MiningPool Pro
# Generated: %DATE%
# Configuration type: %TYPE% mining
# Cryptocurrency: %COIN%

# User configuration
WORKER_NAME="%WORKER_NAME%"
WALLET_ADDRESS="%WALLET_ADDRESS%"
POOL_URL="%POOL_URL%"
MINING_FEE="%MINING_FEE%"

# Print configuration
echo "==============================================="
echo "  MiningPool Pro Mining Configuration"
echo "==============================================="
echo "Worker Name: $WORKER_NAME"
echo "Mining Type: %TYPE%"
echo "Coin: %COIN%"
echo "Pool URL: $POOL_URL"
echo "Fee: $MINING_FEE%"
echo "==============================================="

# Check for dependencies
check_dependency() {
  if ! command -v $1 &> /dev/null; then
    echo "$1 is required but not installed."
    if [ "$2" ]; then
      echo "Install with: $2"
    fi
    return 1
  fi
  return 0
}

install_dependencies() {
  case "%COIN%" in
    "BTC")
      check_dependency "cpuminer" "sudo apt-get install cpuminer" || return 1
      ;;
    "ETH")
      check_dependency "ethminer" "sudo apt-get install ethminer" || return 1
      ;;
    "XMR")
      check_dependency "xmrig" "sudo apt-get install xmrig" || return 1
      ;;
    "LTC")
      check_dependency "cpuminer" "sudo apt-get install cpuminer" || return 1
      ;;
    "RVN")
      check_dependency "kawpowminer" "sudo apt-get install kawpowminer" || return 1
      ;;
    "ZEC")
      check_dependency "nheqminer" "sudo apt-get install nheqminer" || return 1
      ;;
    "BCH")
      check_dependency "cpuminer" "sudo apt-get install cpuminer" || return 1
      ;;
    "DOGE")
      check_dependency "cpuminer" "sudo apt-get install cpuminer" || return 1
      ;;
    "DASH")
      check_dependency "cpuminer" "sudo apt-get install cpuminer" || return 1
      ;;
    *)
      echo "Unsupported coin: %COIN%"
      return 1
      ;;
  esac
  return 0
}

start_mining() {
  echo "Starting %COIN% mining..."
  
  case "%COIN%" in
    "BTC")
      cpuminer -a sha256d -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME
      ;;
    "ETH")
      ethminer -P stratum://$WALLET_ADDRESS.$WORKER_NAME@$POOL_URL
      ;;
    "XMR")
      xmrig -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME --coin=monero
      ;;
    "LTC")
      cpuminer -a scrypt -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME
      ;;
    "RVN")
      kawpowminer -P stratum://$WALLET_ADDRESS.$WORKER_NAME@$POOL_URL
      ;;
    "ZEC")
      nheqminer -l $POOL_URL -u $WALLET_ADDRESS.$WORKER_NAME
      ;;
    "BCH")
      cpuminer -a sha256d -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME
      ;;
    "DOGE")
      cpuminer -a scrypt -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME
      ;;
    "DASH")
      cpuminer -a x11 -o $POOL_URL -u $WALLET_ADDRESS -p $WORKER_NAME
      ;;
    *)
      echo "Unsupported coin: %COIN%"
      exit 1
      ;;
  esac
}

# Main execution
echo "Checking dependencies..."
if install_dependencies; then
  echo "All dependencies are installed."
  echo "Press Ctrl+C to stop mining at any time."
  echo "Starting mining in 5 seconds..."
  sleep 5
  start_mining
else
  echo "Please install the required dependencies and try again."
  exit 1
fi
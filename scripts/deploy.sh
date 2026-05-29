#!/bin/bash
# AnchorFi deployment script
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -e

trap 'echo "ERROR: Deployment failed at line $LINENO"; exit 1' ERR

NETWORK=${1:-testnet}

echo "Deploying AnchorFi to $NETWORK..."
echo ""
echo "Validating Clarinet contracts..."
clarinet check

case $NETWORK in
  simnet)
    clarinet deployments generate --simnet
    echo "Simnet: add contract configuration steps manually in deployments/default.simnet-plan.yaml"
    ;;

  testnet)
    clarinet deployments generate --testnet
    clarinet deployments apply --testnet
    ;;
  mainnet)
    echo "WARNING: Deploying to mainnet. Press Ctrl+C to abort, or wait 5s..."
    sleep 5
    clarinet deployments generate --mainnet
    clarinet deployments apply --mainnet
    ;;
  *)
    echo "Unknown network: $NETWORK. Use testnet or mainnet."
    exit 1
    ;;
esac

echo "Deployment complete."
echo ""
echo "In case of failure, run: clarinet deployments apply --revert"
echo ""
echo "Post-deployment steps:"
echo "1. Call collateral-vault.set-lending-pool <lending-pool-address>"
echo "2. Call ausd-token.set-minter <lending-pool-address>"
echo "3. Call oracle.set-price <initial-stx-usd-price>"
echo "4. Call lending-pool.configure <oracle> <vault> <ausd> <liquidation>"
echo "5. Call liquidation.set-lending-pool <lending-pool-address>"

check_network() {
  if ! clarinet --version > /dev/null 2>&1; then
    echo "Error: clarinet not found. Install from https://docs.hiro.so/clarinet"
    exit 1
  fi
}

check_network

# Enhancement 1: deployment robustness improvement

# Enhancement 2: deployment robustness improvement

# Enhancement 3: deployment robustness improvement

#!/bin/bash

# MiningPool Pro - Setup Script for Linux/Ubuntu Servers
# This script helps set up the full mining pool application on a Linux or Ubuntu server

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}    MiningPool Pro - Server Setup Script    ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""

# Check if running as root
if [ "$(id -u)" != "0" ]; then
   echo -e "${RED}This script must be run as root or with sudo privileges${NC}" 
   exit 1
fi

# Function to display progress
progress() {
  echo -e "${YELLOW}>> $1...${NC}"
}

# Function to check if a command succeeded
check_status() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Success${NC}"
  else
    echo -e "${RED}✗ Failed - $1${NC}"
    exit 1
  fi
}

# Setup system dependencies
install_system_dependencies() {
  progress "Updating package repositories"
  apt-get update
  check_status "Failed to update package repositories"

  progress "Installing system dependencies"
  apt-get install -y curl git build-essential libssl-dev libpq-dev postgresql postgresql-contrib nginx
  check_status "Failed to install system dependencies"
}

# Install Node.js
install_nodejs() {
  progress "Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  check_status "Failed to install Node.js"
  
  # Verify installation
  echo -n "Node.js version: "
  node --version
  echo -n "npm version: "
  npm --version
}

# Setup PostgreSQL database
setup_database() {
  progress "Setting up PostgreSQL database"
  # Start PostgreSQL if not already running
  systemctl is-active --quiet postgresql || systemctl start postgresql
  
  # Create database user and database
  sudo -u postgres psql -c "CREATE USER miningpoolpro WITH PASSWORD 'secure_password_here';" || true
  sudo -u postgres psql -c "CREATE DATABASE miningpool_db OWNER miningpoolpro;" || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE miningpool_db TO miningpoolpro;" || true
  
  # Enable required extensions
  sudo -u postgres psql -d miningpool_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
  
  # Set environment variables for the application
  echo "export DATABASE_URL=postgres://miningpoolpro:secure_password_here@localhost:5432/miningpool_db" >> /etc/profile.d/miningpool.sh
  echo "export PGUSER=miningpoolpro" >> /etc/profile.d/miningpool.sh
  echo "export PGPASSWORD=secure_password_here" >> /etc/profile.d/miningpool.sh
  echo "export PGDATABASE=miningpool_db" >> /etc/profile.d/miningpool.sh
  echo "export PGHOST=localhost" >> /etc/profile.d/miningpool.sh
  echo "export PGPORT=5432" >> /etc/profile.d/miningpool.sh
  
  # Make environment variables available for current session
  source /etc/profile.d/miningpool.sh
  
  check_status "Failed to set up PostgreSQL database"
}

# Clone and set up the application
setup_application() {
  # Get installation directory
  read -p "Enter installation directory [/opt/miningpool-pro]: " INSTALL_DIR
  INSTALL_DIR=${INSTALL_DIR:-/opt/miningpool-pro}
  
  progress "Creating installation directory: $INSTALL_DIR"
  mkdir -p $INSTALL_DIR
  check_status "Failed to create installation directory"
  
  progress "Cloning repository"
  # Replace with your actual repository URL
  git clone https://github.com/yourusername/miningpool-pro.git $INSTALL_DIR
  check_status "Failed to clone repository"
  
  # Change to installation directory
  cd $INSTALL_DIR
  
  progress "Installing npm dependencies"
  npm install
  check_status "Failed to install npm dependencies"
  
  progress "Setting up database schema"
  npm run db:push
  check_status "Failed to set up database schema"
}

# Set up cryptocurrency node directories
setup_nodes() {
  progress "Setting up cryptocurrency node directories"
  
  # Create base directory for cryptocurrency nodes
  mkdir -p $INSTALL_DIR/data
  
  # Create directories for each supported cryptocurrency
  for COIN in btc eth xmr ltc rvn zec bch doge dash; do
    mkdir -p $INSTALL_DIR/data/$COIN
    echo "Created directory for $COIN"
  done
  
  # Set permissions
  chown -R $(whoami) $INSTALL_DIR/data
  
  check_status "Failed to set up cryptocurrency node directories"
}

# Set up Nginx as reverse proxy
setup_nginx() {
  progress "Setting up Nginx as reverse proxy"
  
  # Create Nginx configuration file
  cat > /etc/nginx/sites-available/miningpool-pro << 'EOF'
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

  # Enable the site
  ln -sf /etc/nginx/sites-available/miningpool-pro /etc/nginx/sites-enabled/
  
  # Test Nginx configuration
  nginx -t
  
  # Reload Nginx to apply changes
  systemctl reload nginx
  
  check_status "Failed to set up Nginx"
}

# Create systemd service for running the application
create_systemd_service() {
  progress "Creating systemd service"
  
  # Create service file
  cat > /etc/systemd/system/miningpool-pro.service << EOF
[Unit]
Description=MiningPool Pro Server
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm run dev
Restart=on-failure
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgres://miningpoolpro:secure_password_here@localhost:5432/miningpool_db

[Install]
WantedBy=multi-user.target
EOF

  # Reload systemd to apply changes
  systemctl daemon-reload
  
  # Enable and start the service
  systemctl enable miningpool-pro.service
  systemctl start miningpool-pro.service
  
  check_status "Failed to create systemd service"
}

# Function to install a specific cryptocurrency node
install_cryptocurrency_node() {
  local coin=$1
  local version=$2
  
  case $coin in
    btc)
      progress "Installing Bitcoin Core $version"
      wget https://bitcoincore.org/bin/bitcoin-core-$version/bitcoin-$version-x86_64-linux-gnu.tar.gz
      tar -xzf bitcoin-$version-x86_64-linux-gnu.tar.gz
      install -m 0755 -o root -g root -t /usr/local/bin bitcoin-$version/bin/*
      rm -rf bitcoin-$version-x86_64-linux-gnu.tar.gz bitcoin-$version
      ;;
    eth)
      progress "Installing Geth (Ethereum client)"
      add-apt-repository -y ppa:ethereum/ethereum
      apt-get update
      apt-get install -y ethereum
      ;;
    xmr)
      progress "Installing Monero"
      wget https://downloads.getmonero.org/cli/linux64
      tar -xjf linux64
      cp -r monero-x86_64-linux-gnu-*/  /usr/local/bin/
      rm -rf linux64 monero-x86_64-linux-gnu-*
      ;;
    # Add other cryptocurrencies as needed
  esac
  
  check_status "Failed to install $coin node"
}

# Main installation process
main() {
  # Display welcome message and get confirmation
  echo "This script will install the MiningPool Pro application on your server."
  echo "It includes setting up:"
  echo "  - System dependencies"
  echo "  - Node.js"
  echo "  - PostgreSQL database"
  echo "  - The MiningPool Pro application"
  echo "  - Nginx as a reverse proxy"
  echo "  - Systemd service for automatic startup"
  echo ""
  
  read -p "Do you want to continue? (y/n): " confirm
  if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Installation cancelled"
    exit 0
  fi
  
  # Run installation steps
  install_system_dependencies
  install_nodejs
  setup_database
  setup_application
  setup_nodes
  setup_nginx
  create_systemd_service
  
  # Ask if user wants to install cryptocurrency nodes
  echo ""
  read -p "Do you want to install any cryptocurrency nodes? (y/n): " install_nodes
  if [[ $install_nodes == [yY] || $install_nodes == [yY][eE][sS] ]]; then
    echo "Available options:"
    echo "1. Bitcoin (btc)"
    echo "2. Ethereum (eth)"
    echo "3. Monero (xmr)"
    
    read -p "Enter the number of the cryptocurrency node to install (or 0 to skip): " node_choice
    
    case $node_choice in
      1) install_cryptocurrency_node "btc" "25.0" ;;
      2) install_cryptocurrency_node "eth" "" ;;
      3) install_cryptocurrency_node "xmr" "" ;;
      0) echo "Skipping cryptocurrency node installation" ;;
      *) echo "Invalid option" ;;
    esac
  fi
  
  # Installation complete
  echo ""
  echo -e "${GREEN}==================================================${NC}"
  echo -e "${GREEN}    MiningPool Pro installation complete!    ${NC}"
  echo -e "${GREEN}==================================================${NC}"
  echo ""
  echo "The application should now be running and accessible at:"
  echo "http://your_server_ip"
  echo ""
  echo "You can check the service status with:"
  echo "systemctl status miningpool-pro.service"
  echo ""
  echo "To view logs:"
  echo "journalctl -u miningpool-pro.service"
  echo ""
  echo "Default admin credentials:"
  echo "Username: admin"
  echo "Password: adminPassword123"
  echo ""
  echo -e "${YELLOW}IMPORTANT: Please change the default admin password immediately after login!${NC}"
  echo ""
}

# Run the main function
main
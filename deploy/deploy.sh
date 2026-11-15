#!/bin/bash

# ============================================
# Pakalale Deployment Script for AWS EC2
# ============================================
# Run this on a fresh Ubuntu 22.04 EC2 instance
# Usage: curl -sL https://raw.githubusercontent.com/your-repo/deploy.sh | bash
# ============================================

set -e

echo "🚀 Starting Pakalale deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================
# 1. System Updates
# ============================================
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# ============================================
# 2. Install Node.js 20
# ============================================
echo -e "${YELLOW}📦 Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ============================================
# 3. Install PM2 globally
# ============================================
echo -e "${YELLOW}📦 Installing PM2...${NC}"
sudo npm install -g pm2

# ============================================
# 4. Install Nginx
# ============================================
echo -e "${YELLOW}📦 Installing Nginx...${NC}"
sudo apt-get install -y nginx

# ============================================
# 5. Install Certbot for SSL
# ============================================
echo -e "${YELLOW}📦 Installing Certbot...${NC}"
sudo apt-get install -y certbot python3-certbot-nginx

# ============================================
# 6. Create app directory
# ============================================
echo -e "${YELLOW}📁 Setting up app directory...${NC}"
sudo mkdir -p /var/www/pakalale
sudo chown $USER:$USER /var/www/pakalale

# ============================================
# 7. Clone and setup the app
# ============================================
echo -e "${YELLOW}📥 Cloning repository...${NC}"
cd /var/www/pakalale

# If you have a Git repo:
# git clone https://github.com/your-username/pakalale.git .

# Or copy your files manually:
# scp -r /local/path/* user@ec2-ip:/var/www/pakalale/

# ============================================
# 8. Install dependencies and build
# ============================================
echo -e "${YELLOW}🔨 Building the app...${NC}"
npm ci --only=production
npm run build

# ============================================
# 9. Create logs directory
# ============================================
mkdir -p logs

# ============================================
# 10. Setup environment variables
# ============================================
echo -e "${YELLOW}🔐 Setting up environment...${NC}"
if [ ! -f .env ]; then
  echo -e "${RED}⚠️  No .env file found!${NC}"
  echo "Please create /var/www/pakalale/.env with your environment variables:"
  echo ""
  echo "Required variables:"
  echo "  MONGODB_URI=your_mongodb_connection_string"
  echo "  NEXTAUTH_SECRET=your_secret_key"
  echo "  NEXTAUTH_URL=https://your-domain.com"
  echo "  CLOUDINARY_CLOUD_NAME=your_cloud_name"
  echo "  CLOUDINARY_API_KEY=your_api_key"
  echo "  CLOUDINARY_API_SECRET=your_api_secret"
  echo "  PORT=3000"
  echo ""
  exit 1
fi

# ============================================
# 11. Start with PM2
# ============================================
echo -e "${YELLOW}🚀 Starting app with PM2...${NC}"
pm2 start ecosystem.config.cjs
pm2 save

# Setup PM2 to start on boot
pm2 startup | grep "sudo" | bash

# ============================================
# 12. Configure Nginx
# ============================================
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/pakalale

# Replace domain placeholder
read -p "Enter your domain name (or IP for now): " DOMAIN
sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/pakalale

# Enable the site
sudo ln -sf /etc/nginx/sites-available/pakalale /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

# ============================================
# 13. Setup SSL (if domain is provided)
# ============================================
if [[ "$DOMAIN" != *.* ]] || [[ "$DOMAIN" == *"localhost"* ]]; then
  echo -e "${YELLOW}ℹ️  Skipping SSL setup (not a valid domain)${NC}"
  echo "To setup SSL later, run:"
  echo "  sudo certbot --nginx -d $DOMAIN"
else
  echo -e "${YELLOW}🔒 Setting up SSL...${NC}"
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN"
fi

# ============================================
# 14. Open firewall ports
# ============================================
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# ============================================
# 15. Verify deployment
# ============================================
echo -e "${YELLOW}✅ Verifying deployment...${NC}"
sleep 5

if curl -s http://localhost:3000 > /dev/null; then
  echo -e "${GREEN}✅ App is running on port 3000${NC}"
else
  echo -e "${RED}❌ App failed to start. Check logs with: pm2 logs pakalale${NC}"
fi

if curl -s http://localhost > /dev/null; then
  echo -e "${GREEN}✅ Nginx is proxying correctly${NC}"
else
  echo -e "${RED}❌ Nginx proxy failed. Check: sudo nginx -t${NC}"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your app is now running at:"
echo "  HTTP:  http://$DOMAIN"
echo "  HTTPS: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 status              # Check app status"
echo "  pm2 logs pakalale       # View logs"
echo "  pm2 restart pakalale    # Restart app"
echo "  pm2 stop pakalale       # Stop app"
echo "  sudo nginx -t           # Test Nginx config"
echo "  sudo systemctl restart nginx  # Restart Nginx"
echo ""
echo "To update the app:"
echo "  cd /var/www/pakalale"
echo "  git pull"
echo "  npm ci --only=production"
echo "  npm run build"
echo "  pm2 restart pakalale"
echo ""

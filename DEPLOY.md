# 🚀 Pakalale Deployment Guide (AWS EC2)

This guide walks you through deploying Pakalale to AWS EC2 with full WebSocket support.

## Deploying the Next.js app to Vercel

Vercel can build and host the Next.js pages and API routes. Import the repository with its root directory set to the project root and use `npm run build` as the build command. Configure the app's environment variables in the Vercel project settings for each deployment environment; do not commit `.env` files.

The app's `server.ts` starts a custom HTTP server with Socket.IO and is used by the local and EC2 `start` scripts. Vercel's Next.js deployment does not launch that process, so real-time chat and online-presence events need a separate realtime service or a host that runs the custom Node server. Use the EC2 instructions below when the bundled Socket.IO server is required.

## Prerequisites

- AWS account (free tier eligible)
- Domain name (optional but recommended for SSL)
- Your MongoDB Atlas connection string
- Cloudinary API keys

## Step 1: Launch EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:
   - **Name**: `pakalale-server`
   - **AMI**: Ubuntu 22.04 LTS (Free tier eligible)
   - **Instance type**: `t2.micro` (Free tier: 750 hrs/month)
   - **Key pair**: Create new or select existing (for SSH access)
   - **Network settings**: 
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere
     - Allow HTTPS (port 443) from anywhere
   - **Storage**: 20 GB (free tier includes 30 GB)

4. Click **Launch Instance**

## Step 2: Connect to Your Instance

```bash
# Download your key pair (.pem file) if you haven't already
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 3: Upload Your Code

**Option A: Using Git (recommended)**
```bash
# On the EC2 instance
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/your-username/pakalale.git /var/www/pakalale
cd /var/www/pakalale
```

**Option B: Using SCP (from your local machine)**
```bash
# From your local machine
scp -i your-key.pem -r ./ your-username@ec2-ip:/var/www/pakalale/
```

## Step 4: Setup Environment Variables

```bash
cd /var/www/pakalale
nano .env
```

Add your environment variables:
```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pakalale?retryWrites=true&w=majority

# NextAuth
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server
PORT=3000
NODE_ENV=production
```

Save and exit (Ctrl+X, Y, Enter).

## Step 5: Run Deployment Script

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

The script will:
- Install Node.js, PM2, Nginx, and Certbot
- Build your Next.js app
- Configure Nginx as reverse proxy
- Setup SSL with Let's Encrypt (if domain provided)
- Start the app with PM2

## Step 6: Verify Deployment

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs pakalale

# Test the app
curl http://localhost:3000
```

## Step 7: Setup Domain (Optional)

If you have a domain:

1. **Point your domain to EC2 IP**:
   - Go to your domain registrar
   - Add an A record: `@` → `your-ec2-public-ip`
   - Add a CNAME record: `www` → `@`

2. **Run the deployment script again** with your domain:
   ```bash
   ./deploy/deploy.sh
   # Enter your domain when prompted
   ```

3. **Verify SSL**:
   ```bash
   sudo certbot certificates
   ```

## Step 8: Setup MongoDB Atlas IP Whitelist

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to **Network Access**
3. Add your EC2 public IP:
   ```bash
   # Get your public IP
   curl ifconfig.me
   ```
4. Add this IP to the whitelist

## Useful Commands

```bash
# App management
pm2 status                    # Check app status
pm2 logs pakalale            # View logs
pm2 restart pakalale         # Restart app
pm2 stop pakalale            # Stop app
pm2 monit                    # Monitor resources

# Nginx
sudo nginx -t                # Test config
sudo systemctl restart nginx # Restart Nginx
sudo systemctl status nginx  # Check status

# SSL
sudo certbot renew           # Renew certificates
sudo certbot certificates    # Check certificates

# System
htop                         # Monitor resources
df -h                        # Check disk space
free -h                      # Check memory
```

## Troubleshooting

### App won't start
```bash
# Check logs
pm2 logs pakalale

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart PM2
pm2 restart all
```

### WebSocket not connecting
1. Check Nginx config: `sudo nginx -t`
2. Check firewall: `sudo ufw status`
3. Check security groups in AWS (ports 80, 443 must be open)

### SSL not working
```bash
# Force renew
sudo certbot renew --force-renewal

# Check certificates
sudo certbot certificates
```

### High memory usage
```bash
# Check memory
free -h

# Restart app
pm2 restart pakalale

# If consistently high, consider upgrading to t3.small
```

## Cost Estimate (AWS Free Tier)

| Resource | Free Allowance | Cost After Free Tier |
|---|---|---|
| EC2 t2.micro | 750 hrs/month | ~$8/month |
| EBS Storage | 30 GB | ~$3/month |
| Data Transfer | 100 GB/month | ~$9/month |

**Total**: Free for 12 months, then ~$20/month

## Security Checklist

- [ ] SSH key is secure (not shared)
- [ ] Firewall is enabled (UFW)
- [ ] Only necessary ports are open (22, 80, 443)
- [ ] MongoDB Atlas has IP whitelist
- [ ] Environment variables are secure
- [ ] SSL is enabled and working
- [ ] PM2 is configured to restart on crash

## Next Steps

1. **Setup monitoring**: Consider adding PM2 Plus or a service like UptimeRobot
2. **Backup strategy**: Setup automated MongoDB backups
3. **CI/CD**: Setup GitHub Actions for automatic deployments
4. **Scaling**: If traffic grows, upgrade to t3.small or add load balancing

---

**Need help?** Check the [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/) or [PM2 Documentation](https://pm2.keymetrics.io/)

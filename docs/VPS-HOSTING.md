# VPS Hosting Setup

This guide covers deploying Color Palette Maker on a generic VPS (DigitalOcean, Linode, Hostinger VPS, AWS EC2, etc.) with Ubuntu or Debian.

---

## Prerequisites

- A VPS with root or sudo access
- SSH key or password for access
- Your repo URL (GitHub, GitLab, or other)

---

## 1. Initial Server Setup

SSH into the server:

```bash
ssh user@your-server-ip
```

Update the system and install essential tools:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

---

## 2. Install Docker

Docker is the simplest way to run the app (Node + Python + OpenCV in one image).

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (so you don't need sudo for docker)
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

---

## 3. Clone the Repository

### Public repos

```bash
cd ~
git clone https://github.com/YOUR_ORG/color-palette-maker-react.git
cd color-palette-maker-react
```

### Private repos: Deploy key (recommended)

A deploy key is an SSH key scoped to one repo. Use read-only so the VPS can pull but not push.

**On the VPS** — generate a key pair (no passphrase for unattended pulls):

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/color_palette_deploy -N ""
```

Display the public key (you will add this to GitHub):

```bash
cat ~/.ssh/color_palette_deploy.pub
```

Copy the output (starts with `ssh-ed25519`).

**On GitHub** — add the deploy key:

1. Open the repo → **Settings** → **Deploy keys**
2. Click **Add deploy key**
3. **Title**: e.g. `VPS deploy`
4. **Key**: paste the public key
5. Check **Allow read access** (recommended for servers)
6. Click **Add key**

**On the VPS** — configure SSH to use this key for GitHub and clone:

```bash
# Create or edit SSH config
mkdir -p ~/.ssh
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/color_palette_deploy
  IdentitiesOnly yes
EOF

# Clone via SSH
cd ~
git clone git@github.com:YOUR_ORG/color-palette-maker-react.git
cd color-palette-maker-react
```

Replace `YOUR_ORG` and the repo name with your actual values.

---

## 4. Run with Docker Compose

```bash
docker compose up -d --build
```

The app listens on port 3000. Uploads and metadata are persisted in `./docker-data/` on the host.

---

## 5. Firewall (Optional but Recommended)

Allow HTTP/HTTPS and SSH, then enable UFW:

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

If you expose the app directly on port 3000:

```bash
sudo ufw allow 3000/tcp
```

---

## 6. Reverse Proxy (Optional)

To serve on port 80/443 with TLS, use Nginx or Caddy as a reverse proxy.

### Nginx

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/color-palette-maker-react
```

Add:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/color-palette-maker-react /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

For HTTPS, use Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 7. Restart on Boot

Docker Compose services can restart automatically. In `docker-compose.yml` add:

```yaml
services:
  app:
    restart: unless-stopped
    # ... rest of config
```

Or use systemd. Create `/etc/systemd/system/color-palette-maker-react.service`:

```ini
[Unit]
Description=Color Palette Maker React
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USER/color-palette-maker-react
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=YOUR_USER

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable color-palette-maker-react
sudo systemctl start color-palette-maker-react
```

---

## 8. Updates

To pull new code and redeploy:

```bash
cd ~/color-palette-maker-react
git pull
docker compose up -d --build
```

---

## Alternative: Manual Install (No Docker)

If you prefer not to use Docker:

1. Install Node.js 20+, Python 3, and OpenCV:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs python3 python3-pip python3-venv
   pip3 install --break-system-packages -r requirements.txt
   ```

2. Clone the repo and install:

   ```bash
   git clone https://github.com/YOUR_ORG/color-palette-maker-react.git
   cd color-palette-maker-react
   npm install && cd client && npm install && cd ..
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   ```

3. Build and run:

   ```bash
   npm run build
   PORT=3000 npm start
   ```

Use a process manager (e.g. `pm2` or systemd) to keep the app running and restart on crash/reboot.

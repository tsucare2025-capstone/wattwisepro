# Node.js Installation Guide for Windows

## Option 1: Install Node.js (Recommended for Local Development)

### Step 1: Download Node.js
1. Go to [Node.js official website](https://nodejs.org/)
2. Download the **LTS (Long Term Support)** version for Windows
3. Choose the Windows Installer (.msi) - either 64-bit or 32-bit based on your system

### Step 2: Install Node.js
1. Run the downloaded installer
2. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation location (default is fine)
   - ✅ Make sure "Add to PATH" is checked
   - ✅ Make sure "npm package manager" is checked
   - Click "Install"
3. Wait for installation to complete

### Step 3: Verify Installation
Open a **new** PowerShell or Command Prompt window and run:
```powershell
node --version
npm --version
```

You should see version numbers like:
- `v20.x.x` (or similar)
- `10.x.x` (or similar)

### Step 4: Install Backend Dependencies
Now you can run:
```powershell
cd backend
npm install
```

### Step 5: Run the Backend
```powershell
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

---

## Option 2: Deploy to Railway Without Local Setup

If you don't want to install Node.js locally, you can deploy directly to Railway:

### Step 1: Push Code to GitHub
1. Make sure your `WattWisePro` project is in a Git repository
2. Push to GitHub

### Step 2: Deploy to Railway
1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the Node.js backend

### Step 3: Configure Railway
1. **Set Root Directory:**
   - Go to your service settings
   - Under "Settings" → "Root Directory"
   - Set it to `backend`

2. **Add MySQL Database:**
   - Click "New" → "Database" → "MySQL"
   - Railway will automatically connect it

3. **Get Your Backend URL:**
   - Go to your service settings
   - Click "Generate Domain" or use the default
   - Copy the URL (e.g., `https://your-app.railway.app`)

### Step 4: Update Android App
1. Open `app/src/main/java/myapplication/test/wattwisepro/api/RetrofitClient.kt`
2. Update `BASE_URL` with your Railway URL:
   ```kotlin
   private const val BASE_URL = "https://your-app.railway.app/"
   ```

---

## Quick Troubleshooting

### If npm still not recognized after installation:
1. **Close and reopen** your terminal/PowerShell
2. Restart your computer (sometimes needed)
3. Check if Node.js is in PATH:
   - Open PowerShell
   - Run: `$env:PATH`
   - Look for `C:\Program Files\nodejs\` in the output

### If you see permission errors:
Run PowerShell as Administrator:
1. Right-click PowerShell
2. Select "Run as Administrator"
3. Try `npm install` again

---

## Alternative: Use WSL (Windows Subsystem for Linux)

If you prefer Linux environment:

1. Install WSL from Microsoft Store
2. Install Node.js in WSL:
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```
3. Use WSL terminal for backend development

---

## Next Steps After Installation

Once Node.js is installed:

1. **Install dependencies:**
   ```powershell
   cd WattWisePro\backend
   npm install
   ```

2. **Create .env file** (for local testing):
   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=smart_energy_tracking
   PORT=3000
   NODE_ENV=development
   ```

3. **Start backend:**
   ```powershell
   npm run dev
   ```

4. **Test backend:**
   - Open browser: `http://localhost:3000/health`
   - Should see: `{"status":"healthy","database":"connected"}`

---

## Need Help?

- **Node.js Documentation:** https://nodejs.org/en/docs/
- **npm Documentation:** https://docs.npmjs.com/
- **Railway Documentation:** https://docs.railway.app/



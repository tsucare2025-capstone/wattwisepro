# Railway Backend Deployment Guide

This guide will help you deploy your Node.js backend to Railway. You already have a MySQL service set up - we'll connect the backend to it.

---

## 📋 Prerequisites

✅ MySQL service already created in Railway  
✅ GitHub repository with your code  
✅ Code pushed to GitHub  

---

## 🚀 Step 1: Deploy Backend Service

### 1.1 Create New Service
1. Go to [Railway Dashboard](https://railway.app)
2. Open your existing project (the one with MySQL)
3. Click **"New"** button
4. Select **"Service"** → **"Deploy from GitHub repo"**
5. Select your GitHub repository

### 1.2 Configure Service
1. Railway will auto-detect Node.js
2. Go to your service **Settings**
3. Find **"Root Directory"** setting
4. Set it to: `backend`
5. Click **"Save"**

### 1.3 Connect to MySQL
1. In your backend service, click **"Variables"** tab
2. Railway should automatically detect your MySQL service
3. If not, you can manually add the MySQL service as a dependency:
   - Click **"Settings"** → **"Networking"**
   - Under **"Service Dependencies"**, add your MySQL service

---

## 🔧 Step 2: Verify Environment Variables

Railway automatically sets these variables when MySQL is connected:

- `MYSQLUSER` - MySQL username
- `MYSQL_ROOT_PASSWORD` - MySQL password
- `MYSQL_DATABASE` - Database name
- `RAILWAY_PRIVATE_DOMAIN` - Private MySQL host
- `RAILWAY_TCP_PROXY_DOMAIN` - Public MySQL host (if needed)
- `RAILWAY_TCP_PROXY_PORT` - Public MySQL port (if needed)
- `PORT` - Backend server port

### Check Variables:
1. Go to your backend service
2. Click **"Variables"** tab
3. Verify these variables are present:
   - ✅ `MYSQLUSER`
   - ✅ `MYSQL_ROOT_PASSWORD`
   - ✅ `MYSQL_DATABASE`
   - ✅ `RAILWAY_PRIVATE_DOMAIN`
   - ✅ `PORT`

**Note:** Your `server.js` already reads these variables automatically!

---

## 🌐 Step 3: Generate Public Domain

1. In your backend service, click **"Settings"**
2. Find **"Domains"** section
3. Click **"Generate Domain"** or **"Add Domain"**
4. Railway will create a public URL like:
   - `https://wattwisepro-production.up.railway.app`
   - `https://your-custom-name.railway.app`

5. **Copy this URL** - you'll need it for the Android app!

---

## 📦 Step 4: Deploy

1. Railway will automatically start deploying when:
   - Code is pushed to GitHub (if connected)
   - Or manually click **"Deploy"** in the dashboard

2. Watch the **"Deployments"** tab:
   - Green checkmark = Success ✅
   - Red X = Failed ❌

3. Check **"Logs"** tab for:
   - `✅ Database connected successfully`
   - `✅ User table ready`
   - `🚀 Server is running on port XXXX`

---

## 🧪 Step 5: Test Your Deployment

### Test Health Endpoint
Open your browser and visit:
```
https://your-backend-url.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-..."
}
```

### Test Root Endpoint
```
https://your-backend-url.railway.app/
```

**Expected Response:**
```json
{
  "message": "WattWise Pro API is running",
  "status": "ok",
  "timestamp": "2024-..."
}
```

---

## 🔍 Step 6: Monitor and Debug

### View Logs
1. Go to your backend service
2. Click **"Logs"** tab
3. Watch for:
   - ✅ Successful database connection
   - ✅ Server startup messages
   - ❌ Any error messages

### Common Issues

#### Database Connection Failed
**Symptoms:** Logs show "Database connection failed"

**Solutions:**
1. Check MySQL service is running in Railway
2. Verify environment variables are set
3. Check `RAILWAY_PRIVATE_DOMAIN` is correct
4. Ensure MySQL service is in the same project

#### Service Won't Start
**Symptoms:** Deployment fails or service crashes

**Solutions:**
1. Check **"Logs"** tab for error messages
2. Verify `package.json` has correct start script:
   ```json
   "scripts": {
     "start": "node server.js"
   }
   ```
3. Ensure all dependencies are in `package.json`
4. Check Node.js version compatibility

#### Port Issues
**Symptoms:** Service starts but not accessible

**Solutions:**
1. Railway automatically sets `PORT` environment variable
2. Your `server.js` should use: `process.env.PORT || 3000`
3. Don't hardcode port numbers!

---

## 🔐 Step 7: Security Check

### Environment Variables
- ✅ Never commit `.env` files to GitHub
- ✅ Railway automatically injects secrets
- ✅ `.env` is already in `.gitignore`

### HTTPS
- ✅ Railway automatically provides HTTPS
- ✅ No additional SSL configuration needed

---

## 📝 Step 8: Update Android App

After successful deployment:

1. **Get your backend URL** from Railway (Step 3)
2. **Share the URL** with Android developer
3. Android developer should update `RetrofitClient.kt`:
   ```kotlin
   private const val BASE_URL = "https://your-backend-url.railway.app/"
   ```

See `ANDROID_SETUP_GUIDE.md` for detailed Android setup instructions.

---

## 🔄 Step 9: Continuous Deployment

Railway automatically redeploys when:
- ✅ You push code to the connected GitHub branch
- ✅ Manual deploy button is clicked

### Automatic Deploys
1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update backend"
   git push origin main
   ```
3. Railway will automatically detect and deploy!

---

## 📊 Step 10: Database Verification

After deployment, verify the database:

1. **Check Logs** for:
   - `✅ Database connected successfully`
   - `✅ User table ready`

2. **Optional: Connect via MySQL Workbench**
   - Use the MySQL connection string from Railway
   - Verify `User` table was created
   - Check table structure

---

## 🎯 Quick Reference

### Your Backend Service Settings:
- **Root Directory:** `backend`
- **Build Command:** (auto-detected, usually `npm install`)
- **Start Command:** `npm start`
- **Port:** Set automatically via `PORT` env variable

### Environment Variables (Auto-set by Railway):
- `MYSQLUSER`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `RAILWAY_PRIVATE_DOMAIN`
- `PORT`

### Your Backend URL:
```
https://your-service-name.railway.app
```
(Copy from Railway dashboard → Settings → Domains)

---

## ✅ Deployment Checklist

Before marking deployment as complete:
- [ ] Backend service created
- [ ] Root directory set to `backend`
- [ ] MySQL service connected
- [ ] Environment variables verified
- [ ] Public domain generated
- [ ] Deployment successful (green checkmark)
- [ ] Health endpoint returns 200 OK
- [ ] Database connection successful in logs
- [ ] Backend URL copied and shared with Android team

---

## 🐛 Troubleshooting

### Deployment Fails Immediately
- Check `package.json` exists in `backend` folder
- Verify `server.js` is the entry point
- Check Railway logs for specific error

### Database Connection Times Out
- Verify MySQL service is running
- Check `RAILWAY_PRIVATE_DOMAIN` variable
- Ensure MySQL and backend are in same project

### 404 Not Found
- Verify root directory is set to `backend`
- Check if routes are correctly defined in `server.js`
- Test with `/health` endpoint first

### Service Crashes After Deployment
- Check logs for runtime errors
- Verify all dependencies in `package.json`
- Check Node.js version compatibility

---

## 📞 Need Help?

- **Railway Docs:** https://docs.railway.app/
- **Railway Status:** https://status.railway.app/
- **Support:** Check Railway dashboard support section

---

## 🎉 Success!

If you see:
- ✅ Green deployment status
- ✅ Health endpoint returns healthy status
- ✅ Logs show successful database connection

**Congratulations! Your backend is deployed and ready to use!**

Share the backend URL with your Android developer to update the app.


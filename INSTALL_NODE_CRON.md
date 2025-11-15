# Installation Instructions: node-cron

## What is node-cron?

`node-cron` is a Node.js package that allows us to schedule tasks (like cron jobs) to run at specific times. We use it to automatically update weekly and monthly usage data at the end of each day.

## Installation Steps

### Option 1: Using npm (Recommended)

1. **Open Terminal/Command Prompt**
   - On Windows: Press `Win + R`, type `cmd`, press Enter
   - On Mac/Linux: Open Terminal

2. **Navigate to the backend folder**
   ```bash
   cd path/to/WattWisePro/backend
   ```
   Example:
   ```bash
   cd C:\Users\vonne\AndroidStudioProjects\WattWisePro\backend
   ```

3. **Install node-cron**
   ```bash
   npm install node-cron
   ```

4. **Verify installation**
   - Check that `node-cron` appears in `package.json` under `dependencies`
   - You should see a new folder `node_modules/node-cron` in the backend directory

### Option 2: Using npm install (if package.json is already updated)

If the `package.json` file already has `node-cron` listed in dependencies, you can simply run:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including `node-cron`.

## Verification

After installation, verify it worked:

1. **Check package.json**
   - Open `backend/package.json`
   - Look for `"node-cron": "^3.0.3"` in the `dependencies` section

2. **Check node_modules**
   - Look for `backend/node_modules/node-cron` folder
   - If it exists, installation was successful

3. **Test the server**
   - Start the server: `npm start` or `node server.js`
   - You should see: `✅ End-of-day batch job scheduled (runs daily at 00:01 UTC)`
   - If you see this message, node-cron is working correctly!

## Troubleshooting

### Error: "npm is not recognized"
- **Solution**: Install Node.js from https://nodejs.org/
- Make sure to check "Add to PATH" during installation

### Error: "Cannot find module 'node-cron'"
- **Solution**: Make sure you're in the `backend` folder when running `npm install`
- Try deleting `node_modules` folder and `package-lock.json`, then run `npm install` again

### Error: "Permission denied"
- **Solution (Windows)**: Run Command Prompt as Administrator
- **Solution (Mac/Linux)**: Use `sudo npm install node-cron` (not recommended) or fix npm permissions

## What happens after installation?

Once `node-cron` is installed:
- The server will automatically schedule a job to run at **00:01 UTC every day**
- This job updates `weeklyUsage` and `monthlyUsage` tables
- The job runs in the background and doesn't affect API performance
- You'll see log messages when the job runs: `⏰ End-of-day batch job triggered`

## Need Help?

If you encounter any issues:
1. Make sure Node.js is installed: `node --version`
2. Make sure npm is installed: `npm --version`
3. Check that you're in the correct directory (backend folder)
4. Try `npm install` without specifying the package name (installs all dependencies)

---

**Note**: The `package.json` file has already been updated to include `node-cron`. You just need to run `npm install` to download and install it.


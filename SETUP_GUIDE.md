# WattWise Pro Setup Guide

## 📱 Android App Setup

### 1. Update Backend URL
Open `app/src/main/java/myapplication/test/wattwisepro/api/RetrofitClient.kt` and update the `BASE_URL`:

```kotlin
private const val BASE_URL = "https://your-railway-app.railway.app/"
```

**For Local Testing:**
- **Emulator:** `http://10.0.2.2:3000/`
- **Physical Device:** `http://YOUR_COMPUTER_IP:3000/`

### 2. Sync Gradle
- In Android Studio: **File → Sync Project with Gradle Files**

### 3. Test Sign Up
1. Run the app
2. Fill in all signup fields:
   - Username
   - Email
   - Password
   - Repeat Password
   - Address
   - Household Type (Spinner)
   - City (defaults to "Tarlac City")
   - Subdivision
   - Phone Number
3. Click "Create Account"

---

## 🔧 Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Variables

#### For Railway Deployment:
Railway automatically provides these variables. No configuration needed!

#### For Local Development:
Create `backend/.env` file:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=smart_energy_tracking
PORT=3000
NODE_ENV=development
```

### 3. Run Backend
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Test API
```bash
# Health check
curl http://localhost:3000/health

# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "password": "password123",
    "address": "123 Main St",
    "householdType": "Family",
    "city": "Tarlac City",
    "subdivision": "Villa San Jose",
    "phoneNumber": "09123456789"
  }'
```

---

## 🚂 Railway Deployment

### 1. Connect Repository
1. Go to [Railway](https://railway.app)
2. Create new project
3. Connect GitHub repository

### 2. Add MySQL Service
1. Click "New" → "Database" → "MySQL"
2. Railway will create MySQL instance
3. Environment variables will be automatically set

### 3. Deploy Backend
1. Click "New" → "Service" → "GitHub Repo"
2. Select your repository
3. Set root directory to `backend`
4. Railway will auto-detect Node.js and deploy

### 4. Get Backend URL
1. Go to your service settings
2. Generate public domain
3. Copy the URL (e.g., `https://wattwisepro-backend.railway.app`)
4. Update `RetrofitClient.kt` with this URL

### 5. Environment Variables (Auto-set by Railway)
Railway automatically provides:
- `MYSQLUSER`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `RAILWAY_PRIVATE_DOMAIN`
- `RAILWAY_TCP_PROXY_DOMAIN`
- `RAILWAY_TCP_PROXY_PORT`
- `PORT`

---

## 📊 Database Setup

The backend automatically creates the `User` table on first connection.

### Manual Database Setup (Optional)
If you want to set up the database manually:

1. Connect to your MySQL database
2. Run the schema from `enhanced_smart_energy_database_schema.sql`
3. The backend will work with existing tables

---

## ✅ Testing Checklist

### Android App
- [ ] All signup fields visible
- [ ] Spinner shows household types (Single, Family, Apartment, House)
- [ ] City field defaults to "Tarlac City"
- [ ] Validation works for all fields
- [ ] Signup button calls API
- [ ] Success/error messages display correctly
- [ ] Navigation to LoginActivity works

### Backend
- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] `/health` endpoint returns 200
- [ ] `/api/auth/signup` accepts valid requests
- [ ] Returns proper error messages for invalid data
- [ ] Prevents duplicate email registration
- [ ] Passwords are hashed

---

## 🐛 Troubleshooting

### Backend Connection Failed
- Check MySQL service is running in Railway
- Verify environment variables are set
- Check Railway logs for connection errors

### Android Can't Connect to Backend
- Verify backend URL in `RetrofitClient.kt`
- Check backend is running (test `/health` endpoint)
- For emulator: Use `10.0.2.2` instead of `localhost`
- For physical device: Use your computer's IP address
- Check backend CORS is enabled (already configured)

### Database Errors
- Verify MySQL service in Railway
- Check database name matches in env vars
- Ensure user has proper permissions

---

## 📝 Notes

- Address is stored as TEXT (BLOB equivalent)
- HouseholdType is validated against enum values
- Email must be unique
- Passwords are hashed using bcryptjs
- All timestamps are automatically managed by MySQL



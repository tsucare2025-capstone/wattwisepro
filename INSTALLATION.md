# WattWise Pro - Installation Guide

This guide covers all the dependencies and setup steps required to run the WattWise Pro application.

## Prerequisites

Before installing, ensure you have the following installed on your system:

- **Node.js** (v14 or higher recommended)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
  
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

- **MySQL/MariaDB** (v8.0 or higher)
  - Download MySQL: https://dev.mysql.com/downloads/mysql/
  - Or MariaDB: https://mariadb.org/download/
  - Verify installation: `mysql --version`

- **Android Studio** (for Android app development)
  - Download from: https://developer.android.com/studio
  - Required for building and running the Android application

---

## Backend Dependencies

The backend requires the following npm packages. These will be automatically installed when you run `npm install` in the `backend` directory.

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | Web framework for Node.js |
| `mysql2` | ^3.6.5 | MySQL database driver with Promise support |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing middleware |
| `dotenv` | ^16.3.1 | Environment variable management |
| `bcryptjs` | ^2.4.3 | Password hashing for user authentication |
| `body-parser` | ^1.20.2 | Parse incoming request bodies |
| `uuid` | ^9.0.1 | Generate unique IDs for raw usage records |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemon` | ^3.0.2 | Auto-restart server during development |

---

## Installation Steps

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd WattWisePro/backend
   ```

2. Install all dependencies:
   ```bash
   npm install
   ```

   This will install all packages listed in `package.json`.

3. Create a `.env` file in the `backend` directory:
   ```env
   # Database Configuration
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password_here
   MYSQL_DATABASE=smart_energy_tracking
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. Update the `.env` file with your actual database credentials.

### 2. Database Setup

1. Start your MySQL/MariaDB server.

2. Create the database:
   ```sql
   CREATE DATABASE smart_energy_tracking;
   ```

3. Run the SQL script to create all tables:
   ```bash
   mysql -u root -p smart_energy_tracking < database_tables.sql
   ```
   
   Or manually execute the SQL file in your MySQL client:
   - Open `database_tables.sql`
   - Copy and paste the contents into your MySQL client
   - Execute the script

4. Verify tables were created:
   ```sql
   USE smart_energy_tracking;
   SHOW TABLES;
   ```
   
   You should see:
   - `rawUsage`
   - `dailyUsage`
   - `weeklyUsage`
   - `monthlyUsage`
   - `User` (created automatically by server.js)

### 3. Start the Backend Server

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will:
- Connect to the MySQL database
- Create the `User` table if it doesn't exist
- Start listening on port 3000 (or the port specified in `.env`)

### 4. Verify Installation

1. Check server health:
   ```bash
   curl http://localhost:3000/health
   ```
   
   Or open in browser: `http://localhost:3000/health`

2. Expected response:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "timestamp": "2025-01-XX..."
   }
   ```

---

## Environment Variables Reference

### For Local Development

Create a `.env` file in the `backend` directory with:

```env
# Database Connection
MYSQL_HOST=localhost          # Database host (default: localhost)
MYSQL_PORT=3306               # Database port (default: 3306)
MYSQL_USER=root               # Database username
MYSQL_PASSWORD=your_password  # Database password
MYSQL_DATABASE=smart_energy_tracking  # Database name

# Server Configuration
PORT=3000                     # Server port (default: 3000)
NODE_ENV=development          # Environment mode
```

### For Railway Deployment

Railway automatically provides these environment variables when you add a MySQL service:

- `MYSQLHOST` or `RAILWAY_PRIVATE_DOMAIN` - MySQL host
- `MYSQLPORT` or `RAILWAY_TCP_PROXY_PORT` - MySQL port
- `MYSQLUSER` - MySQL username
- `MYSQLPASSWORD` or `MYSQL_ROOT_PASSWORD` - MySQL password
- `MYSQLDATABASE` or `MYSQL_DATABASE` - Database name
- `PORT` - Server port (default: 3000)

The server automatically detects and uses Railway's environment variables.

---

## Database Tables

The following tables are created by `database_tables.sql`:

1. **rawUsage** - Stores raw sensor data from hardware
   - Fields: `timestamp`, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`, `meterID`, `DeviceID`, `rawUsageID`

2. **dailyUsage** - Aggregated daily usage data
   - Fields: `id`, `date`, totals, averages, peaks for voltage, current, power, energy

3. **weeklyUsage** - Aggregated weekly usage data
   - Fields: `id`, `week_start_date`, `week_end_date`, totals, averages, peaks

4. **monthlyUsage** - Aggregated monthly usage data
   - Fields: `id`, `year`, `month`, totals, averages, peaks

5. **User** - User accounts (created automatically by server.js)
   - Fields: `UserID`, `Name`, `Email`, `Password`, `Address`, `HouseholdType`, `City`, `Subdivision`, `PhoneNumber`, `CreatedAt`, `UpdatedAt`

---

## Troubleshooting

### Module Not Found Errors

If you see errors like `Cannot find module 'uuid'`:

1. Make sure you're in the `backend` directory
2. Run `npm install` again
3. Check that `package.json` includes all required dependencies

### Database Connection Errors

If the server can't connect to the database:

1. Verify MySQL is running:
   ```bash
   # Windows
   net start MySQL
   
   # Linux/Mac
   sudo systemctl status mysql
   ```

2. Check your `.env` file has correct credentials

3. Test connection manually:
   ```bash
   mysql -u root -p -h localhost
   ```

4. Verify the database exists:
   ```sql
   SHOW DATABASES;
   ```

### Port Already in Use

If port 3000 is already in use:

1. Change `PORT` in your `.env` file to a different port (e.g., `3001`)
2. Or stop the process using port 3000

---

## API Endpoints

After installation, the following endpoints are available:

- **GET** `/health` - Server and database health check
- **POST** `/api/auth/signup` - User registration
- **POST** `/api/auth/login` - User login
- **POST** `/api/raw-usage` - Insert raw usage data from hardware

For detailed API documentation, see `backend/README.md`.

---

## Next Steps

1. ✅ Backend server is running
2. ✅ Database is set up
3. 📱 Build and run the Android app in Android Studio
4. 🔌 Connect hardware sensors to send data to `/api/raw-usage`
5. 📊 View usage data in the mobile app

---

## Support

For issues or questions:
- Check the `backend/README.md` for API documentation
- Review error logs in the console
- Verify all environment variables are set correctly


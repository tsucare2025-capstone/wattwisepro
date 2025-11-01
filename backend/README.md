# WattWise Pro Backend API

Node.js/Express backend for WattWise Pro Smart Energy Tracking System with MySQL database.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables

#### For Railway Deployment:
Railway automatically provides these environment variables:
- `MYSQLUSER` - MySQL username
- `MYSQL_ROOT_PASSWORD` - MySQL password
- `MYSQL_DATABASE` - Database name
- `RAILWAY_PRIVATE_DOMAIN` - Private MySQL host
- `RAILWAY_TCP_PROXY_DOMAIN` - Public MySQL host
- `RAILWAY_TCP_PROXY_PORT` - Public MySQL port
- `PORT` - Server port (default: 3000)

#### For Local Development:
Create a `.env` file based on `.env.example`:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=smart_energy_tracking
PORT=3000
NODE_ENV=development
```

### 3. Run Server

#### Development (with auto-reload):
```bash
npm run dev
```

#### Production:
```bash
npm start
```

## API Endpoints

### Health Check
- **GET** `/health` - Check server and database status

### Authentication
- **POST** `/api/auth/signup` - Create new user account

#### Sign Up Request Body:
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "password123",
  "address": "123 Main St",
  "householdType": "Family",
  "city": "Tarlac City",
  "subdivision": "Villa San Jose",
  "phoneNumber": "09123456789"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Account created successfully",
  "userId": 1
}
```

#### Error Response:
```json
{
  "success": false,
  "message": "Error message here"
}
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Railway will automatically detect Node.js project
3. Add MySQL service in Railway
4. Environment variables will be automatically set
5. Deploy!

The server will automatically:
- Connect to Railway MySQL database
- Create tables if they don't exist
- Handle connection retries if database is not ready

## Database Schema

The backend automatically creates the `User` table with the following fields:
- `UserID` (AUTO_INCREMENT PRIMARY KEY)
- `Name` (VARCHAR 100)
- `Email` (VARCHAR 100, UNIQUE)
- `Password` (VARCHAR 255 - hashed)
- `Address` (TEXT)
- `HouseholdType` (ENUM: Single, Family, Apartment, House)
- `City` (VARCHAR 50)
- `Subdivision` (VARCHAR 100)
- `PhoneNumber` (VARCHAR 20)
- `CreatedAt` (TIMESTAMP)
- `UpdatedAt` (TIMESTAMP)



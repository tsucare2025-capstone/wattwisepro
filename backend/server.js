const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Log environment variables on startup
console.log('🔍 Environment Variables Debug:');
console.log('MYSQLHOST:', process.env.MYSQLHOST || 'NOT SET');
console.log('MYSQLUSER:', process.env.MYSQLUSER || 'NOT SET');
console.log('MYSQLPASSWORD:', process.env.MYSQLPASSWORD ? '***SET***' : 'NOT SET');
console.log('MYSQLDATABASE:', process.env.MYSQLDATABASE || 'NOT SET');
console.log('MYSQLPORT:', process.env.MYSQLPORT || 'NOT SET');
console.log('RAILWAY_PRIVATE_DOMAIN:', process.env.RAILWAY_PRIVATE_DOMAIN || 'NOT SET');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection configuration
// Railway provides these environment variables
// Check for Railway MySQL service variables first, then fallback to standard names
const dbConfig = {
  host: process.env.MYSQLHOST || 
        process.env.RAILWAY_PRIVATE_DOMAIN || 
        process.env.MYSQL_HOST || 
        'mysql.railway.internal',
  port: process.env.MYSQLPORT || 
        process.env.RAILWAY_TCP_PROXY_PORT || 
        process.env.MYSQL_PORT || 
        3306,
  user: process.env.MYSQLUSER || 
        process.env.MYSQL_USER || 
        'root',
  password: process.env.MYSQLPASSWORD || 
            process.env.MYSQL_ROOT_PASSWORD || 
            process.env.MYSQL_PASSWORD,
  database: process.env.MYSQLDATABASE || 
             process.env.MYSQL_DATABASE || 
             'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool;

// Initialize database connection
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    
    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Database config (sensitive data hidden):', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user || 'UNDEFINED',
      database: dbConfig.database,
      password: dbConfig.password ? '***SET***' : 'UNDEFINED'
    });
    console.error('Available MySQL env vars:', {
      MYSQLHOST: process.env.MYSQLHOST ? 'SET' : 'NOT SET',
      MYSQLPORT: process.env.MYSQLPORT ? 'SET' : 'NOT SET',
      MYSQLUSER: process.env.MYSQLUSER ? 'SET' : 'NOT SET',
      MYSQLPASSWORD: process.env.MYSQLPASSWORD ? 'SET' : 'NOT SET',
      MYSQLDATABASE: process.env.MYSQLDATABASE ? 'SET' : 'NOT SET',
      RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN ? 'SET' : 'NOT SET',
      MYSQL_ROOT_PASSWORD: process.env.MYSQL_ROOT_PASSWORD ? 'SET' : 'NOT SET',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE ? 'SET' : 'NOT SET'
    });
    // Retry connection after 5 seconds
    setTimeout(initDatabase, 5000);
  }
}

// Create tables if they don't exist
async function createTables() {
  try {
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS User (
        UserID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(100) NOT NULL,
        Email VARCHAR(100) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        Address TEXT,
        HouseholdType ENUM('Single', 'Family', 'Apartment', 'House') DEFAULT 'Family',
        City VARCHAR(50) DEFAULT 'Tarlac City',
        Subdivision VARCHAR(100),
        PhoneNumber VARCHAR(20),
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await pool.execute(createUserTable);
    console.log('✅ User table ready');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'WattWise Pro API is running',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Sign up endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, address, householdType, city, subdivision, phoneNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !address || !householdType || !city || !subdivision || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate household type
    const validHouseholdTypes = ['Single', 'Family', 'Apartment', 'House'];
    if (!validHouseholdTypes.includes(householdType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid household type'
      });
    }

    // Check if email already exists
    const [existingUsers] = await pool.execute(
      'SELECT UserID FROM User WHERE Email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password (simple hash for now, you should use bcrypt in production)
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await pool.execute(
      `INSERT INTO User (Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, address, householdType, city, subdivision, phoneNumber]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      userId: result.insertId
    });

  } catch (error) {
    console.error('Sign up error:', error);
    
    // Handle MySQL duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await initDatabase();
});



const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection configuration
// Railway provides these environment variables
const dbConfig = {
  host: process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQLUSER || process.env.MYSQL_USER,
  password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'smart_energy_tracking',
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
    console.error('Database config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
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
    // Check if database pool is initialized
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database is not ready. Please try again in a moment.'
      });
    }

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
    const validHouseholdTypes = ['Family', 'Apartment', 'Single', 'House'];
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

    // Hash password
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
    console.error('Error stack:', error.stack);
    
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
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    // Check if database pool is initialized
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database is not ready. Please try again in a moment.'
      });
    }

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
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

    // Find user by email
    const [users] = await pool.execute(
      'SELECT UserID, Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber FROM User WHERE Email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Login successful - return user data (excluding password)
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        userId: user.UserID,
        name: user.Name,
        email: user.Email,
        address: user.Address,
        householdType: user.HouseholdType,
        city: user.City,
        subdivision: user.Subdivision,
        phoneNumber: user.PhoneNumber
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await initDatabase();
});



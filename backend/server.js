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
// Try TCP Proxy first (for external connections), then Private Domain (for internal)
const dbConfig = {
  host: process.env.RAILWAY_TCP_PROXY_DOMAIN || 
        process.env.RAILWAY_PRIVATE_DOMAIN || 
        process.env.MYSQL_HOST,
  port: process.env.RAILWAY_TCP_PROXY_PORT || 
        process.env.MYSQL_PORT || 
        3306,
  user: process.env.MYSQLUSER || 
        process.env.MYSQL_USER || 
        'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 
            process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 
            'smart_energy_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Add connection timeout
  connectTimeout: 10000,
  acquireTimeout: 10000
};

// Create connection pool
let pool;

// Initialize database connection
async function initDatabase() {
  try {
    // Log what we're trying to connect with
    console.log('🔌 Attempting database connection...');
    console.log('Database config:', {
      host: dbConfig.host || 'NOT SET',
      port: dbConfig.port || 'NOT SET',
      user: dbConfig.user || 'NOT SET',
      database: dbConfig.database || 'NOT SET',
      password: dbConfig.password ? '***SET***' : 'NOT SET'
    });
    
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    
    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Database config:', {
      host: dbConfig.host || 'NOT SET',
      port: dbConfig.port || 'NOT SET',
      user: dbConfig.user || 'NOT SET',
      database: dbConfig.database || 'NOT SET'
    });
    
    // Log all environment variables related to MySQL
    console.log('Environment variables check:');
    console.log('- RAILWAY_PRIVATE_DOMAIN:', process.env.RAILWAY_PRIVATE_DOMAIN || 'NOT SET');
    console.log('- MYSQL_HOST:', process.env.MYSQL_HOST || 'NOT SET');
    console.log('- MYSQL_PORT:', process.env.MYSQL_PORT || 'NOT SET');
    console.log('- MYSQLUSER:', process.env.MYSQLUSER || 'NOT SET');
    console.log('- MYSQL_USER:', process.env.MYSQL_USER || 'NOT SET');
    console.log('- MYSQL_ROOT_PASSWORD:', process.env.MYSQL_ROOT_PASSWORD ? 'SET' : 'NOT SET');
    console.log('- MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? 'SET' : 'NOT SET');
    console.log('- MYSQL_DATABASE:', process.env.MYSQL_DATABASE || 'NOT SET');
    
    // Retry connection after 5 seconds
    console.log('⏳ Retrying connection in 5 seconds...');
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
    if (!pool) {
      return res.status(503).json({ 
        status: 'unhealthy',
        database: 'not_initialized',
        message: 'Database pool not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const connection = await pool.getConnection();
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    connection.release();
    
    res.json({ 
      status: 'healthy',
      database: 'connected',
      testQuery: rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Database diagnostic endpoint
app.get('/api/db/diagnostic', async (req, res) => {
  try {
    const diagnostic = {
      poolInitialized: !!pool,
      databaseConfig: {
        host: dbConfig.host || 'NOT SET',
        port: dbConfig.port || 'NOT SET',
        user: dbConfig.user || 'NOT SET',
        database: dbConfig.database || 'NOT SET',
        password: dbConfig.password ? '***SET***' : 'NOT SET'
      },
      environmentVariables: {
        RAILWAY_TCP_PROXY_DOMAIN: process.env.RAILWAY_TCP_PROXY_DOMAIN || 'NOT SET',
        RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN || 'NOT SET',
        MYSQL_HOST: process.env.MYSQL_HOST || 'NOT SET',
        RAILWAY_TCP_PROXY_PORT: process.env.RAILWAY_TCP_PROXY_PORT || 'NOT SET',
        MYSQL_PORT: process.env.MYSQL_PORT || 'NOT SET',
        MYSQLUSER: process.env.MYSQLUSER || 'NOT SET',
        MYSQL_USER: process.env.MYSQL_USER || 'NOT SET',
        MYSQL_ROOT_PASSWORD: process.env.MYSQL_ROOT_PASSWORD ? 'SET' : 'NOT SET',
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? 'SET' : 'NOT SET',
        MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'NOT SET'
      },
      connectionTest: null,
      error: null
    };

    if (pool) {
      try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT DATABASE() as current_db, USER() as current_user, NOW() as server_time');
        diagnostic.connectionTest = {
          success: true,
          currentDatabase: rows[0].current_db,
          currentUser: rows[0].current_user,
          serverTime: rows[0].server_time
        };
        connection.release();
      } catch (connError) {
        diagnostic.connectionTest = {
          success: false,
          error: connError.message,
          errorCode: connError.code
        };
        diagnostic.error = connError.message;
      }
    } else {
      diagnostic.error = 'Database pool not initialized';
    }

    res.json(diagnostic);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
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



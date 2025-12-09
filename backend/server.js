const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const rawUsageRoutes = require('./rawUsageRoutes');
const { processEndOfDayBatch } = require('./aggregationService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory cache to store previous values for calculating incremental differences
// Used for live usage display (shows what was added, not accumulated total)
// Also stores previous hardware energy to calculate delta (hardware sends total lifetime energy)
const previousValuesCache = {
  voltage: 0,
  current: 0,
  power: 0,
  energy: 0,
  hardwareEnergy: undefined, // Previous total lifetime energy from hardware (for delta calculation)
  timestamp: null
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection configuration
// Railway provides these environment variables with different naming conventions
// Railway MySQL service provides: MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLHOST, MYSQLPORT
// Also supports: MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, RAILWAY_PRIVATE_DOMAIN (alternative names)
const dbConfig = {
  host: process.env.MYSQLHOST || 
        process.env.RAILWAY_TCP_PROXY_DOMAIN || 
        process.env.RAILWAY_PRIVATE_DOMAIN || 
        process.env.MYSQL_HOST,
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
            'smart_energy_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Add connection timeout
  connectTimeout: 10000,
  acquireTimeout: 10000
};

// Validate required database configuration
function validateDbConfig() {
  const missing = [];
  
  if (!dbConfig.host) {
    missing.push('Database host (RAILWAY_PRIVATE_DOMAIN or MYSQL_HOST)');
  }
  
  if (!dbConfig.password) {
    missing.push('Database password (MYSQL_ROOT_PASSWORD or MYSQL_PASSWORD)');
  }
  
  if (!dbConfig.user) {
    missing.push('Database user (MYSQLUSER or MYSQL_USER)');
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required database configuration:');
    missing.forEach(item => console.error(`   - ${item}`));
    console.error('\n📋 Please check Railway environment variables:');
    console.error('   1. Go to Railway Dashboard → Your Project');
    console.error('   2. Click on Backend Service → Variables tab');
    console.error('   3. Ensure MySQL service is connected to backend service');
    console.error('   4. Verify these variables are set:');
    console.error('      - MYSQLHOST (or RAILWAY_PRIVATE_DOMAIN)');
    console.error('      - MYSQLPORT (or RAILWAY_TCP_PROXY_PORT)');
    console.error('      - MYSQLUSER');
    console.error('      - MYSQLPASSWORD (or MYSQL_ROOT_PASSWORD)');
    console.error('      - MYSQLDATABASE (or MYSQL_DATABASE)');
    return false;
  }
  
  return true;
}

// Create connection pool
let pool;

// Initialize database connection
async function initDatabase() {
  try {
    // Validate configuration first
    if (!validateDbConfig()) {
      console.error('⏳ Retrying connection in 10 seconds...');
      setTimeout(initDatabase, 10000);
      return;
    }
    
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
      database: dbConfig.database || 'NOT SET',
      password: dbConfig.password ? '***SET***' : 'NOT SET'
    });
    
    // Log all environment variables related to MySQL
    console.log('\n📋 Environment variables check:');
    console.log('- MYSQLHOST:', process.env.MYSQLHOST || 'NOT SET');
    console.log('- MYSQLPORT:', process.env.MYSQLPORT || 'NOT SET');
    console.log('- MYSQLUSER:', process.env.MYSQLUSER || 'NOT SET');
    console.log('- MYSQLPASSWORD:', process.env.MYSQLPASSWORD ? 'SET' : 'NOT SET');
    console.log('- MYSQLDATABASE:', process.env.MYSQLDATABASE || 'NOT SET');
    console.log('- RAILWAY_TCP_PROXY_DOMAIN:', process.env.RAILWAY_TCP_PROXY_DOMAIN || 'NOT SET');
    console.log('- RAILWAY_PRIVATE_DOMAIN:', process.env.RAILWAY_PRIVATE_DOMAIN || 'NOT SET');
    console.log('- MYSQL_HOST:', process.env.MYSQL_HOST || 'NOT SET');
    console.log('- MYSQL_PORT:', process.env.MYSQL_PORT || 'NOT SET');
    console.log('- MYSQL_USER:', process.env.MYSQL_USER || 'NOT SET');
    console.log('- MYSQL_ROOT_PASSWORD:', process.env.MYSQL_ROOT_PASSWORD ? 'SET' : 'NOT SET');
    console.log('- MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? 'SET' : 'NOT SET');
    console.log('- MYSQL_DATABASE:', process.env.MYSQL_DATABASE || 'NOT SET');
    
    // Retry connection after 10 seconds
    console.log('\n⏳ Retrying connection in 10 seconds...');
    setTimeout(initDatabase, 10000);
  }
}

// Create tables if they don't exist
async function createTables() {
  try {
    // Check current database
    const [dbInfo] = await pool.execute('SELECT DATABASE() as current_db');
    console.log(`📊 Current database: ${dbInfo[0].current_db}`);
    
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
    
    // Verify table exists
    const [tables] = await pool.execute(
      "SHOW TABLES LIKE 'User'"
    );
    if (tables.length > 0) {
      console.log('✅ Verified: User table exists');
    } else {
      console.log('⚠️ Warning: User table not found after creation');
    }
    
    // Check table structure
    const [columns] = await pool.execute('DESCRIBE User');
    console.log(`📋 User table has ${columns.length} columns`);
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
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
        MYSQLHOST: process.env.MYSQLHOST || 'NOT SET',
        MYSQLPORT: process.env.MYSQLPORT || 'NOT SET',
        MYSQLUSER: process.env.MYSQLUSER || 'NOT SET',
        MYSQLPASSWORD: process.env.MYSQLPASSWORD ? 'SET' : 'NOT SET',
        MYSQLDATABASE: process.env.MYSQLDATABASE || 'NOT SET',
        RAILWAY_TCP_PROXY_DOMAIN: process.env.RAILWAY_TCP_PROXY_DOMAIN || 'NOT SET',
        RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN || 'NOT SET',
        MYSQL_HOST: process.env.MYSQL_HOST || 'NOT SET',
        MYSQL_PORT: process.env.MYSQL_PORT || 'NOT SET',
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
    let existingUsers;
    try {
      [existingUsers] = await pool.execute(
        'SELECT UserID FROM User WHERE Email = ?',
        [email]
      );
    } catch (tableError) {
      // If 'User' table doesn't exist, try 'user' (lowercase)
      if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
        console.log('⚠️ User table not found, trying lowercase "user" table...');
        [existingUsers] = await pool.execute(
          'SELECT UserID FROM user WHERE Email = ?',
          [email]
        );
      } else {
        throw tableError;
      }
    }

    console.log(`🔍 Signup attempt for email: ${email}`);
    console.log(`📊 Existing users with this email: ${existingUsers.length}`);

    if (existingUsers.length > 0) {
      console.log(`❌ Email already registered: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`🔐 Password hashed successfully`);

    // Insert new user
    // Try 'User' table first, then 'user' if it doesn't exist
    let result;
    let tableUsed = '';
    let insertSuccessful = false;
    
    try {
      console.log(`📝 Attempting to insert user into 'User' table...`);
      [result] = await pool.execute(
        `INSERT INTO User (Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, address, householdType, city, subdivision, phoneNumber]
      );
      
      // Verify insert was successful
      if (result && result.affectedRows > 0 && result.insertId) {
        tableUsed = 'User';
        insertSuccessful = true;
        console.log(`✅ User created in 'User' table with ID: ${result.insertId}`);
        console.log(`📊 Affected rows: ${result.affectedRows}`);
      } else {
        console.log(`⚠️ Insert returned but no rows affected or no insertId`);
        throw new Error('Insert failed - no rows affected');
      }
    } catch (tableError) {
      console.log(`⚠️ Error inserting into 'User' table: ${tableError.message}`);
      console.log(`⚠️ Error code: ${tableError.code}`);
      
      // If 'User' table doesn't exist, try 'user' (lowercase)
      if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
        console.log('⚠️ User table not found, trying lowercase "user" table...');
        try {
          [result] = await pool.execute(
            `INSERT INTO user (Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, address, householdType, city, subdivision, phoneNumber]
          );
          
          // Verify insert was successful
          if (result && result.affectedRows > 0 && result.insertId) {
            tableUsed = 'user';
            insertSuccessful = true;
            console.log(`✅ User created in 'user' table with ID: ${result.insertId}`);
            console.log(`📊 Affected rows: ${result.affectedRows}`);
          } else {
            console.log(`⚠️ Insert into 'user' table returned but no rows affected`);
            throw new Error('Insert failed - no rows affected');
          }
        } catch (lowercaseError) {
          console.error(`❌ Error inserting into 'user' table: ${lowercaseError.message}`);
          throw lowercaseError;
        }
      } else {
        throw tableError;
      }
    }

    // Verify user was actually created by querying the database
    if (insertSuccessful && result.insertId) {
      try {
        console.log(`🔍 Verifying user was created in '${tableUsed}' table...`);
        const [verifyUsers] = await pool.execute(
          `SELECT UserID, Name, Email FROM ${tableUsed} WHERE UserID = ?`,
          [result.insertId]
        );
        
        if (verifyUsers.length > 0) {
          console.log(`✅ Verification successful: User found in database`);
          console.log(`   UserID: ${verifyUsers[0].UserID}`);
          console.log(`   Name: ${verifyUsers[0].Name}`);
          console.log(`   Email: ${verifyUsers[0].Email}`);
        } else {
          console.log(`❌ Verification failed: User not found in database after insert!`);
          console.log(`   Expected UserID: ${result.insertId}`);
          console.log(`   Table used: ${tableUsed}`);
        }
      } catch (verifyError) {
        console.error(`⚠️ Error verifying user creation: ${verifyError.message}`);
      }
    }

    if (!insertSuccessful) {
      throw new Error('User insert failed - no rows were affected');
    }

    console.log(`✅ Signup successful for: ${name} (${email})`);
    console.log(`   UserID: ${result.insertId}`);
    console.log(`   Table: ${tableUsed}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      userId: result.insertId,
      table: tableUsed
    });

  } catch (error) {
    console.error('Sign up error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Handle database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please check Railway environment variables.',
        error: 'Database connection error',
        errorCode: error.code
      });
    }
    
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
    // Try both 'User' and 'user' table names for case sensitivity
    let users = [];
    let tableUsed = '';
    
    console.log(`🔍 Login attempt for email: ${email}`);
    
    // Try 'User' table first (uppercase)
    try {
      [users] = await pool.execute(
        'SELECT UserID, Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber FROM User WHERE Email = ?',
        [email]
      );
      if (users.length > 0) {
        tableUsed = 'User';
        console.log(`✅ Found user in 'User' table`);
      }
    } catch (tableError) {
      // If 'User' table doesn't exist, try 'user' (lowercase)
      if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
        console.log('⚠️ User table not found, trying lowercase "user" table...');
      } else {
        console.log(`⚠️ Error querying 'User' table: ${tableError.message}`);
      }
    }
    
    // If not found in 'User' table, try 'user' table (lowercase)
    if (users.length === 0) {
      try {
        [users] = await pool.execute(
          'SELECT UserID, Name, Email, Password, Address, HouseholdType, City, Subdivision, PhoneNumber FROM user WHERE Email = ?',
          [email]
        );
        if (users.length > 0) {
          tableUsed = 'user';
          console.log(`✅ Found user in 'user' table`);
        }
      } catch (tableError) {
        console.log(`⚠️ Error querying 'user' table: ${tableError.message}`);
      }
    }

    console.log(`📊 Found ${users.length} user(s) with this email (table: ${tableUsed || 'none'})`);

    if (users.length === 0) {
      console.log(`❌ No user found with email: ${email}`);
      // Try case-insensitive search as fallback
      try {
        const [caseInsensitiveUsers] = await pool.execute(
          'SELECT UserID, Name, Email FROM User WHERE LOWER(Email) = LOWER(?)',
          [email]
        );
        if (caseInsensitiveUsers.length > 0) {
          console.log(`⚠️ Found user with different case: ${caseInsensitiveUsers[0].Email}`);
        }
      } catch (e) {
        // Ignore errors in fallback search
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        debug: 'No user found with this email address'
      });
    }

    const user = users[0];
    console.log(`✅ User found: ${user.Name} (ID: ${user.UserID})`);
    console.log(`📧 User email from DB: ${user.Email}`);
    console.log(`🔐 Stored password hash length: ${user.Password ? user.Password.length : 0}`);
    console.log(`🔐 Stored password hash (first 20 chars): ${user.Password ? user.Password.substring(0, 20) + '...' : 'NULL'}`);

    // Verify password
    if (!user.Password) {
      console.log(`❌ User password is NULL in database`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    const isPasswordHashed = user.Password && (
      user.Password.startsWith('$2a$') || 
      user.Password.startsWith('$2b$') || 
      user.Password.startsWith('$2y$')
    );
    
    console.log(`🔐 Password is hashed: ${isPasswordHashed}`);
    console.log(`🔐 Password hash starts with: ${user.Password ? user.Password.substring(0, 4) : 'NULL'}`);
    
    let isPasswordValid = false;
    
    if (isPasswordHashed) {
      // Password is hashed with bcrypt, use bcrypt.compare
      isPasswordValid = await bcrypt.compare(password, user.Password);
      console.log(`🔐 Password verification (bcrypt): ${isPasswordValid ? 'VALID' : 'INVALID'}`);
    } else {
      // Password is not hashed (plain text or different format)
      // This should not happen if user was created through signup endpoint
      console.log(`⚠️ WARNING: Password is not hashed with bcrypt!`);
      console.log(`⚠️ This user was likely created manually or with a different method.`);
      console.log(`⚠️ Password comparison skipped - password needs to be re-hashed.`);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        debug: 'Password in database is not properly hashed. Please create a new account through signup or reset your password.'
      });
    }
    
    console.log(`🔐 Input password length: ${password.length}`);

    if (!isPasswordValid) {
      console.log(`❌ Password mismatch for user: ${email}`);
      console.log(`❌ Input password: "${password}"`);
      console.log(`❌ Stored hash: ${user.Password.substring(0, 30)}...`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        debug: 'Password does not match. Please check your password or create a new account.'
      });
    }

    console.log(`✅ Login successful for user: ${email}`);

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
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Handle database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please check Railway environment variables.',
        error: 'Database connection error',
        errorCode: error.code
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

// Get user profile endpoint
app.get('/api/user/:userId', async (req, res) => {
  try {
    // Check if database pool is initialized
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database is not ready. Please try again in a moment.'
      });
    }

    const userId = parseInt(req.params.userId);

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    console.log(`🔍 Fetching profile for user ID: ${userId}`);

    // Try 'User' table first (uppercase)
    let users = [];
    try {
      [users] = await pool.execute(
        'SELECT UserID, Name, Email, Address, HouseholdType, City, Subdivision, PhoneNumber FROM User WHERE UserID = ?',
        [userId]
      );
      if (users.length > 0) {
        console.log(`✅ Found user in 'User' table`);
      }
    } catch (tableError) {
      // If 'User' table doesn't exist, try 'user' (lowercase)
      if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
        console.log('⚠️ User table not found, trying lowercase "user" table...');
      } else {
        console.error(`❌ Error querying 'User' table: ${tableError.message}`);
      }
    }

    // If not found in 'User' table, try 'user' table (lowercase)
    if (users.length === 0) {
      try {
        [users] = await pool.execute(
          'SELECT UserID, Name, Email, Address, HouseholdType, City, Subdivision, PhoneNumber FROM user WHERE UserID = ?',
          [userId]
        );
        if (users.length > 0) {
          console.log(`✅ Found user in 'user' table`);
        }
      } catch (tableError) {
        console.error(`❌ Error querying 'user' table: ${tableError.message}`);
      }
    }

    if (users.length === 0) {
      console.log(`❌ No user found with ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    console.log(`✅ User profile retrieved: ${user.Name} (ID: ${user.UserID})`);

    // Return user profile (excluding password)
    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        UserID: user.UserID,
        Name: user.Name || null,
        Email: user.Email || null,
        Address: user.Address || null,
        HouseholdType: user.HouseholdType || null,
        City: user.City || null,
        Subdivision: user.Subdivision || null,
        PhoneNumber: user.PhoneNumber || null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get daily usage for current week (Sunday to Saturday)
app.get('/api/daily-usage/week', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    // Calculate current week (Sunday to Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get Saturday
    weekEnd.setHours(23, 59, 59, 999);

    // Format dates as YYYY-MM-DD
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Query dailyUsage table for the current week
    const [rows] = await pool.execute(
      "SELECT id, date, total_energy, total_power, peak_power, average_power, created_at, updated_at FROM dailyUsage WHERE date >= ? AND date <= ? ORDER BY date ASC",
      [weekStartStr, weekEndStr]
    );

    // Create a map of date -> usage for easy lookup
    const usageMap = new Map();
    rows.forEach(row => {
      // MySQL DATE fields are returned as strings in 'YYYY-MM-DD' format
      // or as Date objects, so handle both cases
      let dateStr;
      if (row.date instanceof Date) {
        dateStr = row.date.toISOString().split('T')[0];
      } else {
        // Already a string in 'YYYY-MM-DD' format
        dateStr = row.date;
      }
      
      usageMap.set(dateStr, {
        id: row.id,
        date: dateStr,
        total_energy: parseFloat(row.total_energy) || 0,
        total_power: parseFloat(row.total_power) || 0,
        peak_power: parseFloat(row.peak_power) || 0,
        average_power: parseFloat(row.average_power) || 0,
        created_at: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) : null,
        updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) : null
      });
    });

    // Generate array for all 7 days of the week (Sunday to Saturday)
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (usageMap.has(dateStr)) {
        weekData.push(usageMap.get(dateStr));
      } else {
        // Return null/empty data for days without records
        weekData.push({
          id: null,
          date: dateStr,
          total_energy: 0,
          total_power: 0,
          peak_power: 0,
          average_power: 0,
          created_at: null,
          updated_at: null
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Daily usage data retrieved successfully',
      data: weekData,
      weekStart: weekStartStr,
      weekEnd: weekEndStr
    });
  } catch (error) {
    console.error('Error fetching daily usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get weekly usage for last 4 weeks
app.get('/api/weekly-usage/recent', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    // Use Philippine timezone (UTC+08:00) for week calculations - consistent with aggregationService
    // This ensures November 17 and other dates are assigned to the correct week
    const { getWeekStart, getWeekEnd } = require('./aggregationService');
    const today = new Date();
    
    // Generate array for last 4 weeks (most recent first)
    // Use the same week calculation logic as updateWeeklyUsage to ensure consistency
    const weekData = [];
    for (let i = 3; i >= 0; i--) {
      // Calculate the date for i weeks ago
      const targetDate = new Date(today);
      targetDate.setUTCDate(targetDate.getUTCDate() - (i * 7));
      
      // Use getWeekStart() which correctly uses Philippine timezone
      const weekStartStr = getWeekStart(targetDate);
      const weekEndStr = getWeekEnd(targetDate);
      
      // Query weeklyUsage table for this specific week
      const [rows] = await pool.execute(
        "SELECT id, week_start_date, week_end_date, week_number, year, total_energy, total_power, peak_power, average_power, created_at, updated_at FROM weeklyUsage WHERE week_start_date = ?",
        [weekStartStr]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        let weekStartStrFromDb;
        if (row.week_start_date instanceof Date) {
          weekStartStrFromDb = row.week_start_date.toISOString().split('T')[0];
        } else {
          weekStartStrFromDb = row.week_start_date;
        }
        
        let weekEndStrFromDb;
        if (row.week_end_date instanceof Date) {
          weekEndStrFromDb = row.week_end_date.toISOString().split('T')[0];
        } else {
          weekEndStrFromDb = row.week_end_date;
        }
        
        weekData.push({
          id: row.id,
          week_start_date: weekStartStrFromDb,
          week_end_date: weekEndStrFromDb,
          week_number: row.week_number,
          year: row.year,
          total_energy: parseFloat(row.total_energy) || 0,
          total_power: parseFloat(row.total_power) || 0,
          peak_power: parseFloat(row.peak_power) || 0,
          average_power: parseFloat(row.average_power) || 0,
          created_at: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) : null,
          updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) : null
        });
      } else {
        // Return empty data for weeks without records
        const weekStartDate = new Date(weekStartStr + 'T00:00:00Z');
        weekData.push({
          id: null,
          week_start_date: weekStartStr,
          week_end_date: weekEndStr,
          week_number: 0,
          year: weekStartDate.getUTCFullYear(),
          total_energy: 0,
          total_power: 0,
          peak_power: 0,
          average_power: 0,
          created_at: null,
          updated_at: null
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Weekly usage data retrieved successfully',
      data: weekData
    });
  } catch (error) {
    console.error('Error fetching weekly usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get monthly usage for current year (12 months)
app.get('/api/monthly-usage/year', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Query monthlyUsage table for the current year
    const [rows] = await pool.execute(
      "SELECT id, month, year, month_name, total_energy, total_power, peak_power, average_power, created_at, updated_at FROM monthlyUsage WHERE year = ? ORDER BY month ASC",
      [currentYear]
    );

    // Helper function to get month name
    function getMonthName(month) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      return months[month - 1] || '';
    }

    // Create a map of month -> usage for easy lookup
    const usageMap = new Map();
    rows.forEach(row => {
      usageMap.set(row.month, {
        id: row.id,
        month: row.month,
        year: row.year,
        month_name: row.month_name || getMonthName(row.month),
        total_energy: parseFloat(row.total_energy) || 0,
        total_power: parseFloat(row.total_power) || 0,
        peak_power: parseFloat(row.peak_power) || 0,
        average_power: parseFloat(row.average_power) || 0,
        created_at: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) : null,
        updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) : null
      });
    });

    // Generate array for all 12 months (January = 1, December = 12)
    const monthData = [];
    for (let month = 1; month <= 12; month++) {
      if (usageMap.has(month)) {
        monthData.push(usageMap.get(month));
      } else {
        // Return empty data for months without records
        monthData.push({
          id: null,
          month: month,
          year: currentYear,
          month_name: getMonthName(month),
          total_energy: 0,
          total_power: 0,
          peak_power: 0,
          average_power: 0,
          created_at: null,
          updated_at: null
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Monthly usage data retrieved successfully',
      data: monthData,
      year: currentYear
    });
  } catch (error) {
    console.error('Error fetching monthly usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get daily usage for a specific date
app.get('/api/daily-usage/date/:date', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    const dateStr = req.params.date; // Format: YYYY-MM-DD
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Query dailyUsage table for the specific date
    const [rows] = await pool.execute(
      "SELECT id, date, total_energy, total_power, peak_power, average_power, created_at, updated_at FROM dailyUsage WHERE date = ?",
      [dateStr]
    );

    if (rows.length === 0) {
      // No data for this date
      return res.status(200).json({
        success: true,
        message: 'No usage data found for this date',
        data: {
          date: dateStr,
          total_energy: 0,
          total_power: 0,
          peak_power: 0,
          average_power: 0
        }
      });
    }

    const row = rows[0];
    res.status(200).json({
      success: true,
      message: 'Daily usage data retrieved successfully',
      data: {
        id: row.id,
        date: dateStr,
        total_energy: parseFloat(row.total_energy) || 0,
        total_power: parseFloat(row.total_power) || 0,
        peak_power: parseFloat(row.peak_power) || 0,
        average_power: parseFloat(row.average_power) || 0,
        created_at: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) : null,
        updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) : null
      }
    });
  } catch (error) {
    console.error('Error fetching daily usage for date:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get hourly usage for a specific date
app.get('/api/daily-usage/hourly/:date', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    const dateStr = req.params.date; // Format: YYYY-MM-DD
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Query rawUsage table for the specific date, grouped by hour
    // Convert timestamp to Philippine timezone (+08:00) for hour extraction
    const [rows] = await pool.execute(
      `SELECT 
        HOUR(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) as hour,
        AVG(CAST(\`power(W)\` AS DECIMAL(10, 3))) as avg_power,
        MAX(CAST(\`power(W)\` AS DECIMAL(10, 3))) as max_power,
        MIN(CAST(\`power(W)\` AS DECIMAL(10, 3))) as min_power,
        COUNT(*) as record_count
      FROM rawUsage 
      WHERE DATE(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) = ?
      GROUP BY HOUR(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00'))
      ORDER BY hour ASC`,
      [dateStr]
    );

    // Initialize array for 24 hours (0-23) with default values
    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      hourlyData.push({
        hour: i,
        wattage: 0.0,
        max_power: 0.0,
        min_power: 0.0,
        record_count: 0
      });
    }

    // Fill in data from query results
    rows.forEach(row => {
      const hour = parseInt(row.hour);
      if (hour >= 0 && hour < 24) {
        hourlyData[hour] = {
          hour: hour,
          wattage: parseFloat(row.avg_power) || 0.0,
          max_power: parseFloat(row.max_power) || 0.0,
          min_power: parseFloat(row.min_power) || 0.0,
          record_count: parseInt(row.record_count) || 0
        };
      }
    });

    res.status(200).json({
      success: true,
      message: 'Hourly usage data retrieved successfully',
      data: hourlyData,
      date: dateStr
    });
  } catch (error) {
    console.error('Error fetching hourly usage for date:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get current month's usage from monthlyUsage table
app.get('/api/monthly-usage/current', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  // Helper function to get month name
  function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  }

  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed

    // Query monthlyUsage table for current month
    const [rows] = await pool.execute(
      "SELECT id, month, year, month_name, total_energy, total_power, peak_power, average_power, created_at, updated_at FROM monthlyUsage WHERE year = ? AND month = ?",
      [currentYear, currentMonth]
    );

    if (rows.length === 0) {
      // No data for current month
      return res.status(200).json({
        success: true,
        message: 'No usage data found for current month',
        data: {
          month: currentMonth,
          year: currentYear,
          month_name: getMonthName(currentMonth),
          total_energy: 0,
          total_power: 0,
          peak_power: 0,
          average_power: 0
        }
      });
    }

    const row = rows[0];
    res.status(200).json({
      success: true,
      message: 'Current month usage data retrieved successfully',
      data: {
        id: row.id,
        month: row.month,
        year: row.year,
        month_name: row.month_name || getMonthName(row.month),
        total_energy: parseFloat(row.total_energy) || 0,
        total_power: parseFloat(row.total_power) || 0,
        peak_power: parseFloat(row.peak_power) || 0,
        average_power: parseFloat(row.average_power) || 0,
        created_at: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) : null,
        updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) : null
      }
    });
  } catch (error) {
    console.error('Error fetching current month usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get current year's total usage (sum of all months in the year)
app.get('/api/monthly-usage/year-total', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Query monthlyUsage table for all months in current year
    const [rows] = await pool.execute(
      "SELECT total_energy, total_power, peak_power, average_power FROM monthlyUsage WHERE year = ?",
      [currentYear]
    );

    // Sum all months' values
    let totalEnergy = 0;
    let totalPower = 0;
    let peakPower = 0;
    let avgPowerSum = 0;
    const monthCount = rows.length;

    rows.forEach(row => {
      totalEnergy += parseFloat(row.total_energy) || 0;
      totalPower += parseFloat(row.total_power) || 0;
      peakPower = Math.max(peakPower, parseFloat(row.peak_power) || 0);
      avgPowerSum += parseFloat(row.average_power) || 0;
    });

    const averagePower = monthCount > 0 ? avgPowerSum / monthCount : 0;

    res.status(200).json({
      success: true,
      message: 'Year total usage data retrieved successfully',
      data: {
        year: currentYear,
        total_energy: totalEnergy,
        total_power: totalPower,
        peak_power: peakPower,
        average_power: averagePower,
        months_count: monthCount
      }
    });
  } catch (error) {
    console.error('Error fetching year total usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Get latest live usage data from rawUsage table
app.get('/api/raw-usage/latest', async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not available'
    });
  }

  try {
    // Query rawUsage table for today's data (using Philippine timezone UTC+08:00)
    // This matches the date logic used in rawUsageRoutes.js
    // Get the most recent record for today (there's only one row per day, but timestamp gets updated)
    const [rows] = await pool.execute(
      "SELECT `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`, timestamp FROM rawUsage WHERE DATE(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')) ORDER BY timestamp DESC LIMIT 1",
      []
    );

    if (rows.length === 0) {
      // No data available - return zeros
      return res.status(200).json({
        success: true,
        message: 'No usage data available yet',
        data: {
          voltage: "0.000",
          current: "0.000",
          power: "0.000",
          energy: "0.000",
          timestamp: null
        }
      });
    }

    const row = rows[0];
    const recordTimestamp = row.timestamp;
    
    // Check if the data is recent (hardware is active)
    // If timestamp is older than 8 minutes, consider hardware as off
    // Hardware sends data every 5 minutes, so 8 minutes accounts for intervals + network delays
    const STALE_THRESHOLD_MS = 8 * 60 * 1000; // 8 minutes in milliseconds
    const now = new Date();
    let isDataFresh = false;
    
    if (recordTimestamp) {
      const recordDate = recordTimestamp instanceof Date 
        ? recordTimestamp 
        : new Date(recordTimestamp);
      const timeDiff = now.getTime() - recordDate.getTime();
      isDataFresh = timeDiff <= STALE_THRESHOLD_MS;
    }
    
    // If data is stale (hardware is off), return zeros
    if (!isDataFresh) {
      return res.status(200).json({
        success: true,
        message: 'Hardware appears to be off - no recent data',
        data: {
          voltage: "0.000",
          current: "0.000",
          power: "0.000",
          energy: "0.000",
          timestamp: recordTimestamp ? (recordTimestamp instanceof Date ? recordTimestamp.toISOString() : recordTimestamp) : null
        }
      });
    }
    
    // Data is fresh (hardware is on) - calculate incremental values (current - previous)
    // Live usage should show what was added in the latest update, not the accumulated total
    const currentVoltage = parseFloat(row['voltage(V)']) || 0;
    const currentCurrent = parseFloat(row['current(A)']) || 0;
    const currentPower = parseFloat(row['power(W)']) || 0;
    const currentEnergy = parseFloat(row['energy(kWh)']) || 0;
    
    // Voltage and current are replaced (not accumulated), so show current instantaneous values
    // Power and energy are accumulated, so calculate incremental (what was added)
    const incrementalVoltage = currentVoltage;
    const incrementalCurrent = currentCurrent;
    const incrementalPower = previousValuesCache.timestamp ? (currentPower - previousValuesCache.power) : currentPower;
    const incrementalEnergy = previousValuesCache.timestamp ? (currentEnergy - previousValuesCache.energy) : currentEnergy;
    
    // Ensure non-negative values (in case of data issues)
    const finalPower = Math.max(0, incrementalPower);
    const finalEnergy = Math.max(0, incrementalEnergy);
    
    res.status(200).json({
      success: true,
      message: 'Latest usage data retrieved successfully',
      data: {
        voltage: incrementalVoltage.toFixed(3),
        current: incrementalCurrent.toFixed(3),
        power: finalPower.toFixed(3),
        energy: finalEnergy.toFixed(3),
        timestamp: recordTimestamp ? (recordTimestamp instanceof Date ? recordTimestamp.toISOString() : recordTimestamp) : null
      }
    });
  } catch (error) {
    console.error('Error fetching latest raw usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      errorCode: error.code
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await initDatabase();
  
  if (pool) {
    const rawUsageRouter = rawUsageRoutes(pool);
    app.use(rawUsageRouter);
    console.log('✅ RawUsage route added: POST /api/raw-usage');

    // Schedule end-of-day batch processing (runs at 00:01 every day in server's local timezone)
    // This updates weeklyUsage and monthlyUsage tables
    cron.schedule('1 0 * * *', async () => {
      console.log('⏰ End-of-day batch job triggered');
      await processEndOfDayBatch(pool);
    }, {
      scheduled: true
      // No timezone specified - uses server's local timezone
    });
    console.log('✅ End-of-day batch job scheduled (runs daily at 00:01 local time)');
  }
});

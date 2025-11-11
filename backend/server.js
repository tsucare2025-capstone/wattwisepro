const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const rawUsageRoutes = require('./routes/rawUsageRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await initDatabase();
  
  if (pool) {
    const rawUsageRouter = rawUsageRoutes(pool);
    app.use(rawUsageRouter);
    console.log('✅ RawUsage route added: POST /api/raw-usage');
  }
});

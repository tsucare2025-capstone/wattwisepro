const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ESP32 → RAW USAGE INSERT ROUTE
  router.post('/api/raw-usage', async (req, res) => {
    const { voltage, current, power, energy } = req.body;

    // Validate incoming data (only the 4 required fields)
    if (
      voltage === undefined ||
      current === undefined ||
      power === undefined ||
      energy === undefined
    ) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required parameters: voltage, current, power, energy" 
      });
    }

    try {
      // Insert to the database using correct column names with backticks
      // Note: timestamp is automatically set by MySQL (NOT NULL, so we use NOW())
      await pool.execute(
        "INSERT INTO rawUsage (timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`) VALUES (NOW(), ?, ?, ?, ?)",
        [voltage, current, power, energy]
      );

      res.status(201).json({ 
        success: true,
        message: "Data saved successfully" 
      });
    } catch (error) {
      console.error("Insert Error:", error.message);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  return router;
};

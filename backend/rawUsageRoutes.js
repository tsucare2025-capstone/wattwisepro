const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // to generate rawUsageID

module.exports = (pool) => {
  router.post('/api/raw-usage', async (req, res) => {
    try {
      const {
        voltage,
        current,
        power,
        energy,
        meterID,
        DeviceID
      } = req.body;

      if (!voltage || !current || !power || !energy || !meterID || !DeviceID) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const rawUsageID = uuidv4();

      const sql = `
        INSERT INTO rawUsage (
          rawUsageID, timestamp, \`voltage(V)\`, \`current(A)\`, \`power(W)\`, \`energy(kWh)\`, meterID, DeviceID
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)
      `;

      await pool.execute(sql, [
        rawUsageID,
        voltage,
        current,
        power,
        energy,
        meterID,
        DeviceID
      ]);

      res.status(201).json({
        success: true,
        message: 'Raw usage data inserted successfully',
        id: rawUsageID
      });
    } catch (error) {
      console.error('Error inserting raw usage data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });

  return router;
};

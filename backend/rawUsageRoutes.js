const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ESP32 → RAW USAGE INSERT/UPDATE ROUTE
  // Logic: One row per day
  // - First record of the day: INSERT new row
  // - Subsequent records: UPDATE the same row
  //   - voltage(V) and current(A): REPLACE with new values
  //   - power(W) and energy(kWh): ADD to existing values (accumulate)
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
      // Check if a row exists for today's date
      // Using DATE(timestamp) to extract just the date part
      // Get the first row created today (ORDER BY timestamp ASC)
      const [existingRows] = await pool.execute(
        "SELECT timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)` FROM rawUsage WHERE DATE(timestamp) = CURDATE() ORDER BY timestamp ASC LIMIT 1",
        []
      );

      if (existingRows.length > 0) {
        // Row exists for today - UPDATE it
        const existing = existingRows[0];
        const existingTimestamp = existing.timestamp;
        
        // Parse existing values (they're stored as VARCHAR, so convert to numbers)
        const existingPower = parseFloat(existing['power(W)']) || 0;
        const existingEnergy = parseFloat(existing['energy(kWh)']) || 0;
        const newPower = parseFloat(power) || 0;
        const newEnergy = parseFloat(energy) || 0;
        
        // Calculate new accumulated values
        const accumulatedPower = existingPower + newPower;
        const accumulatedEnergy = existingEnergy + newEnergy;
        
        // Update: Replace voltage/current, Add power/energy
        // Update the specific row using its timestamp
        await pool.execute(
          "UPDATE rawUsage SET `voltage(V)` = ?, `current(A)` = ?, `power(W)` = ?, `energy(kWh)` = ?, timestamp = NOW() WHERE timestamp = ?",
          [voltage.toString(), current.toString(), accumulatedPower.toString(), accumulatedEnergy.toString(), existingTimestamp]
        );

        res.status(200).json({ 
          success: true,
          message: "Data updated successfully",
          action: "updated",
          accumulated: {
            power: accumulatedPower,
            energy: accumulatedEnergy
          }
        });
      } else {
        // No row exists for today - INSERT new row
        await pool.execute(
          "INSERT INTO rawUsage (timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`) VALUES (NOW(), ?, ?, ?, ?)",
          [voltage.toString(), current.toString(), power.toString(), energy.toString()]
        );

        res.status(201).json({ 
          success: true,
          message: "Data saved successfully",
          action: "inserted"
        });
      }
    } catch (error) {
      console.error("Database Error:", error.message);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  return router;
};

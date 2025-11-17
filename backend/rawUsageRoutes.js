const express = require('express');
const { updateDailyUsage } = require('./aggregationService');

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
      // Check if a row exists for today's date (using Philippine timezone UTC+08:00)
      // Convert timestamp to Philippine timezone (UTC+08:00) before extracting date
      // Get the first row created today (ORDER BY timestamp ASC)
      const [existingRows] = await pool.execute(
        "SELECT timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)` FROM rawUsage WHERE DATE(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')) ORDER BY timestamp ASC LIMIT 1",
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
        let newEnergy = parseFloat(energy) || 0;
        
        // FIX for kWh doubling issue:
        // Hardware sends data every 5 minutes, but may calculate energy for 1 hour
        // If energy value seems too large (indicating 1-hour calculation), scale it down
        // Expected: kWh = (watts × 0.0833333hr) / 1000 for 5-minute interval
        // If hardware sends 1-hour energy, it would be 12x larger
        // Check if energy seems like it's for 1 hour (power * 1hr / 1000) vs expected (power * 0.0833333hr / 1000)
        // If newEnergy is approximately 12x what it should be, scale it down
        const expectedEnergyFor5Min = (newPower * 0.0833333) / 1000; // kWh for 5 minutes
        const expectedEnergyFor1Hr = (newPower * 1.0) / 1000; // kWh for 1 hour
        // If newEnergy is close to 1-hour calculation (within 10% tolerance), scale it down
        if (newEnergy > 0 && Math.abs(newEnergy - expectedEnergyFor1Hr) < Math.abs(newEnergy - expectedEnergyFor5Min)) {
          // Energy appears to be calculated for 1 hour, scale to 5 minutes
          newEnergy = newEnergy / 12; // 1 hour / 12 intervals = 5 minutes
          console.log(`⚠️ Energy value scaled from ${energy} to ${newEnergy.toFixed(6)} kWh (1-hour to 5-minute conversion)`);
        }
        
        // Calculate new accumulated values
        const accumulatedPower = existingPower + newPower;
        const accumulatedEnergy = existingEnergy + newEnergy;
        
        // Update: Replace voltage/current, Add power/energy
        // Update the specific row using its timestamp
        // Use UTC_TIMESTAMP() to store in UTC (database standard), but date calculations use Philippine time
        await pool.execute(
          "UPDATE rawUsage SET `voltage(V)` = ?, `current(A)` = ?, `power(W)` = ?, `energy(kWh)` = ?, timestamp = UTC_TIMESTAMP() WHERE timestamp = ?",
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

        // Update dailyUsage in background (non-blocking)
        setImmediate(async () => {
          try {
            await updateDailyUsage(null, pool);
          } catch (error) {
            console.error('Background dailyUsage update error:', error.message);
          }
        });
      } else {
        // No row exists for today - INSERT new row
        // Use UTC_TIMESTAMP() to store in UTC (database standard), but date calculations use Philippine time
        await pool.execute(
          "INSERT INTO rawUsage (timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`) VALUES (UTC_TIMESTAMP(), ?, ?, ?, ?)",
          [voltage.toString(), current.toString(), power.toString(), energy.toString()]
        );

      res.status(201).json({
        success: true,
          message: "Data saved successfully",
          action: "inserted"
        });

        // Update dailyUsage in background (non-blocking)
        setImmediate(async () => {
          try {
            await updateDailyUsage(null, pool);
          } catch (error) {
            console.error('Background dailyUsage update error:', error.message);
          }
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

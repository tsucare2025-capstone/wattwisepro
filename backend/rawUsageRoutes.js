const express = require('express');
const { updateDailyUsage } = require('./aggregationService');

module.exports = (pool, previousValuesCache) => {
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
      // Calculate today's date in Philippine timezone (UTC+08:00) for consistent matching
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Convert to Philippine time
      const phYear = phTime.getUTCFullYear();
      const phMonth = String(phTime.getUTCMonth() + 1).padStart(2, '0');
      const phDay = String(phTime.getUTCDate()).padStart(2, '0');
      const todayDateStr = `${phYear}-${phMonth}-${phDay}`; // YYYY-MM-DD in Philippine timezone
      
      // Check if a row exists for today's date (using Philippine timezone UTC+08:00)
      // Use explicit date string comparison to avoid timezone conversion issues
      const [existingRows] = await pool.execute(
        "SELECT timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)` FROM rawUsage WHERE DATE(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) = ? ORDER BY timestamp ASC LIMIT 1",
        [todayDateStr]
      );

      if (existingRows.length > 0) {
        // Row exists for today - UPDATE it
        // The SELECT query already filtered by today's date, so we can trust this row is for today
        const existing = existingRows[0];
        const existingTimestamp = existing.timestamp;
        
        console.log(`✅ Found existing row for today (${todayDateStr}), proceeding with UPDATE`);
        
        // Parse existing values (they're stored as VARCHAR, so convert to numbers)
        const existingPower = parseFloat(existing['power(W)']) || 0;
        const existingAccumulatedEnergy = parseFloat(existing['energy(kWh)']) || 0;
        const newPower = parseFloat(power) || 0;
        const newHardwareEnergy = parseFloat(energy) || 0; // This is TOTAL lifetime energy from hardware
        
        // CRITICAL FIX: Hardware sends TOTAL lifetime energy, not incremental!
        // We need to track the previous hardware energy value to calculate delta
        // Store previous hardware energy in a separate field or cache
        
        // Get previous hardware energy from cache (if available)
        // The cache stores the last hardware energy value received from ESP32/PZEM
        let previousHardwareEnergy = 0;
        if (previousValuesCache && previousValuesCache.hardwareEnergy !== undefined && previousValuesCache.hardwareEnergy > 0) {
          previousHardwareEnergy = previousValuesCache.hardwareEnergy;
          console.log(`✅ Using cached previous hardware energy: ${previousHardwareEnergy.toFixed(3)} kWh`);
        } else {
          // First time or cache not available - this means it's the first reading of the day
          // For the first reading, we can't calculate delta, so we'll use a small initial value
          // The accumulated energy will start from this first reading
          // Note: This is a limitation - ideally we'd store previous hardware energy in the database
          const expectedEnergyFor5Min = (newPower * 0.0833333) / 1000;
          previousHardwareEnergy = Math.max(0, newHardwareEnergy - expectedEnergyFor5Min);
          console.log(`⚠️ No previous hardware energy in cache (first reading of day). Estimating previous: ${previousHardwareEnergy.toFixed(3)} kWh`);
        }
        
        // Calculate delta energy (what was consumed since last reading)
        let deltaEnergy = newHardwareEnergy - previousHardwareEnergy;
        
        // Handle edge cases:
        // 1. If delta is negative, hardware might have reset - use expected calculation
        // 2. If delta is too large, cap it to reasonable value
        if (deltaEnergy < 0) {
          console.log(`⚠️ Negative delta energy (${deltaEnergy.toFixed(3)} kWh). Hardware may have reset. Using expected calculation.`);
          const expectedEnergyFor5Min = (newPower * 0.0833333) / 1000;
          deltaEnergy = expectedEnergyFor5Min;
        } else {
          // Validate delta is reasonable (max 2 hours worth)
          const expectedEnergyFor1Hr = (newPower * 1.0) / 1000;
          const maxReasonableDelta = expectedEnergyFor1Hr * 2;
          if (deltaEnergy > maxReasonableDelta) {
            console.log(`⚠️ Delta energy (${deltaEnergy.toFixed(3)} kWh) exceeds maximum reasonable (${maxReasonableDelta.toFixed(3)} kWh). Capping.`);
            const expectedEnergyFor5Min = (newPower * 0.0833333) / 1000;
            deltaEnergy = expectedEnergyFor5Min;
          }
        }
        
        // Calculate new accumulated values
        // Power: Add current power reading (instantaneous, not accumulated)
        // Energy: Add only the delta (incremental consumption)
        const accumulatedPower = existingPower + newPower;
        const accumulatedEnergy = existingAccumulatedEnergy + deltaEnergy;
        
        // Log the update for debugging
        console.log(`📊 Energy update: Hardware total=${newHardwareEnergy.toFixed(3)} kWh, Previous hardware=${previousHardwareEnergy.toFixed(3)} kWh, Delta=${deltaEnergy.toFixed(3)} kWh, Accumulated=${accumulatedEnergy.toFixed(3)} kWh`);
        
        // Update cache with current hardware energy for next calculation
        if (previousValuesCache) {
          previousValuesCache.hardwareEnergy = newHardwareEnergy;
        }
        
        // Update previous values cache BEFORE updating database
        // This allows live usage endpoint to calculate incremental values (current - previous)
        if (previousValuesCache) {
          previousValuesCache.voltage = parseFloat(existing['voltage(V)']) || 0;
          previousValuesCache.current = parseFloat(existing['current(A)']) || 0;
          previousValuesCache.power = existingPower;
          previousValuesCache.energy = existingAccumulatedEnergy; // Fixed: use correct variable name
          previousValuesCache.timestamp = existingTimestamp;
        }
        
        // Update: Replace voltage/current, Add power/energy
        // Use date-based WHERE clause to ensure we're updating today's row
        // Primary match: date in Philippine timezone (same as SELECT query)
        // Use UTC_TIMESTAMP() to store in UTC (database standard), but date calculations use Philippine time
        const [updateResult] = await pool.execute(
          "UPDATE rawUsage SET `voltage(V)` = ?, `current(A)` = ?, `power(W)` = ?, `energy(kWh)` = ?, timestamp = UTC_TIMESTAMP() WHERE DATE(CONVERT_TZ(timestamp, @@session.time_zone, '+08:00')) = ?",
          [voltage.toString(), current.toString(), accumulatedPower.toString(), accumulatedEnergy.toString(), todayDateStr]
        );
        
        // Verify that exactly one row was updated
        if (updateResult.affectedRows === 0) {
          console.log(`⚠️ WARNING: No rows updated. Date mismatch or row not found. Today: ${todayDateStr}, Existing timestamp: ${existingTimestamp}`);
        } else if (updateResult.affectedRows > 1) {
          console.log(`⚠️ WARNING: Multiple rows (${updateResult.affectedRows}) updated! This should not happen.`);
        } else {
          console.log(`✅ Successfully updated today's row (${todayDateStr})`);
        }

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
      }
      
      // INSERT new row for today (if no valid row exists for today after validation)
      if (existingRows.length === 0) {
        // No row exists for today - INSERT new row
        // Use UTC_TIMESTAMP() to store in UTC (database standard), but date calculations use Philippine time
        const newPower = parseFloat(power) || 0;
        const newHardwareEnergy = parseFloat(energy) || 0;
        
        // For first record of the day, we store the hardware energy as-is (it's the starting point)
        // But we need to track it for delta calculation on next update
        await pool.execute(
          "INSERT INTO rawUsage (timestamp, `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`) VALUES (UTC_TIMESTAMP(), ?, ?, ?, ?)",
          [voltage.toString(), current.toString(), power.toString(), newHardwareEnergy.toString()]
        );
        
        // Update previous values cache for first record of the day
        // Store the hardware energy so we can calculate delta on next update
        if (previousValuesCache) {
          previousValuesCache.voltage = 0;
          previousValuesCache.current = 0;
          previousValuesCache.power = 0;
          previousValuesCache.energy = 0;
          previousValuesCache.hardwareEnergy = newHardwareEnergy; // Store hardware energy for delta calculation
          previousValuesCache.timestamp = null;
        }
        
        console.log(`📊 First record of day: Stored hardware energy=${newHardwareEnergy.toFixed(3)} kWh`);

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

/**
 * Aggregation Service
 * Handles aggregation of usage data from rawUsage -> dailyUsage -> weeklyUsage -> monthlyUsage
 */

/**
 * Update dailyUsage table from rawUsage for a specific date
 * @param {Date|string} date - Date to aggregate (defaults to today)
 * @param {Object} pool - MySQL connection pool
 */
async function updateDailyUsage(date = null, pool) {
  try {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Get rawUsage data for the date
    const [rawData] = await pool.execute(
      "SELECT `voltage(V)`, `current(A)`, `power(W)`, `energy(kWh)`, timestamp FROM rawUsage WHERE DATE(timestamp) = ? ORDER BY timestamp ASC LIMIT 1",
      [dateStr]
    );

    if (rawData.length === 0) {
      console.log(`⚠️ No rawUsage data found for ${dateStr}`);
      return { success: false, message: 'No data to aggregate' };
    }

    const raw = rawData[0];
    
    // Parse values (stored as VARCHAR)
    const voltage = parseFloat(raw['voltage(V)']) || 0;
    const current = parseFloat(raw['current(A)']) || 0;
    const power = parseFloat(raw['power(W)']) || 0;
    const energy = parseFloat(raw['energy(kWh)']) || 0;

    // Check if dailyUsage row exists for this date
    const [existing] = await pool.execute(
      "SELECT id, peak_voltage, peak_current, peak_power, record_count FROM dailyUsage WHERE date = ?",
      [dateStr]
    );

    let peakVoltage = voltage;
    let peakCurrent = current;
    let peakPower = power;
    let recordCount = 1;

    if (existing.length > 0) {
      // Row exists - update peaks if new values are higher
      const existingPeakVoltage = parseFloat(existing[0].peak_voltage) || 0;
      const existingPeakCurrent = parseFloat(existing[0].peak_current) || 0;
      const existingPeakPower = parseFloat(existing[0].peak_power) || 0;
      recordCount = (existing[0].record_count || 0) + 1;

      peakVoltage = Math.max(existingPeakVoltage, voltage);
      peakCurrent = Math.max(existingPeakCurrent, current);
      peakPower = Math.max(existingPeakPower, power);

      // Update existing row
      await pool.execute(
        `UPDATE dailyUsage SET
          total_voltage = ?,
          total_current = ?,
          total_power = ?,
          total_energy = ?,
          peak_voltage = ?,
          peak_current = ?,
          peak_power = ?,
          average_voltage = ?,
          average_current = ?,
          average_power = ?,
          record_count = ?,
          updated_at = NOW()
        WHERE date = ?`,
        [
          voltage,           // total_voltage (using current value as total)
          current,            // total_current (using current value as total)
          power,              // total_power (accumulated from rawUsage)
          energy,             // total_energy (accumulated from rawUsage)
          peakVoltage,        // peak_voltage
          peakCurrent,        // peak_current
          peakPower,          // peak_power
          voltage,            // average_voltage (Option B: use current value)
          current,            // average_current (Option B: use current value)
          power / recordCount, // average_power (total / count)
          recordCount,        // record_count
          dateStr             // WHERE date
        ]
      );
    } else {
      // Insert new row
      await pool.execute(
        `INSERT INTO dailyUsage (
          date, total_voltage, total_current, total_power, total_energy,
          peak_voltage, peak_current, peak_power,
          average_voltage, average_current, average_power,
          record_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dateStr,            // date
          voltage,            // total_voltage
          current,            // total_current
          power,              // total_power
          energy,             // total_energy
          peakVoltage,        // peak_voltage
          peakCurrent,        // peak_current
          peakPower,          // peak_power
          voltage,            // average_voltage
          current,            // average_current
          power,              // average_power (first record)
          recordCount         // record_count
        ]
      );
    }

    console.log(`✅ Daily usage updated for ${dateStr}`);
    return { success: true, date: dateStr };
  } catch (error) {
    console.error(`❌ Error updating dailyUsage:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get week start date (Sunday) for a given date
 * Week definition: Sunday to Saturday
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day; // Days to subtract to get to Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split('T')[0];
}

/**
 * Get week end date (Saturday) for a given date
 */
function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 6); // Add 6 days to get Saturday
  return endDate.toISOString().split('T')[0];
}

/**
 * Get ISO week number for a given date
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * Update weeklyUsage table from dailyUsage for a specific week
 * @param {Date|string} date - Any date in the week (defaults to today)
 * @param {Object} pool - MySQL connection pool
 */
async function updateWeeklyUsage(date = null, pool) {
  try {
    const targetDate = date ? new Date(date) : new Date();
    const weekStart = getWeekStart(targetDate);
    const weekEnd = getWeekEnd(targetDate);
    const weekNum = getWeekNumber(targetDate);
    const year = targetDate.getFullYear();

    // Check if week is complete (past Saturday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(weekEnd);
    const isWeekComplete = today > weekEndDate;

    // Get all dailyUsage records for this week
    const [dailyRecords] = await pool.execute(
      "SELECT * FROM dailyUsage WHERE date >= ? AND date <= ? ORDER BY date ASC",
      [weekStart, weekEnd]
    );

    if (dailyRecords.length === 0) {
      console.log(`⚠️ No dailyUsage data found for week ${weekStart} to ${weekEnd}`);
      return { success: false, message: 'No data to aggregate' };
    }

    // Aggregate values
    let totalVoltage = 0;
    let totalCurrent = 0;
    let totalPower = 0;
    let totalEnergy = 0;
    let peakVoltage = 0;
    let peakCurrent = 0;
    let peakPower = 0;
    let sumAvgVoltage = 0;
    let sumAvgCurrent = 0;
    let sumAvgPower = 0;
    const daysCount = dailyRecords.length;

    dailyRecords.forEach(day => {
      totalVoltage += parseFloat(day.total_voltage) || 0;
      totalCurrent += parseFloat(day.total_current) || 0;
      totalPower += parseFloat(day.total_power) || 0;
      totalEnergy += parseFloat(day.total_energy) || 0;
      peakVoltage = Math.max(peakVoltage, parseFloat(day.peak_voltage) || 0);
      peakCurrent = Math.max(peakCurrent, parseFloat(day.peak_current) || 0);
      peakPower = Math.max(peakPower, parseFloat(day.peak_power) || 0);
      sumAvgVoltage += parseFloat(day.average_voltage) || 0;
      sumAvgCurrent += parseFloat(day.average_current) || 0;
      sumAvgPower += parseFloat(day.average_power) || 0;
    });

    const avgVoltage = daysCount > 0 ? sumAvgVoltage / daysCount : 0;
    const avgCurrent = daysCount > 0 ? sumAvgCurrent / daysCount : 0;
    const avgPower = daysCount > 0 ? sumAvgPower / daysCount : 0;

    // Check if weeklyUsage row exists
    const [existing] = await pool.execute(
      "SELECT id FROM weeklyUsage WHERE year = ? AND week_number = ?",
      [year, weekNum]
    );

    if (existing.length > 0) {
      // Only update if week is not complete (locked weeks should not be updated)
      if (!isWeekComplete) {
        await pool.execute(
          `UPDATE weeklyUsage SET
            week_start_date = ?,
            week_end_date = ?,
            total_voltage = ?,
            total_current = ?,
            total_power = ?,
            total_energy = ?,
            peak_voltage = ?,
            peak_current = ?,
            peak_power = ?,
            average_voltage = ?,
            average_current = ?,
            average_power = ?,
            days_count = ?,
            updated_at = NOW()
          WHERE year = ? AND week_number = ?`,
          [
            weekStart, weekEnd,
            totalVoltage, totalCurrent, totalPower, totalEnergy,
            peakVoltage, peakCurrent, peakPower,
            avgVoltage, avgCurrent, avgPower,
            daysCount,
            year, weekNum
          ]
        );
        console.log(`✅ Weekly usage updated for week ${weekNum} (${weekStart} to ${weekEnd})`);
      } else {
        console.log(`🔒 Week ${weekNum} is complete and locked - skipping update`);
      }
    } else {
      // Insert new row
      await pool.execute(
        `INSERT INTO weeklyUsage (
          week_start_date, week_end_date, week_number, year,
          total_voltage, total_current, total_power, total_energy,
          peak_voltage, peak_current, peak_power,
          average_voltage, average_current, average_power,
          days_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          weekStart, weekEnd, weekNum, year,
          totalVoltage, totalCurrent, totalPower, totalEnergy,
          peakVoltage, peakCurrent, peakPower,
          avgVoltage, avgCurrent, avgPower,
          daysCount
        ]
      );
      console.log(`✅ Weekly usage created for week ${weekNum} (${weekStart} to ${weekEnd})`);
    }

    return { success: true, weekStart, weekEnd, weekNum, year };
  } catch (error) {
    console.error(`❌ Error updating weeklyUsage:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get month name from month number
 */
function getMonthName(month) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}

/**
 * Update monthlyUsage table from weeklyUsage for a specific month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {Object} pool - MySQL connection pool
 */
async function updateMonthlyUsage(year, month, pool) {
  try {
    // Check if month is complete
    const today = new Date();
    const isMonthComplete = today.getFullYear() > year || 
                           (today.getFullYear() === year && today.getMonth() + 1 > month);

    // Get all weeklyUsage records for this month
    // A week belongs to a month if its week_start_date is in that month
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [weeklyRecords] = await pool.execute(
      "SELECT * FROM weeklyUsage WHERE week_start_date >= ? AND week_start_date <= ? ORDER BY week_start_date ASC",
      [monthStart, monthEnd]
    );

    if (weeklyRecords.length === 0) {
      console.log(`⚠️ No weeklyUsage data found for ${year}-${month}`);
      return { success: false, message: 'No data to aggregate' };
    }

    // Aggregate values
    let totalVoltage = 0;
    let totalCurrent = 0;
    let totalPower = 0;
    let totalEnergy = 0;
    let peakVoltage = 0;
    let peakCurrent = 0;
    let peakPower = 0;
    let sumAvgVoltage = 0;
    let sumAvgCurrent = 0;
    let sumAvgPower = 0;
    const weeksCount = weeklyRecords.length;

    weeklyRecords.forEach(week => {
      totalVoltage += parseFloat(week.total_voltage) || 0;
      totalCurrent += parseFloat(week.total_current) || 0;
      totalPower += parseFloat(week.total_power) || 0;
      totalEnergy += parseFloat(week.total_energy) || 0;
      peakVoltage = Math.max(peakVoltage, parseFloat(week.peak_voltage) || 0);
      peakCurrent = Math.max(peakCurrent, parseFloat(week.peak_current) || 0);
      peakPower = Math.max(peakPower, parseFloat(week.peak_power) || 0);
      sumAvgVoltage += parseFloat(week.average_voltage) || 0;
      sumAvgCurrent += parseFloat(week.average_current) || 0;
      sumAvgPower += parseFloat(week.average_power) || 0;
    });

    const avgVoltage = weeksCount > 0 ? sumAvgVoltage / weeksCount : 0;
    const avgCurrent = weeksCount > 0 ? sumAvgCurrent / weeksCount : 0;
    const avgPower = weeksCount > 0 ? sumAvgPower / weeksCount : 0;

    // Check if monthlyUsage row exists
    const [existing] = await pool.execute(
      "SELECT id FROM monthlyUsage WHERE year = ? AND month = ?",
      [year, month]
    );

    if (existing.length > 0) {
      // Only update if month is not complete (locked months should not be updated)
      if (!isMonthComplete) {
        await pool.execute(
          `UPDATE monthlyUsage SET
            month_name = ?,
            total_voltage = ?,
            total_current = ?,
            total_power = ?,
            total_energy = ?,
            peak_voltage = ?,
            peak_current = ?,
            peak_power = ?,
            average_voltage = ?,
            average_current = ?,
            average_power = ?,
            weeks_count = ?,
            updated_at = NOW()
          WHERE year = ? AND month = ?`,
          [
            getMonthName(month),
            totalVoltage, totalCurrent, totalPower, totalEnergy,
            peakVoltage, peakCurrent, peakPower,
            avgVoltage, avgCurrent, avgPower,
            weeksCount,
            year, month
          ]
        );
        console.log(`✅ Monthly usage updated for ${getMonthName(month)} ${year}`);
      } else {
        console.log(`🔒 Month ${month}/${year} is complete and locked - skipping update`);
      }
    } else {
      // Insert new row
      await pool.execute(
        `INSERT INTO monthlyUsage (
          month, year, month_name,
          total_voltage, total_current, total_power, total_energy,
          peak_voltage, peak_current, peak_power,
          average_voltage, average_current, average_power,
          weeks_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          month, year, getMonthName(month),
          totalVoltage, totalCurrent, totalPower, totalEnergy,
          peakVoltage, peakCurrent, peakPower,
          avgVoltage, avgCurrent, avgPower,
          weeksCount
        ]
      );
      console.log(`✅ Monthly usage created for ${getMonthName(month)} ${year}`);
    }

    return { success: true, year, month };
  } catch (error) {
    console.error(`❌ Error updating monthlyUsage:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process end-of-day batch: Update weekly and monthly aggregations
 * Called by cron job at midnight
 */
async function processEndOfDayBatch(pool) {
  try {
    console.log('🔄 Starting end-of-day batch processing...');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Update weekly usage for current week
    await updateWeeklyUsage(today, pool);

    // Update monthly usage for current month
    await updateMonthlyUsage(today.getFullYear(), today.getMonth() + 1, pool);

    console.log('✅ End-of-day batch processing completed');
    return { success: true };
  } catch (error) {
    console.error('❌ Error in end-of-day batch processing:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  updateDailyUsage,
  updateWeeklyUsage,
  updateMonthlyUsage,
  processEndOfDayBatch,
  getWeekStart,
  getWeekEnd,
  getWeekNumber
};


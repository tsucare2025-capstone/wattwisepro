package myapplication.test.wattwisepro

import android.app.AlertDialog
import android.content.Intent
import android.content.res.Resources
import android.os.Bundle
import android.util.TypedValue
import android.view.LayoutInflater
import android.widget.Button
import android.widget.RelativeLayout
import android.widget.TextView
import android.widget.Toast
import android.view.ViewGroup
import com.github.mikephil.charting.charts.LineChart
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.formatter.ValueFormatter
import com.google.android.material.bottomnavigation.BottomNavigationView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import myapplication.test.wattwisepro.api.RetrofitClient
import myapplication.test.wattwisepro.model.DailyUsageResponse
import myapplication.test.wattwisepro.model.HourlyUsageResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class DailyActivity : AppCompatActivity() {
    
    // Store dates for each day to use when fetching hourly data
    private val dayDates = mutableMapOf<Int, String>() // Map day index to date string
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.daily_main)


        val backBtn: Button = findViewById(R.id.btn_back)
        backBtn.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }

        // Load and display daily usage
        loadDailyData()
        
        // Setup click listeners for day cards
        setupDayClickListeners()

        val bottomNavigationView: BottomNavigationView = findViewById(R.id.bottomNavigationView)
        bottomNavigationView.selectedItemId = R.id.home_nav

        bottomNavigationView.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.home_nav -> {
                    val intent = Intent(this, HomeActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    overridePendingTransition(0, 0)
                    finish()
                    true
                }
                R.id.calcu_nav -> {
                    val intent = Intent(this, CalculatorActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    overridePendingTransition(0, 0)
                    finish()
                    true
                }
                R.id.settings_nav -> {
                    val intent = Intent(this, SettingsActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    overridePendingTransition(0, 0)
                    finish()
                    true
                }
                else -> false
            }
        }
    }
    
    private fun loadDailyData() {
        // Get TextViews for each day (ordered: Sun, Mon, Tue, Wed, Thu, Fri, Sat)
        val kwhSun: TextView = findViewById(R.id.kwhSun)
        val kwhMon: TextView = findViewById(R.id.kwhMon)
        val kwhTue: TextView = findViewById(R.id.kwhTue)
        val kwhWed: TextView = findViewById(R.id.kwhWed)
        val kwhThu: TextView = findViewById(R.id.kwhThu)
        val kwhFri: TextView = findViewById(R.id.kwhFri)
        val kwhSat: TextView = findViewById(R.id.kwhSat)
        
        // Set placeholder values initially
        val textViews = arrayOf(kwhSun, kwhMon, kwhTue, kwhWed, kwhThu, kwhFri, kwhSat)
        textViews.forEach { it.text = "-----/kWh" }
        
        // Fetch data from API
        val apiService = RetrofitClient.apiService
        apiService.getDailyUsageWeek().enqueue(object : Callback<DailyUsageResponse> {
            override fun onResponse(
                call: Call<DailyUsageResponse>,
                response: Response<DailyUsageResponse>
            ) {
                if (response.isSuccessful && response.body()?.success == true) {
                    val dailyData = response.body()?.data
                    if (dailyData != null && dailyData.size == 7) {
                        // Map data to TextViews (Sunday is index 0, Saturday is index 6)
                        // Order: Sun, Mon, Tue, Wed, Thu, Fri, Sat
                        for (i in dailyData.indices) {
                                    val usage = dailyData[i]
                            val energy = usage.total_energy
                            
                            // Format: Always show 3 decimal places (no rounding, preserve precision)
                            val displayText = String.format("%.3f/kWh", energy)
                            
                            textViews[i].text = displayText
                            
                            // Store date for this day (for hourly graph)
                            dayDates[i] = usage.date
                        }
                    } else {
                        // Data structure unexpected
                        showError("Invalid data format received")
                    }
                } else {
                    // API call failed
                    val errorMsg = response.body()?.message ?: "Failed to load daily usage"
                    showError(errorMsg)
                }
            }

            override fun onFailure(call: Call<DailyUsageResponse>, t: Throwable) {
                // Network error
                showError("Network error: ${t.message}")
            }
        })
    }
    
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    private fun setupDayClickListeners() {
        // Get day card containers (RelativeLayouts)
        val dayCards = arrayOf(
            findViewById<RelativeLayout>(R.id.textViewSun),  // 0 - Sunday
            findViewById<RelativeLayout>(R.id.textViewMon),  // 1 - Monday
            findViewById<RelativeLayout>(R.id.textViewTue),  // 2 - Tuesday
            findViewById<RelativeLayout>(R.id.textViewWed),  // 3 - Wednesday
            findViewById<RelativeLayout>(R.id.textViewThu),  // 4 - Thursday
            findViewById<RelativeLayout>(R.id.textViewFri),  // 5 - Friday
            findViewById<RelativeLayout>(R.id.textViewSat)   // 6 - Saturday
        )
        
        // Get day names for display
        val dayNames = arrayOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
        
        // Add click listeners
        dayCards.forEachIndexed { index, card ->
            card.setOnClickListener {
                val date = dayDates[index]
                if (date != null) {
                    showHourlyGraph(date, dayNames[index])
                } else {
                    Toast.makeText(this, "No data available for ${dayNames[index]}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    private fun showHourlyGraph(date: String, dayName: String) {
        // Create dialog
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_hourly_graph, null)
        val dialog = AlertDialog.Builder(this)
            .setTitle("Hourly Usage - $dayName")
            .setView(dialogView)
            .setPositiveButton("Close", null)
            .create()
        
        val chart: LineChart = dialogView.findViewById(R.id.chartHourly)
        val tvLoading: TextView = dialogView.findViewById(R.id.tvLoading)
        
        // Show loading
        tvLoading.visibility = TextView.VISIBLE
        chart.visibility = LineChart.GONE
        
        dialog.show()
        
        // Fetch hourly data
        val apiService = RetrofitClient.apiService
        apiService.getHourlyUsage(date).enqueue(object : Callback<HourlyUsageResponse> {
            override fun onResponse(
                call: Call<HourlyUsageResponse>,
                response: Response<HourlyUsageResponse>
            ) {
                tvLoading.visibility = TextView.GONE
                chart.visibility = LineChart.VISIBLE
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val hourlyData = response.body()?.data
if (hourlyData != null) {
    // Always build a 24‑hour list (0..23), fill with zeros first
    val padded = MutableList(24) { hour ->
        myapplication.test.wattwisepro.model.HourlyUsageItem(
            hour = hour,
            wattage = 0.0,
            max_power = 0.0,
            min_power = 0.0,
            record_count = 0
        )
    }
    // Overlay real data where available
    hourlyData.forEach { item ->
        if (item.hour in 0..23) {
            padded[item.hour] = item
        }
    }
    // Use padded list for the chart
    setupChart(chart, padded)
} else {
                        Toast.makeText(this@DailyActivity, "No hourly data available", Toast.LENGTH_SHORT).show()
                        dialog.dismiss()
                    }
                } else {
                    Toast.makeText(this@DailyActivity, "Failed to load hourly data", Toast.LENGTH_SHORT).show()
                    dialog.dismiss()
                }
            }

            override fun onFailure(call: Call<HourlyUsageResponse>, t: Throwable) {
                tvLoading.visibility = TextView.GONE
                Toast.makeText(this@DailyActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
        })
    }
    
    private fun setupChart(chart: LineChart, hourlyData: List<myapplication.test.wattwisepro.model.HourlyUsageItem>) {
    // Make the chart fill the dialog width so the 0–23h range is visible
    val layoutParams = chart.layoutParams
    layoutParams.width = ViewGroup.LayoutParams.MATCH_PARENT
    chart.layoutParams = layoutParams
        
        // Prepare data entries
        val entries = mutableListOf<Entry>()
        hourlyData.forEach { item ->
            entries.add(Entry(item.hour.toFloat(), item.wattage.toFloat()))
        }
        
        // Create dataset
        val dataSet = LineDataSet(entries, "Wattage (W)")
        dataSet.color = ContextCompat.getColor(this, R.color.dark_blue)
        dataSet.lineWidth = 2f
        dataSet.setCircleColor(ContextCompat.getColor(this, R.color.dark_blue))
        dataSet.circleRadius = 4f
        dataSet.setDrawValues(false) // Hide values on points for cleaner look
        dataSet.mode = LineDataSet.Mode.CUBIC_BEZIER // Smooth curve
        
        // Create line data
        val lineData = LineData(dataSet)
        chart.data = lineData

        // Show the full 0–23 hour range by default
        chart.setVisibleXRangeMaximum(24f)
        chart.moveViewToX(0f)
        
        // Configure X-axis (hours)
        val xAxis = chart.xAxis
        xAxis.position = XAxis.XAxisPosition.BOTTOM
        xAxis.textColor = ContextCompat.getColor(this, android.R.color.black)
        xAxis.textSize = 10f
        xAxis.setDrawGridLines(false)
        xAxis.valueFormatter = object : ValueFormatter() {
            override fun getFormattedValue(value: Float): String {
                val hour = value.toInt()
                return when (hour) {
                    0 -> "12 AM"
                    in 1..11 -> "$hour AM"
                    12 -> "12 PM"
                    else -> "${hour - 12} PM"
                }
            }
        }
        // Show all labels for better readability when scrolling
        xAxis.labelCount = hourlyData.size
        xAxis.granularity = 1f
        xAxis.setAvoidFirstLastClipping(true)
        
        // Configure Y-axis (wattage)
        val yAxisLeft = chart.axisLeft
        yAxisLeft.textColor = ContextCompat.getColor(this, android.R.color.black)
        yAxisLeft.textSize = 10f
        yAxisLeft.setDrawGridLines(true)
        yAxisLeft.gridColor = ContextCompat.getColor(this, android.R.color.darker_gray)
        yAxisLeft.axisMinimum = 0f
        
        val yAxisRight = chart.axisRight
        yAxisRight.isEnabled = false // Disable right Y-axis
        
        // Configure chart appearance
        chart.description.isEnabled = false
        chart.legend.isEnabled = false
        chart.setTouchEnabled(true)
        chart.setDragEnabled(true)
        chart.setScaleEnabled(true)
        chart.setPinchZoom(true)
        
        // Refresh chart
        chart.invalidate()
    }
    
    override fun onBackPressed() {
        // Go back to HomeActivity
        val intent = Intent(this, HomeActivity::class.java)
        startActivity(intent)
        finish()
        overridePendingTransition(0, 0)
    }
}

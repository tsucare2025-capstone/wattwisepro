package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import com.google.android.material.bottomnavigation.BottomNavigationView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class HistoryActivity : AppCompatActivity() {

    // Daily
    private lateinit var btnPrevDaily: Button
    private lateinit var btnNextDaily: Button
    private lateinit var tvDailyRange: TextView
    private var currentStartDate: Calendar = Calendar.getInstance()

    // Weekly
    private lateinit var btnPrevWeekly: Button
    private lateinit var btnNextWeekly: Button
    private lateinit var tvWeeklyRange: TextView
    private var currentMonth: Calendar = Calendar.getInstance()

    // Monthly
    private lateinit var btnPrevMonthly: Button
    private lateinit var btnNextMonthly: Button
    private lateinit var tvMonthlyRange: TextView
    private var currentYear: Calendar = Calendar.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.history)

        val backBtn: Button = findViewById(R.id.btn_back)
        backBtn.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }

        // --- Daily Controls ---
        btnPrevDaily = findViewById(R.id.btnPrevDaily)
        btnNextDaily = findViewById(R.id.btnNextDaily)
        tvDailyRange = findViewById(R.id.tvDailyRange)

        setToWeekStart(currentStartDate)
        updateDailyRangeText()

        btnPrevDaily.setOnClickListener {
            currentStartDate.add(Calendar.DAY_OF_YEAR, -7)
            updateDailyRangeText()
        }

        btnNextDaily.setOnClickListener {
            currentStartDate.add(Calendar.DAY_OF_YEAR, 7)
            updateDailyRangeText()
        }

        // --- Weekly Controls ---
        btnPrevWeekly = findViewById(R.id.btnPrevWeekly)
        btnNextWeekly = findViewById(R.id.btnNextWeekly)
        tvWeeklyRange = findViewById(R.id.tvWeeklyRange)

        updateWeeklyRangeText()

        btnPrevWeekly.setOnClickListener {
            currentMonth.add(Calendar.MONTH, -1)
            updateWeeklyRangeText()
        }

        btnNextWeekly.setOnClickListener {
            currentMonth.add(Calendar.MONTH, 1)
            updateWeeklyRangeText()
        }

        // --- Monthly Controls ---
        btnPrevMonthly = findViewById(R.id.btnPrevMonthly)
        btnNextMonthly = findViewById(R.id.btnNextMonthly)
        tvMonthlyRange = findViewById(R.id.tvMonthlyRange)

        updateMonthlyRangeText()

        btnPrevMonthly.setOnClickListener {
            currentYear.add(Calendar.YEAR, -1)
            updateMonthlyRangeText()
        }

        btnNextMonthly.setOnClickListener {
            currentYear.add(Calendar.YEAR, 1)
            updateMonthlyRangeText()
        }

        // --- Bottom Navigation ---
        val bottomNavigationView: BottomNavigationView = findViewById(R.id.bottomNavigationView)
        bottomNavigationView.selectedItemId = R.id.settings_nav

        bottomNavigationView.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.home_nav -> {
                    startActivity(Intent(this, HomeActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }
                R.id.calcu_nav -> {
                    startActivity(Intent(this, CalculatorActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }
                R.id.settings_nav -> true
                else -> false
            }
        }
    }

    // --- Helper Methods ---
    private fun setToWeekStart(calendar: Calendar) {
        calendar.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
    }

    private fun updateDailyRangeText() {
        val sdf = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        val startDate = currentStartDate.time
        val endDateCalendar = currentStartDate.clone() as Calendar
        endDateCalendar.add(Calendar.DAY_OF_YEAR, 6)
        val endDate = endDateCalendar.time
        tvDailyRange.text = "${sdf.format(startDate)} - ${sdf.format(endDate)}"
    }

    private fun updateWeeklyRangeText() {
        val sdf = SimpleDateFormat("MMMM yyyy", Locale.getDefault())
        tvWeeklyRange.text = sdf.format(currentMonth.time)
    }

    private fun updateMonthlyRangeText() {
        val sdf = SimpleDateFormat("yyyy", Locale.getDefault())
        tvMonthlyRange.text = sdf.format(currentYear.time)
    }
}

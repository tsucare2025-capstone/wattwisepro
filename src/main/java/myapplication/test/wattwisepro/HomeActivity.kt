package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView
import java.text.SimpleDateFormat
import java.util.*

class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home_main)

        val bottomNav = findViewById<BottomNavigationView>(R.id.bottomNavigationView)
        bottomNav.selectedItemId = R.id.home_nav

        val dailyButton = findViewById<Button>(R.id.btnDaily)
        val weeklyButton = findViewById<Button>(R.id.btnWeekly)
        val monthlyButton = findViewById<Button>(R.id.btnMonthly)

        // ====== 🧭 NAVIGATION BUTTONS ======
        dailyButton.setOnClickListener {
            val intent = Intent(this, DailyActivity::class.java)
            startActivity(intent)
            overridePendingTransition(0, 0)
        }

        weeklyButton.setOnClickListener {
            val intent = Intent(this, WeeklyActivity::class.java)
            startActivity(intent)
            overridePendingTransition(0, 0)
        }

        monthlyButton.setOnClickListener {
            val intent = Intent(this, MonthlyActivity::class.java)
            startActivity(intent)
            overridePendingTransition(0, 0)
        }

        // ====== ⚙️ BOTTOM NAVIGATION ======
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.home_nav -> true

                R.id.calcu_nav -> {
                    startActivity(Intent(this, CalculatorActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }

                R.id.button_history -> {
                    startActivity(Intent(this, HistoryActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }

                R.id.settings_nav -> {
                    startActivity(Intent(this, SettingsActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }

                else -> false
            }
        }

        val tvLiveValue: TextView = findViewById(R.id.tvLiveValue)
        val tvLiveDate: TextView = findViewById(R.id.tvLiveDate)


        val today = java.text.SimpleDateFormat("MMMM dd", java.util.Locale.getDefault())
            .format(java.util.Date())
        tvLiveDate.text = "Live usage: $today"


        val random = java.util.Random()
        val handler = android.os.Handler()
        val updateRunnable = object : Runnable {
            override fun run() {
                val newValue = 100 + random.nextInt(400)
                tvLiveValue.text = newValue.toString()
                handler.postDelayed(this, 3000)
            }
        }
        handler.post(updateRunnable)
    }
}


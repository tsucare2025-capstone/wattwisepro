package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Switch
import android.widget.Toast
import com.google.android.material.bottomnavigation.BottomNavigationView
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.settings)


        val buttonTips = findViewById<Button>(R.id.button_tips)
        val buttonHistory = findViewById<Button>(R.id.button_history)
        val switchNotification = findViewById<Switch>(R.id.switchNotification)
        val bottomNavigationView = findViewById<BottomNavigationView>(R.id.bottomNavigationView)


        bottomNavigationView.selectedItemId = R.id.settings_nav


        buttonTips.setOnClickListener {
            val intent = Intent(this, TipsActivity::class.java)
            startActivity(intent)
            overridePendingTransition(0, 0) // disable animation
        }


        buttonHistory.setOnClickListener {
            val intent = Intent(this, HistoryActivity::class.java)
            startActivity(intent)
            overridePendingTransition(0, 0) // disable animation
        }


        switchNotification.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                Toast.makeText(this, "Notifications Enabled", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Notifications Disabled", Toast.LENGTH_SHORT).show()
            }
        }


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
                R.id.settings_nav -> {
                    // already here
                    true
                }
                else -> false
            }
        }
    }
}

package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import com.google.android.material.bottomnavigation.BottomNavigationView
import androidx.appcompat.app.AppCompatActivity

class TipsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.tips)

        // --- Back Button ---
        val backBtn: Button = findViewById(R.id.button5)
        backBtn.setOnClickListener {
            finish() // go back
            overridePendingTransition(0, 0) // 🚀 remove animation
        }

        // --- Bottom Navigation ---
        val bottomNavigationView: BottomNavigationView = findViewById(R.id.bottomNavigationView)

        // ✅ Tips is under Settings section → highlight Settings tab
        bottomNavigationView.selectedItemId = R.id.settings_nav

        bottomNavigationView.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.home_nav -> {
                    startActivity(Intent(this, HomeActivity::class.java))
                    overridePendingTransition(0, 0) // 🚀 no animation
                    true
                }

                R.id.calcu_nav -> {
                    startActivity(Intent(this, CalculatorActivity::class.java))
                    overridePendingTransition(0, 0) // 🚀 no animation
                    true
                }

                R.id.settings_nav -> {
                    // already in Settings section (Tips belongs here)
                    true
                }

                else -> false
            }
        }
    }
}

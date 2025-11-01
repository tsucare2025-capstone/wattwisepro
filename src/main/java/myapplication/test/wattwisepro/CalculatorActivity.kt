package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView

class CalculatorActivity : AppCompatActivity() {

    private lateinit var tableLayout: TableLayout
    private lateinit var tvResult: TextView
    private lateinit var btnAddRow: Button
    private lateinit var btnCalculate: Button
    private lateinit var etGlobalPrice: EditText

    // Example appliances list
    private val appliances = arrayOf("Fan", "Aircon", "TV", "Refrigerator", "Washing Machine")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.cal_main)

        // Initialize UI
        tableLayout = findViewById(R.id.tableLayout)
        tvResult = findViewById(R.id.tvResult)
        btnAddRow = findViewById(R.id.btnAddRow)
        btnCalculate = findViewById(R.id.btnCalculate)
        etGlobalPrice = findViewById(R.id.etGlobalPrice)

        // Add first row automatically
        addRow()

        // Button actions
        btnAddRow.setOnClickListener { addRow() }
        btnCalculate.setOnClickListener { calculateTotal() }

        // Bottom navigation setup
        val bottomNav = findViewById<BottomNavigationView>(R.id.bottomNavigationView)
        bottomNav.selectedItemId = R.id.calcu_nav

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.home_nav -> {
                    startActivity(Intent(this, HomeActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }
                R.id.calcu_nav -> true
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
                R.id.button_tips -> {
                    startActivity(Intent(this, TipsActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }
                else -> false
            }
        }
    }

    private fun addRow() {
        val tableRow = TableRow(this)

        // Spinner for appliance
        val spinner = Spinner(this)
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, appliances)

        // EditTexts
        val etWatts = EditText(this).apply {
            hint = "W"
            width = 200
            setTextColor(resources.getColor(android.R.color.black))
            setHintTextColor(resources.getColor(android.R.color.darker_gray))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }

        val etHours = EditText(this).apply {
            hint = "Hr"
            width = 200
            setTextColor(resources.getColor(android.R.color.black))
            setHintTextColor(resources.getColor(android.R.color.darker_gray))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }

        // Delete Button
        val btnDelete = Button(this).apply {
            text = "X"
            setOnClickListener {
                tableLayout.removeView(tableRow)
            }
        }

        // Add views to row
        tableRow.addView(spinner)
        tableRow.addView(etWatts)
        tableRow.addView(etHours)
        tableRow.addView(btnDelete)

        // Add row to table
        tableLayout.addView(tableRow)
    }

    private fun calculateTotal() {
        var total = 0.0

        val pricePerKwh = etGlobalPrice.text.toString().toDoubleOrNull() ?: 0.0

        // Skip first row (header)
        for (i in 1 until tableLayout.childCount) {
            val row = tableLayout.getChildAt(i) as TableRow

            val etWatts = row.getChildAt(1) as EditText
            val etHours = row.getChildAt(2) as EditText

            val watts = etWatts.text.toString().toDoubleOrNull() ?: 0.0
            val hours = etHours.text.toString().toDoubleOrNull() ?: 0.0

            // Formula: (Watts × Hours ÷ 1000) × Price/kWh
            val cost = (watts * hours / 1000) * pricePerKwh
            total += cost
        }

        tvResult.text = "Total: ₱%.2f".format(total)
    }
}

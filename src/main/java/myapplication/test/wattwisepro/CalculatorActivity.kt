package myapplication.test.wattwisepro

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.bottomnavigation.BottomNavigationView

class CalculatorActivity : AppCompatActivity() {

    private lateinit var tableLayout: LinearLayout
    private lateinit var tvResult: TextView
    private lateinit var btnAddRow: Button
    private lateinit var btnCalculate: Button
    private lateinit var etGlobalPrice: EditText
    private lateinit var etDays: EditText

    // Appliance list
    private val appliances = arrayOf(
        "Fan",
        "Aircon",
        "Aircon (Inverter)",
        "TV",
        "Refrigerator",
        "Refrigerator (Inverter)",
        "Washing Machine"
    )
    
    // Data class for appliance sub-options
    data class ApplianceOption(val name: String, val watts: Int)
    data class ApplianceData(
        val name: String,
        val hasSubOptions: Boolean,
        val subOptionLabel: String,
        val options: List<ApplianceOption>
    )
    
    // Appliance data with sub-options and wattage
    private val applianceData = mapOf(
        "Fan" to ApplianceData(
            name = "Fan",
            hasSubOptions = true,
            subOptionLabel = "Type:",
            options = listOf(
                ApplianceOption("Ceiling Fan", 75),
                ApplianceOption("Standing Fan", 100),
                ApplianceOption("Table Fan", 50)
            )
        ),
        "Aircon" to ApplianceData(
            name = "Aircon",
            hasSubOptions = true,
            subOptionLabel = "Horsepower:",
            options = listOf(
                ApplianceOption("0.5 HP", 500),
                ApplianceOption("1 HP", 900),
                ApplianceOption("1.5 HP", 1300),
                ApplianceOption("2 HP", 2000),
                ApplianceOption("2.5 HP", 2800),
                ApplianceOption("3 HP", 3500)
            )
        ),
        "Aircon (Inverter)" to ApplianceData(
            name = "Aircon (Inverter)",
            hasSubOptions = true,
            subOptionLabel = "Horsepower:",
            options = listOf(
                ApplianceOption("0.75 HP Inverter", 550),
                ApplianceOption("1 HP Inverter", 750),
                ApplianceOption("1.5 HP Inverter", 1050),
                ApplianceOption("2 HP Inverter", 1400),
                ApplianceOption("2.5 HP Inverter", 1800)
            )
        ),
        "TV" to ApplianceData(
            name = "TV",
            hasSubOptions = true,
            subOptionLabel = "Size:",
            options = listOf(
                ApplianceOption("32\" LED", 50),
                ApplianceOption("42\" LED", 80),
                ApplianceOption("55\" LED", 120),
                ApplianceOption("65\" LED", 150)
            )
        ),
        "Refrigerator" to ApplianceData(
            name = "Refrigerator",
            hasSubOptions = true,
            subOptionLabel = "Size:",
            options = listOf(
                ApplianceOption("Small (8 cu ft)", 150),
                ApplianceOption("Medium (16 cu ft)", 300),
                ApplianceOption("Large (20 cu ft)", 500)
            )
        ),
        "Refrigerator (Inverter)" to ApplianceData(
            name = "Refrigerator (Inverter)",
            hasSubOptions = true,
            subOptionLabel = "Size:",
            options = listOf(
                ApplianceOption("Small Inverter (8 cu ft)", 80),
                ApplianceOption("Medium Inverter (12-16 cu ft)", 120),
                ApplianceOption("Large Inverter (18-20 cu ft)", 180),
                ApplianceOption("Side-by-side Inverter", 250)
            )
        ),
        "Washing Machine" to ApplianceData(
            name = "Washing Machine",
            hasSubOptions = true,
            subOptionLabel = "Type:",
            options = listOf(
                ApplianceOption("Top Load 7kg", 500),
                ApplianceOption("Top Load 10kg", 600),
                ApplianceOption("Front Load 7kg", 400),
                ApplianceOption("Front Load 10kg", 500)
            )
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.cal_main)

        // Initialize UI
        tableLayout = findViewById(R.id.tableLayout)
        tvResult = findViewById(R.id.tvResult)
        btnAddRow = findViewById(R.id.btnAddRow)
        btnCalculate = findViewById(R.id.btnCalculate)
        etGlobalPrice = findViewById(R.id.etGlobalPrice)
        etDays = findViewById(R.id.etDays)

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
                    val intent = Intent(this, HomeActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    overridePendingTransition(0, 0)
                    finish()
                    true
                }
                R.id.calcu_nav -> true
                R.id.button_history -> {
                    startActivity(Intent(this, HistoryActivity::class.java))
                    overridePendingTransition(0, 0)
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
                R.id.button_tips -> {
                    startActivity(Intent(this, TipsActivity::class.java))
                    overridePendingTransition(0, 0)
                    true
                }
                else -> false
            }
        }
        
        // Handle back button press with exit confirmation dialog
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                showExitDialog()
            }
        })
    }
    
    private fun showExitDialog() {
        AlertDialog.Builder(this)
            .setTitle("Exit App")
            .setMessage("Do you really want to exit?")
            .setPositiveButton("Yes") { _, _ ->
                finishAffinity() // Exit the app
            }
            .setNegativeButton("No", null)
            .setCancelable(false)
            .show()
    }

    private fun addRow() {
        // Create container for each appliance entry (vertical layout)
        val applianceContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 10, 0, 10)
            }
            background = ContextCompat.getDrawable(this@CalculatorActivity, R.drawable.rounded_button_light_blue)
            setPadding(10, 10, 10, 10)
        }

        // Spinner for appliance (full width on top)
        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@CalculatorActivity, android.R.layout.simple_spinner_dropdown_item, appliances)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // Container for sub-options (initially hidden)
        val subOptionContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 10
            }
            visibility = View.GONE
        }

        // Label for sub-option
        val subOptionLabel = TextView(this).apply {
            text = ""
            textSize = 14f
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, R.color.dark_blue))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 5
            }
        }

        // Spinner for sub-options
        val subOptionSpinner = Spinner(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        subOptionContainer.addView(subOptionLabel)
        subOptionContainer.addView(subOptionSpinner)

        // Checkbox for custom wattage input
        val cbCustomWattage = CheckBox(this).apply {
            text = "Use custom wattage"
            textSize = 12f
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, R.color.dark_blue))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 5
            }
            visibility = View.GONE
        }

        // Horizontal layout for Watts, Hours, Quantity, Action
        val bottomRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 10
            }
            weightSum = 4f
        }

        // EditText for Watts
        val etWatts = EditText(this).apply {
            hint = "W"
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ).apply {
                marginEnd = 5
            }
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.black))
            setHintTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.darker_gray))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            setPadding(10, 10, 10, 10)
            isEnabled = false // Initially disabled
        }

        // EditText for Hours
        val etHours = EditText(this).apply {
            hint = "Hr"
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ).apply {
                marginStart = 5
                marginEnd = 5
            }
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.black))
            setHintTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.darker_gray))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            setPadding(10, 10, 10, 10)
        }

        // EditText for Quantity
        val etQuantity = EditText(this).apply {
            hint = "Qty"
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ).apply {
                marginStart = 5
                marginEnd = 5
            }
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.black))
            setHintTextColor(ContextCompat.getColor(this@CalculatorActivity, android.R.color.darker_gray))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setPadding(10, 10, 10, 10)
            setText("1") // Default quantity is 1
        }

        // Delete Button
        val btnDelete = Button(this).apply {
            text = "X"
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ).apply {
                marginStart = 5
            }
            background = ContextCompat.getDrawable(this@CalculatorActivity, R.drawable.button_light_blue)
            setTextColor(ContextCompat.getColor(this@CalculatorActivity, R.color.dark_blue))
            setOnClickListener {
                tableLayout.removeView(applianceContainer)
            }
        }

        // Handle appliance selection
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val selectedAppliance = appliances[position]
                val data = applianceData[selectedAppliance]
                
                if (data != null && data.hasSubOptions) {
                    // Show sub-option container
                    subOptionContainer.visibility = View.VISIBLE
                    subOptionLabel.text = data.subOptionLabel
                    
                    // Populate sub-option spinner
                    val optionNames = data.options.map { it.name }
                    subOptionSpinner.adapter = ArrayAdapter(
                        this@CalculatorActivity,
                        android.R.layout.simple_spinner_dropdown_item,
                        optionNames
                    )
                    
                    // Auto-select first option
                    subOptionSpinner.setSelection(0)
                    val firstOption = data.options[0]
                    etWatts.setText(firstOption.watts.toString())
                    
                    // Show custom wattage checkbox
                    cbCustomWattage.visibility = View.VISIBLE
                    cbCustomWattage.isChecked = false
                    etWatts.isEnabled = false
                } else {
                    // Hide sub-option container
                    subOptionContainer.visibility = View.GONE
                    cbCustomWattage.visibility = View.GONE
                    cbCustomWattage.isChecked = false
                    etWatts.setText("")
                    etWatts.isEnabled = true // Enable for manual input
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        // Handle sub-option selection
        subOptionSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (!cbCustomWattage.isChecked) {
                    val selectedAppliance = spinner.selectedItem as String
                    val data = applianceData[selectedAppliance]
                    if (data != null && position < data.options.size) {
                        val selectedOption = data.options[position]
                        etWatts.setText(selectedOption.watts.toString())
                    }
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        // Handle custom wattage checkbox
        cbCustomWattage.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                // Enable manual input
                etWatts.isEnabled = true
                etWatts.setText("")
                etWatts.requestFocus()
            } else {
                // Disable and auto-fill from sub-option
                etWatts.isEnabled = false
                val selectedAppliance = spinner.selectedItem as String
                val data = applianceData[selectedAppliance]
                if (data != null && subOptionSpinner.selectedItemPosition < data.options.size) {
                    val selectedOption = data.options[subOptionSpinner.selectedItemPosition]
                    etWatts.setText(selectedOption.watts.toString())
                }
            }
        }

        // Add views to bottom row
        bottomRow.addView(etWatts)
        bottomRow.addView(etHours)
        bottomRow.addView(etQuantity)
        bottomRow.addView(btnDelete)

        // Add all views to container in order
        applianceContainer.addView(spinner)
        applianceContainer.addView(subOptionContainer)
        applianceContainer.addView(cbCustomWattage)
        applianceContainer.addView(bottomRow)

        // Add container to table layout
        tableLayout.addView(applianceContainer)
    }

    private fun calculateTotal() {
        var total = 0.0

        val pricePerKwh = etGlobalPrice.text.toString().toDoubleOrNull() ?: 0.0
        val days = etDays.text.toString().toIntOrNull() ?: 1 // Default to 1 day if empty or invalid

        // Skip first child (header)
        for (i in 1 until tableLayout.childCount) {
            val applianceContainer = tableLayout.getChildAt(i) as LinearLayout
            
            // Find the bottom row (last child) which contains Watts, Hours, Quantity, Delete
            val bottomRow = applianceContainer.getChildAt(applianceContainer.childCount - 1) as LinearLayout

            // Get Watts (first child), Hours (second child), and Quantity (third child) from bottom row
            val etWatts = bottomRow.getChildAt(0) as EditText
            val etHours = bottomRow.getChildAt(1) as EditText
            val etQuantity = bottomRow.getChildAt(2) as EditText

            val watts = etWatts.text.toString().toDoubleOrNull() ?: 0.0
            val hours = etHours.text.toString().toDoubleOrNull() ?: 0.0
            val quantity = etQuantity.text.toString().toDoubleOrNull() ?: 1.0 // Default to 1 if empty

            // Multiply watts by quantity to get effective watts
            val effectiveWatts = watts * quantity

            // Formula: kWh = (Watts × Hours) / 1000
            // Then: Cost = kWh × Price/kWh
            val kWh = (effectiveWatts * hours) / 1000
            val cost = kWh * pricePerKwh
            total += cost
        }

        // Multiply total by number of days
        total *= days

        tvResult.text = "Total: ₱%.2f".format(total)
    }
    
}

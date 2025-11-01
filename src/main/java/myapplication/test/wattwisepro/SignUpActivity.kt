package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import myapplication.test.wattwisepro.api.RetrofitClient
import myapplication.test.wattwisepro.model.SignUpRequest
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class SignUpActivity : AppCompatActivity() {
    private lateinit var usernameInput: EditText
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var repeatPasswordInput: EditText
    private lateinit var addressInput: EditText
    private lateinit var householdTypeSpinner: Spinner
    private lateinit var cityInput: EditText
    private lateinit var subdivisionInput: EditText
    private lateinit var phoneNumberInput: EditText
    private lateinit var createBtn: Button
    private lateinit var loginBtn: Button
    private lateinit var progressBar: ProgressBar

    private val householdTypes = arrayOf("Single", "Family", "Apartment", "House")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initializeViews()
        setupSpinner()
        setupClickListeners()
    }

    private fun initializeViews() {
        usernameInput = findViewById(R.id.username_input)
        emailInput = findViewById(R.id.email_address_input)
        passwordInput = findViewById(R.id.password_input)
        repeatPasswordInput = findViewById(R.id.repeat_password_input)
        addressInput = findViewById(R.id.address_input)
        householdTypeSpinner = findViewById(R.id.household_type_spinner)
        cityInput = findViewById(R.id.city_input)
        subdivisionInput = findViewById(R.id.subdivision_input)
        phoneNumberInput = findViewById(R.id.phone_number_input)
        createBtn = findViewById(R.id.create_btn)
        loginBtn = findViewById(R.id.tvLogin)
        
        // Create progress bar programmatically if not in layout
        progressBar = ProgressBar(this).apply {
            visibility = View.GONE
        }
    }

    private fun setupSpinner() {
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, householdTypes)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        householdTypeSpinner.adapter = adapter
        householdTypeSpinner.setSelection(1) // Default to "Family"
    }

    private fun setupClickListeners() {
        loginBtn.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            overridePendingTransition(0, 0)
        }

        createBtn.setOnClickListener {
            handleSignUp()
        }
    }

    private fun handleSignUp() {
        val name = usernameInput.text.toString().trim()
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        val repeatPassword = repeatPasswordInput.text.toString()
        val address = addressInput.text.toString().trim()
        val householdType = householdTypeSpinner.selectedItem.toString()
        val city = cityInput.text.toString().trim()
        val subdivision = subdivisionInput.text.toString().trim()
        val phoneNumber = phoneNumberInput.text.toString().trim()

        // Validate inputs
        if (!validateInputs(name, email, password, repeatPassword, address, city, subdivision, phoneNumber)) {
            return
        }

        // Show loading
        createBtn.isEnabled = false
        progressBar.visibility = View.VISIBLE

        // Create signup request
        val signUpRequest = SignUpRequest(
            name = name,
            email = email,
            password = password,
            address = address,
            householdType = householdType,
            city = city,
            subdivision = subdivision,
            phoneNumber = phoneNumber
        )

        // Make API call
        RetrofitClient.apiService.signUp(signUpRequest)
            .enqueue(object : Callback<myapplication.test.wattwisepro.model.SignUpResponse> {
                override fun onResponse(
                    call: Call<myapplication.test.wattwisepro.model.SignUpResponse>,
                    response: Response<myapplication.test.wattwisepro.model.SignUpResponse>
                ) {
                    createBtn.isEnabled = true
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        val signUpResponse = response.body()!!
                        if (signUpResponse.success) {
                            Toast.makeText(
                                this@SignUpActivity,
                                "Account created successfully! Please log in.",
                                Toast.LENGTH_LONG
                            ).show()
                            // Navigate to login
                            startActivity(Intent(this@SignUpActivity, LoginActivity::class.java))
                            finish()
                        } else {
                            Toast.makeText(
                                this@SignUpActivity,
                                signUpResponse.message,
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        Toast.makeText(
                            this@SignUpActivity,
                            "Sign up failed. Please try again.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(
                    call: Call<myapplication.test.wattwisepro.model.SignUpResponse>,
                    t: Throwable
                ) {
                    createBtn.isEnabled = true
                    progressBar.visibility = View.GONE
                    Log.e("SignUpActivity", "Sign up error", t)
                    Toast.makeText(
                        this@SignUpActivity,
                        "Network error. Please check your connection and try again.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun validateInputs(
        name: String,
        email: String,
        password: String,
        repeatPassword: String,
        address: String,
        city: String,
        subdivision: String,
        phoneNumber: String
    ): Boolean {
        when {
            name.isEmpty() -> {
                usernameInput.error = "Username is required"
                usernameInput.requestFocus()
                return false
            }
            email.isEmpty() -> {
                emailInput.error = "Email is required"
                emailInput.requestFocus()
                return false
            }
            !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() -> {
                emailInput.error = "Invalid email format"
                emailInput.requestFocus()
                return false
            }
            password.isEmpty() -> {
                passwordInput.error = "Password is required"
                passwordInput.requestFocus()
                return false
            }
            password.length < 6 -> {
                passwordInput.error = "Password must be at least 6 characters"
                passwordInput.requestFocus()
                return false
            }
            repeatPassword.isEmpty() -> {
                repeatPasswordInput.error = "Please repeat your password"
                repeatPasswordInput.requestFocus()
                return false
            }
            password != repeatPassword -> {
                repeatPasswordInput.error = "Passwords do not match"
                repeatPasswordInput.requestFocus()
                return false
            }
            address.isEmpty() -> {
                addressInput.error = "Address is required"
                addressInput.requestFocus()
                return false
            }
            city.isEmpty() -> {
                cityInput.error = "City is required"
                cityInput.requestFocus()
                return false
            }
            subdivision.isEmpty() -> {
                subdivisionInput.error = "Subdivision is required"
                subdivisionInput.requestFocus()
                return false
            }
            phoneNumber.isEmpty() -> {
                phoneNumberInput.error = "Phone number is required"
                phoneNumberInput.requestFocus()
                return false
            }
            phoneNumber.length < 10 -> {
                phoneNumberInput.error = "Invalid phone number"
                phoneNumberInput.requestFocus()
                return false
            }
        }
        return true
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(0, 0)
    }
}
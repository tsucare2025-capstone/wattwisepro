package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class   MainActivity : AppCompatActivity() {
    private lateinit var personNameInput: EditText
    private lateinit var emailAddressInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var repeatpasswordInput: EditText
    private lateinit var createBtn: Button
    private lateinit var loginBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        personNameInput = findViewById(R.id.username_input)
        emailAddressInput = findViewById(R.id.email_address_input)
        passwordInput = findViewById(R.id.password_input)
        repeatpasswordInput = findViewById(R.id.repeat_password_input)
        createBtn = findViewById(R.id.create_btn)
        loginBtn = findViewById(R.id.tvLogin)

        createBtn.setOnClickListener {
            val username = personNameInput.text.toString()
            val email = emailAddressInput.text.toString()
            val password = passwordInput.text.toString()
            val repeat = repeatpasswordInput.text.toString()

            when {
                username.isEmpty() || email.isEmpty() || password.isEmpty() || repeat.isEmpty() -> {
                    Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                }
                password != repeat -> {
                    Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show()
                }
                else -> {
                    Log.i("Test Credentials", "Username: $username, Email: $email")
                    Toast.makeText(this, "Account created successfully! Please log in.", Toast.LENGTH_LONG).show()
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                }
            }
        }

        loginBtn.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }
}

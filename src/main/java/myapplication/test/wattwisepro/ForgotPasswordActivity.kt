package myapplication.test.wattwisepro

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class ForgotPasswordActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.otp_main) // your XML with resend, send, verify

        val emailInput: EditText = findViewById(R.id.email_address_input)
        val codeInput: EditText = findViewById(R.id.code_input)
        val sendBtn: Button = findViewById(R.id.send_btn)
        val resendBtn: Button = findViewById(R.id.resend_btn)
        val verifyBtn: Button = findViewById(R.id.verify_btn)

        // Example: Send code
        sendBtn.setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isEmpty()) {
                Toast.makeText(this, "Please enter your email", Toast.LENGTH_SHORT).show()
            } else {
                // TODO: send code logic
                Toast.makeText(this, "Verification code sent to $email", Toast.LENGTH_SHORT).show()
            }
        }

        // Example: Resend code
        resendBtn.setOnClickListener {
            Toast.makeText(this, "Code resent", Toast.LENGTH_SHORT).show()
            // TODO: trigger resend logic
        }

        // Verify code → go to ResetPasswordActivity
        verifyBtn.setOnClickListener {
            val enteredCode = codeInput.text.toString().trim()

            if (enteredCode.isEmpty()) {
                Toast.makeText(this, "Enter the verification code", Toast.LENGTH_SHORT).show()
            } else if (enteredCode == "123456") { // 🔹 Replace with real validation
                Toast.makeText(this, "Code verified", Toast.LENGTH_SHORT).show()
                val intent = Intent(this, ResetPasswordActivity::class.java)
                startActivity(intent)
                finish()
            } else {
                Toast.makeText(this, "Invalid code", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

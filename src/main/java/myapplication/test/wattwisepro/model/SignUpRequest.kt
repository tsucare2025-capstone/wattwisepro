package myapplication.test.wattwisepro.model

data class SignUpRequest(
    val name: String,
    val email: String,
    val password: String,
    val address: String,
    val householdType: String,
    val city: String,
    val subdivision: String,
    val phoneNumber: String
)



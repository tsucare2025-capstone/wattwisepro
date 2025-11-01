package myapplication.test.wattwisepro.model

data class SignUpResponse(
    val success: Boolean,
    val message: String,
    val userId: Int? = null
)

data class ApiError(
    val success: Boolean,
    val message: String,
    val errors: Map<String, String>? = null
)



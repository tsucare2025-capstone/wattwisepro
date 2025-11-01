package myapplication.test.wattwisepro.api

import myapplication.test.wattwisepro.model.SignUpRequest
import myapplication.test.wattwisepro.model.SignUpResponse
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {
    @POST("api/auth/signup")
    fun signUp(@Body request: SignUpRequest): Call<SignUpResponse>
}



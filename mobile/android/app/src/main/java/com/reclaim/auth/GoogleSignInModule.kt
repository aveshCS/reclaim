package com.reclaim.auth

import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * "Sign in with Google" through Android Credential Manager. Returns only Google's ID token
 * (plus the email to show); the server verifies the token. No Google password or access to
 * the user's Google data is involved.
 */
class GoogleSignInModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName() = NAME

  @ReactMethod
  fun signIn(webClientId: String, promise: Promise) {
    val activity = ctx.currentActivity
    if (activity == null) {
      promise.reject("no_activity", "RECLAIM is not in the foreground.")
      return
    }
    val option = GetSignInWithGoogleOption.Builder(webClientId).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    CredentialManager.create(activity).getCredentialAsync(
        activity,
        request,
        CancellationSignal(),
        ContextCompat.getMainExecutor(activity),
        object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
          override fun onResult(result: GetCredentialResponse) {
            val c = result.credential
            if (c !is CustomCredential || c.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
              promise.reject("failed", "Unexpected credential type.")
              return
            }
            try {
              val g = GoogleIdTokenCredential.createFrom(c.data)
              val out = Arguments.createMap()
              out.putString("idToken", g.idToken)
              out.putString("email", g.id)
              promise.resolve(out)
            } catch (e: GoogleIdTokenParsingException) {
              promise.reject("failed", "Google's answer could not be read.", e)
            }
          }

          override fun onError(e: GetCredentialException) {
            when (e) {
              is GetCredentialCancellationException -> promise.reject("cancelled", "Sign-in cancelled.", e)
              is NoCredentialException -> promise.reject("no_account", "No Google account on this phone.", e)
              else -> promise.reject("failed", e.message ?: "Google sign-in failed.", e)
            }
          }
        },
    )
  }

  /** Forget the chosen account so the next sign-in asks again. */
  @ReactMethod
  fun signOut(promise: Promise) {
    CredentialManager.create(ctx).clearCredentialStateAsync(
        ClearCredentialStateRequest(),
        CancellationSignal(),
        ContextCompat.getMainExecutor(ctx),
        object : CredentialManagerCallback<Void?, ClearCredentialException> {
          override fun onResult(result: Void?) = promise.resolve(null)

          override fun onError(e: ClearCredentialException) = promise.resolve(null)
        },
    )
  }

  companion object {
    const val NAME = "ReclaimGoogleSignIn"
  }
}

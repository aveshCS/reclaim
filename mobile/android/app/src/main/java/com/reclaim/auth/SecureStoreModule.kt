package com.reclaim.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small encrypted key-value store for sign-in tokens. Values are sealed with AES-256-GCM
 * using a key that lives in the Android Keystore and never leaves it. If a value can't be
 * opened (e.g. the key was reset), it reads as missing and the user simply signs in again.
 */
class SecureStoreModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private val prefs = ctx.getSharedPreferences("reclaim_secure", Context.MODE_PRIVATE)

  override fun getName() = NAME

  @ReactMethod
  fun setItem(key: String, value: String, promise: Promise) {
    try {
      val cipher = Cipher.getInstance(TRANSFORM)
      cipher.init(Cipher.ENCRYPT_MODE, key())
      val sealed = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      prefs.edit().putString(key, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("secure_store", "Could not save securely.", e)
    }
  }

  @ReactMethod
  fun getItem(key: String, promise: Promise) {
    val stored = prefs.getString(key, null)
    if (stored == null) {
      promise.resolve(null)
      return
    }
    try {
      val bytes = Base64.decode(stored, Base64.NO_WRAP)
      val cipher = Cipher.getInstance(TRANSFORM)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, IV_BYTES))
      val plain = cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES)
      promise.resolve(String(plain, Charsets.UTF_8))
    } catch (e: Exception) {
      prefs.edit().remove(key).apply()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun removeItem(key: String, promise: Promise) {
    prefs.edit().remove(key).apply()
    promise.resolve(null)
  }

  private fun key(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
    val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    gen.init(
        KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build())
    return gen.generateKey()
  }

  companion object {
    const val NAME = "ReclaimSecureStore"
    private const val ALIAS = "reclaim_secure_store_v1"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
  }
}

package com.laundry

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException

class LaundryFreshDownloadsModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LaundryFreshDownloads"

  @ReactMethod
  fun savePdfToDownloads(sourceUri: String, fileName: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED_ANDROID", "Direct Downloads require Android 10 or newer.")
      return
    }

    val resolver = reactContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, fileName)
      put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/LaundryFresh")
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    var destination: Uri? = null
    try {
      destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Unable to create the invoice in Downloads.")

      resolver.openInputStream(Uri.parse(sourceUri)).use { input ->
        resolver.openOutputStream(destination).use { output ->
          if (input == null || output == null) throw IOException("Unable to access invoice file.")
          input.copyTo(output)
        }
      }

      resolver.update(
        destination,
        ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
        null,
        null,
      )
      promise.resolve(destination.toString())
    } catch (error: Exception) {
      destination?.let { resolver.delete(it, null, null) }
      promise.reject("DOWNLOAD_FAILED", error.message, error)
    }
  }
}

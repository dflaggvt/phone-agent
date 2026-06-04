package com.phoneagent.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import kotlin.math.max
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class PhoneAgentScreenshotSmokeTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun primaryScreensRenderNonBlankFrames() {
        var state by mutableStateOf(previewState())
        compose.setContent {
            PhoneAgentTheme {
                PhoneAgentApp(state, previewActions())
            }
        }

        listOf(
            ScreenshotBaseline("home", previewState(Tab.Home), minColorBuckets = 32, minLuminanceSpread = 0.38f),
            ScreenshotBaseline("topics", previewState(Tab.Topics), minColorBuckets = 28, minLuminanceSpread = 0.34f),
            ScreenshotBaseline("review", previewState(Tab.Review), minColorBuckets = 24, minLuminanceSpread = 0.32f),
            ScreenshotBaseline("assistant", previewState(Tab.Assistant), minColorBuckets = 20, minLuminanceSpread = 0.32f),
            ScreenshotBaseline("search", previewState(Tab.Search), minColorBuckets = 18, minLuminanceSpread = 0.30f),
            ScreenshotBaseline("topic_detail", previewState(screen = Screen.TopicDetail("topic_basement")), minColorBuckets = 22, minLuminanceSpread = 0.30f),
            ScreenshotBaseline("call_detail", previewState(screen = Screen.CallDetail("call_1")), minColorBuckets = 18, minLuminanceSpread = 0.26f),
            ScreenshotBaseline("forwarding", previewState(screen = Screen.Forwarding), minColorBuckets = 18, minLuminanceSpread = 0.28f)
        ).forEach { baseline ->
            state = baseline.state
            compose.waitForIdle()
            assertScreenshotMatchesBaseline(baseline.name, compose.onRoot().captureToImage(), baseline)
        }
    }

    private fun assertScreenshotMatchesBaseline(name: String, image: ImageBitmap, baseline: ScreenshotBaseline) {
        assertTrue("$name screenshot width should be phone-sized", image.width >= 320)
        assertTrue("$name screenshot height should be phone-sized", image.height >= 600)
        val pixels = image.toPixelMap()
        val xStep = max(1, pixels.width / 24)
        val yStep = max(1, pixels.height / 24)
        var sampled = 0
        var minLuminance = 1f
        var maxLuminance = 0f
        val buckets = mutableMapOf<Int, Int>()
        for (y in 0 until pixels.height step yStep) {
            for (x in 0 until pixels.width step xStep) {
                val color = pixels[x, y]
                sampled += 1
                minLuminance = minOf(minLuminance, color.luminance())
                maxLuminance = maxOf(maxLuminance, color.luminance())
                val bucket = colorBucket(color.red, color.green, color.blue)
                buckets[bucket] = (buckets[bucket] ?: 0) + 1
            }
        }
        val dominantRatio = (buckets.values.maxOrNull() ?: 0).toFloat() / sampled.toFloat()
        assertTrue("$name screenshot should sample enough pixels", sampled > 100)
        assertTrue("$name screenshot should have enough visual variety: ${buckets.size}", buckets.size >= baseline.minColorBuckets)
        assertTrue(
            "$name screenshot luminance spread too low: ${maxLuminance - minLuminance}",
            maxLuminance - minLuminance >= baseline.minLuminanceSpread
        )
        assertTrue("$name screenshot should not be dominated by one color bucket: $dominantRatio", dominantRatio <= 0.72f)
    }

    private fun colorBucket(red: Float, green: Float, blue: Float): Int {
        val r = (red * 7).toInt().coerceIn(0, 7)
        val g = (green * 7).toInt().coerceIn(0, 7)
        val b = (blue * 7).toInt().coerceIn(0, 7)
        return (r shl 6) or (g shl 3) or b
    }

    private data class ScreenshotBaseline(
        val name: String,
        val state: PhoneAgentUiState,
        val minColorBuckets: Int,
        val minLuminanceSpread: Float
    )
}

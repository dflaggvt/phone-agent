package com.phoneagent.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.ImageBitmap
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
            "home" to previewState(Tab.Home),
            "topics" to previewState(Tab.Topics),
            "review" to previewState(Tab.Review),
            "assistant" to previewState(Tab.Assistant),
            "search" to previewState(Tab.Search),
            "topic_detail" to previewState(screen = Screen.TopicDetail("topic_basement")),
            "call_detail" to previewState(screen = Screen.CallDetail("call_1")),
            "forwarding" to previewState(screen = Screen.Forwarding)
        ).forEach { (name, nextState) ->
            state = nextState
            compose.waitForIdle()
            assertScreenshotHasContent(name, compose.onRoot().captureToImage())
        }
    }

    private fun assertScreenshotHasContent(name: String, image: ImageBitmap) {
        val pixels = image.toPixelMap()
        val xStep = max(1, pixels.width / 24)
        val yStep = max(1, pixels.height / 24)
        val first = pixels[0, 0]
        var sampled = 0
        var varied = false
        for (y in 0 until pixels.height step yStep) {
            for (x in 0 until pixels.width step xStep) {
                sampled += 1
                if (pixels[x, y] != first) {
                    varied = true
                }
            }
        }
        assertTrue("$name screenshot should sample enough pixels", sampled > 100)
        assertTrue("$name screenshot should not be a blank single-color frame", varied)
    }
}

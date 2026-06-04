package com.phoneagent.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun PhoneAgentTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PhoneAgentMaterialColors,
        typography = PhoneAgentTypography,
        shapes = PhoneAgentMaterialShapes,
        content = content
    )
}

val TwilightTop = Color(0xFF65549B)
val TwilightMid = Color(0xFF352363)
val TwilightBottom = Color(0xFF160A2F)
val ChromeSurface = Color(0xFF202531)
val ChromeLine = Color(0xFF323847)
val ChromeMuted = Color(0xFF8B93A5)
val Card = Color(0xFFFCFAFF)
val Soft = Color(0xFFF1ECFF)
val Line = Color(0xFFE8E1F3)
val Ink = Color(0xFF151129)
val Muted = Color(0xFF5D5874)
val Brand = Color(0xFF7667E8)
val Success = Color(0xFF087C6F)
val SuccessLight = Color(0xFF7FE2D0)
val Warning = Color(0xFFB7791F)
val Info = Color(0xFF4E8CCF)
val Critical = Color(0xFFC2413A)

private val PhoneAgentMaterialColors = darkColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = Soft,
    onPrimaryContainer = Ink,
    secondary = Success,
    onSecondary = Color.White,
    tertiary = Warning,
    onTertiary = Color.White,
    background = TwilightBottom,
    onBackground = Color.White,
    surface = Card,
    onSurface = Ink,
    surfaceVariant = Soft,
    onSurfaceVariant = Muted,
    outline = Line,
    error = Critical,
    onError = Color.White
)

private val PhoneAgentTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 30.sp,
        lineHeight = 36.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 32.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 23.sp,
        lineHeight = 28.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        lineHeight = 25.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 21.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 23.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        lineHeight = 16.sp
    )
)

private val PhoneAgentMaterialShapes = Shapes(
    extraSmall = RoundedCornerShape(PhoneAgentRadii.Control),
    small = RoundedCornerShape(PhoneAgentRadii.Control),
    medium = RoundedCornerShape(PhoneAgentRadii.Card),
    large = RoundedCornerShape(PhoneAgentRadii.LargeCard),
    extraLarge = RoundedCornerShape(PhoneAgentRadii.Hero)
)

object PhoneAgentSpacing {
    val Xxs = 4.dp
    val Xs = 8.dp
    val Sm = 12.dp
    val Md = 16.dp
    val Lg = 20.dp
    val Xl = 24.dp
    val Xxl = 32.dp
}

object PhoneAgentRadii {
    val Control = 12.dp
    val Card = 16.dp
    val LargeCard = 18.dp
    val Hero = 20.dp
    val Pill = 999.dp
}

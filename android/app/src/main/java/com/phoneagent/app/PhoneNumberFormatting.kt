package com.phoneagent.app

internal fun normalizePhone(value: String): String {
    val trimmed = value.trim()
    val digits = trimmed.replace(Regex("[^0-9]"), "")
    return when {
        trimmed.startsWith("+") -> "+$digits"
        digits.length == 10 -> "+1$digits"
        digits.length == 11 && digits.startsWith("1") -> "+$digits"
        digits.isNotEmpty() -> "+$digits"
        else -> ""
    }
}

internal fun isValidE164Phone(value: String): Boolean =
    normalizePhone(value).matches(Regex("^\\+[1-9][0-9]{9,14}$"))

package com.phoneagent.app

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ScreenList(content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content
    )
}

@Composable
internal fun HomeTopicCard(topic: TopicThread?, actions: AppActions) {
    val title = topic?.title ?: "No topics yet"
    val unreadLabel = topic?.unreadIndicatorLabel.orEmpty()
    Surface(
        modifier = Modifier
            .width(164.dp)
            .height(84.dp)
            .clip(RoundedCornerShape(18.dp))
            .clickable { if (topic == null) actions.openTopics() else actions.openTopic(topic.id) },
        shape = RoundedCornerShape(18.dp),
        color = Color.White.copy(alpha = 0.15f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.24f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                title,
                color = Color.White,
                fontSize = 15.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            if (unreadLabel.isNotBlank()) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = SuccessLight.copy(alpha = 0.22f),
                    border = BorderStroke(1.dp, SuccessLight.copy(alpha = 0.38f))
                ) {
                    Text(
                        unreadLabel,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        color = Color.White,
                        fontSize = 11.sp,
                        lineHeight = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
internal fun TopicListCard(topic: TopicThread, actions: AppActions) {
    val unreadLabel = topic.unreadIndicatorLabel
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable { actions.openTopic(topic.id) },
        shape = RoundedCornerShape(16.dp),
        color = Card,
        border = BorderStroke(1.dp, Line)
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                topic.title,
                color = Ink,
                fontSize = 17.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (unreadLabel.isNotBlank()) {
                Spacer(Modifier.width(10.dp))
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Brand.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, Brand.copy(alpha = 0.18f))
                ) {
                    Text(
                        unreadLabel,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                        color = Brand,
                        fontSize = 12.sp,
                        lineHeight = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                }
            }
            Spacer(Modifier.width(6.dp))
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = Muted,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
internal fun EmptyTopicListCard() {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(66.dp),
        shape = RoundedCornerShape(16.dp),
        color = Card,
        border = BorderStroke(1.dp, Line)
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "No topics yet",
                color = Ink,
                fontSize = 17.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
internal fun TopicHero(topic: TopicThread) {
    Box(Modifier.fillMaxWidth().height(158.dp).clip(RoundedCornerShape(18.dp))) {
        Image(painterResource(topicImage(topic)), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.78f)))))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Text(topic.title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(topic.compactMeta, color = Color.White.copy(alpha = 0.88f), fontWeight = FontWeight.Bold, fontSize = 11.sp)
        }
    }
}

@Composable
internal fun CallRow(call: CallRecord, actions: AppActions) {
    WorkCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { actions.openCall(call.providerCallId) }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(call.displayCaller, color = Ink, fontSize = 17.sp, lineHeight = 21.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(call.phone.ifBlank { "Unknown number" }, color = Muted, fontSize = 13.sp, lineHeight = 17.sp)
                Text(call.displayTime.ifBlank { call.status }, color = Muted, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            IconButton(onClick = { actions.callNumber(call.callbackNumber.ifBlank { call.phone }) }) { Icon(Icons.Filled.Call, contentDescription = "Call back", tint = Brand) }
            IconButton(onClick = { actions.openCall(call.providerCallId) }) { Icon(Icons.Filled.Info, contentDescription = "Call details", tint = Brand) }
            IconButton(onClick = { actions.openAddNote(call.callbackNumber.ifBlank { call.phone }) }) { Icon(Icons.Filled.Add, contentDescription = "Add note", tint = Brand) }
        }
    }
}

@Composable
internal fun SuggestionCard(suggestion: TopicSuggestion, actions: AppActions) {
    WorkCard {
        Text("Review topic suggestion / ${(suggestion.confidence * 100).toInt()}%", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(suggestion.title, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, lineHeight = 21.sp)
        Text(suggestion.reason, color = Muted, fontSize = 14.sp, lineHeight = 19.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PrimaryButton("Accept", Icons.AutoMirrored.Filled.Send, Modifier.weight(1f)) { actions.acceptSuggestion(suggestion.id) }
            SecondaryButton("Dismiss", Modifier.weight(1f)) { actions.dismissSuggestion(suggestion.id) }
        }
    }
}

@Composable
internal fun TopicSearchRow(topic: TopicThread, actions: AppActions) {
    WorkCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { actions.openTopic(topic.id) }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(topic.title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(topic.compactMeta, color = Muted, fontSize = 12.sp)
            }
            IconButton(onClick = { actions.openTopic(topic.id) }) { Icon(Icons.Filled.Info, contentDescription = "Open topic", tint = Brand) }
        }
    }
}

@Composable
internal fun WorkCard(modifier: Modifier = Modifier.fillMaxWidth(), content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Card),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Line),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier
    ) {
        Column(Modifier.padding(12.dp), content = content)
    }
}

@Composable
internal fun QuietCard(title: String, body: String) {
    WorkCard {
        Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 21.sp)
        Text(body, color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
    }
}

@Composable
internal fun ErrorCard(message: String) {
    WorkCard {
        Text("Setup issue", color = Ink, fontWeight = FontWeight.Bold)
        Text(message, color = Critical, lineHeight = 20.sp)
    }
}

@Composable
internal fun DetailLine(label: String, value: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label.uppercase(), color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(value, color = Ink, fontSize = 15.sp, lineHeight = 20.sp)
    }
}

@Composable
internal fun SectionLabel(value: String) {
    Text(value.uppercase(), color = Color.White.copy(alpha = 0.84f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

@Composable
internal fun PrimaryButton(text: String, icon: ImageVector, modifier: Modifier = Modifier.fillMaxWidth(), enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Brand, disabledContainerColor = Brand.copy(alpha = 0.48f))
    ) {
        Icon(icon, contentDescription = null)
        Spacer(Modifier.width(6.dp))
        Text(text, fontWeight = FontWeight.Bold)
    }
}

@Composable
internal fun SecondaryButton(text: String, modifier: Modifier = Modifier.fillMaxWidth(), onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = modifier.height(46.dp), shape = RoundedCornerShape(12.dp)) {
        Text(text, color = Ink, fontWeight = FontWeight.Bold)
    }
}

@Composable
internal fun MetricTile(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.height(58.dp), color = Soft, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Line)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(value, color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(label, color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
internal fun ActionRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(Modifier.size(36.dp), shape = CircleShape, color = Soft) {
            Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = Brand) }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(subtitle, color = Muted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
internal fun SettingsRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(Modifier.size(36.dp), shape = CircleShape, color = Soft) {
            Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = Brand, modifier = Modifier.size(20.dp)) }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Ink, fontSize = 15.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Muted, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
internal fun ActionTile(title: String, subtitle: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier
            .height(78.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        color = Soft,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line)
    ) {
        Row(Modifier.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = Brand, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Ink, fontSize = 15.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, color = Muted, fontSize = 12.sp, lineHeight = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
internal fun CalmTextField(value: String, onValueChange: (String) -> Unit, label: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Card,
            unfocusedContainerColor = Card,
            focusedBorderColor = Line,
            unfocusedBorderColor = Line,
            focusedLabelColor = Muted,
            unfocusedLabelColor = Muted,
            cursorColor = Brand
        )
    )
}

@Composable
internal fun CalmFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .height(34.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = if (selected) Card else Color.White.copy(alpha = 0.14f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (selected) 0.0f else 0.30f))
    ) {
        Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(label, color = if (selected) Ink else Color.White.copy(alpha = 0.86f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
internal fun GlassRows(rows: List<Pair<String, String>>) {
    Surface(color = Color.White.copy(alpha = 0.10f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f))) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            rows.forEach { (title, code) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(code, color = Color.White.copy(alpha = 0.82f), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

private fun topicImage(topic: TopicThread?): Int {
    val text = ((topic?.title ?: "") + " " + (topic?.description ?: "")).lowercase()
    return when {
        text.contains("dog") || text.contains("pet") || text.contains("cat") || text.contains("vet") -> R.drawable.topic_pets_generated
        text.contains("family") || text.contains("wife") || text.contains("kid") || text.contains("parent") -> R.drawable.topic_family_generated
        text.contains("work") || text.contains("client") || text.contains("recruit") || text.contains("job") -> R.drawable.topic_work_generated
        text.contains("travel") || text.contains("trip") || text.contains("flight") || text.contains("hotel") -> R.drawable.topic_travel_generated
        text.contains("medical") || text.contains("doctor") || text.contains("health") -> R.drawable.topic_medical_generated
        text.contains("tax") || text.contains("budget") || text.contains("finance") || text.contains("invoice") -> R.drawable.topic_finance_generated
        text.contains("car") || text.contains("lease") || text.contains("vehicle") -> R.drawable.topic_car_generated
        text.contains("school") || text.contains("sport") || text.contains("coach") -> R.drawable.topic_school_generated
        text.contains("home") || text.contains("basement") || text.contains("contractor") || text.contains("repair") -> R.drawable.topic_home_projects_generated
        else -> R.drawable.topic_general_generated
    }
}

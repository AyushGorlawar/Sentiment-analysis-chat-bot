// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, push, set, remove, onChildAdded, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCNyxzc2XveqKw3k2DdFwhZbU5qNCJLHQk",
    authDomain: "sentimentbot-b3b65.firebaseapp.com",
    projectId: "sentimentbot-b3b65",
    storageBucket: "sentimentbot-b3b65.firebasestorage.app",
    messagingSenderId: "160282828465",
    appId: "1:160282828465:web:2638cafc4d6a1b453f4c90"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// DOM Elements
let sendButton, voiceButton, clearButton, userInput, chatBox, themeToggle, typingIndicator;

// Flag to prevent reinitializing chat history
let chatInitialized = false;

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded");
    
    // Get DOM elements
    sendButton = document.getElementById("send-button");
    voiceButton = document.getElementById("voice-button");
    clearButton = document.getElementById("clear-button");
    userInput = document.getElementById("user-input");
    chatBox = document.getElementById("chat-box");
    themeToggle = document.getElementById("theme-toggle");
    typingIndicator = document.getElementById("typing-indicator");
    
    // Add event listeners
    sendButton.addEventListener("click", sendMessage);
    voiceButton.addEventListener("click", startVoiceInput);
    clearButton.addEventListener("click", clearChat);
    themeToggle.addEventListener("change", toggleDarkMode);
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
    
    // Initialize chat with welcome message if empty
    if (chatBox.children.length === 0) {
        const welcomeMessage = document.createElement("div");
        welcomeMessage.classList.add("bot-message");
        welcomeMessage.textContent = "Hello! How are you feeling today?";
        chatBox.appendChild(welcomeMessage);
    }
    
    // Apply saved theme
    checkSavedTheme();
    
    // Try to load chat history from Firebase only once
    if (!chatInitialized) {
        tryLoadChatHistory();
        chatInitialized = true;
    }
});

// Try to load chat history but don't rely on it
function tryLoadChatHistory() {
    try {
        console.log("Attempting to load chat history");
        const messagesRef = ref(database, "messages");
        
        // First check if we have messages
        get(messagesRef).then((snapshot) => {
            if (snapshot.exists()) {
                console.log("Found messages in Firebase");
                // Only clear and load if we have messages
                chatBox.innerHTML = "";
                
                // Loop through all messages and add them
                snapshot.forEach((childSnapshot) => {
                    const message = childSnapshot.val();
                    addMessageToUI(message.sender, message.text);
                });
            } else {
                console.log("No messages in Firebase");
            }
        }).catch(error => {
            console.error("Error loading messages:", error);
        });
    } catch (error) {
        console.error("Failed to load chat history:", error);
    }
}

// Function to send a message
async function sendMessage() {  // ✅ `async` added
    const message = userInput.value.trim();
    if (!message) return;

    userInput.value = ""; // Clear input immediately

    addMessageToUI("user", message); // Show user message in UI
    showTypingIndicator(); // Show typing indicator

    try {
        // Firebase me message store karna
        const messagesRef = ref(database, "messages");
        const newMessageRef = push(messagesRef);
        set(newMessageRef, {
            sender: "user",
            text: message,
            timestamp: Date.now()
        });

        // ✅ Sentiment analysis API ko call karna
        const sentiment = await analyzeSentiment(message);
        console.log("Sentiment detected:", sentiment);

        // ✅ Sentiment ke base pe bot ka response lena
        const botResponse = getBotResponse(sentiment);
        
        // ✅ Bot ka response dikhana aur Firebase me store karna
        hideTypingIndicator();
        addMessageToUI("bot", botResponse);

        set(push(messagesRef), {
            sender: "bot",
            text: botResponse,
            timestamp: Date.now()
        });

        speakMessage(botResponse); // ✅ Text-to-speech
    } catch (error) {
        console.error("Error sending message:", error);
        hideTypingIndicator();
    }
}

// Add a message to the UI
function addMessageToUI(sender, text) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(sender === "user" ? "user-message" : "bot-message");
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to clear chat
function clearChat() {
    // Clear UI first
    chatBox.innerHTML = "";
    
    // Add welcome message
    addMessageToUI("bot", "Hello! How are you feeling today?");
    
    // Try to clear Firebase (but don't rely on it)
    try {
        remove(ref(database, "messages"));
    } catch (error) {
        console.error("Failed to clear Firebase messages:", error);
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDarkMode);
}

// Check for saved theme
function checkSavedTheme() {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    if (savedDarkMode) {
        document.body.classList.add("dark-mode");
        themeToggle.checked = true;
    }
}

// Show typing indicator
function showTypingIndicator() {
    typingIndicator.style.display = "block";
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.style.display = "none";
}

// Speech recognition
function startVoiceInput() {
    try {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
        };
        
        recognition.start();
    } catch (error) {
        console.error("Voice recognition error:", error);
    }
}

// Text-to-speech
function speakMessage(message) {
    if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(message);
        speech.lang = "en-US";
        window.speechSynthesis.speak(speech);
    }
}

// Once Firebase is ready, we'll restore the API call
async function analyzeSentiment(message) {
    try {
        const response = await fetch("http://127.0.0.1:5000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message })
        });

        if (!response.ok) {
            return "neutral";
        }

        const data = await response.json();
        return data.sentiment;
    } catch (error) {
        console.error("Sentiment API error:", error);
        return "neutral";
    }
}

// Get response based on sentiment
function getBotResponse(sentiment) {
    if (sentiment === "positive") {
        return "That's great! Keep smiling 😊";
    } else if (sentiment === "negative") {
        return "I'm here for you. Take a deep breath. Things will get better. 💙";
    } else {
        return "I see. Tell me more about it!";
    }
}
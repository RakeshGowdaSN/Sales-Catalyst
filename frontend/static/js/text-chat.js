// js/text-chat.js

const SESSION_ID = Math.random().toString(36).substring(2);
const DOMElements = {
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("message"),
  messagesDiv: document.getElementById("messages"),
  sendButton: document.getElementById("sendButton"),
};
let websocket = null;

function connectWebsocket() {
  DOMElements.sendButton.disabled = true;
  const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  
  // Connect with is_audio=false to enable text-only mode on the backend
  const wsUrl = `${wsProtocol}${window.location.host}/ws/${SESSION_ID}?is_audio=false`;
  
  console.log("Connecting to Text Chat:", wsUrl);
  websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    console.log("Text WebSocket connected.");
    DOMElements.sendButton.disabled = false;
  };

  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    // --- KEY CHANGE ---
    // Simplified handler. We only expect 'text/plain' from the agent now.
    // The logic for 'application/json' has been removed.
    if (message.mime_type === "text/plain") {
      displayAgentTextMessage(message.data);
    }
  };

  websocket.onclose = () => {
    console.log("WebSocket closed. Reconnecting...");
    DOMElements.sendButton.disabled = true;
    setTimeout(connectWebsocket, 2000);
  };
  
  websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
    websocket.close();
  };
}

function handleTextMessageSubmit(e) {
  e.preventDefault();
  const text = DOMElements.messageInput.value.trim();
  if (!text || !websocket || websocket.readyState !== WebSocket.OPEN) return;
  
  displayUserTextMessage(text);
  websocket.send(JSON.stringify({ mime_type: "text/plain", data: text }));
  DOMElements.messageInput.value = "";
}

// --- UI Display Functions (Full Implementation) ---

function scrollToBottom(element) {
  element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
}

function createMessageWrapper(type, pElement) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${type}-wrapper`;
    wrapper.appendChild(pElement);
    DOMElements.messagesDiv.appendChild(wrapper);
    scrollToBottom(DOMElements.messagesDiv);
    return wrapper;
}

function displayUserTextMessage(text) {
  const pElement = document.createElement("p");
  pElement.textContent = text;
  pElement.classList.add("user-message");
  createMessageWrapper('user', pElement);
}

function displayAgentTextMessage(text) {
  if (!text) return;
  const pElement = document.createElement("p");
  pElement.classList.add("agent-message");
  pElement.textContent = text;
  createMessageWrapper('agent', pElement);
}

// --- Initialization ---
DOMElements.messageForm.addEventListener("submit", handleTextMessageSubmit);
connectWebsocket();

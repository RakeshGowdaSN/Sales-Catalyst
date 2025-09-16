/**
* app.js: Frontend logic for the Henkel Sales Dashboard Assistant.
* Merged version with multi-view dashboard UI, multi-modal chat, and enhanced Dev Mode.
*/
import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet, stopMicrophone } from "./audio-recorder.js";
class MediaHandler {
  constructor() {
      this.videoElement = null;
      this.currentStream = null;
      this.frameCaptureInterval = null;
  }
  initialize(videoElement) {
      this.videoElement = videoElement;
  }
  async startWebcam() {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
          this.handleNewStream(stream);
          return true;
      } catch (error) {
          console.error('Error accessing webcam:', error);
          return false;
      }
  }
  async startScreenShare(onStopCallback) {
      try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          stream.getVideoTracks()[0].addEventListener('ended', onStopCallback);
          this.handleNewStream(stream);
          return true;
      } catch (error) {
          console.error('Error starting screen share:', error);
          return false;
      }
  }
  handleNewStream(stream) {
      if (this.currentStream) {
          this.stopAll();
      }
      this.currentStream = stream;
      if (this.videoElement) {
          this.videoElement.srcObject = stream;
      }
  }
  stopAll() {
      this.stopFrameCapture();
      if (this.currentStream) {
          this.currentStream.getTracks().forEach(track => track.stop());
          this.currentStream = null;
      }
      if (this.videoElement) {
          this.videoElement.srcObject = null;
      }
  }
  startFrameCapture(onFrame) {
      if (this.frameCaptureInterval) {
          this.stopFrameCapture();
      }
      this.frameCaptureInterval = setInterval(() => {
          if (!this.currentStream || !this.videoElement || this.videoElement.paused) return;
          const canvas = document.createElement('canvas');
          canvas.width = this.videoElement.videoWidth;
          canvas.height = this.videoElement.videoHeight;
          const context = canvas.getContext('2d');
          context.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          onFrame(base64Image);
      }, 1000);
  }
  stopFrameCapture() {
      clearInterval(this.frameCaptureInterval);
      this.frameCaptureInterval = null;
  }
}
// ▼▼▼ MODIFIED STATE OBJECT ▼▼▼
const state = {
  sessionId: Math.random().toString(36).substring(2),
  websocket: null,
  isAudioMode: false,
  isVideoMode: false,
  activeMediaType: null,
  currentTurnType: null,
  userTranscriptionBuffer: "",
  agentTranscriptionBuffer: "",
  mediaHandler: new MediaHandler(),
  audio: { playerNode: null, playerContext: null, recorderNode: null, recorderContext: null, micStream: null, },
  currentInviteDetails: null, // To store invite data for the updated card
  isAudioActive: true // Default to true for AI Actions mode
};
// ▲▲▲ END OF MODIFIED STATE OBJECT ▲▲▲
const DOMElements = {
  openChatBtn: document.getElementById("openChatBtn"),
  closeChatButton: document.getElementById("closeChatButton"),
  aiActionsBtn: document.getElementById("aiActionsBtn"),
  chatAppContainer: document.getElementById("chatAppContainer"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("message"),
  messagesDiv: document.getElementById("messages"),
  connectionStatusDiv: document.getElementById("connectionStatus"),
  languageSelector: document.getElementById("languageSelector"),
  devModeToggle: document.getElementById("devModeToggle"),
  startAudioButton: document.getElementById("startAudioButton"),
  stopAudioButton: document.getElementById("stopAudioButton"),
  sendButton: document.getElementById("sendButton"),
  startVideoButton: document.getElementById("startVideoButton"),
  stopVideoButton: document.getElementById("stopVideoButton"),
  startScreenButton: document.getElementById("startScreenButton"),
  stopScreenButton: document.getElementById("stopScreenButton"),
  imageUploadButton: document.getElementById("imageUploadButton"),
  imageUploadInput: document.getElementById("imageUploadInput"),
  meetingBriefTarget: document.getElementById("meeting-brief-target"),
  videoFeedContainer: document.getElementById('video-feed-container'),
  videoFeed: document.getElementById('video-feed'),
  // Page view elements
  landingPageView: document.getElementById('landing-page-view'),
  detailsPageView: document.getElementById('details-page-view'),
  customer360PageView: document.getElementById('customer-360-view'),
  emailDraftView: document.getElementById('email-draft-view'),
  meetingRecapView: document.getElementById('meeting-recap-view'),
  meetingInviteView: document.getElementById('meeting-invite-view'),
  meetingUpdatedView: document.getElementById('meeting-updated-view'), // CORRECTED ID
  navDashboard: document.getElementById('nav-dashboard'),
  salesAssistantNav: document.getElementById('sales-assistant'),
  // Email form elements
  emailRecipients: document.getElementById('email-recipients'),
  emailSubject: document.getElementById('email-subject'),
  emailBody: document.getElementById('email-body'),
  attachmentList: document.getElementById('attachment-list'),
  // Meeting Recap View Elements
  recapTitle: document.getElementById('recap-title'),
  recapAttendees: document.getElementById('recap-attendees'),
  recapDiscussionPoints: document.getElementById('recap-discussion-points'),
  recapActionItems: document.getElementById('recap-action-items'),
  recapFollowUpDate: document.getElementById('recap-follow-up-date'),
  // Meeting Invite View Elements
  inviteTitle: document.getElementById('invite-title'),
  inviteDate: document.getElementById('invite-date'),
  inviteTime: document.getElementById('invite-time'),
  inviteSecondaryText: document.getElementById('invite-secondary-text'),
  inviteDescription: document.getElementById('invite-description'),
  inviteLocation: document.getElementById('invite-location'),
  inviteAttendeesContainer: document.getElementById('invite-attendees-container'),
  // snackbar for email and meeting invite
  sendEmailBtn: document.getElementById('send-email-btn'),
  snackbar: document.getElementById('snackbar'),
  saveInviteBtn: document.getElementById('save-invite-btn'),
  // Meeting Updated Card Elements
  updatedInviteTitle: document.getElementById('updated-invite-title'),
  updatedInviteDate: document.getElementById('updated-invite-date'),
  updatedInviteTime: document.getElementById('updated-invite-time'),
  updatedInviteSecondaryText: document.getElementById('updated-invite-secondary-text'),
  updatedInviteDescription: document.getElementById('updated-invite-description'),
  updatedInviteLocation: document.getElementById('updated-invite-location'),
  updatedInviteAttendeesContainer: document.getElementById('updated-invite-attendees-container'),
};
// === NEW Loader Functions ===
function showLoader() {
  hideLoader(); // Ensure no duplicate loaders
  const loaderWrapper = document.createElement('div');
  loaderWrapper.className = 'message-wrapper agent-wrapper';
  loaderWrapper.id = 'agent-loader';
  const loaderBubble = document.createElement('p');
  loaderBubble.className = 'agent-message';
  const loaderDots = document.createElement('div');
  loaderDots.className = 'loader-dots';
  loaderDots.innerHTML = '<span></span><span></span><span></span>';
  loaderBubble.appendChild(loaderDots);
  loaderWrapper.appendChild(loaderBubble);
  DOMElements.messagesDiv.appendChild(loaderWrapper);
  scrollToBottom(DOMElements.messagesDiv);
}
function hideLoader() {
  const loader = document.getElementById('agent-loader');
  if (loader) {
      loader.remove();
  }
}
// =============================
function showSnackbar(message) {
  const snackbar = DOMElements.snackbar;
  snackbar.textContent = message;
  snackbar.classList.add("show");
  // After 3 seconds, remove the show class
  setTimeout(function () {
      snackbar.classList.remove("show");
  }, 3000);
}
function updateNavActiveState(activeLink) {
  DOMElements.navDashboard.classList.remove('active');
  DOMElements.salesAssistantNav.classList.remove('active');
  if (activeLink === 'assistant') {
      DOMElements.salesAssistantNav.classList.add('active');
  } else { // Default to dashboard
      DOMElements.navDashboard.classList.add('active');
  }
}
// ▼▼▼ MODIFIED FUNCTION ▼▼▼
function showView(viewToShow) {
  // Hide all views first
  DOMElements.landingPageView.style.display = 'none';
  DOMElements.detailsPageView.style.display = 'none';
  DOMElements.customer360PageView.style.display = 'none';
  DOMElements.emailDraftView.style.display = 'none';
  DOMElements.meetingRecapView.style.display = 'none';
  DOMElements.meetingInviteView.style.display = 'none';
  DOMElements.meetingUpdatedView.style.display = 'none';
  // Update navigation active state based on the view
  if (viewToShow === 'landing') {
      updateNavActiveState('dashboard');
  } else {
      updateNavActiveState('assistant');
  }
  // Show the requested one
  switch (viewToShow) {
      case 'details':
          DOMElements.detailsPageView.style.display = 'block';
          break;
      case 'customer360':
          DOMElements.customer360PageView.style.display = 'block';
          break;
      case 'email':
          DOMElements.emailDraftView.style.display = 'block';
          break;
      case 'recap':
          DOMElements.meetingRecapView.style.display = 'block';
          break;
      case 'invite':
          DOMElements.meetingInviteView.style.display = 'block';
          break;
      case 'updated':
          DOMElements.meetingUpdatedView.style.display = 'block';
          break;
      case 'landing':
      default:
          DOMElements.landingPageView.style.display = 'block';
          break;
  }
}
// ▲▲▲ END OF MODIFIED FUNCTION ▲▲▲
function updateButtonStates() {
  const audioOnlyMode = state.isAudioMode && !state.isVideoMode;
  const videoMode = state.isVideoMode && state.activeMediaType === 'video';
  const screenMode = state.isVideoMode && state.activeMediaType === 'screen';
  DOMElements.messageInput.disabled = false;
  DOMElements.startAudioButton.disabled = state.isVideoMode;
  DOMElements.stopAudioButton.disabled = !audioOnlyMode;
  if (audioOnlyMode) {
      DOMElements.startAudioButton.classList.add('hidden');
      DOMElements.stopAudioButton.classList.remove('hidden');
  } else {
      DOMElements.startAudioButton.classList.remove('hidden');
      DOMElements.stopAudioButton.classList.add('hidden');
  }
  DOMElements.startVideoButton.disabled = screenMode;
  DOMElements.stopVideoButton.disabled = !videoMode;
  if (videoMode) {
      DOMElements.startVideoButton.classList.add('hidden');
      DOMElements.stopVideoButton.classList.remove('hidden');
  } else {
      DOMElements.startVideoButton.classList.remove('hidden');
      DOMElements.stopVideoButton.classList.add('hidden');
  }
  DOMElements.startScreenButton.disabled = videoMode;
  DOMElements.stopScreenButton.disabled = !screenMode;
  if (screenMode) {
      DOMElements.startScreenButton.classList.add('hidden');
      DOMElements.stopScreenButton.classList.remove('hidden');
  } else {
      DOMElements.startScreenButton.classList.remove('hidden');
      DOMElements.stopScreenButton.classList.add('hidden');
  }
}
// ▼▼▼ MODIFIED FUNCTION ▼▼▼
function connectWebsocket() {
  updateConnectionStatus("Connecting...", "connecting");
  const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  const wsUrl = `${wsProtocol}${window.location.host}/ws/${state.sessionId}`;
  const selectedLang = DOMElements.languageSelector.value;
  const isDevMode = DOMElements.devModeToggle.checked;
  // Use the new state variable to control the audio parameter
  let fullWsUrl = `${wsUrl}?is_audio=${state.isAudioActive}&lang=${selectedLang}&dev_mode=true`;
  console.log("Connecting to:", fullWsUrl);
  state.websocket = new WebSocket(fullWsUrl);
  state.websocket.onopen = onWsOpen;
  state.websocket.onmessage = onWsMessage;
  state.websocket.onclose = onWsClose;
  state.websocket.onerror = onWsError;
}
// ▲▲▲ END OF MODIFIED FUNCTION ▲▲▲
function onWsOpen() {
  console.log("WebSocket connection opened.");
  updateConnectionStatus("Connected", "connected");
  DOMElements.sendButton.disabled = false;
  DOMElements.startAudioButton.disabled = false;
  DOMElements.startVideoButton.disabled = false;
  DOMElements.startScreenButton.disabled = false;
  updateButtonStates();
}
function onWsClose(event) {
  console.log("WebSocket connection closed.", event);
  const status = event.code !== 1000 && event.code !== 1005 ? "error" : "disconnected";
  updateConnectionStatus("Disconnected", status);
  DOMElements.sendButton.disabled = true;
  DOMElements.startAudioButton.disabled = true;
  DOMElements.stopAudioButton.disabled = true;
  DOMElements.startVideoButton.disabled = true;
  DOMElements.stopVideoButton.disabled = true;
  DOMElements.startScreenButton.disabled = true;
  DOMElements.stopScreenButton.disabled = true;
  state.userTranscriptionBuffer = "";
  state.agentTranscriptionBuffer = "";
  setTimeout(connectWebsocket, 1500);
}
function onWsError(error) {
  console.error("WebSocket error: ", error);
  updateConnectionStatus("Error", "error");
}
function onWsMessage(event) {
  try {
      const message = JSON.parse(event.data);
      // console.log("Received data:", message); // <-- You can uncomment this line to debug
      if (message.turn_complete) {
          finalizeAndDisplayMessages();
          state.currentTurnType = null;
          return;
      }
      const isAgentMessage = ["tool_call", "tool_result", "audio/pcm", "text/transcription", "text/plain", "application/json"].includes(message.mime_type);
      if (isAgentMessage && state.userTranscriptionBuffer) {
          displayFinalUserMessage();
      }
      const handleToolCall = (msg) => {
          displayDevMessage(msg);
          const toolName = msg.data?.name;
          if (toolName === 'get_meeting_briefing') {
              console.log("Tool call received: get_meeting_briefing. Navigating to Customer 360 view.");
              showView('customer360');
          }
          else if (toolName === 'get_product_comparison' || toolName === 'get_competitor_comparison') {
              console.log(`Tool call received: ${toolName}. Navigating to Details view.`);
              showView('details');
          }
          else if (toolName === 'draft_email' || toolName === 'draft_follow_up_email' || toolName === 'create_email_from_recap') {
              console.log(`Tool call received: ${toolName}. Navigating to Email Draft view.`);
              showView('email');
          }
          else if (toolName === 'get_meeting_recap') {
              console.log("Tool call received: get_meeting_recap. Navigating to Meeting Recap view.");
              showView('recap');
          }
          else if (toolName === 'create_meeting_invite' || toolName === 'create_invite_from_recap') {
              console.log("Tool call received: create_meeting_invite. Navigating to Meeting Invite view.");
              showView('invite');
          }
      };
      const messageHandlers = {
          "tool_call": handleToolCall,
          "tool_result": handleToolResult,
          "text/input_transcription": handleUserTranscription,
          "audio/pcm": playAudioChunk,
          "text/transcription": (msg) => {
              state.agentTranscriptionBuffer = msg.data;
          },
          "text/plain": displayFinalAgentMessage,
          "application/json": handleJsonData,
      };
      const handler = messageHandlers[message.mime_type];
      if (handler) {
          handler(message);
      }
  } catch (error) {
      console.error("Error processing incoming message:", error);
  }
}
function handleToolResult(msg) {
  displayDevMessage(msg);
  const toolResponse = msg.data?.response;
  const toolName = msg.data?.name;
  if (toolResponse && toolResponse.email_draft) {
      console.log("Tool result contains a nested email draft. Rendering data.");
      renderEmailDraft(toolResponse);
  }
  else if (toolResponse && toolResponse.invite_details) {
      console.log("Tool result contains meeting invite details. Rendering data.");
      renderMeetingInvite(toolResponse);
  }
  else if (toolResponse && toolResponse.comparison_table) {
      console.log("Tool result contains a comparison table. Rendering data.");
      renderComparisonTable(toolResponse);
  }
  else if (toolName === 'get_meeting_recap' && toolResponse) {
      console.log("Tool result is a meeting recap. Rendering data.");
      renderMeetingRecap(toolResponse);
  }
}
function handleUserTranscription(message) {
  state.userTranscriptionBuffer = message.data;
}
function createMessageWrapper(type, pElement) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${type}-wrapper`;
  wrapper.appendChild(pElement);
  DOMElements.messagesDiv.appendChild(wrapper);
  return wrapper;
}
function finalizeAndDisplayMessages() {
  hideLoader(); // Hide loader when turn is complete
  displayFinalUserMessage();
  if (state.agentTranscriptionBuffer) {
      displayFinalAgentMessage({ data: state.agentTranscriptionBuffer });
  }
}
function displayFinalAgentMessage(message) {
  hideLoader(); // Hide loader as soon as a message arrives
  if (state.currentTurnType === 'audio') {
      state.agentTranscriptionBuffer = "";
      return;
  }
  const text = message.data;
  if (!text) return;
  const pElement = document.createElement("p");
  pElement.classList.add("agent-message");
  pElement.textContent = text;
  createMessageWrapper('agent', pElement);
  scrollToBottom(DOMElements.messagesDiv);
  state.agentTranscriptionBuffer = "";
}
function displayFinalUserMessage() {
  if (state.currentTurnType === 'audio' || !state.userTranscriptionBuffer) {
      state.userTranscriptionBuffer = "";
      return;
  }
  const pElement = document.createElement("p");
  pElement.textContent = state.userTranscriptionBuffer;
  pElement.classList.add("user-message");
  createMessageWrapper('user', pElement);
  scrollToBottom(DOMElements.messagesDiv);
  state.userTranscriptionBuffer = "";
}
function displayUserTextMessage(text) {
  const pElement = document.createElement("p");
  pElement.textContent = text;
  pElement.classList.add("user-message");
  createMessageWrapper('user', pElement);
  scrollToBottom(DOMElements.messagesDiv);
}
function displayUserImageMessage(base64Image, mimeType) {
  const imgElement = document.createElement("img");
  imgElement.src = `data:${mimeType};base64,${base64Image}`;
  imgElement.classList.add("user-image");
  createMessageWrapper('user', imgElement);
  scrollToBottom(DOMElements.messagesDiv);
}
function displayDevMessage(message) {
  const data = message.data || {};
  if (message.mime_type === 'tool_result' && Object.keys(data.response || {}).length === 0) {
      return;
  }
  const pre = document.createElement("pre");
  pre.className = "dev-log-entry";
  const type = message.mime_type === 'tool_call' ? "Tool Call" : "Tool Result";
  const content = data.args || data.response || {};
  pre.textContent = `--- ${type}: ${data.name} ---\n${JSON.stringify(content, null, 2)}`;
  DOMElements.messagesDiv.appendChild(pre);
  scrollToBottom(DOMElements.messagesDiv);
}
function updateConnectionStatus(statusText, statusClass) {
  DOMElements.connectionStatusDiv.textContent = statusText;
  DOMElements.connectionStatusDiv.className = '';
  DOMElements.connectionStatusDiv.classList.add(statusClass);
}
function handleTextMessageSubmit(e) {
  e.preventDefault();
  const messageText = DOMElements.messageInput.value.trim();
  if (!messageText) return;
  if (state.userTranscriptionBuffer) {
      state.userTranscriptionBuffer = "";
  }
  state.currentTurnType = 'text';
  displayUserTextMessage(messageText);
  sendMessage({ mime_type: "text/plain", data: messageText });
  DOMElements.messageInput.value = "";
  showLoader(); // Show loader after sending message
}
function scrollToBottom(element) {
  element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
}
function stopMicrophoneAndState() {
  DOMElements.aiActionsBtn.classList.remove('ai-recording');
  if (state.audio.micStream) {
      stopMicrophone(state.audio.micStream);
      state.audio.micStream = null;
  }
  if (state.audio.recorderNode) {
      state.audio.recorderNode.disconnect();
      state.audio.recorderNode = null;
  }
  state.isAudioMode = false;
}
async function setupAudio() {
  state.isAudioMode = true;
  updateNavActiveState('assistant');
  DOMElements.aiActionsBtn.classList.add('ai-recording');
  try {
      if (!state.audio.playerNode) {
          [state.audio.playerNode, state.audio.playerContext] = await startAudioPlayerWorklet();
          if (state.audio.playerContext && state.audio.playerContext.state === 'suspended') {
              await state.audio.playerContext.resume();
              console.log("AudioContext resumed successfully.");
          }
      }
      if (!state.audio.recorderNode) {
          [state.audio.recorderNode, state.audio.recorderContext, state.audio.micStream] = await startAudioRecorderWorklet(audioRecorderHandler);
      }
      updateButtonStates();
  } catch (error) {
      console.error("Audio setup failed:", error);
      handleStopAudio();
  }
}
function handleStopAudio() {
  if (state.audio.playerNode) {
      console.log("Sending 'clear' command to stop agent audio playback.");
      state.audio.playerNode.port.postMessage({ command: 'clear' });
  }
  stopMicrophoneAndState();
  updateNavActiveState('dashboard');
  updateButtonStates();
}
async function startMedia(mediaType) {
  // The problematic "if (state.isAudioMode)" block has been removed.
  state.isVideoMode = true;
  state.activeMediaType = mediaType;
  DOMElements.aiActionsBtn.classList.add('ai-recording');
  try {
      let success = false;
      if (mediaType === 'video') {
          success = await state.mediaHandler.startWebcam();
      } else if (mediaType === 'screen') {
          success = await state.mediaHandler.startScreenShare(() => stopMedia(true));
      }
      if (!success) {
          throw new Error(`Could not start ${mediaType}.`);
      }
      DOMElements.videoFeedContainer.classList.remove('hidden');
      if (!state.audio.playerNode) {
          [state.audio.playerNode, state.audio.playerContext] = await startAudioPlayerWorklet();
          if (state.audio.playerContext && state.audio.playerContext.state === 'suspended') {
              await state.audio.playerContext.resume();
          }
      }
      // This existing check correctly handles starting the mic only if it's not already on.
      if (!state.audio.recorderNode) {
          [state.audio.recorderNode, state.audio.recorderContext, state.audio.micStream] = await startAudioRecorderWorklet(audioRecorderHandler);
          state.isAudioMode = true;
      }
      state.mediaHandler.startFrameCapture(videoFrameHandler);
      DOMElements.chatAppContainer.classList.add('video-active');
      updateButtonStates();
  } catch (error) {
      console.error(`${mediaType} setup failed:`, error);
      stopMedia();
  }
}
// Added a `keepAudio` parameter. When true, it prevents the microphone from being stopped.
function stopMedia(keepAudio = false) {
  state.isVideoMode = false;
  state.activeMediaType = null;
  state.mediaHandler.stopAll();
  DOMElements.videoFeedContainer.classList.add('hidden');
  DOMElements.chatAppContainer.classList.remove('video-active');
  if (!keepAudio) {
      stopMicrophoneAndState();
  }
  updateButtonStates();
}
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
      console.error('File is not an image:', file.type);
      alert('Please upload a valid image file (e.g., JPEG, PNG, GIF).');
      e.target.value = '';
      return;
  }
  const reader = new FileReader();
  reader.onload = function (event) {
      const base64Image = event.target.result.split(',')[1];
      if (base64Image) {
          displayUserImageMessage(base64Image, file.type);
          sendMessage({ mime_type: file.type, data: base64Image });
      }
  };
  reader.onerror = function (error) {
      console.error("Error reading file:", error);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
function videoFrameHandler(base64Image) {
  if (state.isVideoMode) {
      sendMessage({ mime_type: "image/jpeg", data: base64Image });
  }
}
function audioRecorderHandler(pcmData) {
  if (state.isAudioMode || state.isVideoMode) {
      if (state.currentTurnType !== 'audio') {
          state.currentTurnType = 'audio';
      }
      sendMessage({ mime_type: "audio/pcm", data: arrayBufferToBase64(pcmData) });
  }
}
// UPDATED to prevent audio playback in chat mode
function playAudioChunk(message) {
  // Only play audio if the main chat UI is NOT visible (i.e., in 'AI Actions' mode).
  if (!DOMElements.chatAppContainer.classList.contains('visible')) {
      if (state.audio.playerNode && state.audio.playerContext?.state === 'running') {
          state.audio.playerNode.port.postMessage(base64ToArray(message.data));
      } else {
          console.warn("Could not play audio because player is not ready or context is not running.");
      }
  }
}
function sendMessage(message) {
  if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify(message));
  }
}
function base64ToArray(base64) {
  try {
      if (typeof base64 !== 'string' || base64.length === 0) return new ArrayBuffer(0);
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
  } catch (e) {
      console.error("Error decoding base64:", e);
      return new ArrayBuffer(0);
  }
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
function renderComparisonTable(data) {
  hideLoader(); // Hide loader when content is ready
  const tableContainer = document.createElement('div');
  tableContainer.className = 'data-table-container';
  const title = document.createElement('h3');
  title.textContent = data.product_name ? `${data.product_name} Comparison` : "Product Comparison";
  tableContainer.appendChild(title);
  const table = document.createElement('table');
  table.className = 'chat-table';
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  const headers = ['Feature', data.product_name || 'Henkel', data.competitor_name || 'Competitor'];
  headers.forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
  });
  const tbody = table.createTBody();
  data.comparison_table.forEach(item => {
      const row = tbody.insertRow();
      row.insertCell().textContent = item.feature;
      row.insertCell().textContent = item.henkel;
      row.insertCell().textContent = item.competitor;
  });
  tableContainer.appendChild(table);
  createMessageWrapper('agent', tableContainer);
  scrollToBottom(DOMElements.messagesDiv);
  showView('details');
}
function renderMeetingBrief(data) {
  hideLoader(); // Hide loader when content is ready
  console.log("renderMeetingBrief was called. Navigating to customer360 view.");
  const dashboardTarget = DOMElements.meetingBriefTarget;
  if (dashboardTarget) {
      dashboardTarget.innerHTML = '';
      const title = document.createElement('h3');
      title.style.textAlign = 'center';
      title.style.marginBottom = '1.5rem';
      title.textContent = `Meeting Brief: ${data.client_name}`;
      dashboardTarget.appendChild(title);
      const list = document.createElement('ul');
      list.style.listStyle = 'none';
      list.style.paddingLeft = '0';
      const items = {
          "Goal": data.meeting_goal,
          "Key Contacts": data.key_contacts.map(c => `${c.name} (${c.title})`).join(', '),
          "History": data.history_notes,
          "Pain Point": `<strong>${data.pain_point}</strong>`
      };
      for (const [key, value] of Object.entries(items)) {
          const listItem = document.createElement('li');
          listItem.style.marginBottom = '1rem';
          listItem.style.padding = '0.5rem';
          listItem.style.borderLeft = '3px solid var(--henkel-red)';
          listItem.innerHTML = `<strong style="display: block; margin-bottom: 4px; color: #333;">${key}:</strong> ${value}`;
          list.appendChild(listItem);
      }
      dashboardTarget.appendChild(list);
  }
  showView('customer360');
  const briefContainer = document.createElement('div');
  briefContainer.className = 'data-table-container';
  const title = document.createElement('h3');
  title.textContent = `Meeting Brief: ${data.client_name}`;
  briefContainer.appendChild(title);
  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.paddingLeft = '0';
  const items = {
      "Goal": data.meeting_goal,
      "Key Contacts": data.key_contacts.map(c => `${c.name} (${c.title})`).join(', '),
      "History": data.history_notes,
      "Pain Point": `<strong>${data.pain_point}</strong>`
  };
  for (const [key, value] of Object.entries(items)) {
      const listItem = document.createElement('li');
      listItem.style.marginBottom = '8px';
      listItem.innerHTML = `<strong>${key}:</strong> ${value}`;
      list.appendChild(listItem);
  }
  briefContainer.appendChild(list);
  createMessageWrapper('agent', briefContainer);
  scrollToBottom(DOMElements.messagesDiv);
}
function renderEmailDraft(data) {
  hideLoader(); // Hide loader when content is ready
  const draft = data.email_draft;
  DOMElements.emailRecipients.value = draft.recipients.join(', ');
  DOMElements.emailSubject.value = draft.subject;
  DOMElements.emailBody.value = draft.body;
  DOMElements.attachmentList.innerHTML = '';
  if (draft.attachments && draft.attachments.length > 0) {
      draft.attachments.forEach(fileName => {
          const tag = document.createElement('span');
          tag.className = 'attachment-tag';
          tag.textContent = fileName;
          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.onclick = () => tag.remove();
          tag.appendChild(removeBtn);
          DOMElements.attachmentList.appendChild(tag);
      });
  }
  const pElement = document.createElement("p");
  pElement.classList.add("agent-message");
  // Use the message from the server response, with a fallback
  pElement.textContent = data.message || "I've drafted the email for you. You can review it now.";
  createMessageWrapper('agent', pElement);
  scrollToBottom(DOMElements.messagesDiv);
  showView('email');
}
function renderMeetingRecap(data) {
  hideLoader();
  const recap = data.recap_data;
  if (!recap) {
      console.error("renderMeetingRecap failed: 'recap_data' object not found.");
      return;
  }
  // Populate the title
  DOMElements.recapTitle.textContent = recap.title || "Meeting Recap";
  // Hide the attendees section since the new JSON does not provide this data
  DOMElements.recapAttendees.parentElement.style.display = 'none';
  // Populate discussion points
  DOMElements.recapDiscussionPoints.innerHTML = ''; // Clear previous points
  if (Array.isArray(recap.key_discussion_points)) {
      recap.key_discussion_points.forEach(point => {
          const li = document.createElement('li');
          li.innerHTML = point; // Use innerHTML to render any simple formatting
          DOMElements.recapDiscussionPoints.appendChild(li);
      });
  }
  // Populate action items as a checklist
  DOMElements.recapActionItems.innerHTML = ''; // Clear previous items
  if (Array.isArray(recap.action_items)) {
      recap.action_items.forEach(item_string => {
          const li = document.createElement('li');
          // Style each item to look like a task
          li.style.display = 'flex';
          li.style.alignItems = 'center';
          li.style.marginBottom = '8px';
          // Add a checkbox icon before the text
          li.innerHTML = `<span class="material-symbols-outlined" style="margin-right: 8px; color: #9ca3af;">check_box_outline_blank</span> ${item_string}`;
          DOMElements.recapActionItems.appendChild(li);
      });
  }
  // Populate the follow-up date and make the section visible
  if (DOMElements.recapFollowUpDate && recap.follow_up_date) {
      DOMElements.recapFollowUpDate.textContent = recap.follow_up_date;
      DOMElements.recapFollowUpDate.parentElement.style.display = 'block';
  } else if (DOMElements.recapFollowUpDate) {
      DOMElements.recapFollowUpDate.parentElement.style.display = 'none';
  }
  // Add a confirmation message to the chat UI
  const pElement = document.createElement("p");
  pElement.classList.add("agent-message");
  pElement.textContent = data.message || "I've generated the meeting recap for your review.";
  createMessageWrapper('agent', pElement);
  scrollToBottom(DOMElements.messagesDiv);
  // Switch to the recap view
  showView('recap');
}
function renderMeetingInvite(data) {
  hideLoader();
  const invite = data.invite_details;
  if (!invite) {
      console.error("renderMeetingInvite failed: 'invite_details' not found.");
      return;
  }
  // Store the data in our global state for later use
  state.currentInviteDetails = invite;
  // 1. Populate Title, Description, and Location
  DOMElements.inviteTitle.value = invite.subject || "New Meeting";
  DOMElements.inviteDescription.textContent = invite.body || "";
  DOMElements.inviteLocation.textContent = invite.location || "Google Meet"; // Fallback to a default
  // 2. MODIFIED: Directly display the start_time string from the JSON
  if (invite.start_time) {
      // Set the invite-date content to the raw start_time string
      DOMElements.inviteDate.textContent = invite.start_time;
      // Clear the separate time element as it's no longer needed
      DOMElements.inviteTime.textContent = '';
  } else {
      DOMElements.inviteDate.textContent = "Date not set";
      DOMElements.inviteTime.textContent = "";
  }
  DOMElements.inviteSecondaryText.textContent = "Time zone • Does not repeat";
  // 3. Dynamically Populate Attendees
  const attendeesContainer = DOMElements.inviteAttendeesContainer;
  attendeesContainer.innerHTML = ''; // Clear any previous attendees
  if (Array.isArray(invite.attendees)) {
      invite.attendees.forEach(email => {
          const attendeeTag = document.createElement('div');
          attendeeTag.style.display = 'flex';
          attendeeTag.style.alignItems = 'center';
          attendeeTag.style.backgroundColor = '#eef2ff';
          attendeeTag.style.borderRadius = '16px';
          attendeeTag.style.padding = '4px 10px';
          attendeeTag.style.fontSize = '13px';
          attendeeTag.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px; color: #4f46e5;">person</span>
      <span>${email}</span>
    `;
          attendeesContainer.appendChild(attendeeTag);
      });
  }
  // 4. Update Chat and Show View
  const pElement = document.createElement("p");
  pElement.classList.add("agent-message");
  pElement.textContent = data.message || "I've created the calendar invite as requested.";
  createMessageWrapper('agent', pElement);
  scrollToBottom(DOMElements.messagesDiv);
  showView('invite');
}
/**
* NEW FUNCTION
* Populates the 'updated' meeting card using data stored in the global state.
*/
function renderUpdatedMeetingCard() {
  const invite = state.currentInviteDetails;
  if (!invite) {
      console.error("Cannot render updated card, no invite details found in state.");
      return;
  }
  // 1. Populate Title, Description, and Location from stored data
  DOMElements.updatedInviteTitle.value = invite.subject || "New Meeting";
  DOMElements.updatedInviteDescription.textContent = invite.body || "";
  DOMElements.updatedInviteLocation.textContent = invite.location || "Google Meet";
  // 2. Populate Date and Time from stored data
  if (invite.start_time) {
      DOMElements.updatedInviteDate.textContent = invite.start_time;
      DOMElements.updatedInviteTime.textContent = '';
  } else {
      DOMElements.updatedInviteDate.textContent = "Date not set";
      DOMElements.updatedInviteTime.textContent = "";
  }
  DOMElements.updatedInviteSecondaryText.textContent = "Time zone • Does not repeat";
  // 3. Populate Attendees from stored data
  const attendeesContainer = DOMElements.updatedInviteAttendeesContainer;
  attendeesContainer.innerHTML = ''; // Clear previous attendees
  if (Array.isArray(invite.attendees)) {
      invite.attendees.forEach(email => {
          const attendeeTag = document.createElement('div');
          attendeeTag.style.display = 'flex';
          attendeeTag.style.alignItems = 'center';
          attendeeTag.style.backgroundColor = '#eef2ff';
          attendeeTag.style.borderRadius = '16px';
          attendeeTag.style.padding = '4px 10px';
          attendeeTag.style.fontSize = '13px';
          attendeeTag.innerHTML = `
         <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px; color: #4f46e5;">person</span>
         <span>${email}</span>
       `;
          attendeesContainer.appendChild(attendeeTag);
      });
  }
}
function handleJsonData(message) {
  const payload = message.data;
  if (payload.comparison_table) {
      renderComparisonTable(payload);
  }
  else if (payload.meeting_goal) {
      renderMeetingBrief(payload);
  }
  else if (payload.email_draft) {
      renderEmailDraft(payload);
  }
  else if (payload.recap_data) {
      renderMeetingRecap(payload);
  }
  else if (payload.invite_details) {
      renderMeetingInvite(payload);
  }
}
// ▼▼▼ MODIFIED INITIALIZE FUNCTION ▼▼▼
function initialize() {
  state.mediaHandler.initialize(DOMElements.videoFeed);
  DOMElements.messageForm.addEventListener("submit", handleTextMessageSubmit);
  DOMElements.startAudioButton.addEventListener("click", setupAudio);
  DOMElements.stopAudioButton.addEventListener("click", handleStopAudio);
  DOMElements.startVideoButton.addEventListener("click", () => startMedia('video'));
  // The stopVideoButton now also calls stopMedia with the keepAudio flag set to true.
  DOMElements.stopVideoButton.addEventListener("click", () => stopMedia(true));
  DOMElements.startScreenButton.addEventListener("click", () => startMedia('screen'));
  // The stopScreenButton calls stopMedia with the keepAudio flag set to true.
  DOMElements.stopScreenButton.addEventListener("click", () => stopMedia(true));
  DOMElements.imageUploadButton.addEventListener("click", () => DOMElements.imageUploadInput.click());
  DOMElements.imageUploadInput.addEventListener("change", handleImageUpload);
  DOMElements.languageSelector.addEventListener("change", () => {
      if (state.websocket) state.websocket.close();
  });
  DOMElements.devModeToggle.addEventListener("change", (e) => {
      document.body.classList.toggle('dev-mode-active', e.target.checked);
      if (state.websocket) {
          console.log("Dev mode toggled. Reconnecting WebSocket to apply change.");
          state.websocket.close();
      }
  });
  DOMElements.navDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      showView('landing');
      // The updateNavActiveState call is now handled by showView()
  });
  // MODIFIED: Open chat button listener
  DOMElements.openChatBtn.addEventListener('click', () => {
      if (state.isAudioMode) {
          handleStopAudio();
      }
      DOMElements.chatAppContainer.classList.add('visible');
      DOMElements.aiActionsBtn.classList.add('fab-disabled');
      // Set isAudioActive to false and reconnect the WebSocket
      if (state.isAudioActive) {
          state.isAudioActive = false;
          console.log("Chat opened. Setting isAudioActive to false and reconnecting.");
          if (state.websocket) {
              state.websocket.close();
          }
      }
  });
  DOMElements.aiActionsBtn.addEventListener("click", async () => {
      if (DOMElements.chatAppContainer.classList.contains('visible')) {
          console.log("Cannot start AI Actions while chat is open.");
          return;
      }
      if (state.isVideoMode) {
          if (state.isAudioMode) {
              stopMicrophoneAndState();
              updateButtonStates();
          } else {
              await setupAudio();
          }
      } else {
          if (state.isAudioMode) {
              handleStopAudio();
              DOMElements.openChatBtn.classList.remove('fab-disabled');
          } else {
              DOMElements.chatAppContainer.classList.remove('visible');
              await setupAudio();
          }
      }
  });
  // MODIFIED: Close chat button listener
  DOMElements.closeChatButton.addEventListener('click', () => {
      DOMElements.chatAppContainer.classList.remove('visible');
      DOMElements.aiActionsBtn.classList.remove('fab-disabled');
      // Set isAudioActive to true and reconnect the WebSocket
      if (!state.isAudioActive) {
          state.isAudioActive = true;
          console.log("Chat closed. Setting isAudioActive to true and reconnecting.");
          if (state.websocket) {
              state.websocket.close();
          }
      }
  });
  // Add this event listener for the send button
  DOMElements.sendEmailBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevents the page from reloading
      showSnackbar('Email sent successfully!');
      // Navigate back to the dashboard/landing page
      showView('landing');
  });
  DOMElements.saveInviteBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevents default button behavior
      renderUpdatedMeetingCard(); // Populate the updated card before showing it
      showSnackbar('Meeting invite saved Successfully');
      showView('updated');
  });
  DOMElements.sendButton.disabled = true;
  DOMElements.startAudioButton.disabled = true;
  DOMElements.stopAudioButton.disabled = true;
  DOMElements.startVideoButton.disabled = true;
  DOMElements.stopVideoButton.disabled = true;
  DOMElements.startScreenButton.disabled = true;
  DOMElements.stopScreenButton.disabled = true;
  document.body.classList.toggle('dev-mode-active', DOMElements.devModeToggle.checked);
  connectWebsocket();
  showView('landing'); // Initial view
  // The updateNavActiveState call is now handled by showView()
}
// ▲▲▲ END OF MODIFIED INITIALIZE FUNCTION ▲▲▲
initialize();

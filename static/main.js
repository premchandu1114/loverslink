const chatForm = document.getElementById('chatForm');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user');
const callBtn = document.getElementById('callBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const API_BASE = 'https://loverlink-chat.onrender.com'; // update if needed

// Send a message
chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const user = userInput.value.trim();
  const text = textInput.value.trim();
  const file = fileInput.files[0];

  if (!user || (!text && !file)) return;

  const formData = new FormData();
  formData.append('user', user);
  formData.append('text', text);
  if (file) formData.append('file', file);

  const res = await fetch(`${API_BASE}/send`, {
    method: 'POST',
    body: formData
  });

  const msg = await res.json();
  renderMessage(msg);

  textInput.value = '';
  fileInput.value = '';
};

// Fetch messages every 2 seconds
setInterval(async () => {
  const res = await fetch(`${API_BASE}/messages`);
  const data = await res.json();
  messagesDiv.innerHTML = '';
  data.forEach(renderMessage);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}, 2000);

// Render a single message
function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message';

  const time = `<span class="time">${msg.time}</span>`;
  const name = `<span class="user">${msg.user}</span>: `;
  const text = msg.text ? `<span>${msg.text}</span>` : '';
  let media = '';

  if (msg.media) {
    const ext = msg.media.split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      media = `<br><img src="${API_BASE}${msg.media}" style="max-width:100%;">`;
    } else if (['mp4'].includes(ext)) {
      media = `<br><video controls src="${API_BASE}${msg.media}" style="max-width:100%;"></video>`;
    } else if (['mp3', 'wav'].includes(ext)) {
      media = `<br><audio controls src="${API_BASE}${msg.media}"></audio>`;
    }
  }

  div.innerHTML = `${name} ${time}<br>${text}${media}`;
  messagesDiv.appendChild(div);
}

// --- WebRTC Section (video/audio call) ---

let pc;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

callBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = stream;

  pc = new RTCPeerConnection(config);
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];

  pc.onicecandidate = async e => {
    if (e.candidate) {
      await fetch(`${API_BASE}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: e.candidate })
      });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await fetch(`${API_BASE}/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer })
  });
};

// Poll for signaling messages
setInterval(async () => {
  const res = await fetch(`${API_BASE}/signal`);
  const data = await res.json();

  for (const signal of data) {
    if (signal.offer && !pc) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = stream;

      pc = new RTCPeerConnection(config);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ontrack = e => remoteVideo.srcObject = e.streams[0];

      await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`${API_BASE}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });
    }

    if (signal.answer && pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
    }

    if (signal.candidate && pc) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }
}, 2000);

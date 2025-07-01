// ====== LoverLink Full Frontend Logic (Online) ======

// DOM elements
const chatForm    = document.getElementById('chatForm');
const textInput   = document.getElementById('textInput');
const fileInput   = document.getElementById('fileInput');
const messagesDiv = document.getElementById('messages');
const userInput   = document.getElementById('user');
const callBtn     = document.getElementById('callBtn');
const localVideo  = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// 🔥 POINT THIS TO YOUR RENDER APP (HTTPS required for WebRTC)
const API_BASE = 'https://<loverslink>.onrender.com';

// ———————————— SEND CHAT MESSAGE ————————————
chatForm.onsubmit = async e => {
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

// ———————————— FETCH & RENDER CHAT ————————————
setInterval(async () => {
  const res  = await fetch(`${API_BASE}/messages`);
  const data = await res.json();
  messagesDiv.innerHTML = '';
  data.forEach(renderMessage);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}, 2000);

function renderMessage(msg) {
  const div  = document.createElement('div');
  div.className = 'message';

  const name = `<span class="user">${msg.user}</span>: `;
  const time = `<span class="time">${msg.time}</span>`;
  const text = msg.text ? `<div>${msg.text}</div>` : '';
  let media  = '';

  if (msg.media) {
    const url = `${API_BASE}${msg.media}`;
    const ext = msg.media.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif'].includes(ext)) {
      media = `<img src="${url}" class="msg-media">`;
    } else if (ext === 'mp4') {
      media = `<video controls src="${url}" class="msg-media"></video>`;
    } else if (['mp3','wav'].includes(ext)) {
      media = `<audio controls src="${url}" class="msg-media"></audio>`;
    }
  }

  div.innerHTML = `
    <div>${name}${time}</div>
    ${text}
    ${media}
  `;
  messagesDiv.appendChild(div);
}

// ===== WebRTC Voice/Video Calling =====
let pc;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

callBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = stream;

  pc = new RTCPeerConnection(config);
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
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
  if (!pc) return;
  const res     = await fetch(`${API_BASE}/signal`);
  const signals = await res.json();

  for (const s of signals) {
    if (s.offer && !pc.remoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(s.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch(`${API_BASE}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });
    }
    if (s.answer && pc.remoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(s.answer));
    }
    if (s.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(s.candidate));
    }
  }
}, 2000);

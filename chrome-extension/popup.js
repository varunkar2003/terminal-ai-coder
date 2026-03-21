const msgEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const urlEl = document.getElementById('url');

// Check for pending context menu message
chrome.storage.local.get(['pendingMessage'], (data) => {
  if (data.pendingMessage) {
    inputEl.value = data.pendingMessage;
    chrome.storage.local.remove('pendingMessage');
    send();
  }
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

function addMsg(role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.textContent = text;
  msgEl.appendChild(d);
  msgEl.scrollTop = msgEl.scrollHeight;
  return d;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  addMsg('user', text);
  const aEl = addMsg('assistant', '');
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'Thinking...';
  msgEl.appendChild(typing);

  const serverUrl = urlEl.value.replace(/\/$/, '');

  try {
    const res = await fetch(serverUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) {
      typing.remove();
      aEl.className = 'msg error';
      aEl.textContent = 'Error: ' + res.status + '. Is VKCoder running? (vkcoder --serve)';
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      let evType = '';
      for (const ln of lines) {
        if (ln.startsWith('event: ')) evType = ln.slice(7);
        else if (ln.startsWith('data: ')) {
          try {
            const d = JSON.parse(ln.slice(6));
            if (evType === 'token') {
              typing.remove();
              fullText += d.text;
              aEl.textContent = fullText;
              msgEl.scrollTop = msgEl.scrollHeight;
            } else if (evType === 'tool_call') {
              typing.textContent = 'Using ' + d.name + '...';
            } else if (evType === 'error') {
              typing.remove();
              aEl.textContent = 'Error: ' + d.message;
            }
          } catch {}
        }
      }
    }
    typing.remove();
  } catch (err) {
    typing.remove();
    aEl.className = 'msg error';
    aEl.textContent = 'Cannot connect. Run: vkcoder --serve';
  }
}

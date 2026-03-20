import http from 'http';
import os from 'os';
import { getConfig, updateConfig } from './config.js';
import { getProvider, getDefaultModel, isValidProvider } from './providers/router.js';
import { Conversation } from './context/conversation.js';
import { getProjectContext } from './context/project.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { runAgent } from './agent.js';

// ─── Network helpers ────────────────────────────────────────────────────────

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ─── Conversation (single-user, shared across requests) ─────────────────────

const conversation = new Conversation();
let initialized = false;

function ensureConversation() {
  if (!initialized) {
    const config = getConfig();
    const projectContext = getProjectContext();
    conversation.setSystemPrompt(`${config.systemPrompt}\n\n${projectContext}`);
    initialized = true;
  }
}

// ─── Request handler ────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHTML());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    const config = getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: config.model, provider: config.provider }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    await handleChat(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/clear') {
    conversation.clear();
    initialized = false;
    ensureConversation();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Live preview — serve project files
  if (req.method === 'GET' && req.url.startsWith('/preview/')) {
    serveProjectFile(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ─── Live preview — serve project files ─────────────────────────────────────

import { existsSync as fileExists, readFileSync as readFS, statSync as statFS } from 'fs';
import { join as joinPath, extname as getExt } from 'path';

function serveProjectFile(req, res) {
  const filePath = decodeURIComponent(req.url.replace('/preview/', ''));
  const absPath = joinPath(process.cwd(), filePath);

  // Security: prevent path traversal
  if (!absPath.startsWith(process.cwd())) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (!fileExists(absPath)) {
    res.writeHead(404); res.end('Not found'); return;
  }

  try {
    const stat = statFS(absPath);
    if (stat.isDirectory()) {
      // Try index.html
      const indexPath = joinPath(absPath, 'index.html');
      if (fileExists(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFS(indexPath));
        return;
      }
      res.writeHead(404); res.end('No index.html'); return;
    }

    const MIME = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    };
    const ext = getExt(absPath);
    const contentType = MIME[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFS(absPath));
  } catch {
    res.writeHead(500); res.end('Error reading file');
  }
}

// ─── Chat endpoint with SSE ────────────────────────────────────────────────

async function handleChat(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;

  let message, autonomous;
  try {
    const parsed = JSON.parse(body);
    message = parsed.message;
    autonomous = parsed.autonomous || false;
    if (!message) throw new Error('Missing message');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Expected {"message": "..."}' }));
    return;
  }

  ensureConversation();
  const config = getConfig();
  const provider = await getProvider();
  const maxRounds = autonomous ? 50 : 15;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await runAgent(message, {
      conversation,
      provider,
      config,
      tools: TOOL_DEFINITIONS,
      autoApprove: true,
      maxRounds,
      callbacks: {
        onSpinner(text) { send('status', { text }); },
        onSpinnerStop() { send('status', { text: '' }); },
        onFirstToken(meta) { send('meta', meta); },
        onToken(text) { send('token', { text }); },
        onResponseDone(meta) { send('done', meta); },
        onToolCall(name, args) { send('tool_call', { name, args }); },
        onToolResult(name, result) {
          const truncated = result.length > 3000
            ? result.substring(0, 3000) + '\n...(truncated)'
            : result;
          send('tool_result', { name, result: truncated });
        },
        onToolError(name, err) { send('tool_error', { name, error: err.message }); },
        onError(err) { send('error', { message: err.message }); },
        onMaxRounds() { send('error', { message: 'Stopped after max tool rounds.' }); },
      },
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
}

// ─── Startup checks (same as terminal mode) ────────────────────────────────

async function runStartupChecks() {
  const config = getConfig();
  const provider = await getProvider();

  const health = await provider.checkHealth();
  if (!health.ok) {
    console.error(`  Error: ${health.error}`);
    if (config.provider === 'ollama') {
      console.error('  Start Ollama with: ollama serve');
    }
    process.exit(1);
  }

  if (config.provider === 'ollama') {
    const { checkModelAvailable } = await import('./providers/ollama.js');
    const available = await checkModelAvailable(config.model);
    if (!available) {
      console.error(`  Model ${config.model} not found. Pull it with: ollama pull ${config.model}`);
      process.exit(1);
    }
  }
}

// ─── Server entry point ────────────────────────────────────────────────────

export async function startServer(options = {}) {
  const { port = 3456, modelOverride, providerOverride } = options;

  if (providerOverride) {
    if (!isValidProvider(providerOverride)) {
      console.error(`Unknown provider: ${providerOverride}`);
      process.exit(1);
    }
    const defaultModel = getDefaultModel(providerOverride);
    updateConfig({ provider: providerOverride, model: defaultModel });
  }

  if (modelOverride) {
    updateConfig({ model: modelOverride });
  }

  await runStartupChecks();

  // Pre-warm the model
  const warmupConfig = getConfig();
  if (warmupConfig.provider === 'ollama') {
    try {
      const warmupProvider = await getProvider();
      const warmup = warmupProvider.streamChat([{role:'user', content:'hi'}], {});
      for await (const _ of warmup) { break; } // read one token then stop
    } catch {}
  }

  ensureConversation();

  const config = getConfig();
  const ip = getLocalIP();

  const server = http.createServer(handleRequest);
  server.listen(port, '0.0.0.0', () => {
    console.log();
    console.log('  \x1b[36m\x1b[1m★ VKCoder Web Server\x1b[0m');
    console.log(`  Model: ${config.model} (${config.provider})`);
    console.log(`  Local:   \x1b[36mhttp://localhost:${port}\x1b[0m`);
    console.log(`  Network: \x1b[36mhttp://${ip}:${port}\x1b[0m`);
    console.log();
    console.log('  Open the Network URL on your phone to start coding.');
    console.log('  Press Ctrl+C to stop.\n');
  });
}

// ─── Embedded Web UI ────────────────────────────────────────────────────────

function getHTML() {
  // NOTE: This HTML is served as-is. No template literal escaping issues
  // because we use a raw string approach for the JavaScript.
  const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
#header{padding:12px 16px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;flex-shrink:0;position:relative}
#header .logo{color:#e94560;font-weight:700;font-size:1.1em}
#header .info{color:#8b949e;font-size:0.85em}
#messages{flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}
.msg{margin:6px 0;padding:10px 14px;border-radius:12px;max-width:88%;word-wrap:break-word;line-height:1.5;font-size:0.95em}
.msg.user{background:#1f6feb;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.msg.assistant{background:#161b22;border:1px solid #30363d;border-bottom-left-radius:4px}
.msg.tool{background:#1c1229;border-left:3px solid #8957e5;font-size:0.8em;font-family:'SF Mono',Menlo,monospace;max-width:95%;padding:8px 10px;color:#c9d1d9;white-space:pre-wrap;overflow-x:auto;max-height:200px;overflow-y:auto}
.tool-name{color:#8957e5;font-weight:700}
.tool-err{color:#f85149}
.msg pre{background:#0d1117;padding:10px;border-radius:6px;overflow-x:auto;margin:6px 0;border:1px solid #30363d;font-size:0.9em}
.msg code{background:#1c2128;padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:'SF Mono',Menlo,monospace}
.msg pre code{background:none;padding:0;border-radius:0}
.msg strong{color:#fff}
.typing{color:#8b949e;font-style:italic;padding:4px 14px;font-size:0.85em}
.mic-btn{background:none;border:1px solid #30363d;color:#8b949e;border-radius:10px;width:44px;height:44px;min-width:44px;min-height:44px;font-size:20px;cursor:pointer;transition:all 0.2s;z-index:10;position:relative;-webkit-tap-highlight-color:rgba(233,69,96,0.3);touch-action:manipulation;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mic-btn:active{background:#30363d}
.mic-btn.recording{background:#e94560;border-color:#e94560;color:#fff;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
#input-area{display:flex;padding:8px;background:#161b22;border-top:1px solid #30363d;gap:8px;flex-shrink:0;padding-bottom:env(safe-area-inset-bottom,8px)}
#input-area textarea{flex:1;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:10px 14px;font-size:16px;resize:none;min-height:44px;max-height:120px;font-family:inherit;line-height:1.4;outline:none}
#input-area textarea:focus{border-color:#1f6feb}
#input-area button{background:#e94560;color:#fff;border:none;border-radius:10px;padding:0 18px;font-size:16px;cursor:pointer;font-weight:600;min-width:56px;min-height:44px;transition:opacity 0.2s}
#input-area button:active{opacity:0.7}
#input-area button:disabled{opacity:0.4;cursor:default}
.clear-btn{position:absolute;right:16px;top:50%;transform:translateY(-50%);background:none;border:1px solid #30363d;color:#8b949e;padding:4px 10px;border-radius:6px;font-size:0.75em;cursor:pointer}
.clear-btn:active{background:#30363d}
@media(max-width:400px){.msg{max-width:92%}#input-area{padding:6px}}`;

  // Client JS as an array of lines joined with real newlines — avoids template escaping issues
  const JS = [
    'var msgEl=document.getElementById("messages");',
    'var inputEl=document.getElementById("input");',
    'var sendBtn=document.getElementById("send");',
    'var busy=false;',
    'var statusEl=null;',
    '',
    'fetch("/api/status").then(function(r){return r.json()}).then(function(s){',
    '  document.getElementById("model-info").textContent=s.model+" ("+s.provider+")";',
    '}).catch(function(){',
    '  document.getElementById("model-info").textContent="offline";',
    '});',
    '',
    'inputEl.addEventListener("input",function(){',
    '  inputEl.style.height="auto";',
    '  inputEl.style.height=Math.min(inputEl.scrollHeight,120)+"px";',
    '});',
    '',
    'inputEl.addEventListener("keydown",function(e){',
    '  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}',
    '});',
    '',
    'function esc(s){return s.replace(/&/g,"\\x26amp;").replace(/</g,"\\x26lt;").replace(/>/g,"\\x26gt;");}',
    'function scrollDown(){msgEl.scrollTop=msgEl.scrollHeight;}',
    'function removeStatus(){if(statusEl&&statusEl.parentNode){statusEl.parentNode.removeChild(statusEl);statusEl=null;}}',
    '',
    'function addMsg(role,content,isHtml){',
    '  var d=document.createElement("div");',
    '  d.className="msg "+role;',
    '  if(isHtml){d.innerHTML=content;}else{d.textContent=content;}',
    '  msgEl.appendChild(d);scrollDown();return d;',
    '}',
    '',
    'function setStatus(text){',
    '  removeStatus();',
    '  if(!text)return;',
    '  statusEl=document.createElement("div");',
    '  statusEl.className="typing";',
    '  statusEl.textContent=text;',
    '  msgEl.appendChild(statusEl);scrollDown();',
    '}',
    '',
    'function md(text){',
    '  var s=text.replace(/&/g,"\\x26amp;").replace(/</g,"\\x26lt;").replace(/>/g,"\\x26gt;");',
    '  s=s.replace(/```(\\w*)\\n([\\s\\S]*?)```/g,function(_,l,c){return "<pre><code>"+c+"</code></pre>";});',
    '  s=s.replace(/`([^`]+)`/g,"<code>$1</code>");',
    '  s=s.replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>");',
    '  s=s.replace(/^### (.+)$/gm,"<strong>$1</strong>");',
    '  s=s.replace(/^## (.+)$/gm,"<strong>$1</strong>");',
    '  s=s.replace(/^# (.+)$/gm,"<strong>$1</strong>");',
    '  s=s.replace(/^[\\-\\*] (.+)$/gm,"\\u2022 $1");',
    '  s=s.replace(/\\n/g,"<br>");',
    '  return s;',
    '}',
    '',
    'async function doSend(){',
    '  var text=inputEl.value.trim();',
    '  if(!text||busy)return;',
    '  inputEl.value="";inputEl.style.height="auto";',
    '  busy=true;sendBtn.disabled=true;',
    '  addMsg("user",text,false);',
    '  var aEl=addMsg("assistant","",false);',
    '  var fullText="";',
    '  setStatus("Thinking...");',
    '  try{',
    '    var res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,autonomous:autoMode})});',
    '    if(!res.ok){',
    '      var errBody=await res.text();',
    '      removeStatus();',
    '      aEl.textContent="Error "+res.status+": "+errBody;',
    '      busy=false;sendBtn.disabled=false;return;',
    '    }',
    '    var reader=res.body.getReader();',
    '    var dec=new TextDecoder();',
    '    var buf="";',
    '    while(true){',
    '      var chunk=await reader.read();',
    '      if(chunk.done)break;',
    '      buf+=dec.decode(chunk.value,{stream:true});',
    '      var lines=buf.split("\\n");',
    '      buf=lines.pop()||"";',
    '      var evType="";',
    '      for(var i=0;i<lines.length;i++){',
    '        var ln=lines[i];',
    '        if(ln.indexOf("event: ")===0){evType=ln.slice(7);}',
    '        else if(ln.indexOf("data: ")===0){',
    '          try{',
    '            var d=JSON.parse(ln.slice(6));',
    '            if(evType==="token"){removeStatus();aEl.textContent+=d.text;fullText+=d.text;scrollDown();}',
    '            else if(evType==="tool_call"){removeStatus();var as=JSON.stringify(d.args||{});if(as.length>80)as=as.substring(0,80)+"...";addMsg("tool","<span class=\\"tool-name\\">"+esc(d.name)+"</span> "+esc(as),true);setStatus("Running "+d.name+"...");}',
    '            else if(evType==="tool_result"){removeStatus();var rl=d.result.split("\\n");var pv=rl.length>10?rl.slice(0,10).join("\\n")+"\\n...("+rl.length+" lines)":d.result;addMsg("tool",esc(pv),true);setStatus("Thinking...");}',
    '            else if(evType==="tool_error"){addMsg("tool","<span class=\\"tool-err\\">Error: "+esc(d.error)+"</span>",true);}',
    '            else if(evType==="error"){removeStatus();aEl.textContent="Error: "+d.message;}',
    '            else if(evType==="status"&&d.text){setStatus(d.text);}',
    '            else if(evType==="done"){removeStatus();}',
    '          }catch(e){}',
    '        }',
    '      }',
    '    }',
    '    removeStatus();',
    '    if(fullText){aEl.innerHTML=md(fullText);if(usedVoice){speak(fullText);usedVoice=false;}}',
    '  }catch(err){',
    '    removeStatus();',
    '    aEl.textContent="Connection error: "+err.message;',
    '  }',
    '  busy=false;sendBtn.disabled=false;scrollDown();inputEl.focus();',
    '}',
    '',
    'async function clearChat(){',
    '  if(!confirm("Clear conversation?"))return;',
    '  await fetch("/api/clear",{method:"POST"});',
    '  msgEl.innerHTML="";',
    '  addMsg("assistant","Conversation cleared. How can I help?",false);',
    '}',
    '',
    '// ─── Autonomous Mode toggle ────────────────────────────────',
    'var autoMode=false;',
    'function toggleAuto(){',
    '  autoMode=!autoMode;',
    '  var btn=document.getElementById("autoBtn");',
    '  btn.style.background=autoMode?"#e94560":"none";',
    '  btn.style.color=autoMode?"#fff":"#8b949e";',
    '  btn.style.borderColor=autoMode?"#e94560":"#30363d";',
    '}',
    '',
    '// ─── Voice Mode ────────────────────────────────────────────',
    'var recognition=null;',
    'var isRecording=false;',
    'var usedVoice=false;',
    'var micBtn=document.getElementById("mic");',
    '',
    'function toggleMic(){',
    '  if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){',
    '    alert("Speech recognition not supported in this browser. Try Chrome.");return;',
    '  }',
    '  if(isRecording){stopMic();return;}',
    '  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;',
    '  recognition=new SR();',
    '  recognition.lang="en-US";',
    '  recognition.interimResults=true;',
    '  recognition.continuous=false;',
    '  recognition.onstart=function(){isRecording=true;micBtn.classList.add("recording");inputEl.placeholder="Listening...";};',
    '  recognition.onresult=function(e){',
    '    var t="";for(var i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;',
    '    inputEl.value=t;',
    '  };',
    '  recognition.onend=function(){stopMic();};',
    '  recognition.onerror=function(){stopMic();};',
    '  recognition.start();',
    '}',
    '',
    'function stopMic(){',
    '  isRecording=false;micBtn.classList.remove("recording");inputEl.placeholder="Ask anything...";',
    '  if(recognition){recognition.stop();recognition=null;}',
    '  if(inputEl.value.trim()){usedVoice=true;doSend();}',
    '}',
    '',
    '// ─── Text-to-Speech ─────────────────────────────────────────',
    'function speak(text){',
    '  if(!("speechSynthesis" in window))return;',
    '  var clean=text.replace(/```[\\s\\S]*?```/g,"code block").replace(/[#*`_~]/g,"").substring(0,500);',
    '  var utter=new SpeechSynthesisUtterance(clean);',
    '  utter.rate=1.1;utter.pitch=1;',
    '  speechSynthesis.cancel();speechSynthesis.speak(utter);',
    '}',
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>VKCoder</title>
<style>${CSS}</style>
</head>
<body>
<div id="header">
  <span class="logo">★ VKCoder</span>
  <span class="info" id="model-info">connecting...</span>
  <button class="clear-btn" onclick="clearChat()" style="right:80px">Clear</button>
  <button class="clear-btn" id="autoBtn" onclick="toggleAuto()" style="right:16px">Auto</button>
</div>
<div id="messages"></div>
<div id="input-area">
  <button class="mic-btn" id="mic" onclick="toggleMic()">&#x1f399;</button>
  <textarea id="input" rows="1" placeholder="Ask anything..." autocomplete="off" autocorrect="on"></textarea>
  <button id="send" onclick="doSend()">Send</button>
</div>
<script>${JS}</script>
</body>
</html>`;
}

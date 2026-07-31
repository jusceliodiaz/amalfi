const mainVideo=document.getElementById("main-video"),seqCanvas=document.getElementById("seq-canvas"),poiLayer=document.getElementById("poi-layer"),trackEl=document.getElementById("track"),loaderEl=document.getElementById("loader"),ctx=seqCanvas.getContext("2d",{alpha:!1}),MOBILE=window.matchMedia("(hover: none)").matches||window.innerWidth<768,MAX_SEQ=3;let _w=innerWidth,_h=innerHeight,lastFrame=null,currentScene="aerial",busy=!1,navGen=0,poiTimer=null,mode="day";const cache=new Map,videoBlobs=new Map;function sessionId(){let e=sessionStorage.getItem("sid");return e||(e=crypto.randomUUID(),sessionStorage.setItem("sid",e)),e}function track(e,t={}){const n={event:e,...t,slug:CONFIG?.slug,ts:Date.now(),session:sessionId(),device:MOBILE?"mobile":"desktop"};window.gtag&&gtag("event",e,t),navigator.sendBeacon?.("/api/track",JSON.stringify(n))}let dwellStart=Date.now(),dwellScene="aerial";function markDwell(e){track("dwell",{scene:dwellScene,ms:Date.now()-dwellStart}),dwellScene=e,dwellStart=Date.now()}function viewportSize(){const v=window.visualViewport;return v?{w:v.width,h:v.height}:{w:innerWidth,h:innerHeight}}function resizeCanvas(){const{w,h}=viewportSize(),e=MOBILE?1:Math.min(window.devicePixelRatio||1,2);seqCanvas.width=w*e,seqCanvas.height=h*e,seqCanvas.style.width=w+"px",seqCanvas.style.height=h+"px",ctx.setTransform(e,0,0,e,0,0)}function sceneFromHash(){const e=new URLSearchParams(location.hash.slice(1)).get("scene");return CONFIG.scenes[e]?e:"aerial"}function syncHash(e){history.replaceState(null,"",`#scene=${e}`)}function videoSrc(e){let t=e.video;if(t&&(t.day||t.night)&&(t=t[mode]||t.day),!t)return null;if("string"==typeof t)return t;const n=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);return MOBILE||n?t.mp4||t.webm:t.webm||t.mp4}window.addEventListener("pagehide",()=>markDwell(dwellScene)),window.addEventListener("load",()=>{resizeCanvas(),initCursor(),buildTrack(),initAbSlider(),initPreloader()});function onViewportResize(){if(document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))return;const{w,h}=viewportSize();w===_w&&h===_h||(_w=w,_h=h,resizeCanvas(),lastFrame&&drawCover(lastFrame))}window.addEventListener("resize",onViewportResize),window.visualViewport&&window.visualViewport.addEventListener("resize",onViewportResize);const loadOne=e=>!e||videoBlobs.has(e)?Promise.resolve():fetch(e).then(e=>e.blob()).then(t=>{videoBlobs.set(e,URL.createObjectURL(t))}).catch(()=>{});function preloadNeighbors(e){const t=new Set([videoSrc(CONFIG.scenes[e])]);Object.keys(CONFIG.transitions[e]||{}).forEach(e=>t.add(videoSrc(CONFIG.scenes[e]))),[...t].filter(Boolean).forEach(loadOne)}function preloadAllVideos(){const e=[...new Set(Object.values(CONFIG.scenes).map(e=>videoSrc(e)).filter(Boolean))],t=videoSrc(CONFIG.scenes.aerial),n=e.filter(e=>e!==t);(t?loadOne(t):Promise.resolve()).then(()=>Promise.all(n.map(loadOne)))}function showPoster(e,t){seqCanvas.classList.add("active");const n=new Image;n.onload=()=>{drawCover(n),t?.()},n.onerror=()=>t?.(),n.src=e}function startScene(e){const t=CONFIG.scenes[e];if(!t)return;markDwell(e),currentScene=e,setActive(e),syncHash(e),renderPOIs(t.pois),preloadNeighbors(e),Object.values(CONFIG.transitions[e]||{}).forEach(e=>preload(e));const n=videoSrc(t);if(!n)return void seqCanvas.classList.remove("active");const i=navGen;mainVideo.src=videoBlobs.get(n)||n,mainVideo.loop=!0,mainVideo.load();const a=()=>{if(i!==navGen)return;let e=!1;const t=()=>{e||i!==navGen||(e=!0,fadeCanvas())};mainVideo.addEventListener("playing",t,{once:!0}),mainVideo.addEventListener("timeupdate",t,{once:!0}),mainVideo.play().catch(t),setTimeout(t,500)};if(mainVideo.readyState>=3)a();else{const e=MOBILE?"loadeddata":"canplay";mainVideo.addEventListener(e,a,{once:!0}),setTimeout(a,MOBILE?3e3:5e3)}}function fadeCanvas(){seqCanvas.style.transition="opacity 300ms ease",seqCanvas.style.opacity="0",setTimeout(()=>{seqCanvas.classList.remove("active"),seqCanvas.style.opacity="",seqCanvas.style.transition=""},300)}async function navigateTo(e){if(busy||e===currentScene)return;const t=CONFIG.transitions?.[currentScene]?.[e];if(!t)return;busy=!0;const n=++navGen;hidePOIs();setAbSliderVisible(!1);try{const i=await loadWithLoader(t);if(n!==navGen)return;const a=CONFIG.sequences[t],o=(a.fps||30)/(MOBILE?2:1);if(await playSequence(i,!0===a.reverse,n,o),n!==navGen)return;startScene(e)}catch(e){n===navGen&&(console.error("Sequence error:",e),seqCanvas.classList.remove("active"))}finally{n===navGen&&setTimeout(()=>{n===navGen&&(busy=!1)},350)}}function loadWithLoader(e){const t=preload(e),n=setTimeout(()=>loaderEl.classList.add("visible"),400);return t.finally(()=>{clearTimeout(n),loaderEl.classList.remove("visible")})}function rememberSeq(e,t){if(cache.set(e,t),cache.size>3){const t=cache.keys().next().value;t!==e&&cache.delete(t)}}function preload(e,onProgress){if(cache.has(e))return cache.get(e);const t=CONFIG.sequences[e],n=MOBILE?{...t,folder:t.folder.replace("images/seq_arch/","images/seq_arch_m/")}:t,i=MOBILE?2:1,a=[];for(let e=n.from;e<=n.to;e+=i)a.push(e);const o=new Array(a.length);let s=0,r=!1;const c=MOBILE?4:a.length;let d=0;const l=new Promise((t,i)=>{const l=()=>{if(d>=a.length)return;const c=d++,u=String(a[c]).padStart(n.pad,"0"),m=new Image;m.src=`${n.folder}${n.prefix}${u}.${n.ext}`,m.onload=()=>{(m.decode?m.decode().catch(()=>{}):Promise.resolve()).then(()=>{o[c]=m,onProgress&&onProgress(),l(),++s===a.length&&t(o)})},m.onerror=()=>{onProgress&&onProgress(),r||(r=!0,cache.delete(e),i(new Error(`Failed to load: ${m.src}`)))}};for(let e=0;e<Math.min(c,a.length);e++)l()});return rememberSeq(e,l),l}function playSequence(e,t=!1,n,i=30){return new Promise(a=>{seqCanvas.classList.add("active");let o=t?e.length-1:0,s=0;const r=1e3/i;requestAnimationFrame(function i(c){return n!==navGen||c-s>=r&&(s=c,e[o]&&drawCover(e[o]),o+=t?-1:1,t?o<0:o>=e.length)?a():void requestAnimationFrame(i)})})}function drawCover(e){const t=innerWidth,n=innerHeight,i=Math.max(t/e.naturalWidth,n/e.naturalHeight),a=Math.round(e.naturalWidth*i),o=Math.round(e.naturalHeight*i),s=Math.round((t-a)/2),r=Math.round((n-o)/2);ctx.clearRect(0,0,t,n),ctx.drawImage(e,s,r,a,o),lastFrame=e}function renderPOIs(e=[]){poiLayer.innerHTML="",e.forEach((e,t)=>{const n=document.createElement("div");n.className="poi"+("info"===e.type?" poi--info":""),n.style.left=e.x+"%",n.style.top=e.y+"%",n.style.animationDelay=80*t+"ms",n.innerHTML=`<div class="poi-btn"><span class="poi-pulse"></span></div>\n                    <div class="poi-name">${e.label}</div>`;const i=()=>{"nav"===e.type&&e.target?(track("poi_nav",{from:currentScene,to:e.target}),navigateTo(e.target)):"info"===e.type&&e.info?(track("poi_info",{scene:currentScene,label:e.label}),openInfo(e.info)):e.target&&navigateTo(e.target)};n.addEventListener("click",i),n.addEventListener("touchstart",e=>{e.preventDefault(),i()},{passive:!1}),poiLayer.appendChild(n)})}function hidePOIs(){clearTimeout(poiTimer),poiLayer.classList.add("out"),poiTimer=setTimeout(()=>{poiLayer.innerHTML="",poiLayer.classList.remove("out")},300)}function openInfo(e){let t=document.getElementById("info-panel");t||(t=document.createElement("div"),t.id="info-panel",document.body.appendChild(t),t.addEventListener("click",e=>{(e.target===t||e.target.dataset.close)&&t.classList.remove("open")})),t.innerHTML=`\n    <div id="info-card">\n      <button data-close aria-label="Close">&times;</button>\n      ${e.image?`<img src="${e.image}" alt="">`:""}\n      <h3>${e.title}</h3>\n      ${e.area?`<span class="info-area">${e.area}</span>`:""}\n      <ul>${(e.items||[]).map(e=>`<li>${e}</li>`).join("")}</ul>\n    </div>`,requestAnimationFrame(()=>t.classList.add("open"))}function buildTrack(){const e=document.createElement("div");e.id="track-pts",CONFIG.timeline.forEach(t=>{const n=document.createElement("button");n.className="t-pt",n.dataset.id=t.id,n.setAttribute("aria-label",t.label),n.setAttribute("data-label",t.label),n.innerHTML=(t.icon||"")+`<span class="t-label">${t.label}</span>`,n.addEventListener("click",()=>navigateTo(t.id)),e.appendChild(n)}),trackEl.appendChild(e),trackEl.classList.add("show")}function setActive(e){document.querySelectorAll(".t-pt").forEach(t=>{t.classList.toggle("active",t.dataset.id===e)});CONFIG.timeline.find(t=>t.id===e);setAbSliderVisible(!!(CONFIG.scenes[e]&&CONFIG.scenes[e].abVideoB))}function initCursor(){const e=document.getElementById("cursor"),t=document.getElementById("ring");if(!e)return;let n=0,i=0,a=0,o=0;document.addEventListener("mousemove",e=>{n=e.clientX,i=e.clientY},{passive:!0}),function s(){e.style.left=n+"px",e.style.top=i+"px";const r=.12*(n-a),c=.12*(i-o);a+=r,o+=c,(Math.abs(r)>.05||Math.abs(c)>.05)&&(t.style.left=a+"px",t.style.top=o+"px"),requestAnimationFrame(s)}(),document.addEventListener("mouseover",t=>{e.classList.toggle("on",!!t.target.closest("button,.t-pt,.poi"))})}async function captureSceneFrame(){try{const e=innerWidth,t=innerHeight,n=Math.min(1,1024/e),i=Math.round(e*n),a=Math.round(t*n),o=document.createElement("canvas");o.width=i,o.height=a;const s=o.getContext("2d");if(seqCanvas.classList.contains("active"))s.drawImage(seqCanvas,0,0,i,a);else{if(!(mainVideo.readyState>=2&&mainVideo.videoWidth>0))return null;{const e=mainVideo.videoWidth,t=mainVideo.videoHeight,n=Math.max(i/e,a/t),o=e*n,r=t*n;s.drawImage(mainVideo,(i-o)/2,(a-r)/2,o,r)}}return o.toDataURL("image/jpeg",.8).split(",")[1]}catch(e){return null}}function aiKey(){return document.getElementById("ai-key").value.trim()}function aiTogglePanel(){const e=document.getElementById("ai-panel"),t=document.getElementById("ai-trigger-btn"),n=e.classList.contains("open");n||(e.style.top="50%",e.style.left="50%",e.style.transform="translate(-50%, -50%) scale(0.97)",e.offsetHeight),e.classList.toggle("open",!n),t.classList.toggle("active",!n)}function aiInitDrag(){const e=document.getElementById("ai-panel"),t=document.getElementById("ai-panel-header");let n=!1,i=0,a=0;t.addEventListener("pointerdown",o=>{if(o.target.closest("#ai-panel-close"))return;n=!0,e.classList.add("dragging");const s=e.getBoundingClientRect();e.style.top=s.top+"px",e.style.left=s.left+"px",e.style.transform="none",i=o.clientX-s.left,a=o.clientY-s.top,t.setPointerCapture(o.pointerId)}),t.addEventListener("pointermove",t=>{if(!n)return;let o=t.clientX-i,s=t.clientY-a;o=Math.max(0,Math.min(window.innerWidth-e.offsetWidth,o)),s=Math.max(0,Math.min(window.innerHeight-e.offsetHeight,s)),e.style.left=o+"px",e.style.top=s+"px"});const o=()=>{n&&(n=!1,e.classList.remove("dragging"))};t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o)}function aiSwitchTab(e){document.querySelectorAll(".ai-tab-btn").forEach(t=>t.classList.toggle("active",t.dataset.tab===e)),document.querySelectorAll(".ai-tab-panel").forEach(t=>t.classList.toggle("active",t.id==="ai-tab-"+e))}document.addEventListener("contextmenu",e=>e.preventDefault()),document.addEventListener("keydown",e=>{const t=e.key.toLowerCase();("f12"===t||e.ctrlKey&&e.shiftKey&&["i","j","c"].includes(t)||e.ctrlKey&&"u"===t||e.metaKey&&e.altKey&&["i","j","c"].includes(t))&&e.preventDefault()}),aiInitDrag();let _aiImages=[],_aiCapturedB64=null,_aiImgIdx=0;function aiSetStatus(e){document.getElementById("ai-img-status").textContent=e}function aiShowImage(e){_aiImgIdx=e;const t=_aiImages[e];document.getElementById("ai-result-img").src=t.url||"data:image/png;base64,"+t.b64,document.getElementById("ai-img-wrap").classList.add("visible"),document.getElementById("ai-img-dl-btn").classList.add("visible")}function aiCloseImage(){_aiImages=[],_aiImgIdx=0,document.getElementById("ai-img-wrap").classList.remove("visible"),document.getElementById("ai-img-dl-btn").classList.remove("visible"),aiSetStatus("")}function aiOpenLightbox(){const e=document.getElementById("ai-result-img").src;e&&(document.getElementById("ai-lightbox-img").src=e,document.getElementById("ai-lightbox").classList.add("open"))}function aiCloseLightbox(){document.getElementById("ai-lightbox").classList.remove("open")}function aiDownload(){if(!_aiImages.length)return;const e=_aiImages[_aiImgIdx],t=document.createElement("a");t.href=e.url||"data:image/png;base64,"+e.b64,t.download="ai-image.png",t.click()}async function aiManualCapture(){const e=document.querySelector("#ai-tab-image .ai-capture-btn"),t=document.getElementById("ai-img-capture-thumb");e.textContent="⏳ Capturing...",e.disabled=!0;const n=await captureSceneFrame();if(e.disabled=!1,!n)return e.textContent="📷 Capture View",void(t.innerHTML='<span style="color:rgba(255,80,80,0.7)">Failed — try again</span>');_aiCapturedB64=n,e.textContent="✓ Recapture",t.innerHTML=`<img src="data:image/jpeg;base64,${n}" alt="captura" />`}function aiStartFakeProgress(setStatus,label){let pct=0;setStatus(`${label} 0%`);const id=setInterval(()=>{pct+=(92-pct)*0.08+0.3,pct>92&&(pct=92),setStatus(`${label} ${Math.floor(pct)}%`)},250);return()=>clearInterval(id)}async function aiGenerate(){const e=aiKey(),t=document.getElementById("ai-img-prompt").value.trim(),n="photorealistic",i=_aiCapturedB64&&_aiCapturedB64.length>=500,r=document.getElementById("ai-img-ratio").value;if(!e)return void aiSetStatus("Enter the API Key");if(!t&&!i)return void aiSetStatus("Enter a prompt or capture the current view");const a=t||"Enhance this exact scene into a polished, photorealistic architectural render, keeping the same composition, structures and camera angle.",o=n?a+", "+n+" style":a,s=document.getElementById("ai-img-generate-btn");s.disabled=!0,_aiImages=[];const stopProgress=aiStartFakeProgress(aiSetStatus,"Creating image...");try{await aiGemini(e,o,r),stopProgress(),_aiImages.length?(aiShowImage(0),aiSetStatus("Done!")):aiSetStatus("No image returned.")}catch(e){stopProgress(),console.error(e),aiSetStatus("Error: "+e.message)}s.disabled=!1}async function aiGemini(e,t,ratio="16:9"){const n={"Content-Type":"application/json"};let i=_aiCapturedB64;(!i||i.length<500)&&(i=await captureSceneFrame());let a=t;if(i&&i.length>=500){const o=["gemini-3.6-flash","gemini-3.5-flash-lite","gemini-2.5-flash-preview-05-20","gemini-2.5-pro","gemini-2.0-flash","gemini-1.5-flash"],s=JSON.stringify({contents:[{role:"user",parts:[{inlineData:{mimeType:"image/jpeg",data:i}},{text:"Describe this architectural scene in detail for an image generation prompt. Include spatial layout, style, materials, lighting and atmosphere. User style request: "+t+". Respond with ONLY a concise image generation prompt in English, max 100 words."}]}]});e:for(const t of["v1beta","v1"])for(const i of o)try{const o=await fetch(`https://generativelanguage.googleapis.com/${t}/models/${i}:generateContent?key=${e}`,{method:"POST",headers:n,body:s}),r=await o.json();if(!o.ok)continue;const c=r?.candidates?.[0]?.content?.parts?.[0]?.text||"";if(c){a=c.trim();break e}}catch(e){}}const o=i&&i.length>=500;const errs=[];const imageModels=["gemini-3.1-flash-image","gemini-3-pro-image"];for(const model of imageModels)try{const parts=[{text:a}];o&&parts.push({inlineData:{mimeType:"image/jpeg",data:i}});const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${e}`,{method:"POST",headers:n,body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{responseModalities:["IMAGE","TEXT"],imageConfig:{aspectRatio:ratio}}})}),d=await resp.json();if(!resp.ok){errs.push(`[${model}] ${d?.error?.message||resp.status}`);continue}const imgs=(d?.candidates?.[0]?.content?.parts||[]).filter(p=>p.inlineData?.data);if(imgs.length)return void imgs.forEach(p=>_aiImages.push({b64:p.inlineData.data}));errs.push(`[${model}] response had no image`)}catch(err){errs.push(`[${model}] ${err.message}`)}const quotaBlocked=errs.some(msg=>/quota|billing|limit: 0/i.test(msg));if(quotaBlocked)throw new Error("Your API key doesn't have billing enabled — Gemini image generation models have a 0-request free-tier quota and require a paid plan. Enable billing at https://ai.google.dev/gemini-api/docs/rate-limits, then try again.\n"+errs.join("\n"));throw new Error("Image generation failed. The key needs access to a Gemini image model.\n"+errs.join("\n"))}function extractVideoResult(e){const t=e?.response;if(!t)return null;const n=[t?.generateVideoResponse?.generatedSamples?.[0]?.video,t?.generatedVideos?.[0]?.video,t?.videos?.[0]?.video,t?.videos?.[0],t?.generateVideoResponse?.generatedSamples?.[0]].filter(Boolean);for(const e of n){if(e?.uri)return{uri:e.uri};if(e?.videoBytes)return{b64:e.videoBytes,mime:e.mimeType||"video/mp4"};if(e?.bytesBase64Encoded)return{b64:e.bytesBase64Encoded,mime:e.mimeType||"video/mp4"}}return null}document.addEventListener("keydown",e=>{"Escape"===e.key&&aiCloseLightbox()});let _aiVideoB64Frame=null,_aiVideoMime="image/jpeg",_aiVideoUrl=null;async function aiSetVideoSource(e){const t=document.getElementById("ai-vid-capture-thumb");if(document.querySelectorAll("#ai-tab-video .ai-capture-btn").forEach(t=>t.classList.toggle("active",t.dataset.src===e)),"capture"===e){const e=document.querySelector('#ai-tab-video .ai-capture-btn[data-src="capture"]');e.disabled=!0,t.textContent="⏳ Capturing...";const n=await captureSceneFrame();if(e.disabled=!1,!n)return t.innerHTML='<span style="color:rgba(255,80,80,0.7)">Failed — try again</span>',void(_aiVideoB64Frame=null);_aiVideoB64Frame=n,_aiVideoMime="image/jpeg",t.innerHTML=`<img src="data:image/jpeg;base64,${n}" alt="capture" />`}else if("generated"===e){if(!_aiImages.length)return t.innerHTML='<span style="color:rgba(255,80,80,0.7)">Generate an image in the Image tab first</span>',void(_aiVideoB64Frame=null);const e=_aiImages[_aiImgIdx];_aiVideoB64Frame=e.b64,_aiVideoMime="image/png",t.innerHTML=`<img src="data:image/png;base64,${e.b64}" alt="generated image" />`}}function aiSetVideoStatus(e){document.getElementById("ai-vid-status").textContent=e}function aiCloseVideo(){const e=document.getElementById("ai-vid-wrap"),t=document.getElementById("ai-result-video");t.pause(),t.removeAttribute("src"),t.load(),_aiVideoUrl&&(URL.revokeObjectURL(_aiVideoUrl),_aiVideoUrl=null),e.classList.remove("visible"),document.getElementById("ai-vid-dl-btn").classList.remove("visible"),aiSetVideoStatus("Video generation takes 1 to 3 minutes.")}function aiDownloadVideo(){if(!_aiVideoUrl)return;const e=document.createElement("a");e.href=_aiVideoUrl,e.download="ai-video.mp4",e.click()}async function aiStartVeoOperation(key,ver,model,instance,ratio){const resp=await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:predictLongRunning?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instances:[instance],parameters:{aspectRatio:ratio}})}),d=await resp.json();if(!resp.ok)throw new Error(d?.error?.message||String(resp.status));const name=d.name;if(!name)throw new Error("Response had no operation name.");return{ver,name}}async function aiPollVeoOperation(key,ver,name){let done=!1,tries=0,result=null;for(;!done&&tries<60;){await new Promise(r=>setTimeout(r,1e4)),tries++;const resp=await fetch(`https://generativelanguage.googleapis.com/${ver}/${name}?key=${key}`),d=await resp.json();if(!resp.ok)throw new Error(d?.error?.message||String(resp.status));result=d,done=!!d.done}if(!done)throw new Error("Timed out waiting for the video.");if(result.error)throw new Error(result.error.message||"Generation error.");return result}async function aiGenerateVideo(){const e=aiKey(),t=document.getElementById("ai-vid-prompt").value.trim(),r=document.getElementById("ai-vid-ratio").value;if(!e)return void aiSetVideoStatus("Enter the API Key");if(!t)return void aiSetVideoStatus("Enter a prompt");const n=document.getElementById("ai-vid-generate-btn");n.disabled=!0,aiCloseVideo(),aiSetVideoStatus("Creating video...");try{const instance={prompt:t};_aiVideoB64Frame&&(instance.image={bytesBase64Encoded:_aiVideoB64Frame,mimeType:_aiVideoMime});const veoModels=["veo-3.1-generate-preview","veo-3.0-generate-preview","veo-3.0-fast-generate-preview","veo-2.0-generate-001"];const errs=[];let op=null;e:for(const model of veoModels)for(const ver of["v1beta","v1"])try{op=await aiStartVeoOperation(e,ver,model,instance,r);break e}catch(err){errs.push(`[${ver}/${model}] ${err.message}`)}if(!op)throw new Error("No Veo model available for this key.\n"+errs.join("\n"));aiSetVideoStatus("Creating video (this can take 1 to 3 minutes)...");const c=await aiPollVeoOperation(e,op.ver,op.name);const d=extractVideoResult(c);if(!d){const t=c?.response?.raiMediaFilteredReasons?.[0]||c?.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];throw new Error(t?"Blocked by safety filter: "+t:"Response had no video. Raw: "+JSON.stringify(c).slice(0,400))}let u;if(d.uri){const l=await fetch(d.uri,{headers:{"x-goog-api-key":e}});if(!l.ok)throw new Error("Failed to download the generated video.");u=await l.blob()}else{const t=atob(d.b64),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);u=new Blob([n],{type:d.mime||"video/mp4"})}_aiVideoUrl=URL.createObjectURL(u);document.getElementById("ai-result-video").src=_aiVideoUrl,document.getElementById("ai-vid-wrap").classList.add("visible"),document.getElementById("ai-vid-dl-btn").classList.add("visible"),aiSetVideoStatus("Done!")}catch(e){console.error(e),aiSetVideoStatus("Error: "+e.message)}n.disabled=!1}const neoLive={active:!1,connecting:!1,ws:null,micStream:null,inputCtx:null,inputNode:null,_inputSource:null,outputCtx:null,nextPlayTime:0,playingSources:[],frameTimer:null,setupDone:!1},NEO_LIVE_TOOLS=[{name:"navigate_to_scene",description:"Navigates to one of the 3D tour's scenes/views.",parameters:{type:"OBJECT",properties:{scene_id:{type:"STRING",description:"The id of the target scene, one of: "+CONFIG.timeline.map(e=>e.id).join(", ")}},required:["scene_id"]}},{name:"list_scenes",description:"Lists all scenes/views available for navigation, with id and title.",parameters:{type:"OBJECT",properties:{}}}];function neoLiveSystemInstruction(){return`You are a friendly, down-to-earth virtual real estate agent, guiding the user through an immersive 3D tour (ArchViz Explorer) of a property development.\nYou are seeing the user's screen in real time through periodically sent image frames — comment on what you're seeing.\nSpeak in natural, brief English (short answers, a spoken conversational tone, don't read out lists).\nGive tips about what's being shown, highlight standout features, and offer to navigate to other views when it makes sense — use the navigate_to_scene function for that.\nThe available views are:\n${CONFIG.timeline.map(e=>`- id:"${e.id}" title:"${e.label}"`).join("\n")}\nNever invent a scene_id that isn't on this list.`}function neoLiveVoiceEl(e,t){console.debug("[neoLive]",e,t)}function neoLiveSetStatus(e){const t=document.getElementById("ai-voice-btn");t&&(t.title=e)}function neoLiveToggle(){neoLive.active||neoLive.connecting?neoLiveStop():neoLiveStart()}async function neoLiveStart(){const e=aiKey();if(!e)return void neoLiveSetStatus("No API Key — open the AI panel and paste your key first");if(neoLive.connecting||neoLive.active)return;neoLive.connecting=!0;const t=document.getElementById("ai-voice-btn");t.classList.add("connecting"),neoLiveSetStatus("Connecting...");try{neoLive.micStream=await navigator.mediaDevices.getUserMedia({audio:!0})}catch(e){return neoLiveSetStatus("Microphone denied/unavailable."),t.classList.remove("connecting"),void(neoLive.connecting=!1)}neoLive.inputCtx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:16e3}),neoLive.outputCtx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:24e3}),neoLive.nextPlayTime=0,neoLive.playingSources=[];const n=`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${e}`;neoLive.ws=new WebSocket(n),neoLive.setupDone=!1,neoLive.ws.onopen=()=>{neoLive.ws.send(JSON.stringify({setup:{model:"models/gemini-3.1-flash-live-preview",responseModalities:["AUDIO"],systemInstruction:{parts:[{text:neoLiveSystemInstruction()}]},inputAudioTranscription:{},outputAudioTranscription:{},tools:[{functionDeclarations:NEO_LIVE_TOOLS}]}}))},neoLive.ws.onmessage=async e=>{let t,n=e.data;n instanceof Blob&&(n=await n.text());try{t=JSON.parse(n)}catch(e){return}neoLiveHandleMessage(t)},neoLive.ws.onerror=()=>neoLiveSetStatus("Connection error."),neoLive.ws.onclose=()=>{(neoLive.active||neoLive.connecting)&&neoLiveStop()},neoLive.active=!0,neoLive.connecting=!1,neoLiveStartMic(),neoLiveStartScreenFeed()}function neoLiveStartMic(){const e=neoLive.inputCtx.createMediaStreamSource(neoLive.micStream),t=neoLive.inputCtx.createScriptProcessor(4096,1,1);t.onaudioprocess=e=>{if(!neoLive.ws||neoLive.ws.readyState!==WebSocket.OPEN||!neoLive.setupDone)return;const t=e.inputBuffer.getChannelData(0),n=new Int16Array(t.length);for(let e=0;e<t.length;e++){const i=Math.max(-1,Math.min(1,t[e]));n[e]=i<0?32768*i:32767*i}const i=new Uint8Array(n.buffer);let a="";for(let e=0;e<i.length;e++)a+=String.fromCharCode(i[e]);neoLive.ws.send(JSON.stringify({realtimeInput:{audio:{data:btoa(a),mimeType:"audio/pcm;rate=16000"}}}))},e.connect(t),t.connect(neoLive.inputCtx.destination),neoLive.inputNode=t,neoLive._inputSource=e}function neoLiveStartScreenFeed(){neoLive.frameTimer=setInterval(async()=>{if(!neoLive.active||!neoLive.ws||neoLive.ws.readyState!==WebSocket.OPEN||!neoLive.setupDone)return;const e=await captureSceneFrame();e&&neoLive.ws.send(JSON.stringify({realtimeInput:{video:{data:e,mimeType:"image/jpeg"}}}))},1e3)}function neoLivePlayPCM(e){const t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);const i=new Int16Array(n.buffer,n.byteOffset,n.byteLength/2),a=new Float32Array(i.length);for(let e=0;e<i.length;e++)a[e]=i[e]/32768;const o=neoLive.outputCtx,s=o.createBuffer(1,a.length,24e3);s.copyToChannel(a,0);const r=o.createBufferSource();r.buffer=s,r.connect(o.destination);const c=Math.max(o.currentTime,neoLive.nextPlayTime);r.start(c),neoLive.nextPlayTime=c+s.duration,neoLive.playingSources.push(r),r.onended=()=>{neoLive.playingSources=neoLive.playingSources.filter(e=>e!==r)}}function neoLiveStopPlayback(){neoLive.playingSources.forEach(e=>{try{e.stop()}catch(e){}}),neoLive.playingSources=[],neoLive.nextPlayTime=neoLive.outputCtx?neoLive.outputCtx.currentTime:0}function neoLiveHandleMessage(e){if(e.setupComplete){neoLive.setupDone=!0;const e=document.getElementById("ai-voice-btn");return e.classList.remove("connecting"),e.classList.add("live"),void neoLiveSetStatus("🎙️ Listening...")}if(e.serverContent){const t=e.serverContent;if(t.interrupted&&neoLiveStopPlayback(),t.modelTurn?.parts)for(const e of t.modelTurn.parts)e.inlineData?.data&&(neoLiveSetStatus("🔊 Speaking..."),neoLivePlayPCM(e.inlineData.data));t.inputTranscription?.text&&neoLiveVoiceEl("user",t.inputTranscription.text),t.outputTranscription?.text&&neoLiveVoiceEl("model",t.outputTranscription.text),t.turnComplete&&neoLiveSetStatus("🎙️ Listening...")}if(e.toolCall){const t=[];for(const n of e.toolCall.functionCalls){let e;try{e=neoLiveRunTool(n.name,n.args||{})}catch(t){e={error:t.message}}t.push({id:n.id,name:n.name,response:{result:e}})}neoLive.ws.send(JSON.stringify({toolResponse:{functionResponses:t}}))}}function neoLiveRunTool(e,t){return"navigate_to_scene"===e?CONFIG.scenes[t.scene_id]?(navigateTo(t.scene_id),{status:"ok",scene:t.scene_id}):{status:"error",message:"unknown scene_id: "+t.scene_id}:"list_scenes"===e?{scenes:CONFIG.timeline.map(e=>({id:e.id,title:e.label}))}:{status:"error",message:"unknown function: "+e}}function neoLiveStop(){if(neoLive.active=!1,neoLive.connecting=!1,neoLive.frameTimer&&(clearInterval(neoLive.frameTimer),neoLive.frameTimer=null),neoLive.ws){try{neoLive.ws.close()}catch(e){}neoLive.ws=null}if(neoLive.micStream&&(neoLive.micStream.getTracks().forEach(e=>e.stop()),neoLive.micStream=null),neoLive.inputNode){try{neoLive.inputNode.disconnect()}catch(e){}neoLive.inputNode=null}if(neoLive._inputSource){try{neoLive._inputSource.disconnect()}catch(e){}neoLive._inputSource=null}neoLiveStopPlayback(),neoLive.inputCtx&&(neoLive.inputCtx.close().catch(()=>{}),neoLive.inputCtx=null),neoLive.outputCtx&&(neoLive.outputCtx.close().catch(()=>{}),neoLive.outputCtx=null),neoLive.setupDone=!1;document.getElementById("ai-voice-btn").classList.remove("live","connecting"),neoLiveSetStatus("Talk to the AI")}

/* ══════════════════════════════════════════════════════
   Slider A/B — any scene with an `abVideoB` + `abSequence` in its CONFIG
   entry gets it: side A = day video (scene's main video), side B = night
   video (abVideoB). Both videos always play in parallel behind the canvas
   — switching sides is just an opacity toggle (no src/load/fade), and the
   middle of the drag scrubs through a pre-rendered frame sequence (same
   mechanism as the bidese.html dn-slider).
   ══════════════════════════════════════════════════════ */

const abVideoB = document.getElementById("ab-video-b");
const stageEl = document.getElementById("stage");
let abFrames = null, abFramesSeq = null, abLoading = null, abDragging = false, abT = 0;

function abEnsureFrames() {
  const seqId = CONFIG.scenes[currentScene] && CONFIG.scenes[currentScene].abSequence;
  if (!seqId) return null;
  if (abFramesSeq === seqId && (abFrames || abLoading)) return abLoading;
  abFramesSeq = seqId;
  abFrames = null;
  abLoading = preload(seqId).then(frames => { abFrames = frames; }).catch(() => {});
  return abLoading;
}

function abRender() {
  const handle = document.getElementById("ab-handle"), track = document.getElementById("ab-track");
  if (handle) handle.style.left = (abT * 100).toFixed(2) + "%";
  if (track) track.style.setProperty("--ab-t", (abT * 100).toFixed(2) + "%");

  if (abT <= 0) {
    stageEl.classList.remove("ab-show-b");
    seqCanvas.classList.remove("active");
    return;
  }
  if (abT >= 1) {
    stageEl.classList.add("ab-show-b");
    seqCanvas.classList.remove("active");
    return;
  }
  seqCanvas.classList.add("active");
  if (abFrames && abFrames.length) {
    const idx = Math.round(abT * (abFrames.length - 1));
    if (abFrames[idx]) drawCover(abFrames[idx]);
  }
}

let abPendingClientX = null, abRafPending = false;
function abSetFromClientX(clientX) {
  abPendingClientX = clientX;
  if (abRafPending) return;
  abRafPending = true;
  requestAnimationFrame(abFlush);
}
function abFlush() {
  abRafPending = false;
  if (abPendingClientX == null) return;
  const track = document.getElementById("ab-track");
  if (!track) return;
  const r = track.getBoundingClientRect();
  abT = Math.max(0, Math.min(1, (abPendingClientX - r.left) / r.width));
  abRender();
}

function setAbSliderVisible(visible) {
  const el = document.getElementById("ab-slider");
  if (!el) return;
  el.classList.toggle("show", visible);
  if (visible) {
    abEnsureFrames();
    const src = CONFIG.scenes[currentScene] && CONFIG.scenes[currentScene].abVideoB;
    if (src) {
      const resolved = videoBlobs.get(src) || src;
      if (abVideoB.dataset.src !== resolved) {
        abVideoB.src = resolved;
        abVideoB.dataset.src = resolved;
        abVideoB.load();
      }
      abVideoB.play().catch(() => {});
    }
  } else {
    stageEl.classList.remove("ab-show-b");
    if (abT !== 0) {
      abT = 0;
      seqCanvas.classList.remove("active");
      const handle = document.getElementById("ab-handle"), track = document.getElementById("ab-track");
      if (handle) handle.style.left = "0%";
      if (track) track.style.setProperty("--ab-t", "0%");
    }
  }
}

function initAbSlider() {
  const el = document.getElementById("ab-slider");
  if (!el) return;
  el.addEventListener("pointerdown", e => {
    e.stopPropagation();
    abDragging = true;
    el.setPointerCapture(e.pointerId);
    abEnsureFrames();
    abSetFromClientX(e.clientX);
  });
  el.addEventListener("pointermove", e => {
    if (!abDragging) return;
    e.stopPropagation();
    abSetFromClientX(e.clientX);
  });
  const endDrag = e => {
    if (!abDragging) return;
    abDragging = false;
    e.stopPropagation();
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

/* ══════════════════════════════════════════════════════
   Preloader — gates the experience behind a full loading screen so the
   poster, both scene videos and the aerial⇄pool frame sequence are fully
   fetched and decoded (cached in `cache`/`videoBlobs`) before the user can
   press Start. That guarantees the very first transition has every frame
   ready — no mid-animation "missing frame" pop, no stall waiting on the
   network. Secondary assets (AB night videos/sequences) load in the
   background afterwards, same as before.
   ══════════════════════════════════════════════════════ */

function preloadRemainingIdle() {
  const run = () => {
    Object.values(CONFIG.scenes).forEach(s => {
      if (s.abVideoB) loadOne(s.abVideoB);
      if (s.abSequence) preload(s.abSequence);
    });
  };
  window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 1200);
}

function initPreloader() {
  const el = document.getElementById("preloader");
  if (!el) { startScene(sceneFromHash()); return; }
  const pctEl = document.getElementById("preloader-pct");
  const startBtn = document.getElementById("preloader-start");

  const posterSrc = MOBILE
    ? "images/seq_arch_m/aereo_to_piscina_00.jpg"
    : "images/seq_arch/aereo_to_piscina_00.jpg";
  const forwardSeq = "aerial-to-pool", reverseSeq = "pool-to-aerial";
  const seqDef = CONFIG.sequences[forwardSeq];
  const seqLen = Math.floor((seqDef.to - seqDef.from) / (MOBILE ? 2 : 1)) + 1;
  const total = 1 /* poster */ + 2 /* videos */ + seqLen * 2 /* both directions */;
  let done = 0;
  const tick = () => {
    done = Math.min(done + 1, total);
    if (pctEl) pctEl.textContent = Math.round((done / total) * 100) + "%";
  };

  const posterImg = new Image();
  const posterDone = new Promise(res => {
    posterImg.onload = posterImg.onerror = () => { tick(); res(); };
    posterImg.src = posterSrc;
  });

  const videosDone = Promise.allSettled([
    loadOne(videoSrc(CONFIG.scenes.aerial)).then(tick),
    loadOne(videoSrc(CONFIG.scenes.pool)).then(tick)
  ]);

  const sequencesDone = Promise.allSettled([
    preload(forwardSeq, tick),
    preload(reverseSeq, tick)
  ]);

  Promise.allSettled([posterDone, videosDone, sequencesDone]).then(() => {
    if (pctEl) pctEl.textContent = "100%";
    el.classList.add("ready");
    startBtn && startBtn.focus();
  });

  startBtn && startBtn.addEventListener("click", () => {
    el.classList.add("hide");
    showPoster(posterSrc, () => startScene(sceneFromHash()));
    preloadRemainingIdle();
    setTimeout(() => el.remove(), 700);
  }, { once: true });
}

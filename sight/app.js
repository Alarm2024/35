var TRACKS={
iphone:{key:"35-iris-iphone-v1",nextC:"Remove the unknown device / profile / linked session YOURSELF. Change Apple ID password on this phone. No seed in mail.",qs:[
{id:"devices",q:"Apple ID → Devices: phone, iPad, or Mac you do not own?",path:"Settings → [your name] → Devices",yes:"C"},
{id:"mdm",q:"Configuration profile or MDM you did not install?",path:"Settings → General → VPN & Device Management",yes:"C"},
{id:"ext",q:"Safari extension you do not remember installing?",path:"Settings → Apps → Safari → Extensions",yes:"B"},
{id:"chat",q:"Second phone or browser linked to WhatsApp / iMessage / Telegram?",path:"WhatsApp → Settings → Linked devices",yes:"C"},
{id:"mail",q:"Mail forwarding you did not set?",path:"Gmail / iCloud filters. Visual only.",yes:"C"},
{id:"screen",q:"Screen share or remote-view app you did not turn on?",path:"Settings → Screen Time · unknown apps",yes:"C"}
]},
android:{key:"35-iris-android-v1",nextC:"Remove the unknown device / admin / accessibility YOURSELF. On this phone open myaccount.google.com/security. No seed in mail.",qs:[
{id:"gdev",q:"Google account → Devices: phone or browser you do not own?",path:"Settings → Google → Manage account → Security → Your devices",yes:"C"},
{id:"admin",q:"Device admin app you did not grant?",path:"Settings → Security → Device admin apps",yes:"C"},
{id:"acc",q:"Accessibility service you did not install?",path:"Settings → Accessibility",yes:"C"},
{id:"special",q:"Display-over-apps or install-unknown-apps you did not allow?",path:"Settings → Apps → Special app access",yes:"B"},
{id:"chat",q:"Second phone linked to WhatsApp / Telegram?",path:"WhatsApp → Settings → Linked devices",yes:"C"},
{id:"fwd",q:"Gmail forwarding or filter you did not set?",path:"Gmail → Settings → Forwarding and filters. Visual only.",yes:"C"}
]}
};
function loadState(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch(e){return {};}}
function saveState(key,s){try{localStorage.setItem(key,JSON.stringify(s));}catch(e){}}
function rank(track,answers){var cls="A",notes=[];track.qs.forEach(function(item){var a=answers[item.id];if(!a){if(cls==="A")cls="B";notes.push(item.id+": unanswered");return;}if(a==="yes"){if(item.yes==="C")cls="C";else if(cls==="A")cls="B";notes.push(item.id+": YES");}else if(a==="idk"){if(cls==="A")cls="B";notes.push(item.id+": open the path");}else notes.push(item.id+": no");});return{cls:cls,notes:notes};}
function nextText(track,cls){if(cls==="A")return "Looks quiet from what you tapped. Record the date. Do not install a cleaner.";if(cls==="B")return "Open the yellow paths. If a name appears you cannot explain, treat it as C.";return track.nextC;}
function renderTrack(name){var track=TRACKS[name],root=document.getElementById(name);if(!root||!track)return;var answers=(loadState(track.key).answers)||{};var html="";track.qs.forEach(function(item){var cur=answers[item.id]||"";html+='<div class="card"><p class="path">'+item.path+'</p><p class="q">'+item.q+'</p><div class="ans">';["no","yes","idk"].forEach(function(v){var label=v==="idk"?"not sure":v;var on=cur===v?" on-"+v:"";html+='<button type="button" data-track="'+name+'" data-id="'+item.id+'" data-v="'+v+'" class="'+on.trim()+'">'+label+"</button>";});html+="</div></div>";});var r=rank(track,answers);html+='<div class="card"><span class="badge '+r.cls+'">CLASS '+r.cls+"</span><p class=\"rule\">"+nextText(track,r.cls)+"\n"+r.notes.join("\n")+"</p>";html+='<div class="row"><button class="ghost" type="button" id="reset-'+name+'">Reset answers</button></div></div>';root.innerHTML=html;root.querySelectorAll(".ans button").forEach(function(b){b.onclick=function(){var t=TRACKS[b.getAttribute("data-track")];var s=loadState(t.key);s.answers=s.answers||{};s.answers[b.getAttribute("data-id")]=b.getAttribute("data-v");s.updated=new Date().toISOString();saveState(t.key,s);renderTrack(name);};});var reset=document.getElementById("reset-"+name);if(reset)reset.onclick=function(){saveState(track.key,{answers:{},updated:new Date().toISOString()});renderTrack(name);};}
function showTab(id){["iphone","android","sig"].forEach(function(n){var p=document.getElementById(n),b=document.getElementById("tab-"+n);if(p)p.classList.toggle("on",n===id);if(b)b.classList.toggle("on",n===id);});}
var tabI=document.getElementById("tab-iphone"),tabA=document.getElementById("tab-android"),tabS=document.getElementById("tab-sig");
if(tabI)tabI.onclick=function(){showTab("iphone");};
if(tabA)tabA.onclick=function(){showTab("android");};
if(tabS)tabS.onclick=function(){showTab("sig");};
renderTrack("iphone");renderTrack("android");
var ALLOW={"11111111111111111111111111111111":"System","TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA":"SPL Token","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb":"Token-2022","ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL":"ATA","ComputeBudget111111111111111111111111111111":"ComputeBudget","MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr":"Memo"};
var MAX="18446744073709551615";
var RPCS=["https://api.mainnet-beta.solana.com","https://solana-rpc.publicnode.com"];
function looksSecret(s){var t=s.trim();if(/\b(\w+\s+){11,23}\w+\b/.test(t)&&t.split(/\s+/).length<=24)return true;if(/^\s*\[[\d,\s]{80,}\]\s*$/.test(t))return true;return false;}
function looksSig(s){return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s.trim());}
function ixList(tx){var outer=tx.transaction.message.instructions||[];var inner=[];(tx.meta&&tx.meta.innerInstructions||[]).forEach(function(g){(g.instructions||[]).forEach(function(ix){inner.push(ix);});});return outer.concat(inner);}
function classify(tx){var ixs=ixList(tx),programs=[],notes=[],cls="A";ixs.forEach(function(ix){var pid=String(ix.programId||"");var name=ALLOW[pid]||"UNKNOWN";if(programs.indexOf(name==="UNKNOWN"?pid:name)<0)programs.push(name==="UNKNOWN"?pid.slice(0,8)+"\u2026":name);if(!ALLOW[pid]&&pid.length>20){cls="C";notes.push("unknown program");}var parsed=ix.parsed||null;var typ=parsed&&parsed.type?parsed.type:"";var info=parsed&&parsed.info?parsed.info:{};var amt=info.amount||(info.tokenAmount&&info.tokenAmount.amount);if(typ==="approve"||typ==="approveChecked"){if(String(amt)===MAX){if(cls!=="C")cls="B";notes.push("unlimited approve");}else notes.push("finite approve");}if(typ==="setAuthority"){cls="C";notes.push("SetAuthority");}});if(!ixs.length){cls="C";notes.push("no instructions");}return{cls:cls,programs:programs,notes:notes};}
function show(cls,text){var out=document.getElementById("out");if(!out)return;out.classList.add("on");var badge=document.getElementById("badge");badge.className="badge "+cls;badge.textContent=cls==="X"?"BLOCKED":"CLASS "+cls;document.getElementById("report").textContent=text;}
async function rpcGet(sig){var body=JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransaction",params:[sig,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]});var last=null;for(var i=0;i<RPCS.length;i++){try{var res=await fetch(RPCS[i],{method:"POST",headers:{"content-type":"application/json"},body:body});var j=await res.json();if(j.result)return j.result;last=(j.error&&j.error.message)||"empty";}catch(e){last=String(e.message||e);}}throw new Error(last||"rpc failed");}
var run=document.getElementById("run");
if(run)run.onclick=async function(){var raw=document.getElementById("q").value||"";if(looksSecret(raw)){show("X","Rejected. Looks like a seed.");document.getElementById("q").value="";return;}var sig=raw.trim();if(!looksSig(sig)){show("X","Need a public signature.");return;}show("X","Reading chain...");try{var tx=await rpcGet(sig);if(!tx){show("C","Not found.");return;}var r=classify(tx);var lines=["programs "+(r.programs.join(", ")||"none")].concat(r.notes.map(function(n){return "- "+n;}));if(r.cls==="B")lines.push("next: revoke in YOUR wallet");if(r.cls==="C")lines.push("next: do not sign twins");show(r.cls,lines.join("\n"));}catch(e){show("C","RPC blocked. Mail only the public signature.");}};
var clr=document.getElementById("clr");
if(clr)clr.onclick=function(){document.getElementById("q").value="";document.getElementById("out").classList.remove("on");};

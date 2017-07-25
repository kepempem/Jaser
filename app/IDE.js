const vm = require("vm");
const https = require("https");
const electron = require("electron");
const PythonShell = require("python-shell");
const {remote} = electron;
const {app,BrowserWindow,dialog,Menu,MenuItem,clipboard,shell} = remote;
const ipc = electron.ipcRenderer;
const path = require("path");
const fs = require("fs");
const os = require("os");
const {EOL} = os;
const translator = (new (require("./js/translator"))(require("./strings.json")));
const lang = app.getLocale();
const _STRING = w=>translator.translate(w,lang);
const HOME = process.env[(process.platform=="win32")?"USERPROFILE":"HOME"];
const vex = require("vex-js");
const USER_AGENT = "Jaser/"+require(path.join(__dirname,"..","package.json")).version;
const rm_rf = p=>{
	if(fs.existsSync(p)){
		fs.readdirSync(p).forEach(f=>{
			let curPath = path.join(p,f);
			if(fs.statSync(curPath).isDirectory()){
				rm_rf(curPath);
			}else{
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(p);
	}
};
const cookies = require("./js/cookies");
const appdata_dir = cookies.AppData;
let lang_selector = document.getElementById("lang_selector");
cookies.def("lang","js");
cookies.def("gists",[]);
let l_c_e = ["change","click","mouseup","mousedown","keydown","keyup"];
for(let i=0;i<l_c_e.length;i++){
	lang_selector.addEventListener(l_c_e[i],()=>cookies.set("lang",lang_selector.value));
}
for(let i=0;i<lang_selector.childNodes.length;i++){
	let so = lang_selector.childNodes[i];
	if(so.nodeType==1&&so.tagName.toUpperCase()=="OPTION"&&so.value.toUpperCase()==cookies.get("lang").toUpperCase()){
		so.selected = true;
		break;
	}
}
let _code_editor = document.getElementById("code_editor");
let _console = document.getElementById("console");
let _runBtn = document.getElementById("run");
let _clearBtn = document.getElementById("clear");
let console_keys = Object.keys(console);
let c_gist_url;
let c_gist;
let c_gist_files;
const open_gist_file = (index)=>{
	while(_code_editor.firstChild!==null){
		_code_editor.removeChild(_code_editor.firstChild);
	}
	let gcl = c_gist.files[c_gist_files[index]].content.split(EOL);
	for(let i=0;i<gcl.length;i++){
		let le = document.createElement("div");
		le.innerText = gcl[i];
		_code_editor.appendChild(le);
	}
};
let console_function = `
	if(args.length>1){
			JASER_CHUNK.push([args.join("")]);
	}else{
		if(typeof args[0]=="undefined"){
			JASER_CHUNK.push([""]);
			return;
		}
		JASER_CHUNK.push([args[0]]);
	}
`;
const parse_val = (v,inden=0,suff="",tn="div",fi=false,strngfy=false)=>{
	let indntn = "  ";
	let inden_prefix = indntn.repeat(inden);
	let l = document.createElement(tn);
	let firstInden = typeof fi=="boolean"&&fi?"":inden_prefix;
	switch(typeof v){
		case "string":{
			l.classList.add("jaser-output-string");
			l.appendChild(document.createTextNode(firstInden+(strngfy?"\""+v+"\"":v)+suff));
		}
		break;
		case "number":{
			l.classList.add("jaser-output-number");
			l.appendChild(document.createTextNode(firstInden+v.toString()+suff));
		}
		break;
		case "boolean":{
			l.classList.add("jaser-output-boolean");
			l.appendChild(document.createTextNode(firstInden+v.toString()+suff));
		}
		break;
		case "function":{
			l.classList.add("jaser-output-function");
			l.appendChild(document.createTextNode(firstInden+v.toString()+suff));
		}
		break;
		default:{
			if(v==null){
				l.classList.add("jaser-output-null");
				l.appendChild(document.createTextNode(firstInden+"null"));
			}else{
				l.classList.add("jaser-output-object");
				if(Array.isArray(v)){
					l.appendChild(document.createTextNode(firstInden+"["));
					for(let i=0;i<v.length;i++){
						l.appendChild(parse_val(v[i],inden+1,i<v.length-1?",":"","div",false,true));
					}
					l.appendChild(document.createTextNode(inden_prefix+"]"));
				}else{
					let ptio = Object.keys(v);
					l.appendChild(document.createTextNode(firstInden+"{"));
					for(let i=0;i<ptio.length;i++){
						let po = document.createElement("div");
						po.appendChild(document.createTextNode(indntn.repeat(inden+1)+ptio[i]+": "));
						po.appendChild(parse_val(v[ptio[i]],inden+1,(i<ptio.length-1?",":""),"span",true,true));
						l.appendChild(po);
					}
					l.appendChild(document.createTextNode(inden_prefix+"}"));
				}
			}
		}
	}
	return l;
};
const parse_chunk = (chunk)=>{
	let op = document.createElement("div");
	for(let i=0;i<chunk.length;i++){
		if(Array.isArray(chunk[i])){
			let sp = chunk[i][0];
			let li = parse_val(sp);
			li.classList.add("output_line");
			op.appendChild(li);
		}else if(chunk[i].hasOwnProperty("error")){
			let erre = document.createElement("div");
			erre.classList.add("output_line");
			erre.classList.add("jaser-error");
			erre.innerHTML = "☢️ "+chunk[i].error;
			op.appendChild(erre);
		}
	}
	return op;
};
const parse_py_val = (type,v,inden=0,suff="",tn="div",fi=false,strngfy=false)=>{
	let indtt = "  ";
	let ti = indtt.repeat(inden);
	let firstInden = typeof fi=="boolean"&&fi?"":ti;
	let el = document.createElement(tn);
	if(type!=="list"&&type!=="dict"){
		el.innerHTML = v;
	}
	switch(type){
		case "none":
			el.classList.add("jaser-output-null");
			break;
		case "auto":
			el.classList.add("jaser-output-"+typeof v);
			if(strngfy){
				switch(typeof v){
					case "string":
						el.insertBefore(document.createTextNode("\""),el.childNodes[0]);
						el.appendChild(document.createTextNode("\""));
						break;
				}
			}
			break;
		case "function":
			el.classList.add("jaser-output-function");
			break;
		case "class":
			el.classList.add("jaser-output-class");
			break;
		case "list":
			el.classList.add("jaser-output-object");
			el.appendChild(document.createTextNode(firstInden+"["));
			for(let i=0;i<v.length;i++){
				let suffix = "";
				if(i<v.length-1){
					suffix = ",";
				}
				el.appendChild(parse_py_val(v[i].type,v[i].content,inden+1,suffix,"div",false,true));
			}
			el.appendChild(document.createTextNode(ti+"]"+suff));
			break;
		case "dict":
			el.classList.add("jaser-output-object");
			el.appendChild(document.createTextNode(firstInden+"{"));
			let obke = Object.keys(v);
			for(let i=0;i<obke.length;i++){
				let suffix = "";
				if(i<obke.length-1){
					suffix = ",";
				}
				let opel = document.createElement("div");
				opel.appendChild(document.createTextNode(ti+indtt+obke[i]+": "));
				opel.appendChild(parse_py_val(v[obke[i]].type,v[obke[i]].content,inden+1,suffix,"span",true,true));
				el.appendChild(opel);
			}
			el.appendChild(document.createTextNode(ti+"}"+suff));
	}
	if(type!=="list"&&type!=="dict"){
		el.insertBefore(document.createTextNode(firstInden),el.childNodes[0]);
		el.appendChild(document.createTextNode(suff));
	}
	return el;
};
const parse_py_chunk = (chunk,inden=0,suff="")=>{
	let op = document.createElement("div");
	for(let i=0;i<chunk.length;i++){
		if(chunk[i].hasOwnProperty("error")){
			let erre = document.createElement("div");
			erre.classList.add("output_line");
			erre.classList.add("jaser-error");
			erre.innerHTML = "☢️ "+chunk[i].error;
			op.appendChild(erre);
		}else{
			op.appendChild(parse_py_val(chunk[i].type,chunk[i].content,inden,suff));
		}
	}
	return op;
};
const _RUN = ()=>{
	let lang = lang_selector.value;
	if(lang=="js"){
		let CODE_STRING = "try{eval("+JSON.stringify(_code_editor.innerText)+");}catch(e){throw e;}";
		let CODE_LINES = _code_editor.innerText.split(EOL);
		let code = new vm.Script(CODE_STRING);
		let env_scope = Object.assign({},{
			JASER_CHUNK:[],
			console:{},
			alert,
			confirm,
			require
		});
		let cntxt = new vm.createContext(env_scope);
		for(let i=0;i<console_keys.length;i++){
			(new vm.Script("console."+console_keys[i]+"=(...args)=>{"+console_function+"};")).runInContext(cntxt);
		}
		(new vm.Script("console.error = (e)=>{JASER_CHUNK.push({error:e});}")).runInContext(cntxt);
		try{
			code.runInContext(cntxt);
		}catch(e){
			let m = e;
			// e instanceof Error||e instanceof DOMError||e instanceof EvalError||e instanceof MediaError||e instanceof RangeError||e instanceof ReferenceError||e instanceof SyntaxError||e instanceof TypeError||e instanceof URIError
			if(typeof e=="object"&&typeof e.name=="string"&&typeof e.message=="string"&&typeof e.stack=="string"){
				let ld = e.stack.split(EOL)[1].trim().match(/(.*):([0-9]+):([0-9]+)/);
				let line_number = parseInt(ld[2]);
				let character_number = parseInt(ld[3]);
				let actual_line = CODE_LINES[line_number-1].replace(/\t/g," ");
				m = e.name+":\n	"+e.message+"\n	"+_STRING("at_line")+": "+line_number+"\n	"+_STRING("at_character")+": "+character_number+"\n	"+actual_line+"\n	"+(" ".repeat(character_number-1))+"⬆️";
			}
			env_scope.JASER_CHUNK.push({error:m});
			// dialog.showErrorBox("Error",m.toString());
		}finally{
			if(Array.isArray(env_scope.JASER_CHUNK)&&env_scope.JASER_CHUNK.length>0){
				_console.appendChild(parse_chunk(env_scope.JASER_CHUNK));
				_console.scrollTop = _console.scrollHeight;
			}
		}
	}else if(lang=="py"){
		let JASER_CHUNK = [];
		temp.create("__main__.py","from jaser import print"+EOL+_code_editor.innerText);
		let main_shell = new PythonShell("__main__.py",{
			scriptPath:temp.dir("."),
			mode:"json"
		});
		main_shell.on("message",m=>{
			JASER_CHUNK.push(m);
		});
		main_shell.end(err=>{
			if(err){
				let es = String(err).split(EOL);
				es[0] = es[0]
					.replace(temp.dir("__main__.py"),"__main__.py")
					.replace(/line ([0-9]+)/gi,(f,linu)=>{
						return "line "+(parseInt(linu)-1);
					});
				JASER_CHUNK.push({error:es.join(EOL)});
			}
			if(JASER_CHUNK.length>0){
				_console.appendChild(parse_py_chunk(JASER_CHUNK));
				_console.scrollTop = _console.scrollHeight;
			}
			temp.delete("__main__.py");
		});
	}
};
const _CLEAR = ()=>{
	while(_console.hasChildNodes()){
		_console.removeChild(_console.lastChild);
	}
};
let tmp_dir = path.join(appdata_dir,"tmp");
if(!fs.existsSync(tmp_dir)){
	fs.mkdirSync(tmp_dir);
}else if(!fs.statSync(tmp_dir).isDirectory()){
	rm_rf(tmp_dir);
	fs.mkdirSync(tmp_dir);
}
const temp = {
	create:(name,content)=>fs.writeFileSync(path.join(tmp_dir,name),content),
	read:name=>fs.readFileSync(path.join(tmp_dir,name)),
	delete:name=>{
		let f_n = path.join(tmp_dir,name);
		if(fs.existsSync(f_n)){
			let f_s = fs.statSync(f_n);
			if(f_s.isDirectory()){
				rm_rf(f_n);
			}else if(f_s.isFile()){
				fs.unlinkSync(f_n);
			}
		}
	},
	dir:name=>path.join(tmp_dir,name),
	destroy:()=>rm_rf(tmp_dir)
};
temp.create("jaser.py",fs.readFileSync(path.join(__dirname,"py","jaser.py")));
app.setName(_STRING("title"));
vex.registerPlugin(require("vex-dialog"));
vex.defaultOptions.className = "vex-theme-os";
_runBtn.addEventListener("click",_RUN);
_clearBtn.addEventListener("click",_CLEAR);
_code_editor.addEventListener("keydown",(e)=>{
	if(e.keyCode==9){
		e.preventDefault();
		try{
			document.execCommand("insertHTML",false,"\t");
		}catch(e){
			let doc = _code_editor.ownerDocument.defaultView;
			let sel = doc.getSelection();
			let range = sel.getRangeAt(0);
			let tabNode = document.createTextNode("\t");
			range.insertNode(tabNode);
			range.setStartAfter(tabNode);
			range.setEndAfter(tabNode);
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}
});
let evts = ["load","keyup",/*"keydown",*/"mouseup"/*,"mousedown"*/];
for(let i=0;i<evts.length;i++){
	_code_editor.addEventListener(evts[i],()=>{
		let LINE_BREAK = ()=>{
			let lbde = document.createElement("div");
			lbde.appendChild(document.createTextNode(EOL));
			return lbde;
		};
		if(_code_editor.firstChild==null){
			_code_editor.appendChild(document.createElement("div"));
		}else if(_code_editor.firstChild.nodeType!==1||_code_editor.firstChild.tagName.toUpperCase()!=="DIV"){
			_code_editor.removeChild(_code_editor.firstChild);
			_code_editor.appendChild(document.createElement("div"));
			_code_editor.innerHTML = _code_editor.innerHTML;
		}else if(_code_editor.innerText.length>0){
			for(let i=0;i<_code_editor.childNodes.length;i++){
				let ce_ = _code_editor.childNodes[i];
				if(ce_.nodeType==1){
						if(ce_.tagName.toUpperCase()=="BR"){
							ce_.parentNode.insertBefore(LINE_BREAK(),ce_);
							ce_.parentNode.removeChild(ce_);
							continue;
						}
						if(ce_.childNodes.length==0){
							ce_.parentNode.insertBefore(LINE_BREAK(),ce_);
							ce_.parentNode.removeChild(ce_);
							//ce_.appendChild(document.createElement("br"));
						}else if(ce_.childNodes.length>1){
							let it = ce_.innerText.replace(/([\n|\r|\r\n])/g,EOL).split(EOL);
							for(let n=0;n<it.length;n++){
								let ne__ = document.createElement("div");
								ne__.innerText = it[n];
								if(ne__.innerText.length>0){
									ce_.parentNode.insertBefore(ne__,ce_);
								}
							}
							ce_.parentNode.removeChild(ce_);
						}
				}else{
					ce_.parentNode.removeChild(ce_);
				}
			}
		}
		let lln = _code_editor.innerText.replace(/([\n|\r|\r\n])/g,EOL).split(EOL).length-1;
		for(let n=0;n<_code_editor.childNodes.length;n++){
			let ln = n+1;
			let cicn = _code_editor.childNodes[n];
			let rs = lln.toString().length-ln.toString().length;
			if(rs>0){
				cicn.setAttribute("data-prefix"," ".repeat(rs));
			}else if(cicn.hasAttribute("data-prefix")){
				cicn.removeAttribute("data-prefix");
			}
		}
	});
}
_code_editor.addEventListener("paste",(e)=>{
	e.preventDefault();
	document.execCommand("insertHTML",false,e.clipboardData.getData("text/plain").replace(/^/gm,"<div>").replace(/$/gm,"</div>"));
});
let cm = new Menu();
cm.append(new MenuItem({
	role:"undo",
	label:_STRING("undo"),
	accelerator:"CmdOrCtrl+Z"
}));
cm.append(new MenuItem({
	role:"redo",
	label:_STRING("redo"),
	accelerator:"CmdOrCtrl+Y"
}));
cm.append(new MenuItem({
	type:"separator"
}));
cm.append(new MenuItem({
	role:"cut",
	label:_STRING("cut"),
	accelerator:"CmdOrCtrl+X"
}));
cm.append(new MenuItem({
	role:"copy",
	label:_STRING("copy"),
	accelerator:"CmdOrCtrl+C"
}));
cm.append(new MenuItem({
	role:"pasteandmatchstyle",
	label:_STRING("paste"),
	accelerator:"CmdOrCtrl+V"
}));
cm.append(new MenuItem({
	role:"delete",
	label:_STRING("delete"),
	accelerator:"Backspace"
}));
cm.append(new MenuItem({
	role:"selectall",
	label:_STRING("select_all"),
	accelerator:"CmdOrCtrl+A"
}));
cm.append(new MenuItem({
	type:"separator"
}));
cm.append(new MenuItem({
	label:_STRING("run"),
	click(){_RUN();},
	accelerator:"CmdOrCtrl+R"
}));
cm.append(new MenuItem({
	label:_STRING("clear"),
	click(){_CLEAR();},
	accelerator:"CmdOrCtrl+E"
}));
window.addEventListener("contextmenu",()=>{
	cm.popup(remote.getCurrentWindow());
},false);
let FileSave = {
	path:"",
	saved:()=>new Buffer(_code_editor.innerText).toString("base64")===FileSave.contents,
	contents:""
};
const isFineForExit = ()=>{
	return (FileSave.path.length==0&&_code_editor.innerText.length==0)||(
		FileSave.path.length>0&&
		FileSave.saved()
	);
};
const HandleExit = callback=>{
	// 0 - Cancel
	// 1 - No
	// 2 - Yes
	if(typeof callback!=="function"){
		callback = ()=>{};
	}
	if(isFineForExit()){
		callback();
		return 2;
	}else{
		let wishToSave = dialog.showMessageBox(remote.getCurrentWindow(),{
			type:"question",
			title:_STRING("title")+" - "+_STRING("alert"),
			message:_STRING("before_exit"),
			buttons:[_STRING("cancel"),_STRING("no"),_STRING("yes")]
		});
		if(wishToSave===2){
			let s = _SAVE();
			if(s){
				callback();
			}
		}else if(wishToSave===1){
			callback();
		}
		return wishToSave;
	}
	return 0;
};
const _NEW = ()=>HandleExit(()=>{
	_code_editor.innerHTML = "";
	FileSave.path="";
	FileSave.contents="";
});
const _OPEN = ()=>HandleExit(()=>{
	let od = dialog.showOpenDialog(remote.getCurrentWindow(),{
		title:_STRING("title")+" - "+_STRING("open_file"),
		defaultPath:HOME,
		filters:[
			{
				name:"Javascript (.js)",
				extensions:["js"]
			}
		],
		properties:["openFile"]
	});
	if(od.length>0){od=od[0];}else{od="";}
	if(typeof od=="string"&&od.length>0&&fs.existsSync(od)){
		while(_code_editor.firstChild!==null){
			_code_editor.removeChild(_code_editor.firstChild);
		}
		let foc = fs.readFileSync(od);
		let fls = foc.toString().split(EOL);
		for(let i=0;i<fls.length;i++){
			let le = document.createElement("div");
			le.innerText = fls[i];
			_code_editor.appendChild(le);
		}
		FileSave.path = od;
		FileSave.contents = foc.toString("base64");
	}
});
const _SAVE = (notCopy=true)=>{
	let sd;
	let SaveIsAGo = false;
	if(FileSave.path.length>0&&notCopy==true){
		if(FileSave.saved()){
			return true;
		}
		sd = FileSave.path;
		SaveIsAGo = true;
	}else{
		sd = dialog.showSaveDialog(remote.getCurrentWindow(),{
			title:_STRING("title")+" - "+_STRING("save_file"),
			defaultPath:path.join(HOME,"file."+lang_selector.value)
		});
		if(typeof sd=="string"&&sd.length>0){
			SaveIsAGo = true;
		}
	}
	if(SaveIsAGo){
		let ctbs = _code_editor.innerText;
		fs.writeFileSync(sd,ctbs);
		if(notCopy==true){
			FileSave.path = sd;
			FileSave.contents = new Buffer(ctbs).toString("base64");
		}
	}
	return SaveIsAGo;
};
const _SAVE_AS = ()=>_SAVE(false);
const _CREATE_GIST = ()=>{
	vex.dialog.prompt({
		message:_STRING("describe_the_gist"),
		placeholder:_STRING("made_with_jaser"),
		callback(gist_description){
			if(typeof gist_description!=="string"){
				return;
			}
			gist_description = typeof gist_description=="string"?gist_description:"";
			vex.dialog.prompt({
				message:_STRING("name_the_file_for_the_gist"),
				placeholder:FileSave.path.length>0?FileSave.path:"file."+lang_selector.value,
				callback(gist_file_name){
					if(typeof gist_file_name!=="string"){
						return;
					}
					gist_file_name = typeof gist_file_name=="string"&&gist_file_name.length>0&&gist_file_name.replace(/\./g,"").length>0?gist_file_name:(FileSave.path.length>0?FileSave.path:"file.js");
					vex.dialog.confirm({
						message:_STRING("do_you_want_this_gist_to_be_public"),
						callback(gist_is_public){
							let gist_dits = {
								description:gist_description,
								files:{},
								public:gist_is_public
							};
							gist_dits.files[gist_file_name]={
								content:(_code_editor.innerText)//new Buffer
							};
							gist_dits = JSON.stringify(gist_dits);
							vex.dialog.confirm({
								message:_STRING("is_this_fine")+"\n"+_STRING("description")+": "+gist_description+"\n"+_STRING("file_name")+": "+gist_file_name+"\n"+_STRING("public")+": "+_STRING(String(gist_is_public)),
								callback(gist_is_fine){
									if(gist_is_fine){
										const req = https.request({
											hostname:"api.github.com",
											path:"/gists",
											method:"POST",
											headers:{
												"Content-Type":"multipart/form-data",
												"Content-Length":Buffer.byteLength(gist_dits),
												"User-Agent":USER_AGENT,
												"Accept":"application/vnd.github.v3+json"
											}
										},(res)=>{
											let body = "";
											res.on("data",chunk=>{
												body+=chunk;
											});
											res.on("end",()=>{
												if(res.statusCode==201){
													let _gist_data = JSON.parse(body);
													cookies.push("gists",{
														id:_gist_data.id,
														desc:gist_description,
														lang:_gist_data.files[gist_file_name].language,
														file:gist_file_name
													});
													c_gist_url = _gist_data.html_url;
													vex.dialog.alert({
														unsafeMessage:_STRING("gist_was_created")+"<br/>"+
																		_STRING("url")+":<br/><span onclick='shell.openExternal(c_gist_url)' class='link'>"+_gist_data.html_url+"</span>"+
																		"<p></p>"+
																		_STRING("id")+": <br/>"+_gist_data.id+
																		"<p></p>"
													});
												}else{
													vex.dialog.alert({
														message:_STRING("an_error_occurred")
													});
												}
											});
										});
										req.on("error",(e)=>{
											console.error(e);
										});
										req.write(gist_dits);
										req.end();
									}
								}
							});
						}
					});
				}
			});
		}
	});
};
const _LOAD_GIST = ()=>HandleExit(()=>{
	vex.dialog.prompt({
		message:_STRING("request_gist_id"),
		callback(iou){
			if(typeof iou!=="string"){
				return;
			}
			let gi = iou.split("\\").join("/").split("/").filter(v=>v.length>0).pop();
			if(gi.length>0){
				const glr = https.request({
					hostname:"api.github.com",
					method:"GET",
					path:"/gists/"+gi,
					headers:{
						"User-Agent":USER_AGENT
					}
				},res=>{
					let body = "";
					res.on("data",chunk=>{
						body += chunk;
					});
					res.on("end",()=>{
						if(res.statusCode==200){
							let gd = JSON.parse(body);
							c_gist = gd;
							let jsf = [];
							for(let p in gd.files){
								if(gd.files[p].language.toUpperCase()=="JAVASCRIPT"||gd.files[p].language.toUpperCase()=="PYTHON"){
									jsf.push(p);
								}
							}
							if(jsf.length==0){
								vex.dialog.alert({
									message:_STRING("gist_no_files")
								});
							}else if(jsf.length==1){
								while(_code_editor.firstChild!==null){
									_code_editor.removeChild(_code_editor.firstChild);
								}
								let gcl = gd.files[jsf[0]].content.split(EOL);
								for(let i=0;i<gcl.length;i++){
									let le = document.createElement("div");
									le.innerText = gcl[i];
									_code_editor.appendChild(le);
								}
							}else{
								let t_f_c_ = _STRING("gist_file_choose")+" <br/><ol>";
								c_gist_files = jsf;
								for(let i=0;i<jsf.length;i++){
									t_f_c_ += "<li style='cursor:pointer;' onclick='open_gist_file("+i+")'>"+jsf[i]+"</li>";
									if(i<jsf.length-1){
										t_f_c_ += "<hr/>";
									}
								}
								t_f_c_ += "</ol>";
								vex.dialog.alert({
									unsafeMessage:t_f_c_
								});
							}
						}else{
							(res.statusCode);
							console.log(body);
						}
					});
				});
				glr.on("error",(e)=>{
					console.error(e);
				});
				glr.end();
			}
		}
	});
});
const COMMANDS = {
	RUN			:	_RUN,
	CLEAR		:	_CLEAR,
	NEW			:	_NEW,
	OPEN		:	_OPEN,
	SAVE		:	_SAVE,
	SAVE_AS		:	_SAVE_AS,
	HANDLE_EXIT	:	HandleExit,
	CLOSE		:	()=>HandleExit(()=>CommandOut("EXIT")),
	CREATE_GIST	:	_CREATE_GIST,
	LOAD_GIST	:	_LOAD_GIST
};
const CommandIn = (cmnd)=>{
	if(COMMANDS.hasOwnProperty(cmnd.toUpperCase())){
		return COMMANDS[cmnd.toUpperCase()].apply({},[]);
	}
};
const CommandOut = (cmnd)=>{
	return ipc.sendSync("Command",cmnd)
};
ipc.on("Command",(event,cmnd)=>{
	event.returnValue = String(CommandIn(cmnd));
});
window.addEventListener("beforeunload",e=>{
	e.returnValue = false;
	setTimeout(()=>{
		HandleExit(()=>{temp.destroy();CommandOut("EXIT");});
	});
});
let stbc = [...document.getElementsByClassName("interface_string")];
for(let i=0;i<stbc.length;i++){
	if(stbc[i].hasAttribute("string-name")){
		stbc[i].innerHTML = _STRING(stbc[i].getAttribute("string-name"));
	}
}
let etbtokp = ["keydown","keyup","mousedown","mouseup"];
for(let i=0;i<etbtokp.length;i++){
	_code_editor.addEventListener(etbtokp[i],()=>{
		if(!FileSave.saved()){
			if(FileSave.path.length>0){
				document.title = "• "+path.parse(FileSave.path).base+" - "+_STRING("title");
			}else{
				document.title = "• - "+_STRING("title");
			}
		}else{
			if(FileSave.path.length>0){
				document.title = path.parse(FileSave.path).base+" - "+_STRING("title");
			}else{
				document.title = _STRING("title");
			}
		}
	});
}

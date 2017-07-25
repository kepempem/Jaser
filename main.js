const electron = require("electron");
const {app,BrowserWindow,Menu} = electron;
const ipc = electron.ipcMain;
const path = require("path");
const cookies = require("./app/js/cookies");
const url = require("url");
const translator = (new (require("./app/js/translator"))(require("./app/strings.json")));
const lang = app.getLocale();
const _STRING = w=>translator.translate(w,lang);
let MainWindow;
const CommandOut = (m)=>{
	return MainWindow.webContents.send("Command",m);
};
const AppMenu = Menu.buildFromTemplate([
	{
		label:_STRING("title"),
		submenu:[
			{
				label:_STRING("run"),
				click(){
					CommandOut("RUN");
				},
				accelerator:"CmdOrCtrl+R"
			},
			{
				label:_STRING("clear"),
				click(){
					CommandOut("CLEAR");
				},
				accelerator:"CmdOrCtrl+E"
			},
			{
				label:_STRING("exit"),
				click(){
					CommandOut("CLOSE");
				},
				accelerator:"CmdOrCtrl+W"
			}
		]
	},
	{
		label:_STRING("File"),
		submenu:[
			{
				label:_STRING("new"),
				click(){
					CommandOut("NEW");
				},
				accelerator:"CmdOrCtrl+N"
			},
			{
				label:_STRING("open"),
				click(){
					CommandOut("OPEN");
				},
				accelerator:"CmdOrCtrl+O"
			},
			{
				label:_STRING("save"),
				click(){
					CommandOut("SAVE");
				},
				accelerator:"CmdOrCtrl+S"
			},
			{
				label:_STRING("save_as"),
				click(){
					CommandOut("SAVE_AS");
				},
				accelerator:"Shift+CmdOrCtrl+S"
			}
		]
	},
	{
		label:_STRING("edit"),
		submenu:[
			{
				role:"undo",
				label:_STRING("undo"),
				accelerator:"CmdOrCtrl+Z"
			},
			{
				role:"redo",
				label:_STRING("redo"),
				accelerator:"CmdOrCtrl+Y"
			},
			{
				type:"separator"
			},
			{
				role:"cut",
				label:_STRING("cut"),
				accelerator:"CmdOrCtrl+X"
			},
			{
				role:"copy",
				label:_STRING("copy"),
				accelerator:"CmdOrCtrl+C"
			},
			{
				role:"pasteandmatchstyle",
				label:_STRING("paste"),
				accelerator:"CmdOrCtrl+V"
			},
			{
				role:"delete",
				label:_STRING("delete"),
				accelerator:"Backspace"
			},
			{
				role:"selectall",
				label:_STRING("select_all"),
				accelerator:"CmdOrCtrl+A"
			}
		]
	},
	{
		label:_STRING("gist"),
		submenu:[
			{
				label:_STRING("create"),
				click(){
					CommandOut("CREATE_GIST");
				}
			},
			{
				label:_STRING("load"),
				click(){
					CommandOut("LOAD_GIST");
				}
			},
			{
				label:_STRING("my_gists"),
				click(){
					new BrowserWindow({
						width:500,
						height:500,
						icon:path.join(__dirname,"Jaser.png")
					}).loadURL(url.format({
						pathname:path.join(__dirname,"app","gists.html"),
						protocol:"file:",
						slashes:true
					}));
				}
			}
		]
	},
	{
		label:_STRING("view"),
		submenu:[
			{
				role:"toggledevtools",
				label:_STRING("toggle_developer_tools")
			}
		]
	}
]);
const Init = (te=true)=>{
	Menu.setApplicationMenu(AppMenu);
	MainWindow = new BrowserWindow({
		width:1600,
		height:800,
		icon:path.join(__dirname,"Jaser.png")
	});
	MainWindow.loadURL(url.format({
		pathname:path.join(__dirname,"app","index.html"),
		protocol:"file:",
		slashes:true
	}));
};
app.on("ready",Init);
app.on("window-all-closed",()=>{
	if(process.platform!=="darwin"){
		CommandIn("EXIT");
	}
});
app.on("activate",()=>{
	if(MainWindow===null){
		Init();
	}
});
const _EXIT = ()=>{
	try{
		MainWindow.close();
		app.quit();
		app.exit();
		MainWindow = null;
	}catch(e){
		console.log(e);
	}
};
const COMMANDS = {
	EXIT:_EXIT
};
const CommandIn = (cmnd)=>{
	if(COMMANDS.hasOwnProperty(cmnd.toUpperCase())){
		return COMMANDS[cmnd.toUpperCase()].apply({},[]);
	}
};
ipc.on("Command",(event,cmnd)=>{
	event.returnValue = String(CommandIn(cmnd));
})

const path = require("path");
const fs = require("fs");
const appdata_dir = (()=>{
	let app_data;
	try{
		switch(process.platform){
			case "win32":
			case "win64":
				app_data = process.env.LOCALAPPDATA||process.env.APPDATA;
				if(!app_data){
					return "";
				}
			break;
			case "darwin":
				app_data = process.env.HOME;
				if(!app_data){
					return "";
				}
				app_data = path.join(app_data,"Library","Application Support");
			break;
			case "linux":
				app_data = process.env.HOME;
				if(!app_data){
					return "";
				}
				app_data = path.join(app_data,".config");
			break;
			default:
				return "";
		}
	}catch(e){
		return "";
	}finally{
		return path.join(app_data,"JASER_DATA");
	}
})();
if(appdata_dir==""){}else{
	if(!fs.existsSync(appdata_dir)){
		fs.mkdirSync(appdata_dir);
	}else if(!fs.statSync(appdata_dir).isDirectory()){
		rm_rf(appdata_dir);
		fs.mkdirSync(appdata_dir);
	}
	let data_file_dir = path.join(appdata_dir,"data.json");
	if(!fs.existsSync(data_file_dir)){
		fs.writeFileSync(data_file_dir,JSON.stringify({}));
	}
}
module.exports = {
	dir:path.join(appdata_dir,"data.json"),
	state:()=>JSON.parse(fs.readFileSync(cookies.dir)),
	set:(name,value)=>{
		let s1 = cookies.state();
		s1[name] = value;
		fs.writeFileSync(cookies.dir,JSON.stringify(s1));
		return cookies;
	},
	get:name=>cookies.state()[name],
	del:name=>{
		let s2 = cookies.state();
		if(s2.hasOwnProperty(name)){
			delete s2[name];
			fs.writeFileSync(cookies.dir,JSON.stringify(s2));
		}
		return cookies;
	},
	def:(name,value)=>{
		if(!cookies.state().hasOwnProperty(name)){
			cookies.set(name,value);
		}
		return cookies;
	},
	push:(name,val)=>{
		let av = cookies.get(name);
		if(Array.isArray(av)){
			av.push(val);
			cookies.set(name,av);
		}
		return this;
	},
	AppData:appdata_dir
};

const packager = require("electron-packager");
const path = require("path");
const LocalPath = (...args)=>path.join(__dirname,"..",...args);
let options = {
	dir:LocalPath(),
	asar:true,
	name:"Jaser",
	out:LocalPath("builds",require(LocalPath("package.json")).version),
	arch:"all",
	platform:"linux"
};
packager(options);

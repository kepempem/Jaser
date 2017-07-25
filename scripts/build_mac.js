const packager = require("electron-packager");
const path = require("path");
const LocalPath = (...args)=>path.join(__dirname,"..",...args);
let options = {
	dir:LocalPath(),
	asar:true,
	icon:LocalPath("Jaser.icns"),
	name:"Jaser",
	out:LocalPath("builds",require(LocalPath("package.json")).version),
	arch:"all",
	platform:"darwin"
};
packager(options);

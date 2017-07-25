module.exports = class{
	constructor(config){
		this.config = config;
	}
	translate(v,l){
		for(let i=0;i<this.config.strings.length;i++){
			if(this.config.strings[i].name.toUpperCase()==v.toUpperCase()){
				if(this.config.strings[i].strings.hasOwnProperty(l.toLowerCase())){
					return this.config.strings[i].strings[l.toLowerCase()];
				}else if(this.config.strings[i].strings.hasOwnProperty("default")){
					return this.config.strings[i].strings.default;
				}else{
					return v;
				}
			}
		}
	}
};

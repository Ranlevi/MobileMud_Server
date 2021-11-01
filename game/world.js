const Classes=              require('./classes');
const fs=                   require('fs');

class World {
  //Holds all entities and user instances, accesible by ID (String)
  //Only a single instance of it exists.
  constructor(){
    this.world = new Map(); //id: item instance.
    this.users = new Map();
    this.types_db = this.load_types_from_jsons();
  }

  get_instance(instance_id){
    //returns undefined if no entity exists
    let instance;
    instance = this.world.get(instance_id);

    if (instance===undefined){
      instance = this.users.get(instance_id);
    }

    return instance;
  }

  add_to_world(instance){
    if (instance instanceof Classes.User){
      this.users.set(instance.id, instance);
    } else {      
      this.world.set(instance.id, instance);    
    }    
  }  

  remove_from_world(item_id){  
    if (this.world.has(item_id)){
      this.world.delete(item_id);  
    } else if (this.users.has(item_id)){
      this.users.delete(item_id);
    }    
  }

  get_user_id_by_username(username){    
    let user_id = null;
    for (let inst of this.users.values()){      
      if (inst.props["name"]===username){
        user_id = inst.id;
      }
    }
    return user_id;
  }

  load_types_from_jsons(){    
    if (fs.existsSync(__dirname + '/Types/npc_human.json')){
      let data = JSON.parse(fs.readFileSync(__dirname + '/Types/npc_human.json'));
      let type = data.type;
      let obj = {};
      obj[type] = data;   
      return obj;
    }
  }
}
const FIRST_ROOM_ID= '0';
const world=         new World();

//Datebase of registered users. Loaded on game initalization.
let users_db=        null;

exports.world=          world;
exports.users_db=       users_db;
exports.FIRST_ROOM_ID = FIRST_ROOM_ID;
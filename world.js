const Classes= require('./classes');
const fs=      require('fs');

class World {
  //Holds all entities and user instances, accesible by ID (String)
  //Only a single instance of it exists.
  constructor(){
    this.world = new Map(); //id: item instance.
    this.users = new Map();    
    this.users_db = {
      users: {}, //username: {id:, props:}
      items: {}  //id: props
    },
    this.entities_db = null;
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
    
    for (let inst of this.users.values()){      
      if (inst.props.name===username){
        return inst.id;        
      }
    }

    //No user with given username was found.
    return null;
  }  
  
}
const FIRST_ROOM_ID= 'r000000000000000';
const world=         new World();

exports.world=          world;
exports.FIRST_ROOM_ID = FIRST_ROOM_ID;
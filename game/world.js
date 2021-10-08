const Classes = require('./classes');

class World {
  //World state.
  constructor(){
    this.world = new Map(); //id: item instance.
  }

  get_instance(instance_id){
    return this.world.get(instance_id);
  }

  add_to_world(instance){
    this.world.set(instance.id, instance);    
  }  

  remove_from_world(item_id){    
    this.world.delete(item_id);
  }
}
const FIRST_ROOM_ID        = '0';
const world=      new World();
let users_db=     new Map(); //username: {saved_data} 

exports.world=    world;
exports.users_db= users_db;
exports.FIRST_ROOM_ID = FIRST_ROOM_ID;
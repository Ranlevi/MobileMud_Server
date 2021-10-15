const Classes=              require('./classes');

class World {
  //World state.
  constructor(){
    this.world = new Map(); //id: item instance.
    this.users = new Map(); //id: item instance
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
}
const FIRST_ROOM_ID        = '0';
const world=      new World();
let users_db=     new Map(); //username: {saved_data} 

exports.world=    world;
exports.users_db= users_db;
exports.FIRST_ROOM_ID = FIRST_ROOM_ID;
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

const world = new World();
exports.world = world;
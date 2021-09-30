const Classes = require('./classes');

class World {
  //World state.
  constructor(){
    this.world = new Map(); //id: entity instance.
  }

  get_instance(instance_id){
    return this.world.get(instance_id);
  }

  add_to_world(instance){
    this.world.set(instance.id, instance);
  }

  add_entity_to_room(entity_id, room_id){ //TODO: should it be here, not in room?
    let entity = this.get_instance(entity_id);
    let room   = this.get_instance(room_id);
    room.add_entity(entity_id);
    entity.room_id = room_id;
  }

  add_room(current_room_id, direction){
    let current_room = world.get_instance(current_room_id);

    let new_room = new Classes.Room(
      'A Room',
      'This is an empty, generic room.'
    )
    this.add_to_world(new_room);
    current_room.add_exit(direction, new_room.id);
    new_room.add_exit(get_opposite_direction(direction), current_room_id);
    return new_room.id;
  }

  remove_item_from_world(item_id){
    let item = this.world.get(item_id);
    let room = world.get_instance(item.room_id);
    room.remove_entity(item_id);
    this.world.delete(item_id);
  }
}

const world = new World();
Object.freeze(world);

exports.world = world;
const World=      require('./world');

class Inventory {
  constructor(num_of_slots, enable_wear=true, enable_hold=true){

    this.enable_wear= enable_wear;
    this.wear = { //position:id
      'Head':       null,
      'Torso':      null,
      'Legs':       null,
      'Left Foot':  null,
      'Right Foot': null
    }

    this.enable_hold = enable_hold;
    this.hold = { //position:id
      'Right Hand': null,
      'Left Hand':  null
    }

    this.slots = new Set();//ids
    this.num_of_slots = num_of_slots;
  }  
  
  wear(position, element_id){
    
    // let element_id = this.wear[position];
    // if (element_id===undefined){
    //   //position does not exist
    // }
  }

  get(entity_id){
    //If a slot is available, place the entity in it.
    let success = false;
    
    if (this.slots.size<this.num_of_slots){
      this.slots.add(entity_id);
      success = true;
    }

    return success;
  }

  search_target_in_slots(target){    
    for (const entity_id of this.slots){
      let entity = World.world.get_instance(entity_id);
      if ((entity.name!==null && entity.name.toLowerCase()===target) ||
           entity.type.toLowerCase()===target){
        return entity_id;        
      }    
    }
    return null;
  }

  drop(entity_id, room_id){
    //We assume the entity is in the slots.
    //we drop it to the floor.
    let success = false;
    this.slots.delete(entity_id);
    let room = World.world.get_instance(room_id);
    room.add_entity(entity_id);    
    return success;
  }

}

exports.Inventory = Inventory;
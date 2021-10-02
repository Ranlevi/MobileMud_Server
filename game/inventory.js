const World=      require('./world');

class Inventory {
  constructor(num_of_slots, enable_wear_hold=true){

    this.enable_wear_hold= enable_wear_hold;
    this.wear_hold = { //position:id
      'Head':       null,
      'Torso':      null,
      'Legs':       null,
      'Feet':       null,
      'Right Hand': null,
      'Left Hand':  null
    }
    
    this.slots = new Set();//ids
    this.num_of_slots = num_of_slots;
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

  search_target_in_wear_hold(target){
    
    for (const entity_id of Object.values(this.wear_hold)){
      if (entity_id!==null){
        let entity= World.world.get_instance(entity_id);        
        if ((entity.name!==null && entity.name.toLowerCase()===target) ||
           entity.type.toLowerCase()===target){
             //Target found.
             return entity_id;
        }
      }      
    }
    //Target not found
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

  wear_or_hold(entity_id){
    //We assume the entity is in a slot.
    //Remove it, wear or hold it if free.
    let entity = World.world.get_instance(entity_id);
    
    switch(entity.wear_hold_slot){
      case 'Head':
      case 'Torso':
      case 'Legs':
      case 'Feet':
        if (this.wear_hold[entity.wear_hold_slot]!==null){
          return false;
        } else {
          this.wear_hold[entity.wear_hold_slot]=entity_id;
        }
        break;

      case 'Hands':
        if (this.wear_hold['Left Hand']===null){
          this.wear_hold['Left Hand']= entity_id;
        } else if (this.wear_hold['Right Hand']===null){
          this.wear_hold['Right Hand']= entity_id;
        } else {
          return false;
        }
        break;
    }

    //hold/wear was succesful, remove from slots.
    this.slots.delete(entity_id);
    return true;
  }

  remove(entity_id){
    //We assume entity is worn or held.
    //We check if we have a slot available.    
    if (this.slots.size===this.num_of_slots){
      return false;
    }
    
    //There is an available slot.
    for (const [position, id] of Object.entries(this.wear_hold)){
      if (id===entity_id){
        //Found the entity
        this.wear_hold[position]= null;
        this.slots.add(entity_id);
        return true;
      }
    }    
  }

}

exports.Inventory = Inventory;
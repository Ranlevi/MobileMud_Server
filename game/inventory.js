const World=      require('./world');
const Classes=    require('./classes');

class Inventory {
  constructor(owner_id, num_of_slots, props=null, enable_wear_hold=true){

    //Default props
    this.owner_id= owner_id;
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
    this.coins = 0;

    if (props!==null){

      //Override props
      if (props.num_of_slots!==undefined) {this.num_of_slots= props.num_of_slots};
      if (props.coins!==undefined) {this.coins= props.coins};

      if (props.wear_hold!==undefined){
        for (const [position, data] of Object.entries(props.wear_hold)){
          if (data!==null){
            //Assign the container id to the inventory's owner ID
            data.props.container_id = this.owner_id;
            let entity_id = Classes.create_entity(props.type, data.props);
            this.wear_hold[position] = entity_id;
          }
        }  
      }
  }    
  }

  remove_entity(entity_id){
    //Assumes the entity is in the inventory.
    //find it and remove it.
    for (const [position, id] of Object.entries(this.wear_hold)){
      if (id===entity_id){
        this.wear_hold[position]= null;
        return;
      }
    }
    
    if (this.slots.has(entity_id)){
      this.slots.delete(entity_id);
      return;
    }

    //If we're here, the entity is not in the inventory! 
    console.log(`Inventory.remove_entity: Error - entity not found. OwneID: ${this.owner_id}`);
  }

  get_all_entities_ids(){
    let arr = [];
    for (const id of Object.values(this.wear_hold)){
      if (id!==null) arr.push(id);
    }

    for (const id of this.slots.values()){
      arr.push(id);
    }

    return arr;
  }

  get_all_slot_items(){

    let arr = [];
    for (const id of this.slots.values()){
      arr.push(id);
    }

    return arr;    
  }

  get_all_wear_hold_items(){
    let arr = [];
    for (const id of Object.values(this.wear_hold)){
      if (id!==null) arr.push(id);
    }   

    return arr;
  }

  add_to_slots(entity_id){
    //If a slot is available, place the entity in it.
    let success = false;    
    if (this.slots.size<this.num_of_slots){
      this.slots.add(entity_id);
      success = true;
    }

    return success;
  }

  remove_from_slots(entity_id){
    //We assume the entity is in the slots.
    this.slots.delete(entity_id);
  }
  
  get_data_object(){
    let obj = {
      num_of_slots: this.num_of_slots,
      coins:        this.coins,
      wear_hold:    {},
      slots:        []
    };
    

    if (this.enable_wear_hold){
      
      for (const [position, id] of Object.entries(this.wear_hold)){
         if (id!==null){           
          let entity = World.world.get_instance(id);
          obj.wear_hold[position]= {
            type:     entity.type,
            props:    entity.get_data_obj()
          }
        }
      }
    }
    
    for (const id of this.slots){
      let entity = World.world.get_instance(id);
      obj.slots.push(entity.get_data_obj());
    }

    return obj;
  }

  update_from_obj(obj){

    for (const [position, data] of Object.entries(obj.wear_hold)){
      if (data!==null){
        data.instance_properties.container_id = this.owner_id;
        let entity;
        
        switch(data.type){
          case('Screwdriver'):            
            entity = new Classes.Screwdriver(data.instance_properties);
            break;
        }

        World.world.add_to_world(entity);
        this.wear_hold[position] = entity.id;
      }
    }

    for (const data of obj.slots){
      
      let entity;
      data.instance_properties.container_id = this.owner_id;

      switch(data.type){
        case('Screwdriver'):
          entity = new Classes.Screwdriver(data.instance_properties);
          break;
        case('Candy'):
          entity = new Classes.Candy(data.instance_properties);
          break;
      }
      World.world.add_to_world(entity);
      this.slots.add(entity.id);
    }

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

  move_entity_from_slots_to_wear_hold(entity_id){
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

  move_entity_from_wear_hold_to_slots(entity_id){
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

  generate_inv_message(){
    
    let msg = `Your inventory:  `;
    for (const [position, id] of Object.entries(this.wear_hold)){
      if (id===null){
        msg += `${position}: Nothing.  `;
      } else {
        let entity = World.world.get_instance(id);
        msg += `${position}: [${entity.type_string}]({{type:${entity.type}, id:${entity.id}})})  `;
      }
    }
        
    msg += `In slots:  `;
    if (this.slots.size===0){
      msg += `Nothing.`
    } else {
      for (const id of this.slots){
        let entity = World.world.get_instance(id);
        msg += `[${entity.type_string}]({{type:${entity.type}, id:${entity.id}})})  `;
      }
    }   

    msg += `You have ${this.coins} coins.`;
    
    return msg;
  }

  add_coins(coins){
    this.coins += coins;
  }

  remove_coins(coins){
    let balance = this.coins - coins;
    if (balance < 0){
      return false;
    } else {
      this.coins = this.coins - coins;
      return true;
    }
  }

  get_balance(){
    return this.coins;
  }

}

exports.Inventory = Inventory;
const Utils=      require('./utils');
const World=      require('./world');

class Room {
  constructor(props=null, id=null){
      
      this.id= (id===null)? Utils.id_generator.get_new_id() : id;
    
      //Default props
      this.props = {
        "name": "Room",
        "type": "Room",
        "description": "A simple, 3m by 3m room.",
        "entities": new Set(),
        "exits": {
          "north": null, //direction: id
            "south": null,
            "west":  null,
            "east":  null,
            "up":    null,
            "down":  null
        },
        "lighting": "white", //CSS colors
      }

      // Add To world.
      World.world.add_to_world(this);

      if (props!==null) this.update_props(props);    
  }  
  
  update_props(props){
    for (const [key, value] of Object.entries(props)){

      switch(key){
        case "entities":
          for (const id of value){
            this.add_entity(id);            
          }
          break;

        default:
          this.props[key]= value;
      }

      
    }
  }
  
  add_entity(entity_id){
    this.props["entities"].add(entity_id);
  }
  
  remove_entity(entity_id){
    this.props["entities"].delete(entity_id);
  }
  
  get_entities_ids(){
    //entities is a Set(), so we convert it to an array.
    return Array.from(this.props["entities"]);
  }  

  get_users(){
    let id_arr = [];
    for (const id of this.props["entities"]){
      let entity = World.world.get_instance(id);
      if (entity instanceof User){
        id_arr.push(id);
      }      
    }
    return id_arr;
  }
  
  get_look_string(){
        
    let msg = `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}, `;
    msg += `lighting: ${this.props["lighting"]})**  ${this.props["description"]}  `;
    msg += `Exits:  `;

    for (const [direction, next_room_id] of Object.entries(this.props["exits"])){
      if (next_room_id!==null){
          msg += `[${direction}]({type:"Command"}) `
      }
    }

    msg += '  '; //new paragraph

    if (this.props["entities"].size===1){    
      //Only the player is in the room.
      msg += 'The room is empty.';
    } else {
      msg += 'In the room:  ';

      for (const entity_id of this.props["entities"]){
        let entity = World.world.get_instance(entity_id);
        msg += `${entity.get_short_look_string()}  `;
      }
    }

    return msg;
  }

}

class User {
  constructor(props, ws_client, id=null){

    //Default Constants
    this.BASE_HEALTH= 100;
    this.BASE_DAMAGE= 1;

    this.id= (id===null)? Utils.id_generator.get_new_id() : id;
    this.ws_client=     ws_client;

    //Default values for a new player.
    this.props = {
      "name": "A User",
      "type": "User",
      "description": "It's you, bozo!",
      "password": null,
      "container_id": "0",
      "health": this.BASE_HEALTH,
      "body_slots": {
        'Head':       null,
        'Torso':      null,
        'Legs':       null,
        'Feet':       null,
        'Right Hand': null,
        'Left Hand':  null
      },
      "misc_slots": new Set(),
      "misc_slots_size_limit": 10,
      "is_fighting_with": null,
    }

    // Add To world.
    World.world.add_to_world(this);

    this.update_props(props);
  }

  update_props(props){
    for (const [key, value] of Object.entries(props)){

      switch(key){
        case("container_id"):
          this.move_to_room(value);
          break;

        default:
          this.props[key]= value;
      }      
    }
  }

  reset_health(){
    this.props["health"] = this.BASE_HEALTH;
  }

  stop_battle(){
    this.props["is_fighting_with"] = null;
  }

  calc_damage(){
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){
    this.props["health"] -= damage_from_opponent;
    if (this.props["health"]<0){
      this.props["health"] = 0;
    }
  }

  move_to_room(new_room_id){
    Utils.move_to_room(this.id, this.props["container_id"], new_room_id);
    this.look_cmd();
  }

  set_container_id(new_container_id){
    this.props["container_id"] = new_container_id;
  }

  move_to_direction(direction){
    let current_room = World.world.get_instance(this.props["container_id"]);
    let next_room_id = current_room.props["exits"][direction];
  
    if (next_room_id===null){
      //Exit does not exist
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
        `There's no exit to ${direction}.`);      
      return;
    }
  
    //Exit exists.
    Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
    `You travel ${direction}.`);

    this.move_to_room(next_room_id);
    
  }

  look_cmd(target=null){
    //target can be an id, a type or a name.

    if (target===null){
      //Look at the room the user is in.
      let room = World.world.get_instance(this.props["container_id"]);  
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, room.get_look_string());        
      return;
    }

    //Target is not null.
    //Search order: body_slots, misc_slots, room.
    let id_arr = this.get_body_slots_ids();
    id_arr = id_arr.concat(this.get_misc_slots_ids());

    let room = World.world.get_instance(this.props["container_id"]);
    id_arr = id_arr.concat(room.get_entities_ids());

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
      `There is no ${target} around.`);
    } else {
      let entity = World.world.get_instance(entity_id);
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, entity.get_look_string());
    }       
  }

  get_cmd(target=null){
    //Pick an item from the room, place in a misc_slot.
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to get?`);        
      return;
    }

    //Target is not null
    let room = World.world.get_instance(this.props["container_id"]);
    let id_arr = room.get_entities_ids();

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `There's no ${target} around.`);        
      return;
    }

    //Target found.
    //Check is misc_slots are full.
    if (this.props["misc_slots_size_limit"]===this.props["misc_slots"].size){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You are carrying too many things already.`);
      return;
    }

    //The user can carry the item.
    room.remove_entity(entity_id);
    this.props["misc_slots"].add(entity_id);
    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You pick it up.`);
  }

  inv_cmd(){
    let msg = `You are wearing:  `;

    let is_wearing_something = false;
    for (const [position, id] of Object.entries(this.props["body_slots"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${position}: ${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing.  ';
    }

    msg += 'You are carrying:  '
    let is_carrying_something = false;
    for (const id of this.props["misc_slots"]){
      is_carrying_something = true;
      let item = World.world.get_instance(id);
      msg += `${item.get_short_look_string()}`;
    }

    if (!is_carrying_something){
      msg += 'Nothing.  ';
    }

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, msg);
  }

  get_body_slots_ids(){
    let arr = [];
    for (const id of Object.values(this.props["body_slots"])){
      if (id!==null){
        arr.push(id);
      }
    }
    return arr;
  }

  get_misc_slots_ids(){
    return Array.from(this.props["misc_slots"]);
  }  

  get_look_string(){
    let msg = `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}**,  `;
    msg += `${this.props["description"]}  `;
    
    msg += `${this.props["name"]} carries:  `;
    let is_wearing_something = false;
    for (const id of Object.values(this.props["body_slots"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing interesting.';
    }

    return msg;

  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}`;
    return msg;
  }
}

class Item {
  constructor(type, props=null, id=null){
      
    this.id= (id===null)? Utils.id_generator.get_new_id() : id;
  
    this.props = {};
    switch(type){
      case ("Screwdriver"):
        this.props = {
          "name": type,
          "type": type,
          "type_string": "A Screwdriver",
          "description": "A philips screwdriver.",        
          "container_id": "0",
          "is_consumable": false,
          "slots": null,
          "slots_size_limit": 0,
        }
        break;

      case ("Candy"):
        this.props = {
          "name": type,
          "type": type,
          "type_string": "A Candy",
          "description": "A sweet candy bar.",        
          "container_id": "0",
          "is_consumable": true,
          "slots": null,
          "slots_size_limit": 0,
        }
        break;      
      
      case ("Corpse"):
        this.props = {
          "name": type,
          "type": type,
          "type_string": "A Corpse",
          "description": "It's dead, Jim.",
          "container_id": "0",
          "is_consumable": false,
          "slots": new Set(),
          "slots_size_limit": 16, //max num of items for a user.
        }
        break;

      default:
        console.error(`Item constructor: unknown type - ${type}`);
    }

    // Add To world.
    World.world.add_to_world(this);

    if (props!==null) this.update_props(props);    
  }

  update_props(props){
    for (const [key, value] of Object.entries(props)){

      switch(key){
        case("container_id"):
          Utils.move_to_room(this.id, this.props["container_id"], value);
          break;

        default:
          this.props[key]= value;
      }      
    }
  }

  set_container_id(new_container_id){
    this.props["container_id"] = new_container_id;
  }

  get_look_string(){
        
    let msg = `**[${this.props["type_string"]}]({type:${this.props["type"]}, id:${this.id}}**,  `;
    msg += `${this.props["description"]}  `;    

    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["type_string"]}]({type:${this.props["type"]}, id:${this.id}}`;
    return msg;
  }

  add_to_slots(id){
    
    if (this.props["slots"].size===this.props["slots_size_limit"]){
      //slots are full.
      return false;
    }

    //Slots are not full.
    this.props["slots"].add(id);
    return true;
  }
}

class NPC {
  constructor(type, props=null, id=null){

    //Default Constants
    this.BASE_HEALTH= 10;
    this.BASE_DAMAGE= 1;

    this.id= (id===null)? Utils.id_generator.get_new_id() : id;

    //Default values for a new NPC
    this.props = {};
    switch(type){
      case ("Dog"):
        this.props = {
          "name": "Archie",
          "type": "Dog",
          "description": "It's a cute but silly dog.",      
          "container_id": "0",
          "health": this.BASE_HEALTH,
          "state": "Default",
          "state_counter": 0,
          "body_slots": {
            'Head':       null,
            'Torso':      null,
            'Legs':       null,
            'Feet':       null,
            'Right Hand': null,
            'Left Hand':  null
          },
          "misc_slots": new Set(),
          "misc_slots_size_limit": 10,
          "is_fighting_with": null,
        }
        break;

      default:
        console.error(`NPC constructor: unknown type - ${type}`);
    }
    

    // Add To world.
    World.world.add_to_world(this);

    if (props!==null) this.update_props(props);
  }

  update_props(props){
    for (const [key, value] of Object.entries(props)){

      switch(key){
        case("container_id"):
          this.move_to_room(value);
          break;

        default:
          this.props[key]= value;
      }      
    }
  }

  set_container_id(new_container_id){
    this.props["container_id"] = new_container_id;
  }

  move_to_room(new_room_id){
    Utils.move_to_room(this.id, this.props["container_id"], new_room_id);    
  }

  reset_health(){
    this.props["health"] = this.BASE_HEALTH;
  }

  stop_battle(){
    this.props["is_fighting_with"] = null;
  }

  calc_damage(){
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){
    this.props["health"] -= damage_from_opponent;
    if (this.props["health"]<0){
      this.props["health"] = 0;
    }
    return damage_from_opponent;
  }

  get_look_string(){
    let msg = `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}**,  `;
    msg += `${this.props["description"]}  `;
    
    msg += `${this.props["name"]} carries:  `;
    let is_wearing_something = false;
    for (const id of Object.values(this.props["body_slots"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing interesting.';
    }

    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}`;
    return msg;
  }

  do_tick(){
    
    switch(this.props["state"]){

      case("Default"):
        //Action
        this.props["state_counter"] += 1;

        //Transition
        if (this.props["state_counter"]===5){
          this.props["state"] = 'Barking';          
        } 
        break;

      case('Barking'):
        //Action
        this.props["state_counter"]= 0;
        Utils.msg_sender.send_chat_msg_to_room(this.id,'world',`${this.props["name"]} Barks.`);        

        //Transition
        this.props["state"] = 'Default';
        break;
    }
  }

  do_death(){
    //create corpse, move all items to it, remove item from the world.
    let props = {
      "description": `This is the corpse of ${this.props["name"]}.`
    }
    let corpse = new Item("Corpse", props);

    let id_arr = this.get_body_slots_ids();
    id_arr.concat(this.get_misc_slots_ids());

    for (const id of id_arr){
      corpse.add_to_slots(id);
    }
    
  }

  get_body_slots_ids(){
    let arr = [];
    for (const id of Object.values(this.props["body_slots"])){
      if (id!==null){
        arr.push(id);
      }
    }
    return arr;
  }

  get_misc_slots_ids(){
    return Array.from(this.props["misc_slots"]);
  }  

}


//   enable_decay(){    
//     this.is_decaying= true;
//   }

//   disable_decay(){
//     this.is_decaying= false;
//   }

//   process_decay(){
//     if (this.is_decaying){

//       this.decay_tick_counter +=1;
//       if (this.decay_tick_counter===this.decay_rate){
//         this.decay_tick_counter=0;
//         this.wear -= 1;
  
//         if (this.wear===0){
//           //remove entity from the world and user.
//           let container = World.world.get_instance(this.container_id);
//           if (container instanceof User){
//             Utils.msg_sender.send_chat_msg_to_user(container.id, 'world',
//               `${this.type_string} has decayed and disintegrated.`);
//           }
//           this.remove_from_world();          
//         }
//       }
//     }    
//   }

// class Corpse extends Entity {
//   constructor(props, id=null){
//     super(id);
    
//     this.description=         "It's dead, Jim.";
//     this.type=                "Corpse"
//     this.type_string=         "A Corpse";
//     this.decomposition_timer= 60;
//     this.inventory=           new Inventory.Inventory(this.id, 17, props, false);    
//   }

//   process_tick(){
//     this.decomposition_timer -= 1;

//     if (this.decomposition_timer===0){
      
//       //Sending a msg before the actuall removal, since we
//       //cant do anything after the removal.
//       Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
//         'The corpse has decomposed and disappered.');    

//       //Remove all the items in the inventory from the world.
//       let ids_arr = this.inventory.get_all_entities_ids();
//       for (const id of ids_arr){
//         World.world.remove_from_world(id);
//       }

//       //Remove the corpse from its container and the world.
//       let container = World.world.get_instance(this.container_id);
//       container.remove_entity(this.id);
//       World.world.remove_from_world(this.id);
//     }
//   }

//   set_decomposition_timer(num_of_ticks){
//     this.decomposition_timer = num_of_ticks;
//   }


// class User extends AnimatedObject {

//   process_tick(){
    
//     this.counter +=1;
//     if (this.counter===this.HEALTH_DECLINE_RATE){
//       this.health -= 1;
//       this.counter = 0;

//       Utils.msg_sender.send_status_msg_to_user(this.id, this.health);
      
//     }

//     if (this.health===0){
//       //Player is dead.
//       Utils.msg_sender.send_chat_msg_to_user(this.id,'world',`You are DEAD!`);
      
//       //Create a corpse
//       let instance_props= {
//         description:  this.description,
//         container_id: this.container_id
//       };
//       new Corpse(instance_props);
//       this.reset(World.FIRST_ROOM_ID)
//     }
//   }

    
//   reset(spawn_container_id){
//     this.health=            this.BASE_HEALTH;
//     this.damage=            this.BASE_DAMAGE;
//     this.state=             "Default";
//     this.is_fighting_with=  null;
//     this.inventory=         new Inventory.Inventory(this.id, 10);

//     let current_container = World.world.get_instance(this.container_id);
//     current_container.remove_entity(this.id);

//     let spawn_container = World.world.get_instance(spawn_container_id);
//     spawn_container.add_entity(this.id);
//     Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
//       `You respawned in the starting room.`);    
//   }

//   consume(entity_id){
//     //We assume the entity is on the user somewhere.
//     //restore health and remove the entity from the user and world.    
//     this.inventory.remove_entity(entity_id);

//     let entity = World.world.get_instance(entity_id);
    
//     this.health= this.health + entity.restore_health_value;
//     if (this.health>this.BASE_HEALTH){
//       this.health= this.BASE_HEALTH;
//     }

//     this.counter= 0;

//     Utils.msg_sender.send_status_msg_to_user(this.id, this.health);

//     World.world.remove_from_world(entity_id);
//   }

exports.Item=             Item;
exports.User=             User;
exports.Room=             Room;
exports.NPC=              NPC;

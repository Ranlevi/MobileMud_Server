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
        "entities": [],
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
      
      if (props!==null){
        for (const [key, value] of Object.entries(props)){
          this.props[key]= value;
        }
      }
      

      // Add To world.
      World.world.add_to_world(this);

  }  
    
  add_entity(entity_id){
    this.props["entities"].push(entity_id);
  }
  
  remove_entity(entity_id){
    //try to remove entity.
    let success = false;
    let ix = this.props["entities"].indexOf(entity_id);
    if (ix!==-1){
      this.props["entities"].splice(ix,1);
      success = true;
    }
    return success;
  }
  
  get_entities_ids(){
    return this.props["entities"];
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

    if (this.props["entities"].length===1){    
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
    this.BASE_HEALTH= 50;
    this.BASE_DAMAGE= 1;
    this.HEALTH_DECLINE_RATE = 5; //1 HP drop every 5 ticks

    this.id= (id===null)? Utils.id_generator.get_new_id() : id;
    this.ws_client=     ws_client;
    this.tick_counter = 0;

    //Default values for a new player.
    this.props = {
      "name": "A User",
      "type": "User",
      "description": "It's you, bozo!",
      "password": null,
      "container_id": "0",
      "health": this.BASE_HEALTH,
      "wearing": {
        'Head':       null,
        'Torso':      null,
        'Legs':       null,
        'Feet':       null
      },
      "holding": null,
      "slots": [],
      "slots_size_limit": 10,
      "is_fighting_with": null,
    }

    //Note: wearing is fully replaced by loaded props, so they need to be full.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    // Add To world.
    World.world.add_to_world(this);    
  }

  do_tick(){
    this.tick_counter += 1;

    if (this.tick_counter===this.HEALTH_DECLINE_RATE){
      this.tick_counter = 0;
      this.props["health"] -= 1;
      Utils.msg_sender.send_status_msg_to_user(this.id, this.props["health"]);
    }

    if (this.props["health"]===0){
      //The user died of starvation!
      Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', 
        `${this.props["name"]} has starved to death...`);
      this.do_death();
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
    return damage_from_opponent;
  }

  set_container_id(new_container_id){
    this.props["container_id"] = new_container_id;
  }

  move_cmd(direction){
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

    current_room.remove_entity(this.id);
    let next_room = World.world.get_instance(next_room_id);
    next_room.add_entity(this.id);
    this.props["container_id"]= next_room_id;

    this.look_cmd();
    
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
    let id_arr = [];
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(this.props["holding"]);
    
    id_arr = id_arr.concat(this.props["slots"]);

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
    //Pick an item from the room, place in a slot.
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
    if (this.props["slots_size_limit"]===this.props["slots"].length){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You are carrying too many things already.`);
      return;
    }

    //The user can carry the item.
    room.remove_entity(entity_id);
    this.props["slots"].push(entity_id);

    let entity = World.world.get_instance(entity_id);
    entity.set_container_id(this.id);

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You pick it up.`);
  }

  drop_cmd(target=null){
    //search slots, holding and wearing (in that order) and drop the target to the floor.
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to drop?`);        
      return;
    }

    //Target is not null
    let id_arr = this.props["slots"];

    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(id);

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You don't have it.`);        
      return;
    }

    //target found.
    let room = World.world.get_instance(this.props["container_id"]);
    room.add_entity(entity_id);
    let entity = World.world.get_instance(entity_id);
    entity.set_container_id(room.id);

    let id_found = false;
    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id===entity_id){
        id_found = true;
        this.props["wearing"][position] = null;
      }
    }

    if (!id_found){
      if (this.props["holding"]===entity_id){
        id_found = true;
        this.props["holding"] = null;
      }
    }

    if (!id_found){
      let ix = this.props["slots"].indexOf(entity_id);
      if (ix!==-1){
        this.props["slots"].splice(ix,1);
      } else {
        console.error(`User.drop_cmd: id not found on user, can't happen!`);
      }
    }

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', `${this.props["name"]} drops ${entity.get_short_look_string()}`);

  }

  wear_or_hold_cmd(target=null){
    //get an item from the slots or room, and wear or hold it.
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to wear or hold?`);        
      return;
    }

    //Target is not null
    let id_arr = this.props["slots"];    
    let room = World.world.get_instance(this.props["container_id"]);
    id_arr = id_arr.concat(room.get_entities_ids()); 
    let entity_id = Utils.search_for_target(target, id_arr);
   
    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `There's no ${target} around.`);        
      return;
    }

    //Target found.
    //Try to get it from the slots.
    let entity = null;
    let target_location = null;
    for (const id of this.props["slots"]){
      if (id===entity_id){
        entity = World.world.get_instance(id);
        target_location= "slots";
      }
    }

    if (entity===null){
      //Target is not in the slots, must be in the room.
      let id_arr = room.get_entities_ids();
      for (const id of id_arr){
        if (id===entity_id){
          entity = World.world.get_instance(id);
          target_location="room";
        }
      } 
    }

    //Entity found.
    //Check if the required slot is taken
    let required_slot = entity.props["wear_hold_slot"];
    switch(required_slot){
      case("Head"):
      case("Torso"):
      case("Legs"):
      case("Feet"):
        if (this.props["wearing"][required_slot]!==null){
          Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
            `You're already wearing something on your ${required_slot}.`);
            return;
        } else {
          this.props["wearing"][required_slot] = entity_id;
        }
        break;
      
      case("Hold"):
        if (this.props["holding"]!==null){
          Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
            `You're already holding something.`);
            return;
        } else {
          this.props["holding"] = entity_id;
        }
        break;


      default:
        console.error(`User.wear_of_hold_cmd: item with unknown wear_hold_slot: ${entity.props["type"]}`);
        return;
    }

    //Remove the target from it's current position
    if (target_location==="slots"){
      let ix = this.props["slots"].indexOf(entity_id);
      if (ix!==-1){
        this.props["slots"].splice(ix,1);
      }
    } else {
      //Must be room
      room.remove_entity(entity_id);
    }

    entity.set_container_id(this.id);

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `Done.`);
  }

  remove_cmd(target=null){
    //get a target from the wearing or holding slots and place it in the slots.
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to remove?`);        
      return;
    }

    //Target is not null
    let id_arr = [];
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(this.props["holding"]);
    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're not wearing or holding ${target}`);        
      return;
    }

    //Target exists
    //Check if the slots are not full
    if (this.props["slots"].length===this.props["slots_size_limit"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You are carrying too many things already.`);
      return;
    }

    //Slots are avaiable
    //Remove it from it's current slot.
    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id===entity_id){
        this.props["wearing"][position]= null;
      };
    }

    if (this.props["holding"]===entity_id){
      this.props["holding"] = null;
    }

    this.props["slots"].push(entity_id);

    let entity = World.world.get_instance(entity_id);
    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
     `You remove ${entity.props["name"]}`);
  }

  kill_cmd(target=null){
    
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `Who do you want to kill?`);        
      return;
    }

    //Target not null
    let room = World.world.get_instance(this.props["container_id"]);
    let id_arr = room.get_entities_ids();

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `There's no ${target} around.`);        
      return;
    }

    //Target found
    let entity = World.world.get_instance(entity_id);
    if (!(entity instanceof NPC)){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `Come on, you can't kill that.`);        
      return;
    }

    //Target is killable...
    this.props["is_fighting_with"] = entity_id;
    entity.props["is_fighting_with"] = this.id;
  }

  consume_cmd(target=null){
    //eat/drink food that's in the wear,hold or slots.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to consume?`);        
      return;
    }

    //Target is not null
    let id_arr = [];

    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(this.props["holding"]);

    id_arr = id_arr.concat(this.props["slots"]);

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You don't have it on you.`);        
      return;
    }

    //Target exists
    //Check if it's edible
    let entity = World.world.get_instance(entity_id);

    if (!entity.props["is_consumable"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You can't eat THAT!`);        
      return;
    }

    //Target is edible.
    //Find it, remove it from the user and the world, update health.

    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id===entity_id){
        this.props["wearing"][position]= null;
      };
    }

    if (this.props["holding"]===entity_id){
      this.props["holding"] = null;
    }

    let ix = this.props["slots"].indexOf(entity_id);
    if (ix!==-1){
      this.props["slots"].splice(ix,1);
    }

    this.props["health"] += entity.props["hp_restored"];
    if (this.props["health"]>this.BASE_HEALTH){
      this.props["health"] = this.BASE_HEALTH;
    }    

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
      `You consume ${entity.props["name"]}`);   

    World.world.remove_from_world(entity_id);
    Utils.msg_sender.send_status_msg_to_user(this.id, this.props["health"]);
  }

  inv_cmd(){
    let msg = `You are wearing:  `;

    let is_wearing_something = false;
    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${position}: ${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing.  ';
    }

    msg += "You are holding: "
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${item.get_short_look_string()}`;
    } else {
      msg += "Nothing.  ";
    }

    msg += 'You are carrying:  '
    let is_carrying_something = false;
    for (const id of this.props["slots"]){
      is_carrying_something = true;
      let item = World.world.get_instance(id);
      msg += `${item.get_short_look_string()}`;
    }

    if (!is_carrying_something){
      msg += 'Nothing.  ';
    }

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, msg);
  }

  get_look_string(){
    let msg = `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}**,  `;
    msg += `${this.props["description"]}  `;
    
    msg += `${this.props["name"]} is wearing:  `;
    let is_wearing_something = false;
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing interesting.';
    }

    msg += `${this.props["name"]} is holding:  `;
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${item.get_short_look_string()}`;
    } else {
      msg += "Nothing.  ";
    }

    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}}`;
    return msg;
  }

  do_death(){
    //drop items to the room, reset and respawn
    let room = World.world.get_instance(this.props["container_id"]);

    //Move the items to the room.
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null){
        room.add_entity(id);
        let item = World.world.get_instance(id);
        item.set_container_id(room.id);
      }      
    }

    if (this.props["holding"]!==null){
      room.add_entity(this.props["holding"]);
      let item = World.world.get_instance(this.props["holding"]);
      item.set_container_id(room.id);
    }

    if (this.props["slots"]!==null){
      for (const id of this.props["slots"]){
        room.add_entity(id);
        let item = World.world.get_instance(id);
        item.set_container_id(room.id);
      }
    }

    //Reset the user
    room.remove_entity(this.id);
    let spawn_room = World.world.get_instance(World.FIRST_ROOM_ID);
    spawn_room.add_entity(this.id);
    this.props["container_id"] = World.FIRST_ROOM_ID;
    this.props["is_fighting_with"] = null;
    this.reset_health();

    this.props["wearing"] = {
      'Head':       null,
      'Torso':      null,
      'Legs':       null,
      'Feet':       null
    };
    this.props["holding"] = null;
    this.props["slots"]= [];

  }

  do_battle(){
    let opponent = World.world.get_instance(this.props["is_fighting_with"]);
    //Check if opponent disconnected or logged out
    if (opponent===undefined){
      this.stop_battle();
      this.reset_health();
    }

    //Opponent exists.
    //Do damage.
    let damage_dealt = this.calc_damage(); 
    let damage_recieved = opponent.recieve_damage(damage_dealt);

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world',
    `${this.props["name"]} strikes ${opponent.props["name"]}, dealing ${damage_recieved} HP of damage.`);

    Utils.msg_sender.send_status_msg_to_user(this.id, this.props["health"]);

    //Check & Handle death of the opponent.
    if (opponent.props["health"]===0){
      //Opponent has died
      this.stop_battle();

      Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
        `${opponent.props["name"]} is DEAD!`);

      //Create a corpse and remove the opponent
      opponent.do_death();
    }    
  }
}

class Item {
  constructor(type, props=null, id=null){
      
    this.id= (id===null)? Utils.id_generator.get_new_id() : id;
  
    this.props = {};
    switch(type){
      case ("Screwdriver"):
        this.props = {
          "name": "A Screwdriver",
          "type": type,
          "type_string": "A Screwdriver",
          "description": "A philips screwdriver.",        
          "container_id": "0",
          "is_consumable": false,
          "hp_restored": null,
          "wear_hold_slot": "Hold", //Hold, Head, Torso...
        }
        break;

      case ("Candy"):
        this.props = {
          "name": "A Candy",
          "type": type,
          "type_string": "A Candy",
          "description": "A sweet candy bar.",        
          "container_id": "0",
          "is_consumable": true,
          "hp_restored": 5,
          "wear_hold_slot": "Hold", //Hold, Head, Torso...
        }
        break;

      case ("T-Shirt"):
        this.props = {
          "name": "A T-Shirt",
          "type": type,
          "type_string": "A T-Shirt",
          "description": "A plain red T-Shirt.",        
          "container_id": "0",
          "is_consumable": false,
          "hp_restored": null,
          "wear_hold_slot": "Torso", //Hold, Head, Torso...
        }
        break;
      
      default:
        console.error(`Item constructor: unknown type - ${type}`);
    }

    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }
    // Add To world.
    World.world.add_to_world(this);
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
          "wearing": null,
          "holding": null,
          "slots": null,
          "slots_size_limit": 10,
          "is_fighting_with": null,
        }
        break;

      default:
        console.error(`NPC constructor: unknown type - ${type}`);
    }
    
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    // Add To world.
    World.world.add_to_world(this);
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
    let msg = `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}})**,  `;
    msg += `${this.props["description"]}  `;

    if (this.props["wearing"]!==null){

      msg += `${this.props["name"]} is wearing:  `;
      let is_wearing_something = false;
      for (const id of Object.values(this.props["wearing"])){
        if (id!==null){
          is_wearing_something = true;
          let item = World.world.get_instance(id);
          msg += `${item.get_short_look_string()}`;
        }
      }
  
      if (!is_wearing_something){
        msg += 'Nothing interesting.';
      }
    }
    
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${this.props["name"]} is wearing:  ${item.get_short_look_string()}`;
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
        Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
          // `**[${this.props["name"]}]({type:${this.props["type"]}, id:${this.id}})** Barks.`);        
          `**[${this.props["name"]}](type:${this.props["type"]},id:${this.id})** Barks.`);        

        //Transition
        this.props["state"] = 'Default';
        break;
    }
  }

  do_death(){
    //When an NPC dies, it drops it's items.
    let room = World.world.get_instance(this.props["container_id"]);

    //Move the items from the NPC to the room
    if (this.props["wearing"]!==null){
      for (const id of Object.values[this.props["wearing"]]){
        if (id!==null){
          room.add_entity(id);
          let item = World.world.get_instance(id);
          item.set_container_id(room.id);
        }        
      }
    }

    if (this.props["holding"]!==null){
      room.add_entity(this.props["holding"]);
      let item = World.world.get_instance(id);
      item.set_container_id(room.id);
    }

    if (this.props["slots"]!==null){
      for (const id of this.props["slots"]){
        room.add_entity(id);
        let item = World.world.get_instance(id);
        item.set_container_id(room.id);
      }
    }

    //Remove the NPC from the world and from the room    
    room.remove_entity(this.id);
    World.world.remove_from_world(this.id);    
  }

  remove_entity_from_slots(id){
    //try to remove entity.
    let success = false;
    let ix = this.props["slots"].indexOf(id);
    if (ix!==-1){
      this.props["slots"].splice(ix,1);
      success = true;
    }
    return success;
  }

  do_battle(){
    let opponent = World.world.get_instance(this.props["is_fighting_with"]);
    //Check if opponent disconnected or logged out
    if (opponent===undefined){
      this.stop_battle();
      this.reset_health();
    }

    //Opponent exists.
    //Do damage.
    let damage_dealt = this.calc_damage(); 
    let damage_recieved = opponent.recieve_damage(damage_dealt);

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world',
    `${this.props["name"]} strikes ${opponent.props["name"]}, dealing ${damage_recieved} HP of damage.`);

    //Check & Handle death of the opponent.
    if (opponent.props["health"]===0){
      //Opponent has died
      this.stop_battle();

      Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
        `${opponent.props["name"]} is DEAD!`);

      //Create a corpse and remove the opponent
      opponent.do_death();
    }    
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

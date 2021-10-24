const Utils=      require('./utils');
const World=      require('./world');

class Room {
  constructor(props=null, id=null){
      
    this.id= (id===null)? Utils.id_generator.get_new_id() : id;
    
    //Default props
    this.props = {
      "name":         "Room",
      "type":         "Room",
      "description":  "A simple, 3m by 3m room.",
      "entities":     [],
      "exits": {
        "north":      null, //direction: id
        "south":      null,
        "west":       null,
        "east":       null,
        "up":         null,
        "down":       null
      },
      "lighting":     "white", //CSS colors
    }

    //Overwrite the default props with the custome ones from the save file.
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
    //try to remove the given entity from the room.
    //Return True is successful, else False.
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
    //Returns an array with IDs of all the users in the room.
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
    //Returns a Look Command message (String)
    let msg = `**[${this.props["name"]}](ROOM_${this.id})**\n`;
    msg +=    `${this.props["description"]}\n`;
    msg +=    `Exits:\n`;

    for (const [direction, next_room_id] of Object.entries(this.props["exits"])){
      if (next_room_id!==null){
        msg += `[${direction}](${direction}),`
      }
    }

    msg += '\n'; //new paragraph

    if (this.props["entities"].length===1){    
      //Only the player is in the room.
      msg += 'The room is empty.\n';
    } else {
      msg += 'In the room:\n';

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
    this.BASE_HEALTH=           50;
    this.BASE_DAMAGE=           1;
    this.HEALTH_DECLINE_RATE =  5; //1 HP drop every 5 ticks

    this.id=            (id===null)? Utils.id_generator.get_new_id() : id;
    this.ws_client=     ws_client; //The WebSocket for server-client comm.
    this.tick_counter = 0; //For use with state machines, etc.

    //Default values for a new player.
    this.props = {
      "name":             "A User",
      "type":             "User",
      "description":      "It's you, bozo!",
      "password":         null, //String
      "container_id":     "0",
      "health":           this.BASE_HEALTH, //Num
      "wearing": {
        'Head':           null,//ID, String.
        'Torso':          null,
        'Legs':           null,
        'Feet':           null
      },
      "holding":          null,
      "slots":            [],//IDs, String.
      "slots_size_limit": 10,
      "is_fighting_with": null,//ID, String.
    }

    //Overwrite props with saved props. 
    //Note: "wearing" should be overwritten with all it's slots!
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

    //Hunger mechanism. Reduce health over time.
    //If counter is zero, the user is dead.
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
    //Returns how much damage the user does when attacking (Num)
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){
    //Returns how much damage the user recives, after taking into account
    //shields, etc. (Num)
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
    let current_room= World.world.get_instance(this.props["container_id"]);
    let next_room_id= current_room.props["exits"][direction];
  
    if (next_room_id===null){
      //There's no exit in that direction.
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
        `There's no exit to ${direction}.`);      
      return;
    }
  
    //Exit exists.    
    //Remove the player from the current room, add it to the next one.
    //Send a message and perform a look command.
    current_room.remove_entity(this.id);
    let next_room= World.world.get_instance(next_room_id);

    next_room.add_entity(this.id);
    this.props["container_id"]= next_room_id;

    Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
      `You travel ${direction}.`);

    this.look_cmd();    
  }

  look_cmd(target=null){
    //target can be an id, a type or a name.
    //If it exists, returns a string message.
    let room = World.world.get_instance(this.props["container_id"]);  

    if (target===null){
      //Look at the room the user is in.      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, room.get_look_string());        
      return;
    }

    //Target is not null.
    //Search order: body_slots, misc_slots, room entitys, room itself
    let id_arr = [];
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(this.props["holding"]);
    
    id_arr = id_arr.concat(this.props["slots"]);

    room = World.world.get_instance(this.props["container_id"]);
    id_arr = id_arr.concat(room.get_entities_ids());

    id_arr.push(room.id);

    let entity_id = Utils.search_for_target(target, id_arr);
    
    if (entity_id===null){
      //No target found.
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
        `There is no ${target} around.`);
    } else {
      let entity = World.world.get_instance(entity_id);
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, entity.get_look_string());
    }       
  }

  get_cmd(target=null){
    //Pick an item from the room, and place it in a slot.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to get?`);        
      return;
    }

    //Target is not null
    let room=   World.world.get_instance(this.props["container_id"]);
    let id_arr= room.get_entities_ids();

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      //Target not found.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around.`);        
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
    //Remove it from the room, place it in the player's slots.
    room.remove_entity(entity_id);
    this.props["slots"].push(entity_id);

    let entity = World.world.get_instance(entity_id);
    entity.set_container_id(this.id);

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You pick it up.`);
  }

  drop_cmd(target=null){
    //search slots, holding and wearing (in that order) and drop the target to the floor.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to drop?`);        
      return;
    }

    //Target is not null
    //Search for the target on the player.
    let id_arr = this.props["slots"];

    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(id);

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      //Target not found.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `You don't have it.`);        
      return;
    }

    //target found.
    //Remove it from the player, place it in the room.
    let room = World.world.get_instance(this.props["container_id"]);
    room.add_entity(entity_id);
    let entity = World.world.get_instance(entity_id);
    entity.set_container_id(room.id);
    
    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id===entity_id){        
        this.props["wearing"][position] = null;
      }
    }
    
    if (this.props["holding"]===entity_id){  
      this.props["holding"] = null;
    }
  
    let ix = this.props["slots"].indexOf(entity_id);
    if (ix!==-1){
      this.props["slots"].splice(ix,1);
    } else {
      console.error(`User.drop_cmd: id not found on user, can't happen!`);
    }    

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', 
      `[${this.props["name"]}](User_${this.id}) drops ${entity.get_short_look_string()}`);
  }

  wear_or_hold_cmd(target=null){
    //get an item from the slots or room, and wear or hold it.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to wear or hold?`);        
      return;
    }

    //Target is not null
    //Search for it in the room and slots.
    let id_arr=     this.props["slots"];    
    let room=       World.world.get_instance(this.props["container_id"]);
    id_arr=         id_arr.concat(room.get_entities_ids()); 

    let entity_id=  Utils.search_for_target(target, id_arr);
   
    if (entity_id===null){
      //Target not found
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around.`);        
      return;
    }

    //Target found.
    //Try to get it from the slots.
    let entity=           null;
    let target_location=  null;

    for (const id of this.props["slots"]){
      if (id===entity_id){
        entity=           World.world.get_instance(id);
        target_location= "slots";
      }
    }

    if (entity===null){
      //Target is not in the slots, must be in the room.
      let id_arr = room.get_entities_ids();
      for (const id of id_arr){
        if (id===entity_id){
          entity=           World.world.get_instance(id);
          target_location=  "room";
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

    //Remove the target from it's current position,
    //Set it's new container_id.
    if (target_location==="slots"){
      let ix = this.props["slots"].indexOf(entity_id);
      if (ix!==-1){
        this.props["slots"].splice(ix,1);
      }
    } else {
      //Must be in the room
      room.remove_entity(entity_id);
    }

    entity.set_container_id(this.id);

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `Done.`);
  }

  remove_cmd(target=null){
    //get a target from the wearing or holding slots and place it in the slots.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to remove?`);        
      return;
    }

    //Target is not null
    //Search for it in the wearing/holding slots.
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
     `You remove [${entity.props["name"]}](${entity.props["type"]}_${entity.id}).`);
  }

  kill_cmd(target=null){
    //The user starts a fight.
    
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `Who do you want to kill?`);        
      return;
    }

    //Target not null
    //Search for the target in the room.
    let room=   World.world.get_instance(this.props["container_id"]);
    let id_arr= room.get_entities_ids();

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      //No target found.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around.`);        
      return;
    }

    //Target found
    let entity = World.world.get_instance(entity_id);

    if (!(entity instanceof NPC)){
      //Can only fight an NPC.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `Come on, you can't kill that.`);        
      return;
    }

    //Target is killable...
    this.props["is_fighting_with"]=   entity_id;
    entity.props["is_fighting_with"]= this.id;
  }

  consume_cmd(target=null){
    //eat/drink food that's in the wear,hold or slots.
    //Restore health.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, `What do you want to consume?`);        
      return;
    }

    //Target is not null
    //Search for it on the user's body.
    let id_arr = [];

    for (const id of Object.values(this.props["wearing"])){
      if (id!==null) id_arr.push(id);
    }

    if (this.props["holding"]!==null) id_arr.push(this.props["holding"]);

    id_arr = id_arr.concat(this.props["slots"]);

    let entity_id = Utils.search_for_target(target, id_arr);

    if (entity_id===null){
      //Target not found.
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
      //Do not restore more than 100% of points.
      this.props["health"] = this.BASE_HEALTH;
    }    

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
      `You consume ${entity.props["name"]}`);   

    World.world.remove_from_world(entity_id);
    Utils.msg_sender.send_status_msg_to_user(this.id, this.props["health"]);
  }

  inv_cmd(){
    //Return a String message with all things carried by the user.

    let msg = `You are wearing:\n`;

    let is_wearing_something = false;
    for (const [position, id] of Object.entries(this.props["wearing"])){
      if (id!==null){
        is_wearing_something= true;
        let item=             World.world.get_instance(id);
        msg += `${position}: ${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing.\n';
    }

    msg += "You are holding: "
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${item.get_short_look_string()}`;
    } else {
      msg += "Nothing.\n";
    }

    msg += 'You are carrying: '
    let is_carrying_something = false;
    for (const id of this.props["slots"]){
      is_carrying_something = true;
      let item = World.world.get_instance(id);
      msg += `${item.get_short_look_string()}`;
    }

    if (!is_carrying_something){
      msg += 'Nothing.\n';
    }

    Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, msg);
  }

  get_look_string(){
    //Return a String message with what other see when they look at the user.

    let msg = `**[${this.props["name"]}](User_${this.id})**\n`;
    msg += `${this.props["description"]}\n`;
    
    msg += `${this.props["name"]} is wearing:\n`;
    let is_wearing_something = false;
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${item.get_short_look_string()}`;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing interesting.\n';
    }

    msg += `${this.props["name"]} is holding: `;
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${item.get_short_look_string()}`;
    } else {
      msg += "Nothing.\n";
    }

    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}](User_${this.id})`;
    return msg;
  }

  do_death(){
    //The user is dead. Drop items to the room, reset and respawn
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
    this.props["container_id"]=     World.FIRST_ROOM_ID;
    this.props["is_fighting_with"]= null;
    this.reset_health();

    this.props["wearing"] = {
      'Head':       null,
      'Torso':      null,
      'Legs':       null,
      'Feet':       null
    };
    this.props["holding"]=  null;
    this.props["slots"]=    [];
  }

  do_battle(){
    //Perform a round of fighting with the NPC.

    let opponent = World.world.get_instance(this.props["is_fighting_with"]);
    
    //Do damage.
    let damage_dealt=     this.calc_damage(); 
    let damage_recieved=  opponent.recieve_damage(damage_dealt);

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world',
    `[${this.props["name"]}](User_${this.id}) strikes ` + 
    `[${opponent.props["name"]}](${opponent.props["type"]}_${opponent.id}), ` +
    `dealing ${damage_recieved} HP of damage.`);

    Utils.msg_sender.send_status_msg_to_user(this.id, this.props["health"]);

    //Check & Handle death of the opponent.
    if (opponent.props["health"]===0){
      //Opponent has died
      this.stop_battle();

      Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
        `${opponent.props["name"]} is DEAD!`);
      
      opponent.do_death();
    }    
  }
}

class Item {
  constructor(type, props=null, id=null){
      
    this.id=    (id===null)? Utils.id_generator.get_new_id() : id;  
    this.props= {};

    //Set default porps according to type.
    switch(type){
      case ("Screwdriver"):
        this.props = {
          "name":           "A Screwdriver",
          "type":           type,
          "type_string":    "A Screwdriver",
          "description":    "A philips screwdriver.",        
          "container_id":   "0",
          "is_consumable":  false,
          "hp_restored":    null, //Num
          "wear_hold_slot": "Hold", //Hold, Head, Torso...
        }
        break;

      case ("Candy"):
        this.props = {
          "name":           "A Candy",
          "type":           type,
          "type_string":    "A Candy",
          "description":    "A sweet candy bar.",        
          "container_id":   "0",
          "is_consumable":  true,
          "hp_restored":    5,
          "wear_hold_slot": "Hold", //Hold, Head, Torso...
        }
        break;

      case ("T-Shirt"):
        this.props = {
          "name":           "A T-Shirt",
          "type":           type,
          "type_string":    "A T-Shirt",
          "description":    "A plain red T-Shirt.",        
          "container_id":   "0",
          "is_consumable":  false,
          "hp_restored":    null,
          "wear_hold_slot": "Torso", //Hold, Head, Torso...
        }
        break;
      
      default:
        console.error(`Item constructor: unknown type - ${type}`);
    }

    //Overwrite the default props with the saved ones.
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
    //Returns a message with what a user sees when looking at the Item.
        
    let msg = `**[${this.props["name"]}](${this.props["type"]}_${this.id})**,\n`;
    msg +=    `${this.props["description"]}`;
    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}](${this.props["type"]}_${this.id})`;
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

    //Default props for each type.
    switch(type){
      case ("Dog"):
        this.props = {
          "name":             "Archie",
          "type":             "Dog",
          "description":      "It's a cute but silly dog.",      
          "container_id":     "0",
          "health":           this.BASE_HEALTH,
          "state":            "Default",
          "state_counter":    0,
          "wearing":          null, //Object with slots(strings):id(string)
          "holding":          null, //ID (string)
          "slots":            null, //Array (IDs, strings)
          "slots_size_limit": 10,
          "is_fighting_with": null,
        }
        break;

      default:
        console.error(`NPC constructor: unknown type - ${type}`);
    }
    
    //Overwrite the default props with saved ones.
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
    //Return how much damage the NPC does.
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){
    //Returns how much damage the NPC recives after shields, etc.
    this.props["health"] -= damage_from_opponent;
    if (this.props["health"]<0){
      this.props["health"] = 0;
    }
    return damage_from_opponent;
  }

  get_look_string(){
    //Returns a string with what a user sees when looking at the NPC.
    let msg = `**[${this.props["name"]}](${this.props["type"]}_${this.id})**\n`;
    msg += `${this.props["description"]}\n`;

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
      msg += `${this.props["name"]} is holding:  ${item.get_short_look_string()}`;
    }
    
    return msg;
  }

  get_short_look_string(){
    let msg = `[${this.props["name"]}](${this.props["type"]}_${this.id})`;
    return msg;
  }

  do_tick(){
    //State machine for normal behavior. Currently implemented for a dog only.
    
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
          // `[${this.props["name"]}](NPC_${this.id}) Barks.`);        
          `<a>${this.props["name"]}</a> NPC ${this.id}) Barks.`);        

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
    //try to remove the entity.
    //Return True if successful, else False.
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
    //This to prevent users abusing the fighting system by logging out 
    //and reloggin with full health...
    if (opponent===undefined){
      this.stop_battle();
      this.reset_health();
    }

    //Opponent exists.
    //Do damage.
    let damage_dealt=     this.calc_damage(); 
    let damage_recieved=  opponent.recieve_damage(damage_dealt);

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world',
      `[${this.props["name"]}](${this.props["type"]}_${this.id}) strikes` + 
      `[${opponent.props["name"]}](${this.props["type"]}_${this.id}), ` + 
      `dealing ${damage_recieved} HP of damage.`);

    //Check & Handle death of the opponent.
    if (opponent.props["health"]===0){
      //Opponent has died
      this.stop_battle();

      Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
        `${opponent.props["name"]} is DEAD!`);
      
      opponent.do_death();
    }    
  }
}

exports.Item=             Item;
exports.User=             User;
exports.Room=             Room;
exports.NPC=              NPC;
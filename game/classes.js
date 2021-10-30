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
        "north":      null, //direction: {id: string, code: string}
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
    let msg = `<h1>${Utils.generate_html(this.id, 'Room')}</h1>` +
              `<p>${this.props["description"]}</p>` + 
              `<p><span class="style1">Exits:</span> `;
    
    for (const [direction, obj] of Object.entries(this.props["exits"])){      
      if (obj!==null){
        msg += `<span class="pn_link" data-element="pn_cmd" ` + 
                `data-actions="${direction.toUpperCase()}" >${direction.toUpperCase()}</span> `
      }
    }

    msg += '</p>'; //new paragraph

    msg += '<p>In the room: ';

    for (const entity_id of this.props["entities"]){
      let entity = World.world.get_instance(entity_id);
      msg += `${entity.get_short_look_string()} `;
    }  

    msg += `</p>`

    return msg;
  }
}

class User {
  constructor(props, ws_client, id=null){

    //Default Constants
    this.BASE_HEALTH=           100;
    this.BASE_DAMAGE=           1;
    this.HEALTH_DECLINE_RATE =  100; //1 HP drop every 5 ticks

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
    }

    if (this.props["health"]===0){
      //The user died of starvation!
      let msg = `${Utils.generate_html(this.id, 'User')} has starved to death...`;

      Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', msg);        
      this.do_death();
    }

    //Send a status message    
    Utils.msg_sender.send_status_msg_to_user(this.id);
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
    let next_room_obj= current_room.props["exits"][direction];
  
    if (next_room_obj===null){
      //There's no exit in that direction.
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
        `There's no exit to ${direction}.`);      
      return;
    }
  
    //Exit exists.   
    //Check if locked, and if true - check for key on the user's body.
    if (next_room_obj.code!==null){
      //This door requires a key.

      let ids_arr = [];
      if (this.props["holding"]!==null) ids_arr.push(this.props["holding"]);
      if (this.props["wearing"]["Head"]!==null) ids_arr.push(this.props["holding"]["Head"]);
      if (this.props["wearing"]["Torso"]!==null) ids_arr.push(this.props["holding"]["Torso"]);
      if (this.props["wearing"]["Legs"]!==null) ids_arr.push(this.props["holding"]["Legs"]);
      if (this.props["wearing"]["Feet"]!==null) ids_arr.push(this.props["holding"]["Feet"]);

      for (const id of this.props["slots"]){
        ids_arr.push(id);
      }

      //Check for a key
      let key_exists = false;
      for (const entity_id of ids_arr){
        let entity = World.world.get_instance(entity_id);
        if (entity.props["key_code"]===next_room_obj.code){
          key_exists = true;
          break;
        }
      }

      if (!key_exists){
        //The user does not have a key on their body.
        Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
          `It's locked, and you don't have the key.`);      
        return;
      }
    }

    //Key found (or exit is not locked)

    //Remove the player from the current room, add it to the next one.
    //Send a message and perform a look command.
    current_room.remove_entity(this.id);
    let next_room= World.world.get_instance(next_room_obj.id);

    next_room.add_entity(this.id);
    this.props["container_id"]= next_room_obj.id;

    let msg = `${Utils.generate_html(this.id, 'User')} travels ${direction}.`;
    Utils.msg_sender.send_chat_msg_to_room(this.id,'world', msg);      

    this.look_cmd();    
  }

  look_cmd(target=null){
    //target can be an id, a type or a name.
    //If it exists, returns a string message.
    let room = World.world.get_instance(this.props["container_id"]);  

    if (target===null || target==="room"){
      //Look at the room the user is in.      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, room.get_look_string());        
      return;
    }

    //Target is not null. Search for it.
    let result = Utils.search_for_target(this.id, target);

    if (result===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
        `There is no ${target} around.`);
        return;
    }

    //Target was found.
    let entity = World.world.get_instance(result.entity_id);
    Utils.msg_sender.send_chat_msg_to_user(
      this.id, 
      `world`, 
      entity.get_look_string());    
  }

  get_cmd(target=null){
    //Pick an item from the room, and place it in a slot.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to get?`);        
      return;
    }

    //Target is not null. Search in the room.
    let result = Utils.search_for_target(this.id, target);

    if (result===null || result.location!=="Room"){
      //Target not found.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} in the room with you.`);        
      return;
    }

    //Target found.
    //Check if gettable
    let entity = World.world.get_instance(result.entity_id);

    if (!entity.props["is_gettable"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You can't pick it up.`);        
      return;
    }    
    
    //Check is misc_slots are full.
    if (this.props["slots_size_limit"]===this.props["slots"].length){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You are carrying too many things already.`);
      return;
    }

    //The user can carry the item.
    //Remove it from the room, place it in the player's slots.
    let room = World.world.get_instance(this.props["container_id"]);
    room.remove_entity(result.entity_id);
    this.props["slots"].push(result.entity_id);

    
    entity.set_container_id(this.id);

    let msg = 
      `${Utils.generate_html(this.id, 'User')} gets ${Utils.generate_html(entity.id, 'Item')}.`;
    
    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', msg); 
  }

  drop_cmd(target=null){
    //search for target on body and drop the target to the floor.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to drop?`);        
      return;
    }

    let result = Utils.search_for_target(this.id, target);
    
    if (result===null || result.location==="Room"){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You don't have it on your body.`);        
      return;
    }

    //Target found. Remove it from the player.
    switch(result.location){
      case("Holding"):
        this.props["holding"] = null;
        break;

      case('Head'):
      case('Torso'):
      case('Legs'):
      case('Feet'):
        this.props["wearing"][result.location] = null;
        break;

      case("Slots"):
        let ix = this.props["slots"].indexOf(result.entity_id);          
        this.props["slots"].splice(ix,1);
        break;      
    }

    //Place it in the room.
    let room = World.world.get_instance(this.props["container_id"]);
    room.add_entity(result.entity_id);
    let entity = World.world.get_instance(result.entity_id);
    entity.set_container_id(room.id);

    let msg = `${Utils.generate_html(this.id, 'User')} `+
              `drops ${Utils.generate_html(entity.id, 'Item')}`;

    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', msg);
  }

  hold_cmd(target=null){
    //Search for target on body and room, and hold it.
    
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to hold?`);        
      return;
    }

    let result = Utils.search_for_target(this.id, target);

    if (result===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around to hold.`);        
      return;
    }

    if (result.location==="Holding"){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're already holding it!`);        
      return;
    }

    //Target found. 
    //Check if target is holdable
    let entity = World.world.get_instance(result.entity_id);

    if (!entity.props["is_holdable"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You can't hold it.`);        
      return;
    }

    //Remove it from it's current location.
    switch(result.location){
      case("Room"):
        let room = World.world.get_instance(this.props["container_id"]);
        room.remove_entity(result.entity_id);
        break;

      case('Head'):
      case('Torso'):
      case('Legs'):
      case('Feet'):
        this.props["wearing"][result.location] = null;
        break;

      case("Slots"):
        let ix = this.props["slots"].indexOf(result.entity_id);          
        this.props["slots"].splice(ix,1);
        break;      
    }

    this.props["holding"] = result.entity_id;

    //Set new location of entity.    
    entity.set_container_id(this.id);

    let msg = `${Utils.generate_html(this.id, 'User')} `+
              `holds ${Utils.generate_html(entity.id, 'Item')}`;   
    
    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', msg); 
  }

  wear_cmd(target=null){
    //get an item from the slots or room, and wear it.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to wear?`);        
      return;
    }

    let result = Utils.search_for_target(this.id, target);

    if (result===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around to wear.`);        
      return;
    }

    //Target found
    if (result.location==="Holding"){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're holding it, you can't wear it.`);        
      return;
    }

    if (["Head", "Torso", "Legs", "Feet"].includes(result.location)){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're already wearing it!`);        
      return;
    }

    //Check if target can be worn
    let entity = World.world.get_instance(result.entity_id);
    if (entity.props["wear_slot"]===null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You can't wear that!`);        
      return;
    }

    //Check if required slot is taken
    if (this.props["wearing"][entity.props["wear_hold_slot"]]!==null){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're already wearing something on your ${required_slot}.`);
        return;
    }

    //Remove the target from its current location
    switch(result.location){
      case("Room"):
        let room = World.world.get_instance(this.props["container_id"]);
        room.remove_entity(result.entity_id);
        break;    

      case("Slots"):
        let ix = this.props["slots"].indexOf(result.entity_id);          
        this.props["slots"].splice(ix,1);
        break;      
    }

    //Wear the target
    this.props["wearing"][entity.props["wear_slot"]]= result.entity_id;

    entity.set_container_id(this.id);

    let msg = `${Utils.generate_html(this.id, 'User')} `+
              `wears ${Utils.generate_html(entity.id, 'Item')}`;     
    
    Utils.msg_sender.send_chat_msg_to_room(this.id, `world`, msg);
  }

  remove_cmd(target=null){
    //get a target from the wearing or holding slots and place it in the slots.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to remove?`);        
      return;
    }

    let result = Utils.search_for_target(this.id, target);

    if (result===null || result.location==="Room" || result.location==="Slots"){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You're not wearing or holding it.`);        
      return;
    }

    //Target exists
    //Check if the slots are not full
    if (this.props["slots"].length===this.props["slots_size_limit"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You are carrying too many things already.`);
      return;
    }

    switch(result.location){
      case ("Holding"):
        this.props["holding"] = null;
        break;

      case('Head'):
      case('Torso'):
      case('Legs'):
      case('Feet'):
        this.props["wearing"][result.location] = null;
        break;
    }

    //Add it to slots.
    this.props["slots"].push(result.entity_id);

    let entity = World.world.get_instance(result.entity_id);

    let msg = `${Utils.generate_html(this.id, 'User')} `+
              `removes ${Utils.generate_html(entity.id, 'Item')}`;     

    Utils.msg_sender.send_chat_msg_to_room(this.id, `world`, msg);
     
  }

  kill_cmd(target=null){
    //The user starts a fight.
    
    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `Who do you want to kill?`);        
      return;
    }

    let result = Utils.search_for_target(this.id, target);

    if (result===null || (result.location!=="Room")){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around.`);        
      return;
    }

    //Target found
    let entity = World.world.get_instance(result.entity_id);

    if (!(entity instanceof NPC)){
      //Can only fight an NPC.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `Come on, you can't kill that.`);        
      return;
    }

    //Target is killable...
    this.props["is_fighting_with"]=   entity_id;
    entity.props["is_fighting_with"]= this.id;
  }

  consume_cmd(target=null){
    //eat/drink food that's in the wear,hold or slots or room.
    //Restore health.

    if (target===null){      
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `What do you want to consume?`);        
      return;
    }

    //Target is not null
    let result = Utils.search_for_target(this.id, target);

    if (result===null){
      //Target not found.
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `There's no ${target} around.`);        
      return;
    }

    //Target exists
    //Check if it's edible
    let entity = World.world.get_instance(result.entity_id);

    if (!entity.props["is_consumable"]){
      Utils.msg_sender.send_chat_msg_to_user(this.id, `world`, 
        `You can't eat THAT!`);        
      return;
    }

    //Target found. Remove it from its container.
    switch(result.location){
      case("Holding"):
        this.props["holding"] = null;
        break;

      case('Head'):
      case('Torso'):
      case('Legs'):
      case('Feet'):
        this.props["wearing"][result.location] = null;
        break;

      case("Slots"):
        let ix = this.props["slots"].indexOf(result.entity_id);          
        this.props["slots"].splice(ix,1);
        break;

      case("Room"):
        let room = World.world.get_instance(this.props["container_id"]);
        room.remove_entity(result.entity_id);
        break;
    }

    //Restore Health
    this.props["health"] += entity.props["hp_restored"];
    if (this.props["health"]>this.BASE_HEALTH){
      //Do not restore more than 100% of points.
      this.props["health"] = this.BASE_HEALTH;
    }    

    let msg = `${Utils.generate_html(this.id, 'User')} `+
              `consumes ${entity.props["name"]}.`;         
    
    Utils.msg_sender.send_chat_msg_to_room(this.id, 'world', msg);     
    
  }  

  get_look_string(){
    //Return a String message with what other see when they look at the user.

    let msg = `<h1>${Utils.generate_html(this.id, 'User')}</h1>` +
              `<p>${this.props["description"]}</p>` +
              `<p>Wearing: `;

    let is_wearing_something = false;
    for (const id of Object.values(this.props["wearing"])){
      if (id!==null){
        is_wearing_something = true;
        let item = World.world.get_instance(id);
        msg += `${item.get_short_look_string()} `;
      }
    }

    if (!is_wearing_something){
      msg += 'Nothing interesting.';
    }

    msg += `</p>`;

    msg += `<p>Holding: `;
    if (this.props["holding"]!==null){
      let item = World.world.get_instance(this.props["holding"]);
      msg += `${item.get_short_look_string()} `;
    } else {
      msg += "Nothing.";
    }

    msg += `</p>`;

    return msg;
  }

  get_short_look_string(){
    let msg = `${Utils.generate_html(this.id, 'User')}`;     
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
      `${Utils.generate_html(this.id, 'User')} strikes ` + 
      `${Utils.generate_html(this.id, 'NPC')} ` +
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
          "hp_restored":    null, //Num,
          "is_holdable":    true,
          "wear_slot":      null,
          "is_gettable":    true,
          "key_code":       null,
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
          "hp_restored":    50,
          "is_holdable":    true,
          "wear_slot":      null,
          "is_gettable":    true,
          "key_code":       null,
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
          "is_holdable":    false,
          "wear_slot":      "Torso",
          "is_gettable":    true,
          "key_code":       null,
        }
        break;

      case ("Keycard"):
        this.props = {
          "name":           "A Keycard",
          "type":           type,
          "type_string":    "A Keycard",
          "description":    "A small rectangular plastic card.",        
          "container_id":   "0",
          "is_consumable":  false,
          "hp_restored":    null,
          "is_holdable":    true,
          "wear_slot":      null,
          "is_gettable":    true,
          "key_code":       "000000",
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

    let msg = `<h1>${Utils.generate_html(this.id, 'Item')}</h1>` +
              `<p>${this.props["description"]}</p>`;
    
    return msg;
  }
  
  get_short_look_string(){    
    let msg = `${Utils.generate_html(this.id, 'Item')}`; 
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
    let msg = `<h1>${Utils.generate_html(this.id, 'NPC')}</h1>`;
    msg += `${this.props["description"]}\n`;

    if (this.props["wearing"]!==null){

      msg += `Wearing:  `;
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
      msg += `Holding: ${item.get_short_look_string()}`;
    }
    
    return msg;
  }

  get_short_look_string(){
    let msg = `${Utils.generate_html(this.id, 'NPC')}`;
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
          `${Utils.generate_html(this.id, 'NPC')} barks.`);        

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
      `${Utils.generate_html(this.id, 'NPC')} strikes` + 
      `${Utils.generate_html(this.id, 'User')} ` + 
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
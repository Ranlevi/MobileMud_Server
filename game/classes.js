const Utils= require('./utils');
const World= require('./world');
const Types= require('./types');

class Room {
  constructor(props=null, id=null){

    this.SPAWN_DELAY = 10;
      
    this.id= (id===null)? Utils.id_generator.get_new_id() : id;

    this.spawn_counter = 0;
    
    //Default props
    this.props = {
      name:               "Room",
      type:               "Room",
      subtype:            "Room",
      description:        "A simple, 3m by 3m room.",
      spawned_entities:   null,
      entities:           [],
      exits: {
        north:            null, //direction: {id: string, code: string}
        south:            null,
        west:             null,
        east:             null,
        up:               null,
        down:             null
      },
      lighting:           "white", //CSS colors
    }

    //Overwrite the default props with the custome ones from the save file.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }      

    // Add To world.
    World.world.add_to_world(this);

    this.do_spawn(true);
  }
    
  //Inventory Manipulation Methods
  add_entity(entity_id){
    this.props.entities.push(entity_id);
  }
  
  remove_entity(entity_id){
    //try to remove the given entity from the room.
    //Return True is successful, else False.
    
    let ix = this.props.entities.indexOf(entity_id);
    if (ix!==-1){
      this.props.entities.splice(ix,1);
      return true;
    } else {
      return false;
    }    
  }
  
  get_entities(){
    //Returns an array of objects, of the form: {id: string, location: "room"}
    let inv_arr = [];
    for (const id of this.props.entities){
      inv_arr.push({id: id, location: "room"});
    }
    return inv_arr;
  }  

  search_for_target(target){
    //Search the entities in the room for a given target.
    //Target can be name, usbtype or id.
    //returns an object of first item found: {id: string, location: string} or null if not found.
    
    for (const id of this.props.entities){
      let entity = World.world.get_instance(id);
      
      if ((entity.props.name.toLowerCase()===target) ||
          (entity.props.subtype.toLowerCase()===target) ||
          (target===entity.id)){
        return {id: id, location: "room"};
      }
    }

    //target not found.
    return null;
  } 

  //----

  get_name(){
    //Returns an HTML string for the name of the room.
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  get_look_string(){
    //Returns a Look Command message (String)   
    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>` + 
              `<p><span class="style1">Exits:</span> `;
    
    for (const [direction, obj] of Object.entries(this.props.exits)){      
      if (obj!==null){
        msg += `<span class="pn_link" data-element="pn_cmd" ` + 
                `data-actions="${direction.toUpperCase()}" >${direction.toUpperCase()}</span> `
      }
    }

    msg += '</p>'; 
    msg += '<p>In the room: ';

    for (const entity_id of this.props.entities){
      let entity = World.world.get_instance(entity_id);      
      msg += `${entity.get_name()} `;
    }  

    msg += `</p>`

    return msg;
  }

  do_spawn(is_initial_spawn=false){

    this.spawn_counter += 1;

    if (this.spawn_counter===this.SPAWN_DELAY || is_initial_spawn){

      if (!is_initial_spawn){
        this.spawn_counter = 0;
      }

      if (this.props.spawned_entities!==null){
        
        for (const obj of this.props.spawned_entities){
          //obj is of the form:
          //{"type": "Item", "subtype": "Keycard", "amount": 1}
          
          //Count how many of the required item are already present.
          let existing_amount = 0;
          for (const entity_id of this.props.entities){
            let entity = World.world.get_instance(entity_id);
            
            if (entity.props.subtype===obj.subtype){
              existing_amount += 1;
            }
          }
          
          //If not enough items are present, spawn new ones.
          if (existing_amount<obj.amount){          
            for (let i=existing_amount;i<obj.amount;i++){
              
              let props = {
                container_id: this.id
              }

              let entity;

              switch (obj.type){
                case("Item"):
                  entity = new Item(obj.subtype, props);
                  break;

                case('NPC'):
                  entity = new NPC(obj.subtype, props);                  
                  break;                

                default:
                  console.error(`classes.js->do_spawn: unknown type ${data.props.type}`);
              }              
              
              entity.send_msg_to_room(`has spawned here.`);
            }
          }
            
        }
      }
    }
  }

  do_tick(){
    this.do_spawn();        
  } 
  
}

class User {
  
  constructor(props, ws_client=null, id=null){

    //Default Constants
    this.BASE_HEALTH=           100;
    this.BASE_DAMAGE=           1;
    this.HEALTH_DECLINE_RATE =  100; //1 HP drop every X ticks

    this.id=            (id===null)? Utils.id_generator.get_new_id() : id;
    this.ws_client=     ws_client; //The WebSocket for server-client comm.
    this.tick_counter = 0; //For use with state machines, etc.

    //Default values for a new player.
    this.props = {
      name:             "A User",
      type:             "User",
      subtype:          "User",
      description:      "A (non-NPC) human.",
      password:         null, //String
      container_id:     World.FIRST_ROOM_ID,
      health:           this.BASE_HEALTH, //Num 

      //Inventorhy
      wearing: {
        head:           null,//ID, String.
        torso:          null,
        legs:           null,
        feet:           null
      },
      holding:          null,
      slots:            [],//IDs, String.

      slots_size_limit: 10,
      is_fighting_with: null,//ID, String.
    }
    
   //Overwrite props with saved props.         
    for (const [key, value] of Object.entries(props)){
      this.props[key]= value;
    }      
    
    World.world.add_to_world(this);    
    
    //Place the user in a room    
    let room = World.world.get_instance(this.props.container_id);
    room.add_entity(this.id);    
  }

  do_tick(){
    
    //Hunger mechanism. Reduce health over time.
    //If counter is zero, the user is dead.
    this.tick_counter += 1;
    
    if (this.tick_counter===this.HEALTH_DECLINE_RATE){
      this.tick_counter = 0;
      this.props.health -= 1;
    }

    if (this.props.health===0){
      //The user died of starvation!
      this.send_chat_msg_to_client(`You has starved to death.`);
      this.send_msg_to_room('has starved to death.');
      this.do_death();
    }
    //-- End Hunger Mechanism.

    //Send a status message    
    this.send_status_msg_to_client();
  }   

  //Aux. Methods.
  calc_damage(){
    //Returns how much damage the user does when attacking (Num)
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){ 
    //Returns how much damage the user recives, after taking into account
    //shields, etc. (Num),
    //or null if the user is dead.
    this.props.health -= damage_from_opponent;
    if (this.props.health<0){
      this.props.health = 0;
    }
    return damage_from_opponent;  
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  //Inventory Manipulation Methods

  get_all_items_on_body(){
    //Returns an array of objects: {id: string, location: string}
    //Results will be ordered by holding->wearing->slots.
    let inv_arr = [];

    if (this.props.holding!==null){
      inv_arr.push({id: this.props.holding, location: "holding"});
    }

    if (this.props.wearing.head!==null){
      inv_arr.push({id: this.props.wearing.head, location: "head"});
    }

    if (this.props.wearing.torso!==null){
      inv_arr.push({id: this.props.wearing.torso, location: "torso"});
    }

    if (this.props.wearing.legs!==null){
      inv_arr.push({id: this.props.wearing.legs, location: "legs"});
    }

    if (this.props.wearing.feet!==null){
      inv_arr.push({id: this.props.wearing.feet, location: "feet"});
    }

    for (const id of this.props.slots){
      inv_arr.push({id: id, location: "slots"});      
    }

    return inv_arr;
  }

  //Scan all entities on the user's body 
  //return the first hit found as object {id: string, location: string} or null if not found.
  //Search order: holding->wearing->slots
  search_for_target(target){
  
    //Get all entities on the user's body and in the room.
    let inv_arr = this.get_all_items_on_body();

    //Search for the target.
    for (const obj of inv_arr){
      let entity = World.world.get_instance(obj.id);

      if ((entity.props.name.toLowerCase()===target) ||
          (entity.props.subtype.toLowerCase()===target) ||
          (target===entity.id)){
        return obj;
      }  
    }

    //Target is not found.
    return null;
  }

  //Remove the given id from the given location.
  //return Void
  remove_item(id, location){

    switch(location){
      case("holding"):
        this.props.holding = null;
        break;

      case('head'):
      case('torso'):
      case('fegs'):
      case('feet'):
        this.props.wearing[location] = null;
        break;

      case("slots"):
        let ix = this.props.slots.indexOf(id);          
        this.props.slots.splice(ix,1);
        break;
        
      default:
        console.error(`User.remove_item: unknown location ${location}`);
    }
  }

  //Handle Client Commands.

  move_cmd(direction){
    let current_room=   World.world.get_instance(this.props.container_id);
    let next_room_obj=  current_room.props.exits[direction];
    //next_room_obj is of the form: {"id": "6", "code": "00000000" or null}
  
    if (next_room_obj===null){
      //There's no exit in that direction.
      this.send_chat_msg_to_client(`There's no exit to ${direction}.`);
      return;
    }
  
    //Exit exists.   
    //Check if locked, and if true - check for key on the user's body.
    if (next_room_obj.code!==null){
      //This door requires a key.
      let inv_arr = this.get_all_items_on_body();
      
      //Check for a key
      let key_exists = false;
      for (const obj of inv_arr){
        //obj is of the form: {id: string, location: string}
        let entity = World.world.get_instance(obj.id);
        if (entity.props.key_code===next_room_obj.code){
          key_exists = true;
          break;
        }
      }
        
      if (!key_exists){
        //The user does not have a key on their body.
        this.send_chat_msg_to_client(`It's locked, and you don't have the key.`);        
        return;
      }
    }

    //Key found (or exit is not locked)
    //Send messages. 
    this.send_chat_msg_to_client(`You travel ${direction}.`);
    this.send_msg_to_room(`travels ${direction}.`);

    //Remove the player from the current room, add it to the next one.    
    current_room.remove_entity(this.id);

    let next_room= World.world.get_instance(next_room_obj.id);
    next_room.add_entity(this.id);

    this.props.container_id= next_room_obj.id;

    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`enters from ${Utils.get_opposite_direction(direction)}.`);
  }

  look_cmd(target=null){
    //search for a target on the user's body or in the room.
    //target can be an id, a subtype or a name.
    //returns a string message.   
    let room= World.world.get_instance(this.props.container_id);   

    if (target===null || 
        target==="room" || 
        target===room.props.name.toLowerCase() ||
        target===room.id){
      //Look at the room the user is in.
      this.send_chat_msg_to_client(room.get_look_string());      
      return;
    }

    //Target is not null. Search for it.    
    let result = this.search_for_target(target);    
    
    if (result===null){
      //Target not found on user. Try finding in the room.      
      result=   room.search_for_target(target);

      if (result===null){
        //Target not found in room either.
        this.send_chat_msg_to_client(`There is no such thing around.`);
        return;
      }      
    }

    //Target was found.
    let entity = World.world.get_instance(result.id);
    this.send_chat_msg_to_client(entity.get_look_string());
  }

  get_cmd(target=null){
    //Pick an item from the room, and place it in a slot.

    if (target===null){   
      this.send_chat_msg_to_client(`What do you want to get?`);   
      return;
    }

    //Target is not null. Search in the room.
    let room=     World.world.get_instance(this.props.container_id);
    let result=   room.search_for_target(target);

    if (result===null){
      this.send_chat_msg_to_client(`There's no ${target} in the room with you.`);
      return;
    }

    //Target found.
    //Check if gettable
    let entity = World.world.get_instance(result.id);
    
    if (!entity.props.is_gettable){
      this.send_chat_msg_to_client(`You can't pick it up.`);
      return;
    }    
    
    //Check is misc_slots are full.
    if (this.props.slots_size_limit===this.props.slots.length){
      this.send_chat_msg_to_client(`You are carrying too many things already.`);
      return;
    }

    //The user can carry the item.
    //Remove it from the room, place it in the player's slots.
    room.remove_entity(entity.id);
    this.props.slots.push(entity.id);    
    entity.set_container_id(this.id);

    //Notify client and room
    this.send_chat_msg_to_client('You pick it up and place it in your slots.');
    this.send_msg_to_room(`gets ${entity.get_name()}`);
  }

  drop_cmd(target=null){
    //search for target on body and drop the target to the room.

    if (target===null){      
      this.send_chat_msg_to_client(`What do you want to drop?`);
      return;
    }

    let result = this.search_for_target(target);

    if (result===null){
      //target not found on the user's body.
      this.send_chat_msg_to_client(`You don't have it on you.`);
      return;
    }

    //Target found, remove it from the user's body.
    this.remove_item(result.id, result.location);

    //Place it in the room.
    let room = World.world.get_instance(this.props.container_id);
    room.add_entity(result.id);

    let entity = World.world.get_instance(result.id);
    entity.set_container_id(room.id);

    //Send messages.
    this.send_chat_msg_to_client('You drop it to the floor.');
    this.send_msg_to_room(`drops ${entity.get_name}.`);    
  }

  hold_cmd(target=null){
    //Search for target on body and room, and hold it.
    
    if (target===null){
      this.send_chat_msg_to_client(`What do you want to hold?`);      
      return;
    }

    let result = this.search_for_target(target);   
    let room= World.world.get_instance(this.props.container_id);

    if (result===null){
      //Target not found on user's body. Try to find it in room       
      result= room.search_for_target(target);
      
      if (result===null){
        //Target is not in room either
        this.send_chat_msg_to_client(`There's no ${target} around to hold.`);
        return;
      }      
    }

    //Target was found. Check if already held.
    if (result.location==="holding"){
      this.send_chat_msg_to_client(`You're already holding it!`);
      return;
    }
 
    //Check if target is holdable
    let entity = World.world.get_instance(result.id);

    if (!entity.props.is_holdable){
      this.send_chat_msg_to_client(`You can't hold it.`);
      return;
    }

    //Target is holdable.
    //Remove it from it's container. 
    if (result.location==="room"){
      room.remove_entity(result.id);
    } else {
      //Must be on the user
      this.remove_item(result.id, result.location);
    }    
    //Set new location of entity.    
    entity.set_container_id(this.id);

    //Place it in the user's hands.
    this.props.holding = result.id;

    //Send messgaes
    this.send_chat_msg_to_client(`You hold it.`);
    this.send_msg_to_room(`holds ${entity.get_name()}.`);
  }

  wear_cmd(target=null){
    //get an item from the slots or room, and wear it.

    if (target===null){
      this.send_chat_msg_to_client(`What do you want to wear?`);      
      return;
    }

    //Search for the target on the user's body.
    let result = this.search_for_target(target);
    let room = World.world.get_instance(this.props.container_id);
    
    if (result===null){
      //Target is not on the user's body. Try in room.
      result = room.search_for_target(target);
      if (result===null){
        //Target not in room either.
        this.send_chat_msg_to_client(`There's no ${target} around to wear.`);
        return;
      }      
    }

    //Target found
    let entity = World.world.get_instance(result.id);

    //Check that it's an Item (all others can't be worn)
    if (!(entity instanceof Item) || entity.props.wear_slot===null){
      this.send_chat_msg_to_client(`You can't wear that.`);
      return;
    }

    //Check that the user isn't already wearing/holding it.    
    if (result.location==="Holding"){
      this.send_chat_msg_to_client(`You're holding it, you can't wear it.`); 
      return;
    }

    if (["head", "torso", "legs", "feet"].includes(result.location)){
      this.send_chat_msg_to_client(`You're already wearing it!`);
      return;
    }

    //Check if target can be worn
    
    if (entity.props.wear_slot===null){
      this.send_chat_msg_to_client(`You can't wear that!`);
      return;
    }

    //Check if required slot is taken
    if (this.props.wearing[entity.props.wear_hold_slot]!==null){
      this.send_chat_msg_to_client(`You're already wearing something on your ${entity.props.wear_slot}.`);
      return;
    }

    //Target can be worn.

    //Remove the target from its current location
    switch(result.location){
      case("room"):        
        room.remove_entity(result.id);
        break;    

      case("slots"):
        let ix = this.props.slots.indexOf(result.id);
        this.props.slots.splice(ix,1);
        break;      
    }

    //Wear the target
    this.props.wearing[entity.props.wear_slot]= result.id;

    entity.set_container_id(this.id);

    //Send messages.
    this.send_chat_msg_to_client(`You wear it.`);
    this.send_msg_to_room(`wears ${entity.get_name()}`);
  }

  remove_cmd(target=null){
    //get a target from the wearing or holding slots and place it in the slots.

    if (target===null){  
      this.send_chat_msg_to_client(`What do you want to remove?`);    
      return;
    }

    //Target is not null. Search for it on the user's body.
    let result = this.search_for_target(target);

    if (result===null){
      //Target is not found on the body.
      this.send_chat_msg_to_client(`You don't have it on you.`);
      return;
    }

    if (result.location==="slots"){
      this.send_chat_msg_to_client(`It's already in the slots.`);
      return;
    }

    //Target exists
    //Check if the slots are not full
    if (this.props.slots.length===this.props.slots_size_limit){
      this.send_chat_msg_to_client(`You are carrying too many things in your slots already.`);
      return;
    }

    //Slots not full. 
    //Remove the item from it's current location.
    this.remove_item(result.id, result.location);

    //Add it to slots.
    this.props.slots.push(result.id);

    //Send messages.
    let entity = World.world.get_instance(result.id);
    this.send_chat_msg_to_client(`You remove it and place it in your slots.`);
    this.send_msg_to_room(`removes ${entity.get_name()}`); 
  }

  kill_cmd(target=null){
    //The user starts a fight with an NPC in the same room.
    
    if (target===null){
      this.send_chat_msg_to_client(`Who do you want to kill?`);      
      return;
    }

    let room=   World.world.get_instance(this.props.container_id);
    let result= room.search_for_target(target);
    
    if (result===null){
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;
    }

    //Target found
    let entity = World.world.get_instance(result.id);

    if (!(entity instanceof NPC)){
      //Can only fight an NPC.
      this.send_chat_msg_to_client(`Come on, you can't kill THAT.`);
      return;
    }

    if (!entity.is_killable){
      //This is a non-killable NPC
      this.send_chat_msg_to_client(`Sorry, ${this.props.name}, I can't let you do that.`);
      return;
    }

    //Target is killable...
    this.props.is_fighting_with=   entity_id;
    entity.props.is_fighting_with= this.id;
  }

  consume_cmd(target=null){
    //eat/drink food that's in the wear,hold or slots or room.
    //Restore health.

    if (target===null){  
      this.send_chat_msg_to_client(`What do you want to consume?`);    
      return;
    }

    //Target is not null
    //Search for it on the user's body.
    let result= this.search_for_target(target);
    let room=   World.world.get_instance(this.props.container_id);

    if (result===null){
      //Target not found on the body. Try the room.
      result = room.search_for_target(target);
      if (result===null){
        //Not it room either
        this.send_chat_msg_to_client(`There's no ${target} around.`);
        return;
      }
    }

    //Target exists
    //Check if it's edible
    let entity = World.world.get_instance(result.id);

    if (!entity.props.is_consumable){
      this.send_chat_msg_to_client(`You can't eat THAT!`);
      return;
    }

    //Target is edible. Remove it from its container.
    if (result.location==="room"){
      room.remove_entity(result.id);
    } else {
      //Must be on the user's body
      this.remove_item(result.id, result.location);
    }

    //Restore Health
    this.props.health += entity.props.hp_restored;
    if (this.props.health>this.BASE_HEALTH){
      //Do not restore more than 100% of points.
      this.props.health = this.BASE_HEALTH;
    }    

    World.world.remove_from_world(result.id);

    //Send messages.
    this.send_chat_msg_to_client(`You consume it.`);
    this.send_msg_to_room(`consumes ${entity.get_name()}`);    
  }

  say_cmd(target=null){

    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to say?`);  
      return;
    }

    //Send messages.
    this.send_chat_msg_to_client(`You say: ${target}`);
    this.send_msg_to_room(`says: ${target}`);
  }

  tell_cmd(username, content=null){

    console.log(username, content);

    if (username===undefined){
      this.send_chat_msg_to_client(`Who do you want to talk to?`);
      return;
    }

    let user_id = World.world.get_user_id_by_username(username);

    if (user_id===null){
      this.send_chat_msg_to_client('No User by this name is online.');
      return;
    }

    let user = World.world.get_instance(user_id);

    if (content===''){
      this.send_chat_msg_to_client(`What do you want to tell ${user.get_name()}?`);
      return;
    }
    
    this.send_chat_msg_to_client(`You tell ${user.get_name()}: ${content}`);
    user.get_msg(this.id, `tells you: ${content}`);
  }

  emote_cmd(target=null){
    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to emote?`);  
      return;
    }

    this.send_chat_msg_to_client(`You emote: ${target}`);
    this.send_msg_to_room(`${target}`);
  }

  get_look_string(){
    //Return a String message with what other see when they look at the user.

    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>` +
              `<p>Wearing: `;

    let text = '';

    for (const id of Object.values(this.props.wearing)){
      if (id!==null){
        let entity = World.world.get_instance(id);
        text += `${entity.get_name()} `; 
      }      
    }
    
    if (text==='') text = 'Plain cloths.';
    msg += text;
    msg += `</p>`;

    msg += `<p>Holding: `;
    if (this.props.holding!==null){
      let item = World.world.get_instance(this.props.holding);
      msg += `${item.get_name()} `;
    } else {
      msg += "Nothing.";
    }
    msg += `</p>`;

    return msg;
  }  

  do_death(){
    //The user is dead. Drop items to the room, reset and respawn
    let room = World.world.get_instance(this.props.container_id);

    //Move the items to the room.
    let inv_arr = this.get_all_items_on_body();
    for (const obj of inv_arr){
      //obj is of the form {id: string, location: string}
      this.remove_item(obj.id, obj.location);
      room.add_entity(obj.id);
      let item = World.world.get_instance(obj.id);
      item.set_container_id(room.id);
    }

    //Reset the user
    room.remove_entity(this.id);
    let spawn_room = World.world.get_instance(World.FIRST_ROOM_ID);
    spawn_room.add_entity(this.id);
    this.props.container_id=     World.FIRST_ROOM_ID;
    this.props.is_fighting_with= null;
    this.props.health = this.BASE_HEALTH;    

    //Send messages
    this.send_chat_msg_to_client(`You respawned, losing all your inventory.`);
    this.send_msg_to_room(`${this.get_name()} respawns.`);
  }

  do_battle(){
    //Perform a round of fighting with the NPC.
    //Note: we're handling only the blows the user strikes the opponent,
    //not blows recived.

    let opponent = World.world.get_instance(this.props.is_fighting_with);
    
    //Do damage.
    let damage_dealt=     this.calc_damage(); 
    let damage_recieved=  opponent.recieve_damage(damage_dealt);

    //Send messages
    this.send_chat_msg_to_client(`You strike, dealing ${damage_recieved} HP of damage.`);
    this.send_msg_to_room(
      `${this.get_name()} strikes ${opponent.get_name},`+
      `dealing ${damage_recieved} HP of damage.`
      );

    //Check  & Handle death of the opponent.
    if (opponent.props.health===0){
      //Opponent has died
      //Stop battle
      this.props.is_fighting_with = null;   
      
      //Messages
      this.send_chat_msg_to_client(`${opponent.props.name} is DEAD!`);
      this.send_msg_to_room(`kills ${opponent.props.name}.`);
      
      opponent.do_death();
    }    
  }
  
  //Handle Messages

  send_chat_msg_to_client(content){
    let message = {
      type:    'Chat',      
      content: content
    }    
    this.ws_client.send(JSON.stringify(message));
  }

  send_status_msg_to_client(){

    let msg = {
      type:       "Status",
      content:  {
        health:   this.props.health,
        holding:  'Nothing.',
        wearing: {
          head:   'Nothing.',
          torso:  'Nothing.',
          legs:   'Nothing.',
          feet:   'Nothing.',
        },
        slots:    'Nothing.',
        room_lighting: 
                  World.world.get_instance(this.props.container_id).props.lighting,
      }
    }
        
    if (this.props.holding!==null){
      let entity=           World.world.get_instance(this.props.holding);
      msg.content.holding=  entity.get_name();
    }  
      
    if (this.props.wearing.head!==null){
      let entity=               World.world.get_instance(this.props.wearing.Head);
      msg.content.wearing.head= entity.get_name();
    }  
  
    if (this.props.wearing.torso!==null){
      let entity=                 World.world.get_instance(this.props.wearing.Torso);
      msg.content.wearing.torso=  entity.get_name();
    }
      
    if (this.props.wearing.legs!==null){
      let entity=                 World.world.get_instance(this.props.wearing.Legs);
      msg.content.wearing.legs=   entity.get_name();
    }
       
    if (this.props.wearing.feet!==null){
      let entity=                 World.world.get_instance(this.props.wearing.Feet);
      msg.content.wearing.feet=   entity.get_name();
    }

    if (this.props.slots.length!==0){
      let html = '';
      for (const id of this.props.slots){
        let entity= World.world.get_instance(id);
        html += `${entity.get_name()} `;
      }
      msg.content.slots = html;
    }
  
    this.ws_client.send(JSON.stringify(msg));      
  }

  send_msg_to_room(content){
    let room=     World.world.get_instance(this.props.container_id);
    let ids_arr=  room.get_entities();

    for (const obj of ids_arr){
      if (obj.id!==this.id){ //Don't send to yourself.
        let entity = World.world.get_instance(obj.id);
        entity.get_msg(this.id, content);
      }
    }
  }

  send_login_msg_to_client(is_login_successful){
    let message = {
      type:    'Login',      
      content: {is_login_successful: is_login_successful}
    }    
    this.ws_client.send(JSON.stringify(message));
  }

  get_msg(sender_id, content){
    //Forward the recived message to the client.
    let entity= World.world.get_instance(sender_id);
    let msg=    `${entity.get_name()} ${content}`;

    this.send_chat_msg_to_client(msg);
  }

  disconnect_from_game(){

    //Save user state to users_db
    World.world.users_db.users[this.props.name] = {
      id: this.id,
      props: this.props
    }

    let inv_arr = this.get_all_items_on_body();        
    for (const obj of inv_arr){
      //obj: {id: string, location: string}
      let entity = World.world.get_instance(obj.id);
      World.world.users_db.items[entity.id] = entity.props;
    } 
    
    let room = World.world.get_instance(this.props.container_id);
    room.remove_entity(this.id);
    World.world.remove_from_world(this.id); 
  }
  
}

class Item { 

  constructor(subtype, props=null, id=null){
      
    this.id=    (id===null)? Utils.id_generator.get_new_id() : id;  
    this.props= {};

    //Set default porps according to subtype.
    let subtype_data=  Types.Types[subtype];    
    this.props=     Utils.deepCopyFunction(subtype_data.props);

    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    // Add To world.
    World.world.add_to_world(this);

    //If container is room - add it to the room. Else, don't add it.    
    //(this is because in User loading, the user already has the item on him.)
    let container = World.world.get_instance(this.props.container_id);
    if (container instanceof Room){
      container.add_entity(this.id);
    }
    
  }

  set_container_id(new_container_id){
    this.props.container_id= new_container_id;
  }

  get_look_string(){
    //Returns a message with what a user sees when looking at the Item.

    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>`;    
    return msg;
  }
   
  do_disintegrate(){
    //Remove the item from its container, and the world.

    let container = World.world.get_instance(this.props.container_id);

    if (container instanceof User){
      //Find the location of the item on the user's body.
      let inv_arr = container.get_all_items_on_body();
      for (const obj of inv_arr){
        //{id, location}
        if (this.id===obj.id){
          container.remove_item(obj.id, obj.location);
          container.get_msg(this.id, `${this.props.name} has disintegrated.`);
          break;
        }
      }

    } else if (container instanceof NPC){
      //Find the location of the item on the NPC's body.
      let inv_arr = container.get_all_items_on_body();
      for (const obj of inv_arr){
        //{id, location}
        if (this.id===obj.id){
          container.remove_item(obj.id, obj.location);
          container.get_msg(this.id, `${this.props.name} has disintegrated.`);
          break;
        }
      }

    } else if (container instanceof Room){
      container.remove_entity(this.id);      
      this.send_msg_to_room(`${this.props.name} has disintegrated.`);
    }

    World.world.remove_from_world(this.id);
  }

  do_tick(){    
    //Expiration mechanism.

    if (this.props.expiration_limit!==null){
      this.props.expiration_counter += 1;
      if (this.props.expiration_counter===this.props.expiration_limit){
        this.do_disintegrate();
      }
    }
  }

  get_msg(sender_id, content){
    //Not implemented yet
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Get_Drop_Wear_Hold_Consume_Remove">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  send_msg_to_room(content){
    //Check if the item is in a room (i.e. not on user, etc)
    //and send a message to all entities.
    let container=     World.world.get_instance(this.props.container_id);

    if (container instanceof Room){
      let ids_arr=  container.get_entities();
      //array of objects, of the form: {id: string, location: "room"}

      for (const obj of ids_arr){
        if (obj.id!==this.id){ //Don't send to yourself.
          let entity = World.world.get_instance(obj.id);
          entity.get_msg(this.id, content);
        }
      }
    }    
  }
  
}

class NPC {
  constructor(subtype, props=null, id=null){

    //Default Constants
    this.BASE_HEALTH= 10;
    this.BASE_DAMAGE= 1;

    this.id= (id===null)? Utils.id_generator.get_new_id() : id;

    //Load the subtype
    let subtype_data=      Types.Types[subtype];
    this.props=         Utils.deepCopyFunction(subtype_data.props);
    this.state_machine= new Utils.StateMachine(this.id, subtype_data.stm_definition);
        
    // {//Mandatory props for every NPC
    //   "name":             "An NPC",
    //   "type":             "An NPC",
    //   "subtype":          "Larry",
    //   "description":      "It's an NPC.",      
    //   "container_id":     "0", //
    //   "health":           this.BASE_HEALTH, //Num
    //   "is_fighting_with": null,//ID, String.      
    //   "state_variables":    null, //Object user_id: {cs: , vars: entered_room: bool}
    // }

    //Note: if the 'wearing' prop is present, it must be an object (like in User)
    //      if the 'holding' prop is present, it must be an object.
    //      if the 'slots' prop is present, it must be an Array of IDs, and have
    //        a limit prop like in User.

    // Add To world.
    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    World.world.add_to_world(this);

    //Place the npc in a room
    let room = World.world.get_instance(this.props.container_id);
    room.add_entity(this.id);    
  }

  //Inventory manipulation Methods

  get_all_items_on_body(){
    //returns an array of {id, location}
    let inv_arr = [];

    if (this.props.wearing!==null){
      for (const [location, id] of Object.entries(this.props.wearing)){
        if (id!==null){
          inv_arr.push({id: id, location: location});
        }
      }
    }

    if (this.props.holding!==null){
      for (const [location, id] of Object.entries(this.props.holding)){
        if (id!==null){
          inv_arr.push({id: id, location: location});
        }
      }
    }

    if (this.props.slots!==null){
      for (const id of this.props.slots){
        inv_arr.push({id: id, location: "slots"});
      }
    }    

    return inv_arr;
  }

  remove_item(id, slot_type, position){

    if (slot_type==="wearing"){
      this.props.wearing[position] = null;

    } else if (slot_type==="holding"){
      this.props.holding[position] = null;

    } else if (slot_type==="slots"){
      let ix = this.props.slots.indexOf(id);          
      this.props.slots.splice(ix,1);
    }
  }

  //Aux Methods.

  set_container_id(new_container_id){
    this.props.container_id = new_container_id;
  }

  reset_health(){
    this.props.health = this.BASE_HEALTH;
  }

  stop_battle(){
    this.props.is_fighting_with = null;
  }

  calc_damage(){
    //Return how much damage the NPC does.
    return this.BASE_DAMAGE;
  }

  recieve_damage(damage_from_opponent){
    //Returns how much damage the NPC recives after shields, etc.
    this.props.health -= damage_from_opponent;
    if (this.props.health<0){
      this.props.health = 0;
    }
    return damage_from_opponent;
  }

  get_look_string(){
    //Returns a string with what a user sees when looking at the NPC.
    let msg = `<h1>${this.get_name()}</h1>`;
    msg += `<p>${this.props.description}</p>`;

    if (this.props.wearing!==null){
      msg += `<p>Wearing:  `;

      let text = '';
      for (const [position, id] of Object.entries(this.props.wearing)){
        if (id!==null){
          let entity = World.world.get_instance(id);
          text += `<p>${position}: ${entity.get_name()}</p>`;
        }
      }

      if (text===''){
        msg += `Nothing.</p>`;
      } else {
        msg += text + `</p>`;
      }
    }

    if (this.props.holding!==null){
      msg += `<p>Holding:  `;

      let text = '';
      for (const [position, id] of Object.entries(this.props.holding)){
        if (id!==null){
          let entity = World.world.get_instance(id);
          text += `<p>${position}: ${entity.get_name()}</p>`;
        }
      }

      if (text===''){
        msg += `Nothing.</p>`;
      } else {
        msg += text + `</p>`;
      }
    }
    
    return msg;
  }  

  do_tick(){
    this.state_machine.do_tick(this.id);
  }

  do_death(){
    //When an NPC dies, it drops it's items.
    let room = World.world.get_instance(this.props.container_id);

    //Move the items from the NPC to the room
    if (this.props.wearing!==null){
      for (const id of Object.values[this.props.wearing]){
        if (id!==null){
          room.add_entity(id);
          let item = World.world.get_instance(id);
          item.set_container_id(room.id);
        }        
      }
    }   

    if (this.props.holding!==null){
      for (const id of Object.values[this.props.holding]){
        if (id!==null){
          room.add_entity(id);
          let item = World.world.get_instance(id);
          item.set_container_id(room.id);
        }        
      }
    }

    if (this.props.slots!==null){
      for (const id of this.props.slots){
        room.add_entity(id);
        let item = World.world.get_instance(id);
        item.set_container_id(room.id);
      }
    }

    //Remove the NPC from the world and from the room    
    room.remove_entity(this.id);
    World.world.remove_from_world(this.id);

    this.send_msg_to_room(`is DEAD.`);
  }

  do_battle(){
    let opponent = World.world.get_instance(this.props.is_fighting_with);
    //Check if opponent disconnected or logged out
    //This to prevent users abusing the fighting system by logging out 
    //and reloggin with full health...
    if (opponent===undefined){
      this.stop_battle();
      this.reset_health();
      return;
    }

    //Opponent exists.
    //Do damage.
    let damage_dealt=     this.calc_damage(); 
    let damage_recieved=  opponent.recieve_damage(damage_dealt);

    this.send_msg_to_room(
      `strikes ${opponent.get_name()}`+
      `dealing ${damage_recieved} HP of damage.`
    );

    //Check & Handle death of the opponent.
    if (opponent.props.health===0){
      //Opponent has died
      this.stop_battle();
      this.send_msg_to_room(`kills ${opponent.get_name()}!`);      
      opponent.do_death();
    }    
  }    
  
  get_msg(sender_id, msg){

    let event;
    if (msg.includes('enters from')){
      event = "user_enters_room";
    } else if (msg.includes('says')){
        event = msg;
    }

    this.state_machine.recive_event(sender_id, event);    
  }

  say_cmd(msg){
    this.send_msg_to_room(`says: ${msg}`);    
  }

  emote_cmd(emote){
    this.send_msg_to_room(emote);    
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Kill">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  send_msg_to_room(content){
    ///Send a message to all entities in the room.
    let container=  World.world.get_instance(this.props.container_id);
    
    let ids_arr=  container.get_entities();
    //array of objects, of the form: {id: string, location: "room"}

    for (const obj of ids_arr){
      if (obj.id!==this.id){ //Don't send to yourself.
        let entity = World.world.get_instance(obj.id);
        entity.get_msg(this.id, content);
      }
    }    
  }

}



exports.Item=             Item;
exports.User=             User;
exports.Room=             Room;
exports.NPC=              NPC;

// switch(type){
//   case ("Screwdriver"):
//     this.props = {
//       "name":           "A Screwdriver",
//       "type":           type,
//       "type_string":    "A Screwdriver",
//       "description":    "A philips screwdriver.",        
//       "container_id":   "0",
//       "is_consumable":  false,
//       "hp_restored":    null, //Num,
//       "is_holdable":    true,
//       "wear_slot":      null,
//       "is_gettable":    true,
//       "key_code":       null,
//     }
//     break;

//   case ("Candy"):
//     this.props = {
//       "name":           "A Candy",
//       "type":           type,
//       "type_string":    "A Candy",
//       "description":    "A sweet candy bar.",        
//       "container_id":   "0",
//       "is_consumable":  true,
//       "hp_restored":    50,
//       "is_holdable":    true,
//       "wear_slot":      null,
//       "is_gettable":    true,
//       "key_code":       null,
//     }
//     break;

//   case ("T-Shirt"):
//     this.props = {
//       "name":           "A T-Shirt",
//       "type":           type,
//       "type_string":    "A T-Shirt",
//       "description":    "A plain red T-Shirt.",        
//       "container_id":   "0",
//       "is_consumable":  false,
//       "hp_restored":    null,
//       "is_holdable":    false,
//       "wear_slot":      "Torso",
//       "is_gettable":    true,
//       "key_code":       null,
//     }
//     break;

//   case ("Keycard"):
//     this.props = {
//       "name":           "A Keycard",
//       "type":           type,
//       "type_string":    "A Keycard",
//       "description":    "A small rectangular plastic card.",        
//       "container_id":   "0",
//       "is_consumable":  false,
//       "hp_restored":    null,
//       "is_holdable":    true,
//       "wear_slot":      null,
//       "is_gettable":    true,
//       "key_code":       "000000",
//     }
//     break;
  
//   default:
//     console.error(`Item constructor: unknown type - ${type}`);
// }
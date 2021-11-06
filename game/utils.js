const World=    require('./world');
const Classes=  require('./classes');

//Keeps tracks of current ID, and generates a new one.
//IDs are Strings, generated in sequencal order.
//There is a single ID_Generator instance.
class ID_Generator {
  constructor(){
    //Note: IDs are handled as Numbers internally, 
    //but everywhere else in the game they are Strings.
    this.current_id = 0;
  }
  
  get_new_id(){
    this.current_id += 1;
    let new_id = this.current_id.toString();    
    return new_id;
  }
  
  set_new_current_id(id){
    this.current_id = parseInt(id,10);
  }
}
const id_generator_instance = new ID_Generator();

//Responsible for sending messages to users.
//There is only one instance of it.
class Message_Sender {
  constructor(){
    //TBD
  }

  send_message_to_user(user_id, message){        
    //Auxilary methond - Not meant to be called directly
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_message_to_room(user_id, message, dont_send_to_user=false){
    //Not meant to be called directly  
    let user=       World.world.get_instance(user_id);
    let container=  World.world.get_instance(user.container_id);

    let arr= container.get_users();
    for (const id of arr){
      if (id===user_id && dont_send_to_user) continue;
      this.send_message_to_user(id, message);
    }
  }

  send_status_msg_to_user(user_id){
    //Send a Status message to the user via WebSocket.
    let user = World.world.get_instance(user_id);    

    let holding_html = 'Nothing.';
    if (user.props["holding"]!==null){
      let entity = World.world.get_instance(user.props["holding"]);
      holding_html = entity.get_short_look_string();
    }

    let wearing_head = 'Nothing.';
    if (user.props["wearing"]["Head"]!==null){
      let entity = World.world.get_instance(user.props["wearing"]["Head"]);
      wearing_head = entity.get_short_look_string();
    }

    let wearing_torso = 'Nothing.'
    if (user.props["wearing"]["Torso"]!==null){
      let entity = World.world.get_instance(user.props["wearing"]["Torso"]);
      wearing_torso = entity.get_short_look_string();
    }

    let wearing_legs = 'Nothing.';
    if (user.props["wearing"]["Legs"]!==null){
      let entity = World.world.get_instance(user.props["wearing"]["Legs"]);
      wearing_legs = entity.get_short_look_string();
    }

    let wearing_feet = 'Nothing.';
    if (user.props["wearing"]["Feet"]!==null){
      let entity = World.world.get_instance(user.props["wearing"]["Feet"]);
      wearing_feet = entity.get_short_look_string();
    }

    let slots_html = '';
    for (const entity_id of user.props['slots']){
      let entity = World.world.get_instance(entity_id);
      slots_html += entity.get_short_look_string();
    }

    if (slots_html===''){
      slots_html = 'Nothing.'
    }
    
    let msg = {
      type:     "Status",
      content:  {
        health: user.props["health"],
        holding: holding_html,
        wearing: {
          head: wearing_head,
          torso: wearing_torso,
          legs: wearing_legs,
          feet: wearing_feet,
        },
        slots: slots_html,
        room_lighting: World.world.get_instance(user.props["container_id"]).props["lighting"],
      }
    }
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(msg));
  }

  send_chat_msg_to_user(user_id, sender, text){
    //Send a Chat message to the user via WebSocket.
    let message = {
      type:    'Chat',      
      content: text
    }
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_login_msg_to_user(ws_client, is_login_successful){
    let msg = {
      type: "Login",
      content: {
        is_login_successful: is_login_successful
      }
    }
    
    ws_client.send(JSON.stringify(msg));
  }

  send_chat_msg_to_room(sender_id, sender, text, dont_send_to_user=false){
    
    //Send a Chat message to all entities in the same room as the sender.
    let sender_entity=     World.world.get_instance(sender_id);
    let container= World.world.get_instance(sender_entity.props.container_id);

    if (!(container instanceof Classes.Room)){
      container = World.world.get_instance(container.props.container_id);
    }

    //Now the container is the room
    let arr = container.get_entities_ids();
    for (const id of arr){
      if (id===sender_id && dont_send_to_user) continue;

      let entity = World.world.get_instance(id);
      
      if (entity instanceof Classes.User){
        //TODO: fix bug - larry is NPC but shows as User
        this.send_chat_msg_to_user(id, sender, `${generate_html(sender_id, 'User')} ${text}`);
      } else if (entity instanceof Classes.NPC){
        entity.get_msg(sender_id, text.toLowerCase());
      }      
    }
  }
  
  broadcast_message(message){
    //Broadcast a message to all connected clients.
    //To Be Implemented.
  }
}
const msg_sender_instance = new Message_Sender();

function get_opposite_direction(direction){  
  switch(direction){
    case('north'):
      return 'south';
    case('south'):
      return 'north';
    case('east'):
      return 'west';
    case('west'):
      return 'east';
    case('up'):
      return 'down';
    case('down'):
      return 'up';
  }
}

function move_to_room(id, current_room_id, new_room_id){
  //Move the given entity from room to room.

  let current_room = World.world.get_instance(current_room_id);
  current_room.remove_entity(id);

  let new_room = World.world.get_instance(new_room_id);
  new_room.add_entity(id);

  World.world.get_instance(id).set_container_id(new_room_id);
}

function search_for_target(user_id, target){
  //Search for a target in the room, or in the user's vicinity, from close to far.  
  //returns an object {entity_id, location} or null.
  
  //Auxilary helper function
  const test_if_target = (entity, target) => {
    //Return ID (string) or null.
    if ((entity.props.name.toLowerCase()===target) ||
        (entity.props.type.toLowerCase()===target) ||
        (target===entity.id)){
      return entity.id;
    }
    return null;
  }

  let user = World.world.get_instance(user_id);

  if (user.props["holding"]!==null){
    let entity = World.world.get_instance(user.props["holding"]);
    let entity_id = test_if_target(entity,target);
    if (entity_id!==null){
      return {entity_id: entity_id, location: "Holding"}
    }
  }

  //Target not in Holding. Check Wearing.

  for (const [position, id] of Object.entries(user.props["wearing"])){
    if (id!==null){
      let entity = World.world.get_instance(id);
      let entity_id = test_if_target(entity,target);
      if (entity_id!==null){
        return {entity_id: entity_id, location: `${position}`}
      }
    }
  }
  
  //Target not in Wearing. Check Slots.

  for (const id of user.props["slots"]){
    let entity = World.world.get_instance(id);
    let entity_id = test_if_target(entity,target);
    if (entity_id!==null){
      return {entity_id: entity_id, location: "Slots"}
    }
  }
    
  //Target Not found in Slots. Check Room.
  
  let room = World.world.get_instance(user.props["container_id"]);
  let id_arr=   room.get_entities_ids();
  for (const id of id_arr){
    let entity = World.world.get_instance(id);
    let entity_id = test_if_target(entity,target);
    if (entity_id!==null){
      return {entity_id: entity_id, location: "Room"}
    }
  }

  //Check the room itself
  let entity_id = test_if_target(room, target);
  if (entity_id!==null){
    return {entity_id: entity_id, location: "World"}
  }

  //Target is not found.
  return null;
}

function generate_html(entity_id, type){

  let entity = World.world.get_instance(entity_id);

  if (type==="User" || type==="Room"){
    return  `<span class="pn_link" data-element="pn_link" data-type="${type}" ` + 
            `data-id="${entity.id}" data-name="${entity.props["name"]}" `+
            `data-actions="Look">${entity.props["name"]}</span>`
  } else if (type==="Item"){
    return  `<span class="pn_link" data-element="pn_link" data-type="${type}" ` + 
            `data-id="${entity.id}" data-name="${entity.props["name"]}" `+
            `data-actions="Look_Get_Drop_Wear_Hold_Consume_Remove">`+ 
            `${entity.props["name"]}</span>`
  } else if (type==="NPC"){
    return  `<span class="pn_link" data-element="pn_link" data-type="${type}" ` + 
            `data-id="${entity.id}" data-name="${entity.props["name"]}"`+
            `data-actions="Look_Kill">${entity.props["name"]}</span>`
  }
}

function deepCopyFunction(inObject){
  let outObject, value, key;

  if (typeof inObject !== "object" || inObject === null) {
    return inObject // Return the value if inObject is not an object
  }

  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {}

  for (key in inObject) {
    value = inObject[key]

    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = deepCopyFunction(value)
  }

  return outObject
}

class StateMachine {
  //A machine as a value (=current state), and a function that transition it 
  //from the current state to the next state according to given event.
  constructor(stm_definition){
    this.machine = this.createMachine(stm_definition);    
  }

  createMachine(stm_definition){
    const machine = {
      current_state: stm_definition.initialState,

      transition(current_state, event, params_obj=null){        
        const currentStateDefinition= stm_definition[current_state];
        const next_state=             currentStateDefinition.transitions[event];        

        if (!next_state){
          //If the given event does not trigger a transition, return early.
          return;
        }

        // const destinationState = destinationTransition.target;
        const next_state_definition = stm_definition[next_state];
        
        //Perform the actions.        
        next_state_definition.action(params_obj);        

        //return the next state.
        machine.current_state = next_state;
        return machine.current_state;
      }      
    }
    
    return machine;
  }  
  
}
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.move_to_room=           move_to_room;
exports.search_for_target=      search_for_target;
exports.generate_html=          generate_html;
exports.StateMachine=           StateMachine;
exports.deepCopyFunction=       deepCopyFunction;
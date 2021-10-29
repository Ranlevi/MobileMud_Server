const World=    require('./world');
const Classes=  require('./classes');

//Keeps tracks of current ID, and generates a new one.
//IDs are Strings, generated in sequencal order.
//There is a single ID_Generator instance.
class ID_Generator {
  constructor(){
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

  send_status_msg_to_user(user_id, status_obj){
    //Send a Status message to the user via WebSocket.
    let msg = {
      type:     "Status",
      content:  status_obj
    }
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(msg));
  }

  send_chat_msg_to_user(user_id, sender, text){
    //Send a Chat message to the user via WebSocket.
    let message = {
      type:       'Chat',
        content: {
          sender: sender,
          text:   text
        }        
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
    //Send a Chat message to all users in the same room as the sender.
    let user= World.world.get_instance(sender_id);
    let room= World.world.get_instance(user.props["container_id"]);

    let arr = room.get_users();
    for (const id of arr){
      if (id===sender_id && dont_send_to_user) continue;            
      this.send_chat_msg_to_user(id, sender, text);
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
    if ((entity.props["name"].toLowerCase()===target) ||
        (entity.props["type"].toLowerCase()==target) ||
        (target===entity.id)){
      return id;
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

  //Target is not found.
  return null;
}

function generate_html(entity_id){

  let entity = World.world.get_instance(entity_id, type);

  if (type==="User" || type==="Room"){
    return  `<span class="pn_link" data-element="pn_link" data-type="${type}" ` + 
            `data-id="${entity.id}" data-name="${entity.props["name"]}" >`+
            `data-actions="Look" ${entity.props["name"]}</span>`
  } else if (type==="Item"){
    return  `<span class="pn_link" data-element="pn_link" data-type="${type}" ` + 
            `data-id="${entity.id}" data-name="${entity.props["name"]}" >`+
            `data-actions="Look_Get_Drop_Wear_Hold_Consume_Remove" `+ 
            `${entity.props["name"]}</span>`
  }
}
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.move_to_room=           move_to_room;
exports.search_for_target=      search_for_target;
exports.generate_html=          generate_html;
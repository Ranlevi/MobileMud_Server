const World=    require('./world');

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

function search_for_target(target, array_of_ids){
  //scans an array for a given target.
  //Target can be an id, or a name or a type.

  for (const id of array_of_ids){
    let entity = World.world.get_instance(id);
    if ((entity.props["name"].toLowerCase()===target) ||
    (entity.props["type"].toLowerCase()==target) ||
    (target===entity.id)){
      return id;
    }
  }

  //No target found
  return null;
}
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.move_to_room=           move_to_room;
exports.search_for_target=      search_for_target;
// const Classes=  require('./classes');
const World=    require('./world');

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

// class Message_Formatter {
//   constructor(){
//     //TBD    
//   }

// //   generate_look_room_msg(room_id, user_id){
// //     let room = World.world.get_instance(room_id);
    
// //     let msg = `**[${room.name}]({type:"room", id:${room_id}}, `;
// //     msg += `lighting: ${room.lighting})**  ${room.description}  `;
// //     msg += `Exits:  `;

// //     for (const [direction, next_room_id] of Object.entries(room.exits)){
// //       if (next_room_id!==null){
// //           msg += `[${direction}]({type:"command"}) `
// //       }
// //     }

// //     msg += '  '; //new paragraph

// //     let entities_arr = room.get_entities();
    
// //     if (entities_arr.length===1){
// //       //Only the player is in the room.
// //       msg += 'The room is empty.';
// //     } else {
// //       msg += 'With you in the room:  ';

// //       for (const entity_id of entities_arr){
// //         if (entity_id===user_id) continue; //skip the player.

// //         let entity = World.world.get_instance(entity_id);
// //         msg += `[${entity.name}]({type:${entity.type_string}, id:${entity_id}}), `;
// //         msg += `${entity.type_string}`;
// //       }
// //     }

// //     return msg;
// // }

//   // generate_look_entity_msg(entity_id){
//   //   let entity = World.world.get_instance(entity_id);
    
//   //   //Different messages for NPCs and Objects.
//   //   if (entity instanceof Classes.NPC){
//   //     let msg = `This is ${entity.name}, ${entity.type_string}`
//   //     return msg;
//   //   } else if (entity instanceof Classes.InAnimateObject){
//   //     let msg = `This is ${entity.name}, ${entity.type_string}`
//   //     return msg;
//   //   }
//   // }
// }
// const msg_formatter_instance = new Message_Formatter();

class Message_Sender {
  constructor(){
    //TBD
  }

  send_message_to_user(user_id, message){      
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_message_to_room(user_id, message, dont_send_to_user=false){
    let user = World.world.get_instance(user_id);
    let room = World.world.get_instance(user.room_id);
    let arr = room.get_users();
    for (const id of arr){
      if (id===user_id && dont_send_to_user) continue;
      this.send_message_to_user(id, message);
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

function search_for_target(room_id, target){
  //target is string
  //search order: wear, hold, slots, room. 

  let room = World.world.get_instance(room_id);
  let entities_ids_arr = room.get_entities();

  for (const entity_id of entities_ids_arr){
    let entity = World.world.get_instance(entity_id);

    if (entity.name!==null && entity.name.toLowerCase()===target){
      return entity_id;
    } else if (entity.type.toLowerCase()==target){
      return entity_id;
    }     
  }

  return null; //no target found
}
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
// exports.msg_formatter=          msg_formatter_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.search_for_target = search_for_target;

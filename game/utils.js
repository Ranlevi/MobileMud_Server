const Classes = require('./classes');
const World = require('./world');

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
Object.freeze(id_generator_instance);

class Message_Formatter {
constructor(world){
    this.world = world;
}

generate_look_room_msg(room_id, user_id){
    let room = this.world.get_instance(room_id);
    
    let msg = `**[${room.name}]({type:"room", id:${room_id}}, `;
    msg += `lighting: ${room.lighting})**  ${room.description}  `;
    msg += `Exits:  `;

    for (const [direction, next_room_id] of Object.entries(room.exits)){
    if (next_room_id!==null){
        msg += `[${direction}]({type:"command"}) `
    }
    }

    msg += '  '; //new paragraph

    let entities_arr = room.get_entities();
    
    if (entities_arr.length===1){
    //Only the player is in the room.
    msg += 'The room is empty.';
    } else {

    msg += 'With you in the room:  ';

    for (const entity_id of entities_arr){
        if (entity_id===user_id) continue; //skip the player.

        let entity = this.world.get_instance(entity_id);
        msg += `[${entity.name}]({type:${entity.type}, id:${entity_id}}), `;
        msg += `${entity.type}`;
    }
    }
    return msg;
}

generate_look_entity_msg(entity_id){
    let entity = this.world.get_instance(entity_id);
    
    //Different messages for NPCs and Objects.
    if (entity instanceof Classes.NPC){
    let msg = `This is ${entity.name}, ${entity.type}`
    return msg;
    }
  }
}

const msg_formatter_instance = new Message_Formatter();
Object.freeze(msg_formatter_instance);

class Message_Sender {
  constructor(){
    //TBD
  }

  send_message_to_user(user_id, message){    
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_message_to_room(room_id, message){
    let room = World.world.get_instance(room_id);
    let arr = room.get_users()
    for (const user_id of arr){
      this.send_message_to_user(user_id, message);      
    }
  }

  broadcast_message(message){
    //Broadcast a message to all connected clients.
    //To Be Implemented.
  }
}

const msg_sender_instance = new Message_Sender();
Object.freeze(msg_sender_instance);

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
  
  
exports.id_generator = id_generator_instance;
exports.msg_sender  = msg_sender_instance;
exports.msg_formatter = msg_formatter_instance;
exports.get_opposite_direction = get_opposite_direction;

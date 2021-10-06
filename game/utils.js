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
    let container = World.world.get_instance(user.container_id);
    let arr = container.get_users();
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

function search_for_target(container_id, target){
  //target is string
  //search order: wear, hold, slots, room. 

  let container = World.world.get_instance(container_id);
  let entities_ids_arr = container.get_entities();

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

class Queue {
  constructor(){
    this.elements = []; //Index 0 is the front, i.e. next msg to be retrieved.
  }

  load(elements_arr){
    //Element at index 0 is the first msg.
    for (let i=0;i<elements_arr.length;i++){
      this.elements.push(elements_arr[i]);
    }
  }

  dequeue(){
    if (this.elements.length!==0){
      let msg = this.elements.shift();
      if (this.elements.length===0){
        msg += 'End of Message Chain.'
      } else {
        msg += '[Next]({type:"Command"}) [End]({type:"Command"})';
      }
      return msg;
    } else {
      return null;
    }      
  }
  
  clear(){
    this.elements = [];
  }
}
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.search_for_target=      search_for_target;
exports.Queue=                  Queue;

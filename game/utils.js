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
    console.log(message);
    //Not meant to be called directly  
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_message_to_room(user_id, message, dont_send_to_user=false){
    //Not meant to be called directly  
    let user = World.world.get_instance(user_id);
    let container = World.world.get_instance(user.container_id);
    let arr = container.get_users();
    for (const id of arr){
      if (id===user_id && dont_send_to_user) continue;
      this.send_message_to_user(id, message);
    }
  }

  send_status_msg_to_user(user_id, health){
    let msg = {
      type:     "Status",
      content:  {health: health}
    }
    let ws_client = World.world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(msg));
  }

  send_chat_msg_to_user(user_id, sender, text){
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

  send_chat_msg_to_room(sender_id, sender, text, dont_send_to_user=false){
    
    let user = World.world.get_instance(sender_id);
    let container = World.world.get_instance(user.container_id);
    let arr = container.get_users();
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

// class Queue {
//   constructor(){
//     this.elements = []; //Index 0 is the front, i.e. next msg to be retrieved.
//   }

//   load(elements_arr){
//     //Element at index 0 is the first msg.
//     for (let i=0;i<elements_arr.length;i++){
//       this.elements.push(elements_arr[i]);
//     }
//   }

//   dequeue(){
//     if (this.elements.length!==0){
//       let msg = this.elements.shift();
//       if (this.elements.length!==0){
//         msg += '[Next]({type:"Command"}) [End]({type:"Command"})';
//       }       
//       return msg;
//     } else {
//       return null;
//     }      
//   }
  
//   clear(){
//     this.elements = [];
//   }
// }
    
exports.id_generator=           id_generator_instance;
exports.msg_sender=             msg_sender_instance;
exports.get_opposite_direction= get_opposite_direction;
// exports.Queue=                  Queue;

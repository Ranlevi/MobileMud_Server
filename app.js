var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');

const LOAD_WORLD_FROM_SAVE = true;
let   FIRST_ROOM_ID        = '0';

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

let world=            null;
let id_generator=     null;
let msg_sender=       null;
let msg_formatter=    null;

class GameEvent {
  constructor(due_in, event_data){
    this.due_in = due_in;
    this.event_data = event_data;
  }
  decrement_due_in(){
    this.due_in -= 1;
  }
}

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

class World {
  //World state.
  constructor(){
    this.world = new Map(); //id: entity instance.
  }

  get_instance(instance_id){
    return this.world.get(instance_id);
  }

  add_to_world(instance){
    this.world.set(instance.id, instance);
  }

  add_entity_to_room(entity_id, room_id){
    let entity = this.get_instance(entity_id);
    let room   = this.get_instance(room_id);
    room.add_entity(entity_id);
    entity.room_id = room_id;
  }

  add_room(current_room_id, direction){
    let current_room = world.get_instance(current_room_id);

    let new_room = new Room(
      'A Room',
      'This is an empty, generic room.'
    )
    this.add_to_world(new_room);
    current_room.add_exit(direction, new_room.id);
    new_room.add_exit(get_opposite_direction(direction), current_room_id);
    return new_room.id;
  }    
}

class BaseType {
  //Not meant to be called directly.
  constructor(name, description, id){
    this.id= (id===null)? id_generator.get_new_id() : id;
    this.name=        name;
    this.description= description;
    this.scheduled_event = null;
    // this.current_state = null;
    //An entity can schedule a single event for the future.
    //each tick the due_in decreases, until it is 0 and then
    //excecuted. 
    //If something happens that influences the future event,
    //the entity can discard it and schedule a new one. 
  }

  decrement_scheduled_events_due_in(){
    if (this.scheduled_event!==null){
      this.scheduled_event.decrement_due_in();
    }
  }

  process_tick(){
    //do nothing unless overided by instance
  }

  cleak_scheduled_event(){
    this.scheduled_event=null;
  }

}

class Entity extends BaseType {
  //Not meant to be called directly.
  constructor(name, description, id){
    super(name, description, id);
    this.room_id = null;
  }
}

class User extends Entity {
  constructor(name, description, ws_client, id=null){
    super(name, description, id);
    this.ws_client = ws_client;
    this.type = "A Player";
  }
}

class NPC extends Entity {
  //Not meant to be called directly.
  constructor(name, description, id){
    super(name, description, id);    
  }
}

class Dog extends NPC {
  constructor(name, description, id=null){
    super(name, description, id);
    this.type = "A Dog";
    this.scheduled_event = new GameEvent(5,{action: "bark"});
  }

  process_tick(){
    
    if (this.scheduled_event.due_in===0){

        if (this.scheduled_event.event_data.action==="bark"){
          //Send a message to the room.
          let msg = {
            sender: 'world',
            content: `${this.name} Barks!`
          }
          msg_sender.send_message_to_room(this.room_id, msg);

          //Schedule a new event.
          this.scheduled_event = new GameEvent(5,{action: "bark"});
        }        
    }

    // if (this.scheduled_event===null){
    //   this.scheduled_event = new GameEvent(5,{
    //     action: "bark"
    //   })
    // } else {
    //   if (this.scheduled_event.due_in===0){
    //     //bark
    //     let msg = generate_action_msg(this.id, "barks");
    //     msg_sender.send_message_to_room(this.current_room, msg);

    //     this.scheduled_event = new GameEvent(5,{
    //       action: "bark"
    //     })
    //   } 
    // } 
    //process the current event if available.
    //then, schedule a new one if needed.
    //state machine progresses via ticks.
    // switch(this.current_state){
    //   case(null):
    //     let event = new GameEvent(5,{
    //       action: "next state"
    //     })
    //     this.current_state="Idle";
    //     break;
    //   case("Idle"):

    //     this.current_state="Excited";
    //     break;
    //   case('Excited'):
    //     this.current_state="Fearful";
    //     break;
    //   case('Fearful'):
    //     this.current_state="Idle";
    //     break;
    //   }
    
    //dog state machine
    //ST1: idle
    //ST2: excited
    //ST3: fearful
  }
}

class Room extends BaseType {
  constructor(name, description, id=null){
    super(name, description, id);
    this.entities = new Set();
    this.exits    = {
      "north": null,
      "south": null,
      "west":  null,
      "east":  null,
      "up":    null,
      "down":  null
    },
    this.lighting = "white"; //CSS colors
  }

  add_exit(direction, next_room_id){
    this.exits[direction] = next_room_id;
  }

  add_entity(entity_id){
    this.entities.add(entity_id);
  }

  remove_entity(entity_id){
    this.entities.delete(entity_id);
  }

  get_entities(){
    let arr = [];
    for (let entity_id of this.entities){
      arr.push(entity_id);
    }
    return arr;
  }

  get_users(){
    let arr = [];
    for (let entity_id of this.entities){
      let entity = world.get_instance(entity_id);
      if (entity instanceof User){
        arr.push(entity_id);
      }
    }
    return arr;
  }

  set_lighting(color){
    this.lighting = color;
  }
}

class Message_Formatter {
  constructor(){
    //TBD
  }

  generate_look_room_msg(room_id, user_id){
    let room = world.get_instance(room_id);
    
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

        let entity = world.get_instance(entity_id);
        msg += `[${entity.name}]({type:${entity.type}, id:${entity_id}}), `;
        msg += `${entity.type}`;
      }
    }
    return msg;
  }

  // generate_action_msg(entity_id, content){
  //   let entity = world.get_instance(entity_id);
  //   let msg = `[${entity.name}]({type:${entity.type}, id:${entity_id}}) `;
  //   msg += `${content}`;
  //   return msg;
  // }
}

class Message_Sender {
  constructor(){   
    //TBD
  }

  send_message_to_user(user_id, message){    
    let ws_client = world.get_instance(user_id).ws_client;
    ws_client.send(JSON.stringify(message));
  }

  send_message_to_room(room_id, message){
    let room = world.get_instance(room_id);
    let arr = room.get_users()
    for (const user_id of arr){
      world.get_instance(user_id).ws_client.send(JSON.stringify(message));
    }
  }

  broadcast_message(message){
    //Broadcast a message to all connected clients.
    //To Be Implemented.
  }
}

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

class Game_Controller {
  constructor(){
    this.init_game();
  }

  init_game(){
    id_generator=   new ID_Generator();    
    world=          new World();
    msg_sender=     new Message_Sender();
    msg_formatter=  new Message_Formatter();
      
    if (LOAD_WORLD_FROM_SAVE){
      this.load_world();
    } else {
      this.generate_world();
    }    
  
    app.listen(3000); //Ready to recive connections.
  
    setInterval(this.game_loop, 1000);
  }

  generate_world(){
    let room = new Room(
      'Room 1',
      'This is the first room of the game.'
    )  
  
    world.add_to_world(room);  
  
    room = world.add_room(room.id, 'north');
    room.set_lighting('silver');
    //TODO: add room name/descripion
  
  }
  
  load_world(){
    
    if (fs.existsSync(`./world_save.json`)){
      let current_id;
      let data = JSON.parse(fs.readFileSync('./world_save.json'));
  
      for (const [id, instance_data] of Object.entries(data)){
        current_id = id;
  
        if (instance_data.type==="room"){
          let room = new Room(instance_data.name, instance_data.description, id);
          
          room.set_lighting(instance_data.lighting);
  
          for (const [direction, next_room_id] of Object.entries(instance_data.exits)){
            room.add_exit(direction, next_room_id);
          }
  
          world.add_to_world(room);
  
        } else {
          //It's an npc
          let entity = null;
          switch(instance_data.type){
            case ("dog"):
              entity = new Dog(instance_data.name, instance_data.description, id);
              break;
          }
  
          world.add_to_world(entity);
          world.add_entity_to_room(entity.id, instance_data.room_id);
        }
      }
  
      id_generator.set_new_current_id(current_id);
  
    } else {
      //TODO: fallback if no save exists
    }
  }
  
  game_loop(){
    
    world.world.forEach(
      (item) => item.decrement_scheduled_events_due_in()
    );

    world.world.forEach(
      (item) => item.process_tick()
    );

  }

  new_client_connected(ws_client){
    let user = new User('HaichiPapa', "It's you, bozo", ws_client);
    world.add_to_world(user);
    world.add_entity_to_room(user.id, FIRST_ROOM_ID);
    let msg = {
      sender: "world",
      content: `Hi ${user.name}, your ID is ${user.id}`
    }
    msg_sender.send_message_to_user(user.id, msg);  
    this.look_cmd(user.id);      
    return user.id;
  }

  process_incoming_message(event, user_id){
  
    let normalized_text= event.data.trim().toLowerCase();  
    let re = /\s+/g; //search for all white spaces.
    let input_arr = normalized_text.split(re);
    
    let cmd = input_arr[0];
  
    switch(cmd){
      case 'look':
      case 'l':
        this.look_cmd(user_id);
        break;
  
      case 'north':
      case 'n':
        this.move_cmd('north', user_id);
        break;
  
      case 'south':
      case 's':
        this.move_cmd('south', user_id);
        break;
  
      case 'west':
      case 'w':
        this.move_cmd('west', user_id);
        break;
  
      case 'east':
      case 'e':
        this.move_cmd('east', user_id);
        break;
  
      case 'up':
      case 'u':
        this.move_cmd('up', user_id);
        break;
  
      case 'down':
      case 'd':
        this.move_cmd('down', user_id);
        break;
    }  
  }

  look_cmd(user_id){
    let user = world.get_instance(user_id);
    let room = world.get_instance(user.room_id);

    let message = {
      sender: 'world',
      content: msg_formatter.generate_look_room_msg(room.id, user_id)
    }
    msg_sender.send_message_to_user(user_id, message)
  }

  move_cmd(direction, user_id){
    let user=         world.get_instance(user_id);
    let current_room= world.get_instance(user.room_id);

    if (current_room.exits[direction]===null){
      //Exit does not exist
      let message = {
        sender: 'world',
        content: `There's no exit to ${direction}.`        
      }
      msg_sender.send_message_to_user(user_id, message)
      return;
    }

    //Exit exists.
    let new_room=     world.get_instance(current_room.exits[direction]);

    user.room_id = new_room.id;
    current_room.remove_entity(user.id);
    new_room.add_entity(user_id);

    let message = {
      sender: 'world',
      content: `
        You travel ${direction} to ${new_room.name}.`        
    }
    msg_sender.send_message_to_user(user_id, message)

    this.look_cmd(user.id);

  }
}

let game_controller=  new Game_Controller();

//-- WebSockets
wss.on('connection', (ws_client) => {
  
  let user_id = game_controller.new_client_connected(ws_client);  

  ws_client.on('close', () => {
    console.log(`Client User ID ${user_id}disconnected`);
    //TODO: save user.
  });

  ws_client.onmessage = (event) => {
    game_controller.process_incoming_message(event, user_id);    
  }
});
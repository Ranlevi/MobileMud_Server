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

//-- WebSockets
wss.on('connection', (ws_client) => {
  
  let user_id = new_client_connected(ws_client);  
  ws_client.on('close', () => {
    console.log(`Client User ID ${user_id}disconnected`);
    //TODO: save user.
  });

  ws_client.onmessage = (event) => {
    process_incoming_message(event, user_id);    
  }
});

let world=        null;
let id_generator= null;
let msg_sender=   null;
let game_controller = null;
let msg_formatter = null;

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

class Game_Controller {
  constructor(){
    //TBD    
  }

  look_cmd(user_id){
    let user = world.get_instance(user_id);
    let room = world.get_instance(user.room_id);

    let message = {
      sender: 'world',
      content: msg_formatter.generate_look_room_msg(room.id, user_id)
    }
    msg_sender.send_message(user_id, message)
  }

  move_cmd(direction, user_id){
    let user=         world.get_instance(user_id);
    let current_room= world.get_instance(user.room_id);
    let new_room=     world.get_instance(current_room.exits[direction]);

    user.room_id = new_room.id;
    current_room.remove_entity(user.id);
    new_room.add_entity(user_id);

    let message = {
      sender: 'world',
      content: `
        You travel ${direction} to ${new_room.name}.`        
    }
    msg_sender.send_message(user_id, message)

    this.look_cmd(user.id);

  }
}

class Message_Formatter {
  constructor(){
    //TBD
  }

  generate_look_room_msg(room_id, user_id){
    let room = world.get_instance(room_id);
    let msg = 
    `**[${room.name}]({type:"room", id:${room_id}})**  ${room.description}
    Exits:  `;

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
}

//-------------
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
    }
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
}

class Message_Sender {
  constructor(world){
    this.world = world;
  }

  send_message(user_id, message){
    this.ws_client = this.world.get_instance(user_id).ws_client;
    this.ws_client.send(JSON.stringify(message));
  }

  broadcast_message(message){
    //Broadcast a message to all connected clients.
    //To Be Implemented.
  }
}

/////////////////////////////////////////
function init_game(){

  id_generator= new ID_Generator();    
  world=        new World();
  msg_sender=   new Message_Sender(world);
  game_controller = new Game_Controller();
  msg_formatter = new Message_Formatter();

  if (LOAD_WORLD_FROM_SAVE){
    load_world();
  } else {
    generate_world();
  }
  

  app.listen(3000); //Ready to recive connections.
}

init_game();

function generate_world(){
  let room = new Room(
    'Room 1',
    'This is the first room of the game.'
  )

  world.add_to_world(room);  

  room = world.add_room(room.id, 'north');
  //TODO: add room name/descripion

}

function load_world(){
  
  if (fs.existsSync(`./world_save.json`)){
    let current_id;
    let data = JSON.parse(fs.readFileSync('./world_save.json'));

    for (const [id, instance_data] of Object.entries(data)){
      current_id = id;

      if (instance_data.type==="room"){
        let room = new Room(instance_data.name, instance_data.description, id);
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

function new_client_connected(ws_client){
  let user = new User('HaichiPapa', "It's you, bozo", ws_client);
  world.add_to_world(user);
  world.add_entity_to_room(user.id, FIRST_ROOM_ID);
  let msg = {
    sender: "world",
    content: `Hi ${user.name}, your ID is ${user.id}`
  }
  msg_sender.send_message(user.id, msg);

  game_controller.look_cmd(user.id);

  // let room = world.get_instance(FIRST_ROOM_ID);
  // msg = {
  //   sender: 'world',
  //   content: msg_formatter.generate_look_room_msg(room.id, user.id)
  // }
  // msg_sender.send_message(user.id, msg);

  return user.id;
}

function process_incoming_message(event, user_id){
  
  let normalized_text= event.data.trim().toLowerCase();  
  let re = /\s+/g; //search for all white spaces.
  let input_arr = normalized_text.split(re);
  
  let cmd = input_arr[0];

  switch(cmd){
    case 'look':
    case 'l':
      game_controller.look_cmd(user_id);
      break;

    case 'north':
    case 'n':
      game_controller.move_cmd('north', user_id);
      break;

    case 'south':
    case 's':
      game_controller.move_cmd('south', user_id);
      break;

    case 'west':
    case 'w':
      game_controller.move_cmd('west', user_id);
      break;

    case 'east':
    case 'e':
      game_controller.move_cmd('east', user_id);
      break;

    case 'up':
    case 'u':
      game_controller.move_cmd('up', user_id);
      break;

    case 'down':
    case 'd':
      game_controller.move_cmd('down', user_id);
      break;
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
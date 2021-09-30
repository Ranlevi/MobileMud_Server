var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');

const Utils = require('./game/utils');
const Classes = require('./game/classes');
const World = require('./world');

const LOAD_WORLD_FROM_SAVE = true;
let   FIRST_ROOM_ID        = '0';

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

// let world=            null;
// let id_generator=     null;
// let msg_sender=       null;
// let msg_formatter=    null;

class Game_Controller {
  constructor(){
    // this.id_generator = new Utils.id_generator();    
    // this.msg_sender=     new Message_Sender();
    // this.msg_formatter=  new Utils.Message_Formatter();
    
    this.init_game();
  }

  init_game(){
    // id_generator=   new Utils.ID_Generator();    
    // world=          new World();
    // msg_sender=     new Message_Sender();
    // msg_formatter=  new Message_Formatter();
      
    if (LOAD_WORLD_FROM_SAVE){
      this.load_world();
    } else {
      this.generate_world();
    }    
  
    app.listen(3000); //Ready to recive connections.
  
    setInterval(this.game_loop, 1000);
  }

  generate_world(){
    let room = new Classes.Room(
      'Room 1',
      'This is the first room of the game.'
    )  
  
    World.world.add_to_world(room);  
  
    room = World.world.add_room(room.id, 'north');
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
          let room = new Classes.Room(instance_data.name, instance_data.description, id);
          
          room.set_lighting(instance_data.lighting);
  
          for (const [direction, next_room_id] of Object.entries(instance_data.exits)){
            room.add_exit(direction, next_room_id);
          }
  
          World.world.add_to_world(room);
  
        } else {
          //It's an npc
          let entity = null;
          switch(instance_data.type){
            case ("dog"):
              entity = new Classes.Dog(instance_data.name, instance_data.description, id);
              break;
          }
  
          World.world.add_to_world(entity);
          World.world.add_entity_to_room(entity.id, instance_data.room_id);
        }
      }
  
      Utils.id_generator.set_new_current_id(current_id);
  
    } else {
      //TODO: fallback if no save exists
    }
  }
  
  game_loop(){    
    var msg;
    World.world.world.forEach(
      (item) => {

        if (item instanceof Classes.Entity && item.is_fighting_with!==null){

          let damage_dealt = item.strike_opponent();
            
          let opponent = World.world.get_instance(item.is_fighting_with);
          msg = {
            sender: 'world',
            content: `${item.name} strikes ${opponent.name}, `+
                      `dealing ${damage_dealt} HP.`
          }
          Utils.msg_sender.send_message_to_room(item.room_id, msg);

          if (opponent.health===0){
            //Opponent has died
            item.stop_battle();

            msg = {
              sender: 'world',
              content: `${opponent.name} is DEAD!`
            }
            Utils.msg_sender.send_message_to_room(item.room_id, msg);

            //Create a corpse
            let corpse = new Classes.Corpse(opponent.name, opponent.description);
            World.world.add_to_world(corpse);
            World.world.add_entity_to_room(corpse.id, opponent.room_id);

            //If an NPC - remove from world.
            //If user - respwan
            if (opponent instanceof Classes.NPC){
              World.world.remove_item_from_world(opponent.id);
            } else if (opponent instanceof Classes.User){
              //Respawn the user
              let room = World.world.get_instance(opponent.room_id);
              room.remove_entity(opponent.id);

              room = World.world.get_instance(FIRST_ROOM_ID);
              room.add_entity(opponent.id);

              opponent.reset();

              msg = {
                sender: "world",
                content: `You respawned in the starting room.`
              }
              Utils.msg_sender.send_message_to_user(opponent.id, msg);
            }            
          }
        } else {
          item.process_tick();
        }
      }      
    );
  }

  new_client_connected(ws_client){
    let user = new Classes.User('HaichiPapa', "It's you, bozo", ws_client);
    World.world.add_to_world(user);
    World.world.add_entity_to_room(user.id, FIRST_ROOM_ID);
    let msg = {
      sender: "world",
      content: `Hi ${user.name}, your ID is ${user.id}`
    }
    Utils.msg_sender.send_message_to_user(user.id, msg);  

    this.process_incoming_message('look', user.id);    
    return user.id;
  }

  process_incoming_message(text, user_id){

    if (text==='') return;
  
    let normalized_text= text.trim().toLowerCase();  
    let re = /\s+/g; //search for all white spaces.
    let input_arr = normalized_text.split(re);
    
    let cmd = input_arr[0];
    let target;
    if (input_arr.length===1){
      target= null;
    } else {
      target = input_arr.slice(1).join(' ');
    } 

    switch(cmd){
      case 'look':
      case 'l':
        this.look_cmd(user_id,target);
        break;

      case 'kill':
      case 'k':
        this.kill_cmd(user_id, target);
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

  kill_cmd(user_id, target){

    if (target===null){
      let message = {
        sender: 'world',
        content: `Who do you want to kill?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);

    } else {

      let user=       World.world.get_instance(user_id);
      let room=       World.world.get_instance(user.room_id);
      let entity_id=  room.get_entity_id_by_name(target);

      if (entity_id===null){
        let message = {
          sender: 'world',
          content: `There is no ${target} around.`
        }
        Utils.msg_sender.send_message_to_user(user_id, message);

      } else {
        user.start_battle_with(entity_id);
        World.world.get_instance(entity_id).start_battle_with(user_id);
        //give the offence a bit of an advantage of striking first
        let damage_dealt = user.strike_opponent(entity_id);
        let opponent = World.world.get_instance(entity_id);
        let msg = {
          sender: 'world',
          content: `${user.name} attacks ${opponent.name}, `+
                    `dealing ${damage_dealt} HP.`
        }
        Utils.msg_sender.send_message_to_room(user.room_id, msg);
      }
    }
  }

  look_cmd(user_id, target){
    let user = World.world.get_instance(user_id);
    let room = World.world.get_instance(user.room_id);

    if (target===null){
      let message = {
        sender: 'world',
        content: Utils.msg_formatter.generate_look_room_msg(room.id, user_id)
      }
      Utils.msg_sender.send_message_to_user(user_id, message)

    } else {
      let entity_id = room.get_entity_id_by_name(target);

      if (entity_id===null){
        let message = {
          sender: 'world',
          content: `There is no ${target} around.`
        }
        Utils.msg_sender.send_message_to_user(user_id, message);
      
      } else {

        let message = {
          sender: 'world',
          content: Utils.msg_formatter.generate_look_entity_msg(entity_id)
        }
        Utils.msg_sender.send_message_to_user(user_id, message);
      }
    }    
  }

  move_cmd(direction, user_id){
    let user=         World.world.get_instance(user_id);
    let current_room= World.world.get_instance(user.room_id);

    if (current_room.exits[direction]===null){
      //Exit does not exist
      let message = {
        sender: 'world',
        content: `There's no exit to ${direction}.`        
      }
      Utils.msg_sender.send_message_to_user(user_id, message)
      return;
    }

    //Exit exists.
    let new_room=   World.world.get_instance(current_room.exits[direction]);

    user.room_id = new_room.id;
    current_room.remove_entity(user.id);
    new_room.add_entity(user_id);

    let message = {
      sender: 'world',
      content: `
        You travel ${direction} to ${new_room.name}.`        
    }
    Utilsmsg_sender.send_message_to_user(user_id, message)
    this.process_incoming_message('look', user.id);
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
    game_controller.process_incoming_message(event.data, user_id);    
  }
});
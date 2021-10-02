var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');
const Utils=                require('./game/utils');
const Classes=              require('./game/classes');
const World=                require('./game/world');

const LOAD_WORLD_FROM_SAVE = true;
let   FIRST_ROOM_ID        = '0';

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

class Game_Controller {
  constructor(){    
    this.init_game();
  }

  init_game(){
      
    if (LOAD_WORLD_FROM_SAVE){
      this.load_world();
    } else {
      this.generate_world();
    }    
  
    app.listen(3000); //Ready to recive connections.
  
    setInterval(this.game_loop, 1000);
  }

  generate_world(){
    //To be implemented  
  }
  
  load_world(){
    
    if (fs.existsSync(`./world_save.json`)){
      let current_id;
      let data = JSON.parse(fs.readFileSync('./world_save.json'));
  
      for (const [id, instance_data] of Object.entries(data)){
        current_id = id;
        var entity;

        switch(instance_data.type){
          case "Room":
            let room = new Classes.Room(instance_data.name, instance_data.description, id);          
            room.set_lighting(instance_data.lighting);
    
            for (const [direction, next_room_id] of Object.entries(instance_data.exits)){
              room.add_exit(direction, next_room_id);
            }
    
            World.world.add_to_world(room);
            break;

          case "Dog":
            entity = new Classes.Dog(
              instance_data.name, 
              instance_data.description, 
              instance_data.room_id,
              id);
            World.world.add_to_world(entity);
            break;

          case "Screwdriver":
            entity = new Classes.Screwdriver(
              instance_data.description, 
              instance_data.room_id,
              id);
            World.world.add_to_world(entity);
            break;
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

        if (item instanceof Classes.AnimatedObject && item.is_fighting_with!==null){
          let opponent = World.world.get_instance(item.is_fighting_with);

          let damage_dealt = item.strike_opponent(opponent.id);                      
          msg = {
            sender: 'world',
            content: `${item.name} strikes ${opponent.name}, `+
                      `dealing ${damage_dealt} HP.`
          }
          Utils.msg_sender.send_message_to_room(item.id, msg);

          if (opponent.health===0){
            //Opponent has died
            item.stop_battle();

            msg = {
              sender: 'world',
              content: `${opponent.name} is DEAD!`
            }
            Utils.msg_sender.send_message_to_room(item.id, msg);

            //Create a corpse
            let corpse = new Classes.Corpse(              
              opponent.description,
              opponent.room_id,
              );
            World.world.add_to_world(corpse);

            if (opponent instanceof Classes.User){
              opponent.reset(FIRST_ROOM_ID);

            } else {
              //Remove entity from the world
              let room = World.world.get_instance(opponent.room_id);
              room.remove_entity(opponent.id);
              World.world.remove_from_world(opponent.id);
            }          
          }
        } else {
          item.process_tick();
        }
      }      
    );
  }

  new_client_connected(ws_client){
    
    let user = new Classes.User(
      'HaichiPapa', 
      "It's you, bozo", 
      ws_client,
      FIRST_ROOM_ID
    );    
    World.world.add_to_world(user);

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

      case 'get':
      case 'g':
        this.get_cmd(user_id, target);
        break;

      case 'drop':
      case 'd':
        this.drop_cmd(user_id, target);
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

  //TODO: refactor like get_cmd
  kill_cmd(user_id, target){

    if (target===null){
      let message = {
        sender: 'world',
        content: `Who do you want to kill?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);

    } else {

      let user=       World.world.get_instance(user_id);
      let entity_id = Utils.search_for_target(user.room_id, target);

      if (entity_id===null){
        let message = {
          sender: 'world',
          content: `There is no ${target} around.`
        }
        Utils.msg_sender.send_message_to_user(user_id, message);

      } else {

        let opponent = World.world.get_instance(entity_id);

        if (!(opponent instanceof Classes.AnimatedObject)){
          let message = {
            sender: 'world',
            content: `You can't fight it.`
          }
          Utils.msg_sender.send_message_to_user(user_id, message);
          return;
        }

        user.start_battle_with(opponent.id);
        opponent.start_battle_with(user.id);

        //give the offence a bit of an advantage of striking first
        let damage_dealt = user.strike_opponent(opponent.id);
        
        let msg = {
          sender: 'world',
          content: `${user.name} attacks ${opponent.name}, `+
                    `dealing ${damage_dealt} HP.`
        }
        Utils.msg_sender.send_message_to_room(user.id, msg);
      }      
    }
  }

  //TODO: refactor like get_cmd
  look_cmd(user_id, target){
    let user = World.world.get_instance(user_id);
    let room = World.world.get_instance(user.room_id);

    if (target===null){
      let message = {
        sender: 'world',
        content: room.get_look_string()
      }
      Utils.msg_sender.send_message_to_user(user_id, message)

    } else {

      let entity_id = Utils.search_for_target(room.id, target);

      if (entity_id===null){
        let message = {
          sender: 'world',
          content: `There is no ${target} around.`
        }
        Utils.msg_sender.send_message_to_user(user_id, message);

      } else {
        //target found
        let message = {
          sender: 'world',
          content: World.world.get_instance(entity_id).get_look_string()
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
    Utils.msg_sender.send_message_to_user(user_id, message)
    this.process_incoming_message('look', user.id);
  }

  get_cmd(user_id, target){
    //pick up the target and place in a slot.

    if (target===null){
      let message = {
        sender: 'world',
        content: `What do you want to get?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target is not null.
    let user=       World.world.get_instance(user_id);
    let entity_id = Utils.search_for_target(user.room_id, target);

    if (entity_id===null){
      let message = {
        sender: 'world',
        content: `There is no ${target} around.`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target found.
    let entity = World.world.get_instance(entity_id);

    if (!entity.is_gettable){
      let message = {
        sender: 'world',
        content: `You can't pick it up.`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target can be picked up.
    let success = user.inventory.get(entity_id);

    if (success){
      let msg = {
        sender: 'world',
        content: `You pick up ${entity.type_string} and place it in a slot.`
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);

      msg.content = `${user.name} picks up ${entity.type_string}`;
      Utils.msg_sender.send_message_to_room(user_id, msg, true);

      let room = World.world.get_instance(user.room_id);
      room.remove_entity(entity_id);

    } else {
      let msg = {
        sender: 'world',
        content: `You don't have a free slot to put it in.`
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);
    }   
  }

  drop_cmd(user_id, target){
    //drop a target from the slots to the room.

    if (target===null){
      let message = {
        sender: 'world',
        content: `What do you want to drop?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target is not null.
    let user=       World.world.get_instance(user_id);
    let entity_id=  user.inventory.search_target_in_slots(target);

    if (entity_id===null){
      //Target was not found in slots.
      let msg = {
        sender: 'world',
        content: `You don't have it in your slots.`
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);
      return;
    } 
    
    //Target was found
    user.inventory.drop(entity_id, user.room_id);

    let msg = {
      sender: 'world',
      content: `You drop it to the floor.`
    }
    Utils.msg_sender.send_message_to_user(user_id, msg);

    let entity = World.world.get_instance(entity_id);

    msg.content = `${user.name} drops ${entity.type_string}`;
    Utils.msg_sender.send_message_to_room(user_id, msg, true);
  }
}

let game_controller=  new Game_Controller();

//-- WebSockets
wss.on('connection', (ws_client) => {  
  let user_id = game_controller.new_client_connected(ws_client);  

  ws_client.on('close', () => {
    console.log(`Client User ID ${user_id} disconnected`);
    //TODO: save user.
  });

  ws_client.onmessage = (event) => {
    game_controller.process_incoming_message(event.data, user_id);    
  }
});
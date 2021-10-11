var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');
const Utils=                require('./game/utils');
const Classes=              require('./game/classes');
const World=                require('./game/world');

const LOAD_WORLD_FROM_SAVE=   true;
const LOAD_GENERIC_WORLD=     true;
const USER_SAVE_INTERVAL=     10;
const WORLD_SAVE_INTERVAL=    10;
const GEN_WORLD_NUM_OF_ROOMS= 2;

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

class Game_Controller {
  constructor(){
    this.user_save_counter=   USER_SAVE_INTERVAL;
    this.world_save_counter=  WORLD_SAVE_INTERVAL;
    this.init_game();
  }

  init_game(){

    this.load_users_db();
      
    if (LOAD_WORLD_FROM_SAVE){      
      this.load_world();
    } else {
      this.generate_world(GEN_WORLD_NUM_OF_ROOMS);
    }    
  
    app.listen(3000); //Ready to recive connections.
    this.game_loop();  
  }

  generate_world(num_of_rooms){
    //TODO: implelemt.      
  }

  load_users_db(){
    //Load users_db
    if (fs.existsSync('./users_db.json')){
      let data = JSON.parse(fs.readFileSync('./users_db.json'));
      for (const [username, props] of Object.entries(data)){
        World.users_db.set(username, props);
      }
    }
  }
  
  load_world(){
    let path;
    if (LOAD_GENERIC_WORLD){
      path = `./generic_world.json`
    } else {
      path = `./world_save.json`;
    }

    if (fs.existsSync(path)){
      let current_id;
      let parsed_info = JSON.parse(fs.readFileSync(path));
      
      for (const [id, props] of Object.entries(parsed_info)){
        current_id=     id;
        let entity_id=  Classes.Item(props, id);
        Utils.id_generator.set_new_current_id(current_id);        
      } 
      
    } else {
      console.error(`app.load_world -> ${path} does not exist.`);
    }    
  }

  save_users_to_file(){
        
    let data = {};
    World.world.world.forEach((item)=>{
      if (item instanceof Classes.User){    
        data[item.name] = item.props; 
      }
    });

    fs.writeFile(`./users_db.json`, 
                  JSON.stringify(data),  
                  function(err){if (err) console.log(err);}
                );
    console.log('Users saved.');    
  }

  save_world_to_file(){
    //Save all non-users, and items not held by users.
    let data = {};
    World.world.world.forEach((item)=>{

      if (item instanceof Classes.Item){
        data[item.id] = item.props; 
      }
    });

    fs.writeFile(
      `./world_save.json`, 
      JSON.stringify(data),  
      function(err){if (err) console.log(err);}
    );        
  }
  
  game_loop(){
    //Note: the loop technique allows for a minimum fixed length between
    //loop iterations, regardless of content of the loop.
    
    let timer_id = setTimeout(
      function update(){

        this.user_save_counter -= 1;
        if (this.user_save_counter===0){
          this.user_save_counter = USER_SAVE_INTERVAL;
          this.save_users_to_file();
        }

        this.world_save_counter -= 1;
        if (this.world_save_counter===0){
          this.world_save_counter = WORLD_SAVE_INTERVAL;
          this.save_world_to_file();
        }

        this.run_simulation_tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  run_simulation_tick(){

    World.world.world.forEach(
      (item) => {

        if (item instanceof Classes.AnimatedObject && item.is_fighting_with!==null){
          let opponent = World.world.get_instance(item.is_fighting_with);

          //Check if opponent disconnected or logged out
          if (opponent===undefined){
            item.is_fighting_with=  null;
            item.health=            item.BASE_HEALTH;
            
          } else {
          
            //Opponent exists
            let damage_dealt = item.strike_opponent(opponent.id); 

            if (item instanceof Classes.User){
              Utils.msg_sender.send_chat_msg_to_user(item.id,'world',
              `You strike ${opponent.name}, dealing ${damage_dealt} HP.`);  
            } 

            if (opponent instanceof Classes.User){
              Utils.msg_sender.send_chat_msg_to_user(opponent.id,'world',
              `${item.name} strikes you, dealing ${damage_dealt} HP.`);
            }
            
            if (opponent.health===0){
              //Opponent has died
              item.stop_battle();

              Utils.msg_sender.send_chat_msg_to_room(item.id,'world',
                `${opponent.name} is DEAD!`);
              
              //Create a corpse
              let instance_props= {
                description:  opponent.description,
                container_id: opponent.container_id
              };
              new Classes.Corpse(instance_props);
              
              if (opponent instanceof Classes.User){
                opponent.reset(World.FIRST_ROOM_ID);

              } else {
                //Remove entity from the world
                opponent.remove_from_world();
              }          
            }
          }
        } else {
          item.process_tick();
          if (item instanceof Classes.Entity){
            item.process_decay();
          }
        }
      }      
    );
  }
  
  // new_client_connected(ws_client, username){
    
  //   let user_data = World.users_db.get(username);   
    
  //   let user = new Classes.User(user_data.props, ws_client);

  //   Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
  //     `Welcome back ${user.name}.`);

  //   Utils.msg_sender.send_status_msg_to_user(user.id, user.health);

  //   this.process_incoming_message('look', user.id);    
  //   return user.id;
  // }

  process_user_input(text, user_id){

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

      case 'wear':
      case 'we':
      case 'hold':
      case 'h':
        this.wear_hold_cmd(user_id, target);
        break;

      case 'remove':
      case 'r':
        this.remove_cmd(user_id, target);
        break;

      case 'inventory':
      case 'inv':
      case 'i':
        this.inv_cmd(user_id);
        break;      

      case 'say':
      case 'sa':
        this.say_cmd(user_id, target);
        break;

      case 'create':
      case 'c':
        this.create_cmd(user_id, target);
        break;

      case 'eat':
      case 'ea':
      case 'drink':
      case 'dr':
        this.eat_drink_cmd(user_id, target);
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

      default:
        Utils.msg_sender.send_chat_msg_to_user(user_id, `world`, `Unknown command.`);
    }  
  }

  //TODO: refactor like get_cmd
  // kill_cmd(user_id, target){

  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `Who do you want to kill?`);      

  //   } else {

  //     let user=       World.world.get_instance(user_id);
  //     let container = World.world.get_instance(user.container_id);
  //     let entity_id = container.search_for_target(target);

  //     if (entity_id===null){
  //       Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //         `There is no ${target} around.`);       
  //     } else {

  //       let opponent = World.world.get_instance(entity_id);

  //       if (!(opponent instanceof Classes.AnimatedObject)){
  //         Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //           `You can't fight it.`);          
  //         return;
  //       }

  //       user.start_battle_with(opponent.id);
  //       opponent.start_battle_with(user.id);

  //       //give the offence a bit of an advantage of striking first
  //       let damage_dealt = user.strike_opponent(opponent.id);

  //       Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //         `${user.name} attacks ${opponent.name}, dealing ${damage_dealt} HP.`);        
  //     }      
  //   }
  // }
    
  // look_cmd(user_id, target){
  //   let user=       World.world.get_instance(user_id);

  //   if (target===null){
  //     //Look at the room the user is in.
  //     Utils.msg_sender.send_chat_msg_to_user(user_id, `world`, user.get_look_string());        
  //     return;
  //   }

  //   //Target is not null.
  //   //Search order: wear_hold, slots, container.
  //   let entity_id = user.search_target_in_wear_hold(target);

  //   if (entity_id===null){
  //     entity_id= user.search_target_in_slots(target);

  //     if (entity_id===null){
  //       entity_id = container.search_for_target(target);

  //       if (entity_id===null){
  //         Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //           `There is no ${target} around.`);      
  //         return;
  //       }
  //     }
  //   }    

  //   //Target found.
  //   let entity = World.world.get_instance(entity_id);
  //   Utils.msg_sender.send_chat_msg_to_user(user_id, `world`, entity.get_look_string());        
  // }

  // move_cmd(direction, user_id){    

  //   let user=         World.world.get_instance(user_id);
  //   let current_container= World.world.get_instance(user.container_id);

  //   if (current_container.exits[direction]===null){
  //     //Exit does not exist
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `There's no exit to ${direction}.`);      
  //     return;
  //   }

  //   //Exit exists.
  //   let new_container=   World.world.get_instance(current_container.exits[direction]);

  //   user.container_id = new_container.id;
  //   current_container.remove_entity(user.id);
  //   new_container.add_entity(user_id);

  //   Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //     `You travel ${direction} to ${new_container.name}.`);
    
  //   this.process_incoming_message('look', user.id);
  // }

  // get_cmd(user_id, target){
  //   //pick up the target and place in a slot.

  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to get?`);      
  //     return;
  //   }

  //   //Target is not null.
  //   let user=       World.world.get_instance(user_id);
  //   let container=  World.world.get_instance(user.container_id);
  //   let entity_id = container.search_for_target(target);

  //   if (entity_id===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `There is no ${target} around.`);      
  //     return;
  //   }

  //   //Target found.
  //   let entity = World.world.get_instance(entity_id);

  //   if (!entity.is_gettable){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You can't pick it up.`);      
  //     return;
  //   }

  //   //Target can be picked up.
  //   let success = user.add_to_slots(entity_id);

  //   if (success){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You pick up ${entity.type_string} and place it in a slot.`);
      
  //     Utils.msg_sender.send_chat_msg_to_room(user_id,'world',
  //       `${user.name} picks up ${entity.type_string}`,
  //       true
  //     );      

  //     let container = World.world.get_instance(user.container_id);
  //     container.remove_entity(entity_id);

  //     entity.enable_decay();

  //   } else {
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You don't have a free slot to put it in.`);      
  //   }   
  // }

  // drop_cmd(user_id, target){
  //   //drop a target from the slots to the room.

  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to drop?`);
  //     return;
  //   }

  //   //Target is not null.
  //   let user=       World.world.get_instance(user_id);
  //   let entity_id=  user.search_target_in_slots(target);

  //   if (entity_id===null){
  //     //Target was not found in slots.
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You don't have it in your slots.`);      
  //     return;
  //   } 
    
  //   //Target was found
  //   user.drop_item_from_slots(entity_id);
  //   Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //     `You drop it to the floor.`);    

  //   let entity = World.world.get_instance(entity_id);
  //   entity.disable_decay();

  //   Utils.msg_sender.send_chat_msg_to_room(user_id,'world',
  //     `${user.name} drops ${entity.type_string}`,
  //     true);    
  // }

  // wear_hold_cmd(user_id, target){
  //   //take an entity from the slots and wear/hold in a pre-specified position.
  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to wear or hold?`);      
  //     return;
  //   }

  //   //Target is not null.
  //   let user=       World.world.get_instance(user_id);
  //   let entity_id = user.search_target_in_slots(target);

  //   if (entity_id===null){
  //     //Target was not found in slots.
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You don't have it in your slots.`);      
  //     return;
  //   } 

  //   //Target was found
  //   let entity = World.world.get_instance(entity_id);

  //   if (entity.wear_hold_slot===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You can't wear or hold it.`);      
  //     return;
  //   }

  //   //Target can be worn or held.
  //   let success = user.wear_or_hold_entity(entity_id);

  //   if (success){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',`Done.`);      
  //   } else {
  //     //position is unavailable.
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       "You're already wearing or holding something there.");      
  //   }
  // }

  // remove_cmd(user_id, target){
  //   //remove a worn or held entity, and place it in a slot.

  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to remove?`);      
  //     return;
  //   }

  //   //Target is not null
  //   let user=       World.world.get_instance(user_id);
  //   let entity_id=  user.search_target_in_wear_hold(target);

  //   if (entity_id===null){
  //     //target was not found
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You're not wearing or holding it.`);      
  //     return;
  //   }

  //   //Target is worn or held.
  //   let success = user.remove_from_wear_hold(entity_id);
  //   if (success){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You remove it and place it in one of your slots.`);     

  //   } else {
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You don't have a free slot to put it in.`);      
  //   }
  // }

  // inv_cmd(user_id){
  //   //generates inventory messages and loads them to the user's msg queue.
  //   //send the first message.
  //   let user = World.world.get_instance(user_id);
    
  //   Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //     user.get_inv_content());    
  // }

  // say_cmd(user_id, content){
  //   //send the content to all users in the room.
  //   let user = World.world.get_instance(user_id);
  //   let msg = `${user.name} says: ${content}`;

  //   Utils.msg_sender.send_chat_msg_to_room(user_id,'world', msg);    
  // }

  // create_cmd(user_id, type){
  //   //Creates an entity and places it in the room.

  //   if (type===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to create?`);      
  //     return;
  //   }

  //   //Type is not null.    
  //   let user=       World.world.get_instance(user_id);    

  //   let instance_props = {container_id: user.container_id}

  //   let entity_id=  Classes.create_entity(type, instance_props);    

  //   if (entity_id===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `There is no such thing as ${type}.`);      
  //     return;
  //   }

  //   //Item created and placed in the container
  //   Utils.msg_sender.send_chat_msg_to_user(user_id,'world',`${type} created.`);
  //   return;
  // }

  // eat_drink_cmd(user_id, target){
  //   //eat/drink food that's in the wear,hold or slots.

  //   if (target===null){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `What do you want to consume?`);    
  //     return;
  //   }

  //   //Target is not null.
  //   let user=       World.world.get_instance(user_id);    
  //   let entity_id = user.search_target_in_slots(target);

  //   if (entity_id===null){
  //     entity_id = user.search_target_in_wear_hold(target);
  //     if (entity_id===null){
  //       //Target not found on user's body.
  //       Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //         `You don't have it on you.`);        
  //       return;
  //     }
  //   }

  //   //Target was found
  //   let entity = World.world.get_instance(entity_id);

  //   if (!entity.is_food){
  //     Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //       `You want to put ~THAT~ in you MOUTH??!`
  //     );      
  //     return;
  //   }

  //   //Target can be consumed.
  //   user.consume(entity_id);
  //   Utils.msg_sender.send_chat_msg_to_user(user_id,'world',
  //     `You consume ${entity.type_string}.`);
        
  //   Utils.msg_sender.send_chat_msg_to_room(user_id, 'world', 
  //     `${user.name} consumes ${entity.type_string}`, true);
  // }

  create_new_user(ws_client, username, password){

    let props = {
      "name":         username,
      "password":     password,
      "container_id": World.FIRST_ROOM_ID
    }

    let user = new Classes.User(props, ws_client);    
    
    Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
      `Hi ${user.props["name"]}, your ID is ${user.id}`);

    Utils.msg_sender.send_status_msg_to_user(user.id, user.props["health"]);

    this.process_user_input('look', user.id);    
    return user.id;
  }
}

let game_controller=  new Game_Controller();

//-- WebSockets
wss.on('connection', (ws_client) => {  
  let state = 'Not Logged In';
  let user_id = null;
  
  ws_client.on('close', () => {
    // console.log(`Client User ID ${user_id} disconnected`);
  });

  ws_client.onmessage = (event) => {
    
    let state= "Not Logged In";
    let user_id= null;
    let incoming_msg = JSON.parse(event.data);

    if (incoming_msg.type==="Login"){
      state = 'Logged In';
      user_id = game_controller.create_new_user(
        ws_client, 
        incoming_msg.content.username, 
        incoming_msg.content.password);

    } else if (incoming_msg.type==="User Input"){
      game_controller.process_user_input(incoming_msg.content, user_id);
    }
    
    // if (state==="Not Logged In" && incoming_msg.type==="Login"){
    //   //Check if User is already registered.
    //   let user_data = World.users_db.get(incoming_msg.content.username);
    //   if (user_data!==undefined){                
    //     if (incoming_msg.content.password===user_data.props.password){
    //       state= 'Logged In';
    //       user_id = game_controller.create_existing_user(ws_client, incoming_msg.content.username);                  
    //     } else {
    //       ws_client.close(4000, 'Wrong Username or Password.');
    //     }

    //   } else {
    //     //A new user
    //     state = 'Logged In';
    //     user_id = game_controller.create_new_user(
    //       ws_client, 
    //       incoming_msg.content.username, 
    //       incoming_msg.content.password);          
    //   }

    // } else if (state==='Logged In' && incoming_msg.type==="User Input"){
      
    //   game_controller.process_incoming_message(incoming_msg.content, user_id);
    // }
  }
});
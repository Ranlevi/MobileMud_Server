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
const ENABLE_USER_SAVE=       false;
const ENABLE_WORLD_SAVE=      true;
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
      
      for (const [id, data] of Object.entries(parsed_info)){
        current_id=     id;

        switch(data.type){
          case "Room":
            new Classes.Room(data.props, id);
            break;
          
          case "Screwdriver":
          case "Candy":
            new Classes.Item(data.type, data.props, id);
            break;

          case "Dog":
            new Classes.NPC(data.type, data.props, id)
            break;

          default:
            console.error(`GC.load_world: Unknown type: ${data.type}`);
        }
                 
        Utils.id_generator.set_new_current_id(current_id);        
      } 
      
    } else {
      console.error(`app.load_world -> ${path} does not exist.`);
    }    
  }

  save_users_to_file(){
    
    if (!ENABLE_USER_SAVE) return;
        
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

    if (!ENABLE_WORLD_SAVE) return;

    let data = {};
    World.world.world.forEach((item)=>{

      if (!(item instanceof Classes.User)){
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
    console.log('tick');
    World.world.world.forEach(
      (item) => {

        if ((item instanceof Classes.User || item instanceof Classes.NPC) && 
            (item.props["is_fighting_with"]!==null)){

            let opponent = World.world.get_instance(item.props["is_fighting_with"]);
            //Check if opponent disconnected or logged out
            if (opponent===undefined){
              item.stop_battle();
              item.reset_health();
            }
            //Opponent exists.
            //Do damage.
            let damage_dealt = item.calc_damage(); 
            let damage_recieved = opponent.recieve_damage(damage_dealt);

            Utils.msg_sender.send_chat_msg_to_room(item.id, 'world',
              `${item.props["name"]} strikes ${opponent.props["name"]}, dealing ${damage_recieved} HP of damage.`);

            //Check & Handle death of the opponent.
            if (opponent.props["health"]===0){
              //Opponent has died
              item.stop_battle();

              Utils.msg_sender.send_chat_msg_to_room(item.id,'world',
                `${opponent.props["name"]} is DEAD!`);

              //Create a corpse and remove the opponent
              opponent.do_death();
            }
        } else if (item instanceof Classes.NPC){
            item.do_tick();
        }
      }
    );
  }
              
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

    let user = World.world.get_instance(user_id);
    
    switch(cmd){
      case 'look':
      case 'l':
        user.look_cmd(target);
        break;

      case 'north':
      case 'n':
        user.move_cmd('north');
        break;

      case 'south':
      case 's':
        user.move_cmd('south');
        break;

      case 'east':
      case 'e':
        user.move_cmd('east');
        break;
      
      case 'west':
      case 'w':
        user.move_cmd('east');
        break;

      case 'get':
      case 'g':
        user.get_cmd(target);
        break;

      case 'drop':
      case 'dr':
        user.drop_cmd(target);
        break;

      case 'hold':
      case 'h':
      case 'wear':
      case 'we':
        user.wear_or_hold_cmd(target);
        break;

      case "inventory":
      case "inv":
      case "i":
        user.inv_cmd();
        break;

      case "kill":
      case "k":
        user.kill_cmd(target);
        break;

      default:
        Utils.msg_sender.send_chat_msg_to_user(user_id, `world`, `Unknown command.`);
    }  
  }  

  create_new_user(ws_client, username, password){

    let props = {
      "name":         username,
      "password":     password,
      "container_id": World.FIRST_ROOM_ID
    }

    let user = new Classes.User(props, ws_client);
    
    let room = World.world.get_instance(World.FIRST_ROOM_ID);
    room.add_entity(user.id);
    
    Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
      `Hi ${user.props["name"]}, your ID is ${user.id}`);

    Utils.msg_sender.send_status_msg_to_user(user.id, user.props["health"]);
    user.look_cmd();

    return user.id;
  }
}

let game_controller=  new Game_Controller();

//-- WebSockets
wss.on('connection', (ws_client) => {  
  
  ws_client.on('close', () => {
    // console.log(`Client User ID ${user_id} disconnected`);
  });

  ws_client.onmessage = (event) => {
    
    // let state= "Not Logged In";
    // let user_id= null;
    let incoming_msg = JSON.parse(event.data);    

    if (incoming_msg.type==="Login"){
      // var state = 'Logged In';
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

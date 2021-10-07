var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');
const Utils=                require('./game/utils');
const Classes=              require('./game/classes');
const World=                require('./game/world');

const LOAD_WORLD_FROM_SAVE = true;
const FIRST_ROOM_ID        = '0';
const USER_SAVE_INTERVAL   = 10;

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

class Game_Controller {
  constructor(){
    this.user_save_counter = USER_SAVE_INTERVAL;   
    this.init_game();
  }

  init_game(){

    this.load_users_db();
      
    if (LOAD_WORLD_FROM_SAVE){
      this.load_world();
    } else {
      this.generate_world();
    }    
  
    app.listen(3000); //Ready to recive connections.
    this.game_loop();  
  }

  generate_world(){
    //To be implemented  
  }

  load_users_db(){
    //Load users_db
    if (fs.existsSync('./users_db.json')){
      let data = JSON.parse(fs.readFileSync('./users_db.json'));
      for (const [username, data_obj] of Object.entries(data)){
        World.users_db.set(username, data_obj);
      }
    }
  }
  
  load_world(){
    if (fs.existsSync(`./world_save.json`)){
      let current_id;
      let parsed_info = JSON.parse(fs.readFileSync('./world_save.json'));
      
      for (const [id, data] of Object.entries(parsed_info)){
        current_id = id;
               
        switch(data.type){
          case "Room":
            new Classes.Room(data.instance_properties, id);
            break;

          case "Dog":
            new Classes.Dog(data.instance_properties, id);                         
            break;

          case "Screwdriver":
            new Classes.Screwdriver(data.instance_properties, id);                          
            break;
        }

        //TODO: copy world save from backup, with new instance_info
      
        Utils.id_generator.set_new_current_id(current_id);        
      } 
      
    } else {
      console.error(`app.load_world -> world_save.json does not exist.`);
    }
  }

  save_users_to_file(){
    //skip users in battle
    
    let data = {};
    World.world.world.forEach((item)=>{
      if (item instanceof Classes.User && item.is_fighting_with===null){
        //Not in battle
        data[item.name] = item.get_data_obj(); 
      }
    });

    fs.writeFile(`./users_db.json`, 
                  JSON.stringify(data),  
                  function(err){if (err) console.log(err);}
                );
    console.log('Users saved.');    
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

        this.run_simulation_tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  run_simulation_tick(){

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
            new Classes.Corpse(opponent.description, opponent.container_id);
            
            if (opponent instanceof Classes.User){
              opponent.reset(FIRST_ROOM_ID);

            } else {
              //Remove entity from the world
              let container = World.world.get_instance(opponent.container_id);
              container.remove_entity(opponent.id);
              World.world.remove_from_world(opponent.id);
            }          
          }
        } else {
          item.process_tick();
        }
      }      
    );
  }
  
  new_client_connected(ws_client, username, user_data){
    
    let user = new Classes.User(
      username, 
      user_data.description,
      ws_client,
      user_data.container_id
    ); 
    user.health = user_data.health;
    user.damage = user_data.damage;
    user.password= user_data.password;
    
    user.inventory.update_from_obj(user_data.inventory);

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

      case 'next':
      case 'ne':
        this.next_cmd(user_id);
        break;

      case 'end':
      case 'en':
        this.end_cmd(user_id);
        break;

      case 'say':
      case 'sa':
        this.say_cmd(user_id, target);
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
      let entity_id = Utils.search_for_target(user.container_id, target);

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
    let container = World.world.get_instance(user.container_id);

    if (target===null){
      let message = {
        sender: 'world',
        content: container.get_look_string()
      }
      Utils.msg_sender.send_message_to_user(user_id, message)

    } else {

      let entity_id = Utils.search_for_target(container.id, target);

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
    let current_container= World.world.get_instance(user.container_id);

    if (current_container.exits[direction]===null){
      //Exit does not exist
      let message = {
        sender: 'world',
        content: `There's no exit to ${direction}.`        
      }
      Utils.msg_sender.send_message_to_user(user_id, message)
      return;
    }

    //Exit exists.
    let new_container=   World.world.get_instance(current_container.exits[direction]);

    user.container_id = new_container.id;
    current_container.remove_entity(user.id);
    new_container.add_entity(user_id);

    let message = {
      sender: 'world',
      content: `
        You travel ${direction} to ${new_container.name}.`        
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
    let entity_id = Utils.search_for_target(user.container_id, target);

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

      let container = World.world.get_instance(user.container_id);
      container.remove_entity(entity_id);

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
    user.inventory.drop(entity_id, user.container_id);

    let msg = {
      sender: 'world',
      content: `You drop it to the floor.`
    }
    Utils.msg_sender.send_message_to_user(user_id, msg);

    let entity = World.world.get_instance(entity_id);

    msg.content = `${user.name} drops ${entity.type_string}`;
    Utils.msg_sender.send_message_to_room(user_id, msg, true);
  }

  wear_hold_cmd(user_id, target){
    //take an entity from the slots and wear/hold in a pre-specified position.
    if (target===null){
      let message = {
        sender: 'world',
        content: `What do you want to wear or hold?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target is not null.
    let user=       World.world.get_instance(user_id);
    let entity_id = user.inventory.search_target_in_slots(target);

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
    let entity = World.world.get_instance(entity_id);

    if (entity.wear_hold_slot===null){
      let msg = {
        sender: 'world',
        content: `You can't wear or hold it.`
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);
      return;
    }

    //Target can be worn or held.
    let success = user.inventory.wear_or_hold(entity_id);

    if (success){
      let msg = {
        sender: 'world',
        content: `Done.`
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);
    } else {
      //position is unavailable.
      let msg = {
        sender: 'world',
        content: "You're already wearing or holding something there."
      }
      Utils.msg_sender.send_message_to_user(user_id, msg);
    }
  }

  remove_cmd(user_id, target){
    //remove a worn or held entity, and place it in a slot.

    if (target===null){
      let message = {
        sender: 'world',
        content: `What do you want to remove?`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target is not null
    let user=       World.world.get_instance(user_id);
    let entity_id=  user.inventory.search_target_in_wear_hold(target);

    if (entity_id===null){
      //target was not found
      let message = {
        sender: 'world',
        content: `You're not wearing or holding it.`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
      return;
    }

    //Target is worn or held.
    let success = user.inventory.remove(entity_id);
    if (success){
      let message = {
        sender: 'world',
        content: `You remove it and place it in one of your slots.`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);

    } else {
      let message = {
        sender: 'world',
        content: `You don't have a free slot to put it in.`
      }
      Utils.msg_sender.send_message_to_user(user_id, message);
    }
  }

  inv_cmd(user_id){
    //generates inventory messages and loads them to the user's msg queue.
    //send the first message.
    let user = World.world.get_instance(user_id);
    
    let message = {
      sender: 'world',
      content: user.get_inv_content()
    }
    Utils.msg_sender.send_message_to_user(user_id, message);    
  }

  next_cmd(user_id){
    let user = World.world.get_instance(user_id);
    let content  = user.get_next_msg_from_queue();
    
    if (content===null){
      //No msg in queue
      content = 'No more messages in chain.';
    } 
    
    let message = {
      sender: 'world',
      content: content
    }
    Utils.msg_sender.send_message_to_user(user_id, message);
  }

  end_cmd(user_id){
    //clear the queue.
    let user = World.world.get_instance(user_id);
    user.clear_msg_queue();

    let message = {
      sender: 'world',
      content: 'Message chain cleared.'
    }
    Utils.msg_sender.send_message_to_user(user_id, message);
  }

  say_cmd(user_id, content){
    //send the content to all users in the room.
    let user = World.world.get_instance(user_id);
    let msg = `${user.name} says: ${content}`;

    let message = {
      sender: 'world',
      content: msg
    }

    Utils.msg_sender.send_message_to_room(user_id, message);
  }

  create_new_user(ws_client, username, password){
    let user = new Classes.User(
      username, 
      "It's you, Bozo.",      
      ws_client,
      FIRST_ROOM_ID
    ); 
    user.set_password(password);
    
    let msg = {
      sender: "world",
      content: `Hi ${user.name}, your ID is ${user.id}`
    }
    Utils.msg_sender.send_message_to_user(user.id, msg);   

    this.process_incoming_message('look', user.id);    
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
    
    let incoming_msg = JSON.parse(event.data);
    console.log('MSG RCVD');
    
    if (state==="Not Logged In" && incoming_msg.type==="Login"){
      //Check if User is already registered.
      let user_data = World.users_db.get(incoming_msg.content.username);
      if (user_data!==undefined){
        console.log('USERNAME FOUND');
        //check password.
        if (incoming_msg.content.password===user_data.password){
          state = 'Logged In';
          user_id = game_controller.new_client_connected(ws_client, incoming_msg.content.username, user_data);  
          console.log('Logged In');      
        } else {
          ws_client.close(4000, 'Wrong Username or Password.');
          console.log('WRONG USRNAME/PW');
        }

      } else {
        //A new user
        state = 'Logged In';
        user_id = game_controller.create_new_user(ws_client, incoming_msg.content.username, incoming_msg.content.password);
        console.log('NEW USER');  
      }

    } else if (state==='Logged In' && incoming_msg.type==="User Input"){
      game_controller.process_incoming_message(incoming_msg.content, user_id);
    }
  }
});
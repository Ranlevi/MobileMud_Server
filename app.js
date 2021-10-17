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

const VERSION = 0.01;

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
      World.users_db = JSON.parse(fs.readFileSync('./users_db.json'));
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
        current_id=  id;
        
        switch(data.type){
          case "Room":
            new Classes.Room(data.props, id);
            break;
          
          case "Screwdriver":
          case "Candy":
          case "T-Shirt":
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
        
    let data = {
      "users": {},
      "items": {}
    };

    World.world.users.forEach((user)=>{
      data["users"][user.props["name"]] = user.props;
    });

    World.world.world.forEach((item)=>{
      let container = World.world.get_instance(item.props["container_id"]);

      if (container instanceof Classes.User){        
        data["items"][item.id] = item.props;                
        
      };
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
      let container = World.world.get_instance(item.props["container_id"]);

      if (!(container instanceof Classes.User)){
        //Save all items not carried by users.
        data[item.id] = {
          "type": item.props["type"],
          "props": Object.assign({}, item.props)
        };        
      }

      if (item instanceof Classes.Room){
        //If the item is a room - remove users from it's entities        
        data[item.id]["props"]["entities"] = [];
        
        for (const id of item.props["entities"]){
          let entity = World.world.get_instance(id);
          if (!(entity instanceof Classes.User)){
            data[item.id]["props"]["entities"].push(id);
          }
        }

      }

    });

    fs.writeFile(
      `./world_save.json`, 
      JSON.stringify(data),  
      function(err){if (err) console.log(err);}
    );   
    console.log('World saved.');         
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

        if (item instanceof Classes.NPC){
          if (item.props["is_fighting_with"]!==null){
            item.do_battle(); 
          } else {
            item.do_tick();
          }
        }       
      }
    );

    World.world.users.forEach((user)=> {
      if (user.props["is_fighting_with"]!==null){
        user.do_battle();
      } else {
        user.do_tick();
      }
    });
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

      case "remove":
      case "r":
        user.remove_cmd(target);
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

      case "eat":
      case "ea":
      case "drink":
        user.consume_cmd(target);      
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

  load_existing_user(ws_client, username){
    
    console.log('Loading existing user');

    let user_data = World.users_db["users"][username];

    let user = new Classes.User(user_data, ws_client);

    let room = World.world.get_instance(user.props["container_id"]);
    room.add_entity(user.id);

    //Get the items the user carries
    for (const [position, id] of Object.entries(user.props["wearing"])){
      if (id!==null){
        //get the saved item
        let props = World.users_db["items"][id];
        let entity = new Classes.Item(props["type"], props);

        entity.set_container_id(user.id);
        user.props["wearing"][position] = entity.id;        
      }
    }

    if (user.props["holding"]!==null){
      let props = World.users_db["items"][user.props["holding"]];
      let entity = new Classes.Item(props["type"], props);

      entity.set_container_id(user.id);
      user.props["holding"] = entity.id;        
    }

    let temp_arr = user.props["slots"];
    user.props["slots"] = [];
    for (const id of temp_arr){
      let props = World.users_db["items"][id];
      let entity = new Classes.Item(props["type"], props);

      entity.set_container_id(user.id);
      user.props["slots"].push(entity.id);
    }

    Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
    `Hi ${user.props["name"]}, your ID is ${user.id}`);

    Utils.msg_sender.send_status_msg_to_user(user.id, user.props["health"]);
    user.look_cmd();
    return user.id;
  }
}

let game_controller=  new Game_Controller();
const clients = new Map();

//-- WebSockets
wss.on('connection', (ws_client) => {  

  if (!clients.has(ws_client)){    
    clients.set(ws_client, null); //ws_client, user_id
  }

  ws_client.onmessage = (event) => {
    let incoming_msg = JSON.parse(event.data);    

    if (incoming_msg.type==="Login"){

      let user_id = clients.get(ws_client);
      if (user_id===null){
        //User is not logged in.
        //Check if User is registered.
        
        user_data = World.users_db["users"][incoming_msg.content.username];
        
        if (user_data===undefined){
          //This is a new player.
          let user_id = game_controller.create_new_user(
            ws_client, 
            incoming_msg.content.username, 
            incoming_msg.content.password);
          clients.set(ws_client, user_id);

        } else {
          //This is a registered User.
          //Check Password

          if (user_data["password"]===incoming_msg.content.password){
            //Valid passworld
            let user_id = game_controller.load_existing_user(
              ws_client, 
              incoming_msg.content.username);            
            clients.set(ws_client, user_id);

          } else {
            //invalid password
            ws_client.close(4000, 'Wrong Username or Password.');
            clients.delete(ws_client);
          }
        }
      } 
      //If user_id is not null, then the login message is ignored.

    } else if (incoming_msg.type==="User Input"){  
      
      let user_id = clients.get(ws_client);

      if (user_id===null){
        console.error('ws_client.onmessage: recived message when client is not logged in.')
      } else {
        game_controller.process_user_input(incoming_msg.content, user_id);
      }      
    }
  }

  ws_client.on('close', () => {
    clients.delete(ws_client);
  });
  
});


// wss.on('connection', (ws_client) => {  
  
//   ws_client.on('close', () => {
//     console.log(`Client User ID ${user_id} disconnected`);
//   });

//   ws_client.onmessage = (event) => {    
    
//     let incoming_msg = JSON.parse(event.data);    

//     if (incoming_msg.type==="Login"){

//       if (user_data!==undefined){
//         let user_data = World.users_db["users"][incoming_msg.content.username];
    
//         if (user_data===undefined){
//           //This is a new player.
//           user_id = game_controller.create_new_user(
//             ws_client, 
//             incoming_msg.content.username, 
//             incoming_msg.content.password);
//           state = "Logged In";
  
//         } else {
//           //An existing player.
//           //Check passworld.
//           if (user_data["password"]===incoming_msg.content.password){
//                 //Valid passworld
//                 user_id = game_controller.load_existing_user(
//                   ws_client, 
//                   incoming_msg.content.username);
//                 state = "Logged In";
//           } else {
//             //invalid password
//             ws_client.close(4000, 'Wrong Username or Password.');
//           }
//         }
//       }

           
         

//     } else if (incoming_msg.type==="User Input"){      
//       game_controller.process_user_input(incoming_msg.content, user_id);
//     }
    
//     // if (state==="Not Logged In" && incoming_msg.type==="Login"){
//     //   //Check if User is already registered.
//     //   let user_data = World.users_db.get(incoming_msg.content.username);
//     //   if (user_data!==undefined){                
//     //     if (incoming_msg.content.password===user_data.props.password){
//     //       state= 'Logged In';
//     //       user_id = game_controller.create_existing_user(ws_client, incoming_msg.content.username);                  
//     //     } else {
//     //       ws_client.close(4000, 'Wrong Username or Password.');
//     //     }

//     //   } else {
//     //     //A new user
//     //     state = 'Logged In';
//     //     user_id = game_controller.create_new_user(
//     //       ws_client, 
//     //       incoming_msg.content.username, 
//     //       incoming_msg.content.password);          
//     //   }

//     // } else if (state==='Logged In' && incoming_msg.type==="User Input"){
      
//     //   game_controller.process_incoming_message(incoming_msg.content, user_id);
//     // }
//   }
// });

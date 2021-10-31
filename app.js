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

/*
TODO:
center actions
create cmd i/f
set user description somehow
improve client UI
emote
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
Tell
*/


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
    //Load the database of registered users.    
    if (fs.existsSync('./users_db.json')){
      World.users_db = JSON.parse(fs.readFileSync('./users_db.json'));
    }
  }
  
  load_world(){
    //Load all rooms and entities (except users) from the save file.
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
        
        //Create the entities, with their saves props.
        switch(data.type){
          case "Room":
            new Classes.Room(data.props, id);
            break;
          
          case "Screwdriver":
          case "Candy":
          case "T-Shirt":
          case "Keycard":
            new Classes.Item(data.type, data.props, id);
            break;

          case "Human":
            new Classes.Human(data.props, id);
            break;

          default:
            console.error(`GC.load_world: Unknown type: ${data.type}`);
        }
                 
        //Since entities are loaded with their pre-existing IDs,
        //we update the id_generator on the latest existing id (so it
        //won't create an identical ID.)
        Utils.id_generator.set_new_current_id(current_id);        
      } 
      
    } else {
      console.error(`app.load_world -> ${path} does not exist.`);
    }
    
  }

  save_users_to_file(){
    //Save all the users and the entities they carry on them.
    if (!ENABLE_USER_SAVE) return;
        
    let data = {
      "users": {},
      "items": {}
    };

    World.world.users.forEach((user)=>{
      data["users"][user.props["name"]] = user.props;
    });

    World.world.world.forEach((item)=>{
      //For each item in the world, check if it is carried by a user.
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

        //Save Counters
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
    //Iterate on all entities, and process their tick actions.    

    World.world.world.forEach(
      (item) => {
        //Currently, only NPCs and Users have tick actions.
        //Fighting overrides the do_tick().
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
    //Takes the text recived via the webSockets interface,
    //and the user_id who sent it. Parses the text.

    if (text==='') return;//Ignore empty messages.
  
    let normalized_text= text.trim().toLowerCase();  
    let re = /\s+/g; //search for all white spaces.
    let input_arr = normalized_text.split(re);
    
    //Assume the first word is always a Command, and everything that
    //comes after that is a target.
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
        user.move_cmd('west');
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
        user.hold_cmd(target);
        break;

      case 'wear':
      case 'we':
        user.wear_cmd(target);
        break;

      case "remove":
      case "r":
        user.remove_cmd(target);
        break;      

      case "kill":
      case "k":
        user.kill_cmd(target);
        break;

      case "consume":
      case "c":      
        user.consume_cmd(target);      
        break;

      case "say":
      case "sa":
        user.say_cmd(target);
        break;

      default:
        Utils.msg_sender.send_chat_msg_to_user(user_id, `world`, `Unknown command.`);
    }  
  }  

  create_new_user(ws_client, username, password){
    //Create a new user, and associate the ws_client with it.
    //Returns the ID of the created user (String)
    let props = {
      "name":         username,
      "password":     password,
      "container_id": World.FIRST_ROOM_ID
    }

    let user = new Classes.User(props, ws_client);
    
    //Add the user to the Spawn room.
    let room = World.world.get_instance(World.FIRST_ROOM_ID);
    room.add_entity(user.id);
    
    //Send a welcome message, and a Status message to init the health bar.
    //Than perform a Look command on the room.
    Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
      `Welcome ${user.props["name"]}!`);
    
    user.look_cmd();

    return user.id;
  }

  load_existing_user(ws_client, username){
    //Load the user from the registered users database, and associate
    //the ws_client with it.
    //Return the ID of the retrived user (String)
    
    console.log('Loading existing user');

    let user_data = World.users_db["users"][username];

    let user = new Classes.User(user_data, ws_client);
  
    //Spawn the user it the saved room.
    let room = World.world.get_instance(user.props["container_id"]);
    room.add_entity(user.id);

    //Get the items the user carries
    for (const [position, id] of Object.entries(user.props["wearing"])){
      if (id!==null){
        //Create the saved item, add it to the user and set its container ID.
        let props=  World.users_db["items"][id];
        let entity= new Classes.Item(props["type"], props);

        entity.set_container_id(user.id);
        user.props["wearing"][position] = entity.id;        
      }
    }

    if (user.props["holding"]!==null){
      let props=  World.users_db["items"][user.props["holding"]];
      let entity= new Classes.Item(props["type"], props);

      entity.set_container_id(user.id);
      user.props["holding"] = entity.id;        
    }

    let temp_arr = user.props["slots"];
    user.props["slots"] = [];
    for (const id of temp_arr){
      let props=  World.users_db["items"][id];
      let entity= new Classes.Item(props["type"], props);

      entity.set_container_id(user.id);
      user.props["slots"].push(entity.id);
    }

    //Send a welcome message, and a status message to init the health bar.
    //Then do a Look command on the room.
    Utils.msg_sender.send_chat_msg_to_user(user.id,'world',
    `Hi ${user.props["name"]}, your ID is ${user.id}`);
    
    user.look_cmd();
    return user.id;
  }
}

let game_controller=  new Game_Controller();
const clients=        new Map(); //holds all connected clients. ws_client: user_id

//-- WebSockets
wss.on('connection', (ws_client) => {    
  var user_id;

  ws_client.onmessage = (event) => {
    let incoming_msg = JSON.parse(event.data);
    
    switch (incoming_msg.type){
      
      case ('Login'):
        user_id = clients.get(ws_client);
        
        if (user_id===undefined){
          //This client is not bonded to a playing user.
          //Check the username to find if the user is already in the game.
          user_id = World.world.get_user_id_by_username(incoming_msg.content.username);          
          
          if (user_id===null){
            //User is not in the game.
            //Is it a new player, or a registred one?
            let user_data = World.users_db["users"][incoming_msg.content.username];
            
            if (user_data===undefined){
              //This is a new player.
              user_id = game_controller.create_new_user(
                ws_client, 
                incoming_msg.content.username, 
                incoming_msg.content.password);
              clients.set(ws_client, user_id);
              
              Utils.msg_sender.send_login_msg_to_user(ws_client,true);
            } else {
              //This is an already registed user
              //Verify password is correcnt.
              if (user_data["password"]===incoming_msg.content.password){
                //Valid passworld
                user_id = game_controller.load_existing_user(
                  ws_client, 
                  incoming_msg.content.username);            
                clients.set(ws_client, user_id);

                Utils.msg_sender.send_login_msg_to_user(ws_client,true);
              } else {
                //invalid password
                // ws_client.close(4000, 'Wrong Username or Password.');
                Utils.msg_sender.send_login_msg_to_user(ws_client,false);
              }
            }
          } else {
            //The user is in the game.
            //We need to replace the existing ws_client with this new one.            
            let user = World.world.get_instance(user_id);
            clients.delete(user.ws_client);
            user.ws_client = ws_client;
            clients.set(ws_client, user_id);            
          }
          
        } else {
          //This client is bonded to a playing user.
          //We ignore the login message. 
        }
        break;

      case ("User Input"):        
        game_controller.process_user_input(incoming_msg.content, user_id);        
        break;
    }
  }

  ws_client.on('close', () => {
    clients.delete(ws_client);
  });
  
});
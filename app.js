var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();
const wss=                  new WebSocketServer({port: 8080});
const fs=                   require('fs');
const Utils=                require('./game/utils');
const Classes=              require('./game/classes');
const World=                require('./game/world');

const ENABLE_USER_SAVE=       true;
const USER_SAVE_INTERVAL=     10;

const VERSION = 0.01;

/*
TODO:
//check loading and saving, fix spwaning mechanism
center actions
create_cmd i/f
set user description somehow
improve client UI
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
//todo: place user in room, fix spawn_entity parameters?
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
    this.init_game();
  }

  init_game(){    
    // this.load_users_db();
    this.load_world();  
    app.listen(3000); //Ready to recive connections.
    this.game_loop();      
  }

  load_users_db(){
    //Load the database of existing users.    
    if (fs.existsSync('./users_db.json')){
      let data = JSON.parse(fs.readFileSync('./users_db.json'));

      for (const [username, user_obj] of Object.entries(data.users)){
        //user_obj: {id: user.id, props: user.props};
        World.world.users_db.users[username] = user_obj;
      }

      for (const [id, props] of Object.entries(this.data.items)){
        World.world.users_db.items[id] = props;
      }
      
    }
  }
  
  load_world(){
    //Load all rooms and entities (except users) from the save file.
    let path = `./generic_world.json`;
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));
      
      for (const [id, data] of Object.entries(parsed_info)){   
        
        switch (data.props.type){
          case("Item"):
            new Classes.Item(data.props.subtype, data.props, id);
            break;

          case('NPC'):
            new Classes.NPC(data.props.subtype, data.props, id);
            break;

          case("Room"):
            new Classes.Room(data.props, id);
            break;

          default:
            console.error(`app.js->load_world: unknown type ${data.props.type}`);
        }
        
      }     
              
    } else {
      console.error(`app.load_world -> ${path} does not exist.`);
    }
    
  }

  save_users_to_file(){
    //Save all the users and the entities they carry on them.
    if (!ENABLE_USER_SAVE) return;

    let data = {
      users: {}, //username: {id:, props:}
      items: {}  //id: props
    }; 

    World.world.users.forEach((user)=>{
      data.users[user.props.name] = {id: user.id, props: user.props};

      let inv_arr = user.get_all_items_on_body();
      for (const obj of inv_arr){
        //obj: {id: string, location: string}
        let entity = World.world.get_instance(obj.id);
        data.items[entity.id] = entity.props
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

        //Save Counters
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
    //Iterate on all entities, and process their tick actions.    

    World.world.world.forEach(
      (entity) => {
        
        if (entity instanceof Classes.NPC){          
          if (entity.props.is_fighting_with!==null){
            //Fighting overrides the do_tick().
            entity.do_battle(); 
          } else {
            entity.do_tick();
          }
        } else {
          entity.do_tick();
        }       
      }
    );

    World.world.users.forEach((user)=> {
      if (user.props.is_fighting_with!==null){
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

      case "emote":
      case "em":
        user.emote_cmd(target);
        break;

      case "tell":
      case "'":
      case "t":
        let username = input_arr[1];
        let content = input_arr.slice(2).join(' ');
        user.tell_cmd(username, content);
        break;

      default:
        user.send_chat_msg_to_client(`Unknown command.`);        
    }  
  }  

  create_new_user(ws_client, username, password){
    //Create a new user, spawned at spawn room, and associate the ws_client with it.
    //Returns the ID of the created user (String)
    let props = {
      name:         username,
      password:     password      
    }

    let user = new Classes.User(props, ws_client);
    
    //Send a welcome message, and a Status message to init the health bar.
    //Than perform a Look command on the room.
    user.send_chat_msg_to_client(`Welcome ${user.props.name}!`);
    user.look_cmd();

    return user.id;
  }

  load_existing_user(ws_client, username){
    //Load the user from the registered users database, and associate
    //the ws_client with it.
    //Return the ID of the retrived user (String)
    
    console.log('Loading existing user');

    let user_data = World.world.users_db[username]; //user_data= {id:, props:}

    let user = new Classes.User(user_data.props, ws_client, user_data.id);

    //Spawn the items the users carries
    let inv_arr = user.get_all_items_on_body();

    for (const obj of inv_arr){
      let props = World.world.users_db.items[obj.id];

      //Must be of type Item
      new Classes.Item(props.subtype, props, obj.id);      
    }  

    //Send a welcome message, and a status message to init the health bar.
    //Then do a Look command on the room.
    user.send_chat_msg_to_client(`Welcome back, ${user.get_name()}.`);
    user.send_status_msg_to_client();
    
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

              let user = World.world.get_instance(user_id);
              user.send_login_msg_to_client(true);
              
            } else {
              //This is an already registed user
              //Verify password is correcnt.
              if (user_data["password"]===incoming_msg.content.password){
                //Valid passworld
                user_id = game_controller.load_existing_user(
                  ws_client, 
                  incoming_msg.content.username);            
                clients.set(ws_client, user_id);

                let user = World.world.get_instance(user_id);
                user.send_login_msg_to_client(true);
                
              } else {
                //invalid password
                // ws_client.close(4000, 'Wrong Username or Password.');
                let message = {
                  type:    'Login',      
                  content: {is_login_successful: false}
                }    
                ws_client.send(JSON.stringify(message));
                
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
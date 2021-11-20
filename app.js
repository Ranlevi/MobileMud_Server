const fs=         require('fs');
const Classes=    require('./game/classes');
const World=      require('./game/world');

const express=    require('express');
const app=        express();
const http =      require('http');
const server =    http.createServer(app);
const { Server }= require("socket.io");
const io=         new Server(server);

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));

app.get('/', (req, res) => {  
  res.sendFile(__dirname + '/index.html');
});

server.listen(5000, () => {
  console.log('listening on *:5000');
});

const ENABLE_USER_SAVE=   false;
const USER_SAVE_INTERVAL= 10;
const VERSION=            0.01;

//Socket.IO Connections and messages.

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('Login Message', (msg)=>{

    //Try to find an active user with the same username.
    user_id = World.world.get_user_id_by_username(msg.content.username);

    if (user_id===null){
      //This is not an active player
      //Check if it is a preveiouly created player.
      let data = World.world.users_db.users[msg.content.username];
      
      if (data===undefined){
        //This is a new player
        user_id = game_controller.create_new_user(
                                    socket, 
                                    msg.content.username, 
                                    msg.content.password);            

      } else {
        //This is a previously created player.
        //Check if the password is correct:
        if (data.props.password===msg.content.password){
          //Password is correct
          user_id = game_controller.load_existing_user(
                                    socket, 
                                    msg.content.username);
        } else {
          //Password incorrect
          let message = {            
            content: {is_login_successful: false}
          }    
          socket.emit('Login Message', message);
          //End login
        }
        
      }

    } else {
      //This is an active player.
      //Check password
      let user = World.world.get_instance(user_id);

      if (user.password===msg.content.password){
        //Password correct, change socket
        user.socket = socket;
        user.send_chat_msg_to_client('Reconnected.');

      } else {
        //Password incorrect
        let message = {          
          content: {is_login_successful: false}
        }    
        socket.emit('Login Message', message);
      }
    }
  });

  socket.on('User Input Message', (msg)=>{
    game_controller.process_user_input(msg.content, user_id);        
  });

  socket.on('Settings Message', (msg)=>{
    let user = World.world.get_instance(user_id);
    user.set_description(msg.content.description);
  });

  socket.on('disconnect', () => {
    //This is an unxpected close of connection (user didn't press 'close')
    //find the user with the socket and remove from the world.
    
    for (const user of World.world.users.values()){
      
      if (user.socket===socket){ //TODO: maybe compare socket ids?
        user.disconnect_from_game();
      }
    }
  });
});


/*
TODO:

in client, health changes color when changed
create_cmd i/f
improve client UI, add disconnect btn
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
//todo: place user in room, fix spawn_entity parameters?
*/

class Game_Controller {
  constructor(){
    this.user_save_counter=   USER_SAVE_INTERVAL;    
    this.init_game();
  }

  init_game(){    
    this.load_users_db();
    this.load_world();  
    this.game_loop();      
  }

  load_users_db(){
    //Load the database of existing users.

    if (fs.existsSync('./users_db.json')){

      let text = fs.readFileSync('./users_db.json');

      if (text.toString() !== ''){
        let data = JSON.parse(text);

        for (const [username, user_obj] of Object.entries(data.users)){
          //user_obj: {id: user.id, props: user.props};
          World.world.users_db.users[username] = user_obj;
        }
  
        for (const [id, props] of Object.entries(data.items)){
          World.world.users_db.items[id] = props;
        }
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

    //Update the users_db object with new values
    for (const user of World.world.users.values()){

      World.world.users_db.users[user.props.name] = {
        id: user.id,
        props: user.props
      }

      let inv_arr = user.get_all_items_on_body();        
      for (const obj of inv_arr){
        //obj: {id: string, location: string}
        let entity = World.world.get_instance(obj.id);
        World.world.users_db.items[entity.id] = entity.props;
      }     
      
    }
       
    fs.writeFile(`./users_db.json`, 
                  JSON.stringify(World.world.users_db),  
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
        user.send_chat_msg_to_client(`Unknown command: ${text}`);        
    }  
  }  

  create_new_user(socket, username, password){
    //Create a new user, spawned at spawn room, and associate the socket with it.
    //Returns the ID of the created user (String)
    let props = {
      name:         username,
      password:     password,      
    }

    let user = new Classes.User(props, socket);
    user.send_login_msg_to_client(true);

    //Send a welcome message, and a Status message to init the health bar.
    //Than perform a Look command on the room.
    user.send_chat_msg_to_client(`Welcome ${user.get_name()}!`);
    user.look_cmd();

    return user.id;
  }

  load_existing_user(soclet, username){
    //Load the user from the registered users database, and associate
    //the socket with it.
    //Return the ID of the retrived user (String)
    
    console.log('Loading existing user');

    let user_data = World.world.users_db.users[username]; //user_data= {id:, props:}

    let user = new Classes.User(user_data.props, socket, user_data.id);

    //Spawn the items the users carries
    let inv_arr = user.get_all_items_on_body();

    for (const obj of inv_arr){
      let props = World.world.users_db.items[obj.id];

      //Must be of type Item
      new Classes.Item(props.subtype, props, obj.id);      
    }  

    //Send a welcome message, and a status message to init the health bar.
    //Then do a Look command on the room.
    user.send_login_msg_to_client(true);
    user.send_chat_msg_to_client(`Welcome back, ${user.get_name()}.`);
    user.send_status_msg_to_client();
    
    user.look_cmd();
    return user.id;
  }
}

let game_controller=  new Game_Controller();
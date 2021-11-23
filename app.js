/*
Apps.js
-------
Entry point for the server.
Handles serving the Client to users, user login
and user input.

TODO:
in client, health changes color when changed
create_cmd i/f
add disconnect btn
add report abuse to user's cmds
State machines: if waiting for player response, repeat the state when user returns to room.
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
*/

const SERVER_VERSION=  0.2;

const fs=         require('fs');
const Classes=    require('./classes');
const World=      require('./world');

const express=    require('express');
const app=        express();
const http =      require('http');
const server =    http.createServer(app);
const { Server }= require("socket.io");
const io=         new Server(server);
 
//Serving the client to the browser
//--------------------------------

app.use(express.static('public'));

app.get('/', (req, res) => {  
  res.sendFile(__dirname + '/index.html');
});

server.listen(5000, () => {
  console.log('listening on *:5000');
});

//Game Parameters
const ENABLE_USER_SAVE=   false;
const USER_SAVE_INTERVAL= 10;

//Handle Socket.IO Connections and messages.
//-----------------------------------------

io.on('connection', (socket) => {
  console.log('a user connected');

  //Create a new user or load a new one.
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

  //Send text inputs for processing.
  socket.on('User Input Message', (msg)=>{
    game_controller.process_user_input(msg.content, user_id);        
  });

  //Set the user's description field.
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

//Init the game world, handle users login, process inputs.
class Game_Controller {
  constructor(){
    this.user_save_counter= USER_SAVE_INTERVAL;    
    this.init_game();
  }

  //Runs when the server is created. 
  //Loads databases, starts the game loop.
  init_game(){    
    this.load_users_db();
    this.load_world();  
    this.load_entities_db();
    this.game_loop();      
  }

  //Load the database of existing users.
  load_users_db(){   

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
  
  //Load all rooms and entities (except users) from the database.
  load_world(){    
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

  load_entities_db(){
    if (fs.existsSync(`./entities.json`)){      
      World.world.entities_db = JSON.parse(fs.readFileSync("./entities.json"));              
    } else {
      console.error(`app.load_entities -> entities.js does not exist.`);
    }

  }

  //Called periodicaly
  //Save all the users and the entities they carry on them.    
  save_users_to_file(){    

    if (!ENABLE_USER_SAVE) return;

    //Update the users_db object with new values
    for (const user of World.world.users.values()){

      World.world.users_db.users[user.props.name] = {
        id:     user.id,
        props:  user.props
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
  
  //Timer for game loop.
  //Note: the loop technique allows for a minimum fixed length between
  //loop iterations, regardless of content of the loop.
  game_loop(){   
    
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

  //Iterate on all entities, and process their tick actions (or handle a fight)
  run_simulation_tick(){    

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
    
  //Takes the text recived via the webSockets interface,
  //and the user_id who sent it. Parses the text, and calls the required 
  //command method from Use.
  process_user_input(text, user_id){    

    if (text==='') return;//Ignore empty messages.
  
    //All input text is changed to lower case, and split by
    //white spaces.
    let normalized_text=  text.trim().toLowerCase();  
    let re=               /\s+/g; //search for all white spaces.
    let input_arr =       normalized_text.split(re);
    
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
        //Assumes the 2nd word is the username to send a message to.
        let username = input_arr[1];
        let content = input_arr.slice(2).join(' ');
        user.tell_cmd(username, content);
        break;

      case "create":
      case "cr":
        user.create_cmd(target);
        break;

      default:
        user.send_chat_msg_to_client(`Unknown command: ${text}`);        
    }  
  }  

  //Create a new user, spawned at spawn room, and associate the socket with it.
  //Returns the ID of the created user (String)
  create_new_user(socket, username, password){
    
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

  //Load the user from the registered users database, and associate
  //the socket with it.
  //Return the ID of the retrived user (String)
  load_existing_user(soclet, username){
    
    console.log('Loading existing user');

    let user_data=  World.world.users_db.users[username]; //user_data= {id:, props:}
    let user=       new Classes.User(user_data.props, socket, user_data.id);

    //Spawn the items the users carries
    let inv_arr = user.get_all_items();

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

//Start Game Server
let game_controller=  new Game_Controller();
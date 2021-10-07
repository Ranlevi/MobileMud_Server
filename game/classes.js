const Utils=      require('./utils');
const World=      require('./world');
const Inventory=  require('./inventory');

//Notes on the design concept:
//1. Minimal number of Classes.
//2. Base classes exists to set default values and methods, for DRY, that
//   should be overwritten by the specific instance class.
//3. Each class should be autonamous as possible, with it's own internal state
//   and returning it's own look strings, etc.

class Item {
//Not meant to be called directly.
constructor(id){    
    this.id=          (id===null)? Utils.id_generator.get_new_id() : id;
    this.name=        null;
    this.description= "A Description.";
    this.type=        "Item";
    this.type_string= "An Item."; 
    this.state=       "Default";
  }  

  process_tick(){
    //do nothing unless overided by instance
  }

  get_look_string(){
    //Can be overriden
    return "This is a generic item in the game. If you see this, Ran screwed up."
  }

  add_entity(id){
    return false;//If not overriden by child, adding fails.
  }

  remove_entity(id){
    return false;//If not overriden by child, removing fails.
  }

  get_entities(){
    return [];
  }
}

class Room extends Item {
  constructor(instance_props, id=null){
      super(id);

      this.name=        instance_props.name;
      this.description= instance_props.description;
      this.type=        "Room"
      this.type_string= "A Room"; 
      this.entities=    new Set();
      this.exits= {
        "north": null, //direction: id
        "south": null,
        "west":  null,
        "east":  null,
        "up":    null,
        "down":  null
        },
      this.lighting=  "white"; //CSS colors

      for (const [direction, next_room_id] of Object.entries(instance_props.exits)){
        this.add_exit(direction, next_room_id);
      }
      World.world.add_to_world(this);
  }
  
  add_exit(direction, next_room_id){
    this.exits[direction] = next_room_id;
  }
  
  add_entity(entity_id){
    this.entities.add(entity_id);
  }
  
  remove_entity(entity_id){
    this.entities.delete(entity_id);
  }
  
  get_entities(){
    //this.entities is a Set(), so we convert it to an array.
    let arr = [];
    for (const entity_id of this.entities){
    arr.push(entity_id);
    }
    return arr;
  }  
  
  get_users(){
    let arr = [];
    for (let entity_id of this.entities){
      let entity = World.world.get_instance(entity_id);
      if (entity instanceof User){
        arr.push(entity_id);
      }
    }
    return arr;
  }
  
  set_lighting(color){
    this.lighting = color;
  }

  get_look_string(){
        
    let msg = `**[${this.name}]({type:"Room", id:${this.id}}, `;
    msg += `lighting: ${this.lighting})**  ${this.description}  `;
    msg += `Exits:  `;

    for (const [direction, next_room_id] of Object.entries(this.exits)){
      if (next_room_id!==null){
          msg += `[${direction}]({type:"Command"}) `
      }
    }

    msg += '  '; //new paragraph

    // let entities_arr = room.get_entities();
    if (this.entities.size===1){    
      //Only the player is in the room.
      msg += 'The room is empty.';
    } else {
      msg += 'In the room:  ';

      for (const entity_id of this.entities){        

        let entity = World.world.get_instance(entity_id);

        if (entity.name===null){
          msg += `[${entity.type_string}](${entity.type_string})     `;
        } else {
          msg += `[${entity.name}]({type:${entity.type_string}, `;
          msg += `id:${entity.id}}), ${entity.type_string}.  `;       
        }
      }
    }

    return msg;
  }
}

class Entity extends Item {
  //Not meant to be called directly.
  constructor(id, container_id){
      super(id);

      this.container_id = container_id;    
      
      let container= World.world.get_instance(container_id);
      container.add_entity(this.id);

      World.world.add_to_world(this);

      this.inventory=       new Inventory.Inventory(0, false);
      this.is_gettable=     false;
      this.wear_hold_slot=  null; //Hands, Feet, Head, Torso, Legs.
  }

  get_look_string(){
    let msg = `It's ${this.type_string}`;
    return  msg;
  }

  set_container_id(id){
    this.container_id= id;
  }
}

class AnimatedObject extends Entity {
  //Not meant to be called directly.
  constructor(id, container_id){
    super(id, container_id);

    this.health=            10;
    this.damage=            1;          
    this.is_fighting_with=  null;    
  }

  start_battle_with(id){
    this.is_fighting_with = id;
  }

  stop_battle(){
    this.is_fighting_with = null;
  }

  strike_opponent(opponent_id){
    //basic striking. Can be overriden.
    let opponent=     World.world.get_instance(opponent_id);
    let damage_dealt= opponent.receive_damage(this.damage);
    return damage_dealt;
  }

  receive_damage(damage){
    //Basic damage reception, can be overided.
    this.health = this.health - damage;
    if (this.health<0) this.health= 0;
    return damage;
  }
}

class Dog extends AnimatedObject {
  constructor(instance_props, id=null){
    super(id, instance_props.container_id);

    this.name=        instance_props.name;
    this.description= instance_props.description;
    this.type=        "Dog";
    this.type_string= "A Dog";
    this.health=      5;
    this.counter=     5;    
  }

  process_tick(){
    
    //Overide in inherited class.
    switch(this.state){

      case("Default"):
        //Action
        this.counter -= 1;

        //Transition
        if (this.counter===0){
        this.state = 'Barking';          
        } 
        break;

      case('Barking'):
        //Action
        this.counter = 5;
        
        let msg = {
          sender: 'world',
          content: 'Archie Barks.'
        }
        Utils.msg_sender.send_message_to_room(this.id, msg);

        //Transition
        this.state = 'Default';
        break;
    }
  }  

  get_look_string(){
    let msg = `This is [${this.name}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.type_string}.  ${this.description}`
    return  msg;
  }
}

class Corpse extends Entity {
  constructor(description, container_id, id=null){
    super(id, container_id);

    this.description =        description;
    this.type=                "Corpse"
    this.type_string=         "A Corpse";
    this.decomposition_timer= 10;
    this.inventory=           new Inventory.Inventory(17, false);
  }

  process_tick(){
    this.decomposition_timer -= 1;

    if (this.decomposition_timer===0){
      
      //Sending a msg before the actuall removal, since we
      //cant do anything after the removal.
      let msg = {
        sender: 'world',
        content: 'The corpse has decomposed and disappered.'
      }
      Utils.msg_sender.send_message_to_room(this.id, msg); 
      

      //Remove all the items in the inventory from the world.
      let ids_arr = this.inventory.get_all_entities_ids();
      for (const id of ids_arr){
        World.world.remove_from_world(id);
      }

      //Remove the corpse from its container and the world.
      let container = World.world.get_instance(this.container_id);
      container.remove_entity(this.id);
      World.world.remove_from_world(this.id);
    }
  }

  set_decomposition_timer(num_of_ticks){
    this.decomposition_timer = num_of_ticks;
  }

  get_look_string(){
    //TODO: solve - how to return a message chain??
  }
}

class Screwdriver extends Entity {
  constructor(instance_props, id=null){
    super(id,instance_props.container_id);

    this.description =   instance_props.description;
    this.type=          "Screwdriver"
    this.type_string=   "A Screwdriver";
    this.is_gettable=   true;
    this.wear_hold_slot="Hands";
  }

  get_data_obj(){
    let obj = {
      type:        this.type
    }
    return obj;
  }

  get_look_string(){
    let msg = `This is [${this.type_string}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.description}`;
    return  msg;
  }
}

class User extends AnimatedObject {
  constructor(name, description, ws_client, container_id, id=null){
    super(id, container_id);    
    this.BASE_HEALTH = 10;
    this.BASE_DAMAGE = 1;
    
    this.name=          name;
    this.description=   description;
    this.ws_client=     ws_client;
    this.type=          "User";
    this.type_string=   "A User";
    this.health=        this.BASE_HEALTH;
    this.damage=        this.BASE_DAMAGE;

    this.inventory=     new Inventory.Inventory(10);
    this.msg_queue=     new Utils.Queue();

    this.password=      null;
  }

  set_password(pw){
    this.password = pw;
  }

  get_data_obj(){
    let obj = {
      description:    this.description,
      container_id:   this.container_id,
      health:         this.health,
      damage:         this.damage,
      password:       this.password,
      inventory:      this.inventory.get_data_object()
    }
    return obj;
  }
    
  reset(spawn_container_id){
    this.health=            this.BASE_HEALTH;
    this.damage=            this.BASE_DAMAGE;
    this.state=             "Default";
    this.is_fighting_with=  null;
    this.inventory=         new Inventory.Inventory(10);

    let current_container = World.world.get_instance(this.container_id);
    current_container.remove_entity(this.id);

    let spawn_container = World.world.get_instance(spawn_container_id);
    spawn_container.add_entity(this.id);

    let msg = {
      sender: "world",
      content: `You respawned in the starting room.`
    }
    Utils.msg_sender.send_message_to_user(this.id, msg);
  }

  get_look_string(){    
    let msg = `This is [${this.name}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.type_string}.  ${this.description};`
    return  msg;    
  }

  get_inv_content(){
    let messages_arr = this.inventory.generate_inv_messages();
    this.msg_queue.load(messages_arr);

    return this.msg_queue.dequeue(); 
  }

  get_next_msg_from_queue(){
    return this.msg_queue.dequeue();
  }

  clear_msg_queue(){
    this.msg_queue.clear();
  }

}

exports.Item=             Item;
exports.AnimatedObject=   AnimatedObject;
exports.Corpse=           Corpse;
exports.Entity=           Entity;
exports.User=             User;
exports.Dog=              Dog;
exports.Room=             Room;
exports.Screwdriver=      Screwdriver;

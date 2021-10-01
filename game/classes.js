const Utils = require('./utils');
const World = require('./world');
const Inventory = require('./inventory');

class Item {
//Not meant to be called directly.
constructor(name, description){    
    this.name=        name;
    this.description= description;
    this.type_string= null; 
    this.state=       "Default";
  }  

  process_tick(){
    //do nothing unless overided by instance
  } 
}

class Room extends Item {
  constructor(name, description, id=null){
      super(name, description, id);
      this.id=      (id===null)? Utils.id_generator.get_new_id() : id;
      this.type_string= "A Room"; 
      this.entities=    new Set();
      this.exits= {
        "north": null,
        "south": null,
        "west":  null,
        "east":  null,
        "up":    null,
        "down":  null
        },
      this.lighting=  "white"; //CSS colors
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
    for (let entity_id of this.entities){
    arr.push(entity_id);
    }
    return arr;
  }
  
  get_entity_id_by_name(name){
    //Note: name is assumed to be all lower case.
    for (let entity_id of this.entities){      
      let entity_name = World.world.get_instance(entity_id).name.toLowerCase();
      if (entity_name===name){
          return entity_id;
      }
    }
    return null;//entity not found.
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
}

class Entity extends Item {
  //Not meant to be called directly.
  constructor(name, description, room_id, id=null){
      super(name, description);
      this.id=      (id===null)? Utils.id_generator.get_new_id() : id;

      let room =              World.world.get_instance(room_id);
      room.add_entity(this.id);
      this.room_id=           room_id;

      this.health=            10;
      this.damage=            1;          
      this.is_fighting_with=  null;

      this.inventory= new Inventory.Inventory(10);
  }
  
  start_battle_with(id){
      this.is_fighting_with = id;
  }
  
  stop_battle(){
      this.is_fighting_with = null;
  }
  
  strike_opponent(opponent_id){
      //basic striking. Can be overriden.
      let opponent = World.world.get_instance(opponent_id);
      let damage_dealt = opponent.receive_damage(this.damage);
      return damage_dealt;
  }
  
  receive_damage(damage){
      //Basic damage reception, can be overided.
      this.health = this.health - damage;
      if (this.health<0) this.health= 0;
      return damage;
  }
  
  process_tick(){
    //To ve overidden
  }
}

class InAnimateObject extends Entity {
  //Not meant to be called directly.
  constructor(name, description, room_id, id){
    super(name, description, room_id, id);  
    
    this.inventory= new Inventory.Inventory(0, false, false);
  }
}

class Corpse extends InAnimateObject {
  constructor(name, description, room_id, id=null){
    super(`The Corpse of ${name}`, description, room_id, id);
    this.type_string=         "A Corpse";
    this.decomposition_timer= 10;
    this.inventory=           new Inventory.Inventory(17, false, false);
  }

  process_tick(){
    this.decomposition_timer -= 1;
  }

  set_decomposition_timer(num_of_ticks){
    this.decomposition_timer = num_of_ticks;
  }
}

class Screwdriver extends InAnimateObject {
  constructor(name, description, room_id, id=null){
    super(name, description, room_id, id);

    this.type_string=         "A Screwdriver";
  }
}

class User extends Entity {
  constructor(name, description, ws_client, room_id, id=null){
    super(name, description, room_id, id);
    this.BASE_HEALTH = 100;
    this.BASE_DAMAGE = 1;

    this.ws_client=   ws_client;
    this.type_string= "A User";
    this.health=      BASE_HEALTH;
    this.damage=      BASE_DAMAGE;
  }

  reset(spawn_room_id){
    this.health=            BASE_HEALTH;
    this.damage=            BASE_DAMAGE;
    this.state=             "Default";
    this.is_fighting_with=  null;
    this.inventory=         new Inventory.Inventory(10);

    let current_room = World.world.get_instance(this.room_id);
    current_room.remove_entity(this.id);

    let starting_room = World.world.get_instance(spawn_room_id);
    starting_room.add_entity(this.id);
  }
}

class NPC extends Entity {
//Not meant to be called directly.
  constructor(name, description, room_id, id){
    super(name, description, room_id, id);
  }
}

class Dog extends NPC {
  constructor(name, description, room_id, id=null){
    super(name, description, room_id, id);
    this.type_string= "A Dog";
    this.health=      5;
    this.counter=     5;
    this.inventory=   new Inventory.Inventory(0, false, false);
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
        Utils.msg_sender.send_message_to_room(this.room_id, msg);

        //Transition
        this.state = 'Default';
        break;
    }
  }  
}

exports.Item=             Item;
exports.InAnimateObject=  InAnimateObject;
exports.Corpse=           Corpse;
exports.Entity=           Entity;
exports.NPC=              NPC;
exports.User=             User;
exports.Dog=              Dog;
exports.Room=             Room;
const Utils = require('./utils');
const World = require('./world');

class BaseType {
//Not meant to be called directly.
constructor(name, description, id){
    this.id=          (id===null)? Utils.id_generator.get_new_id() : id;
    this.name=        name;
    this.description= description;
    this.type=        null; //todo: change to type_string
    this.state=       null;
}  

process_tick(){
    //do nothing unless overided by instance
  }  
}

class InAnimateObject extends BaseType {
constructor(name, description, id){
    super(name, description, id);
    this.room_id = null;
  }
}

class Corpse extends InAnimateObject {
constructor(name, description, id=null){
    super(`The Corpse of ${name}`, description, id);
    this.type = "A Corpse";
    this.decomposition_timer= 10;
}

process_tick(){
  this.decomposition_timer -= 1;
}
}

class Entity extends BaseType {
//Not meant to be called directly.
constructor(name, description, id){
    super(name, description, id);
    this.room_id= null;   
    this.health=  10;
    this.damage=  1;    
    this.state= null; 
    this.is_fighting_with=    null;    
}

start_battle_with(id){
    this.is_fighting_with = id;
}

stop_battle(){
    this.is_fighting_with = null;
}

strike_opponent(){
    //basic striking. Can be overriden.
    let opponent = World.world.get_instance(this.is_fighting_with);
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

class User extends Entity {
constructor(name, description, ws_client, id=null){
    super(name, description, id);
    this.ws_client= ws_client;
    this.type=      "A Player";
    this.health=    5;       
}

reset(){
    this.health = 100;
    this.damage = 1;
    this.state = "Default";
    this.is_fighting_with = null;
}
}

class NPC extends Entity {
//Not meant to be called directly.
constructor(name, description, id){
    super(name, description, id);
}
}

class Dog extends NPC {
constructor(name, description, id=null){
    super(name, description, id);
    this.type=    "A Dog";
    this.health=  50;
    this.counter= 5; 
    this.state = "Idle";
}

process_tick(){
    //Overide in inherited class.
    switch(this.state){

    case("Idle"):
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
        this.state = 'Idle';
        break;
    }
}  
}

class Room extends Classes.BaseType {
constructor(name, description, id=null){
    super(name, description, id);
    this.entities = new Set();
    this.exits    = {
    "north": null,
    "south": null,
    "west":  null,
    "east":  null,
    "up":    null,
    "down":  null
    },
    this.lighting = "white"; //CSS colors
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
    let arr = [];
    for (let entity_id of this.entities){
    arr.push(entity_id);
    }
    return arr;
}

get_entity_id_by_name(name){
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


exports.BaseType = BaseType;
exports.InAnimateObject = InAnimateObject;
exports.Corpse = Corpse;
exports.Entity = Entity;
exports.NPC = NPC;
exports.User = User;
exports.Dog = Dog;
exports.Room = Room;
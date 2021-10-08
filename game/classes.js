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
    //Can be overriden. Returns Arr.
    return ["This is a generic item in the game. If you see this, Ran screwed up."]
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

  get_data_obj(){
    //Basic default save object.
    let obj = {
      type:           this.type,
      instance_properties: {
        name:         this.name,
        description:  this.description,
        state:        this.state
      }      
    }
    return obj;
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

    return [msg];
  }

  get_data_obj(){    
    let obj = {
      type:           this.type,
      instance_properties: {
        name:         this.name,
        description:  this.description,
        lighting:     this.lighting,
        exits:        this.exits
      }      
    }
    return obj;
  }

  search_for_target(target){
    let entities_ids_arr = this.get_entities();

  for (const entity_id of entities_ids_arr){
    let entity = World.world.get_instance(entity_id);
    console.log(entity.type);

    if (entity.name!==null && entity.name.toLowerCase()===target){
      return entity_id;
    } else if (entity.type.toLowerCase()==target){
      return entity_id;
    }     
  }

  return null; //no target found
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

      this.inventory=       new Inventory.Inventory(this.id, 0, false);
      this.is_gettable=     false;
      this.wear_hold_slot=  null; //Hands, Feet, Head, Torso, Legs.
      this.is_food=         false;
      this.restore_health_value= 0;
  }

  remove_from_world(){
    let container = World.world.get_instance(this.container_id);
    container.remove_entity(this.id);
    World.world.remove_from_world(this.id);
  }

  get_look_string(){
    let msg = `This is [${this.type_string}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.description}`;
    return [msg];
  }

  set_container_id(id){
    this.container_id= id;
  }

  get_data_obj(){
    //Basic default save object.
    let obj = {
      type:             this.type,
      instance_properties: {
        name:           this.name,
        description:    this.description,
        state:          this.state,
        container_id:   this.container_id,
        is_gettable:    this.is_gettable,
        wear_hold_slot: this.wear_hold_slot,
        inventory:      this.inventory.get_data_object(),
        is_food:        this.is_food,
        restore_health_value: this.restore_health_value
      }      
    }
    return obj;
  }
}

class AnimatedObject extends Entity {
  //Not meant to be called directly.
  constructor(id, container_id){
    super(id, container_id);

    this.health=            10;
    this.damage=            1;          
    this.is_fighting_with=  null;
    this.counter=           0;
  }

  get_data_obj(){
    //Basic default save object.
    //Should cover all the default properties.
    //Overide if unique props exist.
    let obj = {
      type:               this.type,
      instance_properties: {
        name:             this.name,
        description:      this.description,
        state:            this.state,
        container_id:     this.container_id,
        is_gettable:      this.is_gettable,
        wear_hold_slot:   this.wear_hold_slot,
        inventory:        this.inventory.get_data_object(),
        health:           this.health,
        damage:           this.damage,
        is_fighting_with: this.is_fighting_with,
        counter:          this.counter
      }      
    }
    return obj;
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


    this.health=        (instance_props.health===undefined)?
      5 : instance_props.health;
    this.damage=        (instance_props.damage===undefined)?
      1 : instance_props.damage;
    this.counter=        (instance_props.counter===undefined)?
      5 : instance_props.counter;    
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
          type: "Chat",
            content: {
              sender: 'world',
              text: 'Archie Barks.'
            }          
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
    return [msg];
  }
}

class Corpse extends Entity {
  constructor(instance_props, id=null){
    super(id, instance_props.container_id);

    this.description =        instance_props.description;
    this.type=                "Corpse"
    this.type_string=         "A Corpse";
    this.decomposition_timer= 60;
    this.inventory=           new Inventory.Inventory(this.id, 17, false);
  }

  get_data_obj(){
    //Basic default save object.
    let obj = {
      type:                   this.type,
      instance_properties: {
        name:                 this.name,
        description:          this.description,
        state:                this.state,
        container_id:         this.container_id,
        is_gettable:          this.is_gettable,
        wear_hold_slot:       this.wear_hold_slot,
        inventory:            this.inventory.get_data_object(),
        decomposition_timer:  this.decomposition_timer
      }      
    }
    return obj;
  }

  process_tick(){
    this.decomposition_timer -= 1;

    if (this.decomposition_timer===0){
      
      //Sending a msg before the actuall removal, since we
      //cant do anything after the removal.
      let msg = {
        type: "Chat",
            content: {
              sender: 'world',
              text: 'The corpse has decomposed and disappered.'
            }        
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
    let msg_arr = [];
    let msg = `**[${this.type_string}]({type:${this.type}, id:${this.id}}, `;
    msg += `It holds:  `;
       
    let items = this.inventory.get_all_slot_items();

    if (items.length===0){
      msg += `Nothing.`;      
      msg_arr.push(msg);
    } else {
      msg_arr.push(msg);
      let counter = 0;
      msg = ``;
      for (const id of items){
        counter += 1;
        if (counter===4){
          msg_arr.push(msg);
          msg = ``;
          counter= 0;
        } else {
          msg += `${this.type_string}  `;
        }
        msg_arr.push(`${this.type_string}  `);
      }
    }
    return msg_arr;
  }
}

class Screwdriver extends Entity {
  constructor(instance_props, id=null){
    super(id,instance_props.container_id);

    this.description =   "It's a philips screwdriver."
    this.type=          "Screwdriver"
    this.type_string=   "A Screwdriver";
    this.is_gettable=   true;
    this.wear_hold_slot="Hands";
  }    
}

class User extends AnimatedObject {
  constructor(instance_props, ws_client, id=null){
    super(id, instance_props.container_id);    
    this.BASE_HEALTH= 5;
    this.BASE_DAMAGE= 1;  
    this.HEALTH_DECLINE_RATE=10; //1 health point per 10 ticks  

    this.ws_client=     ws_client;
    this.name=          instance_props.name;
    this.password=      instance_props.password;
    this.description=   (instance_props.description===undefined)? 
      "It's YOU, Bozo!" : instance_props.description;
    this.health=        (instance_props.health===undefined)?
      this.BASE_HEALTH : instance_props.health;
    this.damage=        (instance_props.damage===undefined)?
      this.BASE_DAMAGE : instance_props.damage;    

    this.inventory=     new Inventory.Inventory(this.id, 10);
    if (instance_props.inventory!==undefined){      
      this.inventory.update_from_obj(instance_props.inventory);
    }
      
    this.type=          "User";
    this.type_string=   "A User";
    this.msg_queue=     new Utils.Queue();    
  }

  process_tick(){
    
    this.counter +=1;
    if (this.counter===this.HEALTH_DECLINE_RATE){
      this.health -= 1;
      this.counter = 0;

      let msg = {
        type: "Status",
        content: {
          health: this.health
        }        
      }
      Utils.msg_sender.send_message_to_user(this.id, msg);
    }

    if (this.health===0){
      //Player is dead.
      let msg = {
        type: "Chat",
        content: {
          sender: 'world',
          text: `You are DEAD!`
        }        
      }
      Utils.msg_sender.send_message_to_user(this.id, msg);

      //Create a corpse
      let instance_props= {
        description:  this.description,
        container_id: this.container_id
      };
      new Corpse(instance_props);
      this.reset(World.FIRST_ROOM_ID)
    }

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
      
type: 'Chat',
content: {
  sender: "world",
      text: `You respawned in the starting room.`
}
      
    }
    Utils.msg_sender.send_message_to_user(this.id, msg);
  }

  get_look_string(){    
    let msg = `This is [${this.name}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.type_string}.  ${this.description};`
    return [msg];    
  }

  get_inv_content(){
    this.msg_queue.clear(); 
    let messages_arr = this.inventory.generate_inv_messages();
    this.msg_queue.load(messages_arr);

    return this.msg_queue.dequeue(); 
  }

  add_to_queue(msg_arr){
    this.msg_queue.load(msg_arr);    
  }

  get_next_msg_from_queue(){
    return this.msg_queue.dequeue();
  }

  clear_msg_queue(){
    this.msg_queue.clear();
  }

  search_target_in_slots(target){
    let items_in_slots_arr = this.inventory.get_all_slot_items();

    for (const entity_id of items_in_slots_arr){
      let entity = World.world.get_instance(entity_id);
      if ((entity.name!==null && entity.name.toLowerCase()===target) ||
           entity.type.toLowerCase()===target){
        return entity_id;        
      }    
    }
    return null;
  }

  search_target_in_wear_hold(target){
    let items_in_wear_hold_arr = this.inventory.get_all_wear_hold_items();

    for (const entity_id of items_in_wear_hold_arr){
      let entity = World.world.get_instance(entity_id);
      if ((entity.name!==null && entity.name.toLowerCase()===target) ||
           entity.type.toLowerCase()===target){
        return entity_id;        
      }    
    }
    return null;
  }

  drop_item_from_slots(entity_id){
    //We assume the entity is in the slots.
    //we drop it to the floor.
    let success = false;
    this.inventory.remove_from_slots(entity_id);
    let container = World.world.get_instance(this.container_id);
    container.add_entity(entity_id);

    let entity = World.world.get_instance(entity_id);
    entity.set_container_id(container.id);

    return success;
  }

  add_to_slots(entity_id){
    let success = this.inventory.add_to_slots(entity_id);

    if (success){
      let entity = World.world.get_instance(entity_id);
      entity.set_container_id(this.id);
    }

    return success;
  }

  wear_or_hold_entity(entity_id){
    //We assume the entity is in a slot.
    //Remove it from slots, wear or hold it if free.
    let success = this.inventory.move_entity_from_slots_to_wear_hold(entity_id);
    return success;
  }

  remove_from_wear_hold(entity_id){
    //returns true/false
    return this.inventory.move_entity_from_wear_hold_to_slots(entity_id);    
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

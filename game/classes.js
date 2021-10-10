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
  constructor(){    
    //Base properties that exist for all Items.
    this.id=          null;
    this.name=        null;
    this.description= "";
    this.type=        "Item";
    this.type_string= "An Item.";
    this.state=       "Default";
  }  

  process_tick(){
    //do nothing unless overided by instance
  }

  get_look_string(){    
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

  get_data_obj(){//TODO: change to save_obj?
    //Returns an object with all the properties of the instance.
    //Note: if overriden, the overiding class needs to get
    //all the props of the super-class, plus its own unique ones.

    //Note: id is not save since it is already saved as key to the object in the JSON file.
    let obj = {
      type:           this.type,
      props: {
        name:         this.name,
        description:  this.description,
        type_string:  this.type_string,
        state:        this.state,
      }      
    }
    return obj;
  }

  override_props(props_obj){
    //Override with props
    
    if (props_obj!==null){
      for (const [prop, value] of Object.entries(props_obj)){

        if (prop==="inventory") continue;

        if (prop==="container_id"){
          let old_container= World.world.get_instance(this.container_id);
          old_container.remove_entity(this.id);
          let new_container= World.world.get_instance(value);
          new_container.add_entity(this.id);
          this.container_id= value;
        } else {
          this[prop]= value;
        }        
      }
    }
  }
}

class Room extends Item {
  constructor(props=null, id=null){
      super();

      //Default props
      this.id= (id===null)? Utils.id_generator.get_new_id() : id;
      this.name= "Room";
      this.description="A simple, 3m by 3m room, with white walls."
      this.type=        "Room"
      this.type_string= "A Room"; 
      this.entities=    new Set();//Note: saved entities are added when created.
      this.exits= {
        "north": null, //direction: id
        "south": null,
        "west":  null,
        "east":  null,
        "up":    null,
        "down":  null
        },
      this.lighting=  "white"; //CSS colors

      //Overide props if exist
      this.override_props(props);      

      //Add To world.
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
          msg += `[${entity.type_string}]({type:${entity.type_string}, `;
          msg += `id:${entity.id}}), ${entity.type_string}.  `;
        } else {
          msg += `[${entity.name}]({type:${entity.type_string}, `;
          msg += `id:${entity.id}}), ${entity.type_string}.  `;       
        }
      }
    }

    return msg;
  }

  get_data_obj(){  
    
    let obj = {
      type:           this.type,
      props: {
        //Item props
        name:         this.name,
        description:  this.description,
        state:        this.state,
        //Room Props
        lighting:     this.lighting,
        exits:        this.exits
        //Note: entities are not saved in the room, but by themselves.
      }      
    }
    return obj;
  } 

  search_for_target(target){
    let entities_ids_arr = this.get_entities();    

  for (const entity_id of entities_ids_arr){
    let entity = World.world.get_instance(entity_id);
    
    if ((entity.name!==null && entity.name.toLowerCase()===target) ||
        (entity.type.toLowerCase()==target) ||
        (target===entity.id)){
          return entity_id;    
    }          
  }

  return null; //no target found
  }
}

class Entity extends Item {
  //Not meant to be called directly.
  constructor(id=null){ //note: no props, since this is done on the subclass level
      super();
      this.BASE_WEAR=  2;
      this.DECAY_RATE= 10; //1 wear point per 10 ticks.

      //Default props
      this.id= (id===null)? Utils.id_generator.get_new_id() : id;
      this.container_id =  "0";
      this.inventory=       null;
      this.is_gettable=     false;
      this.wear_hold_slot=  null; //Hands, Feet, Head, Torso, Legs.
      this.is_food=         false;
      this.restore_health_value= 0;
      this.is_decaying=     false;
      this.decay_rate=      this.DECAY_RATE;
      this.wear=            this.BASE_WEAR;
      this.decay_tick_counter= 0;
      
      //Add to World
      let container= World.world.get_instance(this.container_id);
      container.add_entity(this.id);
      World.world.add_to_world(this);
  }
  
  enable_decay(){    
    this.is_decaying= true;
  }

  disable_decay(){
    this.is_decaying= false;
  }

  process_decay(){
    if (this.is_decaying){

      this.decay_tick_counter +=1;
      if (this.decay_tick_counter===this.decay_rate){
        this.decay_tick_counter=0;
        this.wear -= 1;
  
        if (this.wear===0){
          //remove entity from the world and user.
          let container = World.world.get_instance(this.container_id);
          if (container instanceof User){
            Utils.msg_sender.send_chat_msg_to_user(container.id, 'world',
              `${this.type_string} has decayed and disintegrated.`);
          }
          this.remove_from_world();          
        }
      }
    }    
  }

  remove_from_world(){
    let container = World.world.get_instance(this.container_id);
    container.remove_entity(this.id);
    World.world.remove_from_world(this.id);
  }

  get_look_string(){
    let msg = `This is [${this.type_string}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.description}  `;
    msg += `Wear level: ${this.wear}.`

    if (this.inventory!==null){

      msg += `It holds:  `;
       
      let items = this.inventory.get_all_slot_items();

      if (items.length===0){
        msg += `Nothing.`;            
      } else {      
        for (const id of items){
          msg += `${this.type_string}  `;      
        }
      }
    }

    return msg;
  }

  set_container_id(id){
    this.container_id= id;
  }

  get_data_obj(){

    let obj = {
      type:           this.type,
      props: {
        //Item default props
        name:         this.name,
        description:  this.description,
        state:        this.state,
        //Entity specific props
        container_id:   this.container_id,
        is_gettable:    this.is_gettable,
        wear_hold_slot: this.wear_hold_slot,
        inventory:      (this.inventory===null)? null : this.inventory.get_data_object(),
        is_food:        this.is_food,
        restore_health_value: this.restore_health_value,
        is_decaying: this.is_decaying,
        decay_rate: this.decay_rate,
        wear: this.wear,
        decay_tick_counter: this.decay_tick_counter
      }      
    }
    return obj;
  }    
}

class AnimatedObject extends Entity {
  //Not meant to be called directly.
  constructor(id){
    super(id);

    this.BASE_HEALTH=       10;
    this.BASE_DAMAGE=       1;
    this.BASE_COUNTER=      5;

    //Default values
    this.health=            this.BASE_HEALTH;
    this.damage=            this.BASE_DAMAGE;          
    this.is_fighting_with=  null;//Never spawn into a battle.
    this.counter=           this.BASE_COUNTER;    
  }

  get_data_obj(){
    let obj = {
      type:           this.type,
      props: {
        //Item default props
        name:         this.name,
        description:  this.description,
        state:        this.state,
        //Entity specific props
        container_id:   this.container_id,
        is_gettable:    this.is_gettable,
        wear_hold_slot: this.wear_hold_slot,
        inventory:      (this.inventory===null)? null : this.inventory.get_data_object(),
        is_food:        this.is_food,
        restore_health_value: this.restore_health_value,
        is_decaying: this.is_decaying,
        decay_rate: this.decay_rate,
        wear: this.wear,
        decay_tick_counter: this.decay_tick_counter,
        //AnimatedObject specific props
        health:           this.health,
        damage:           this.damage,
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

  get_look_string(){
    let msg = `This is [${this.name}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.type_string}.  ${this.description}`
    return msg;
  }
}

class Dog extends AnimatedObject {
  constructor(props, id=null){
    super(id);

    this.BASE_HEALTH= 10;    
    this.type=        "Dog";
    this.type_string= "A Dog";  
    this.name=        "Archie";
    this.description= "A cute but silly dog.";

    this.override_props(props);//possible bug: should the save object keys be strings??
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
        Utils.msg_sender.send_chat_msg_to_room(this.id,'world','Archie Barks.');        

        //Transition
        this.state = 'Default';
        break;
    }
  } 
  
}

class Corpse extends Entity {
  constructor(props, id=null){
    super(id);
    
    this.description=         "It's dead, Jim.";
    this.type=                "Corpse"
    this.type_string=         "A Corpse";
    this.decomposition_timer= 60;
    this.inventory=           new Inventory.Inventory(this.id, 17, props, false);    
  }

  process_tick(){
    this.decomposition_timer -= 1;

    if (this.decomposition_timer===0){
      
      //Sending a msg before the actuall removal, since we
      //cant do anything after the removal.
      Utils.msg_sender.send_chat_msg_to_room(this.id,'world',
        'The corpse has decomposed and disappered.');    

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

  get_data_obj(){
    let obj = {
      type:           this.type,
      props: {
        //Item default props
        name:         this.name,
        description:  this.description,
        state:        this.state,
        //Entity specific props
        container_id:   this.container_id,
        is_gettable:    this.is_gettable,
        wear_hold_slot: this.wear_hold_slot,
        inventory:      this.inventory.get_data_object(),
        is_food:        this.is_food,
        restore_health_value: this.restore_health_value,
        is_decaying: this.is_decaying,
        decay_rate: this.decay_rate,
        wear: this.wear,
        decay_tick_counter: this.decay_tick_counter,
        //Corpse specific props
        decomposition_timer: this.decomposition_timer
      }      
    }
  }
 
}

class Screwdriver extends Entity {
  constructor(props, id=null){
    super(id);

    this.description =   "It's a philips screwdriver."
    this.type=          "Screwdriver"
    this.type_string=   "A Screwdriver";
    this.is_gettable=   true;
    this.wear_hold_slot="Hands";    

    this.override_props(props);
  }    
}

class User extends AnimatedObject {
  constructor(props, ws_client, id=null){
    super(id);    
    this.BASE_HEALTH= 5;
    this.BASE_DAMAGE= 1;  
    this.HEALTH_DECLINE_RATE=10; //1 health point per 10 ticks  

    this.ws_client=     ws_client;
    this.name=          "A Player";
    this.type=          "User";
    this.type_string=   "A User";
    this.password=      null;
    this.is_fighting_with= null; //never spawn a user into a battle.
    this.description= "It's YOU, Bozo!";
    this.health=       this.BASE_HEALTH;
    this.damage=       this.BASE_DAMAGE;    

    this.inventory=     new Inventory.Inventory(this.id, 10, props.inventory);

    this.override_props(props);
  }

  process_tick(){
    
    this.counter +=1;
    if (this.counter===this.HEALTH_DECLINE_RATE){
      this.health -= 1;
      this.counter = 0;

      Utils.msg_sender.send_status_msg_to_user(this.id, this.health);
      
    }

    if (this.health===0){
      //Player is dead.
      Utils.msg_sender.send_chat_msg_to_user(this.id,'world',`You are DEAD!`);
      
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
      type:           this.type,
      props: {
        //Item default props
        name:         this.name,
        description:  this.description,
        state:        this.state,
        //Entity specific props
        container_id:   this.container_id,
        is_gettable:    this.is_gettable,
        wear_hold_slot: this.wear_hold_slot,
        inventory:      this.inventory.get_data_object(),
        is_food:        this.is_food,
        restore_health_value: this.restore_health_value,
        is_decaying: this.is_decaying,
        decay_rate: this.decay_rate,
        wear: this.wear,
        decay_tick_counter: this.decay_tick_counter,
        //AnimatedObject specific props
        health:           this.health,
        damage:           this.damage,
        counter:          this.counter,
        //User specific props
        password:    this.password
      }      
    }
    return obj;
  }
    
  reset(spawn_container_id){
    this.health=            this.BASE_HEALTH;
    this.damage=            this.BASE_DAMAGE;
    this.state=             "Default";
    this.is_fighting_with=  null;
    this.inventory=         new Inventory.Inventory(this.id, 10);

    let current_container = World.world.get_instance(this.container_id);
    current_container.remove_entity(this.id);

    let spawn_container = World.world.get_instance(spawn_container_id);
    spawn_container.add_entity(this.id);
    Utils.msg_sender.send_chat_msg_to_user(this.id,'world',
      `You respawned in the starting room.`);    
  }

  get_look_string(){    
    let msg = `This is [${this.name}]({type:${this.type}, id:${this.id}}), `;
    msg += `${this.type_string}.  ${this.description};`
    return msg;    
  }

  get_inv_content(){
    return this.inventory.generate_inv_message(); 
  }

  search_target_in_slots(target){
    let items_in_slots_arr = this.inventory.get_all_slot_items();

    for (const entity_id of items_in_slots_arr){
      let entity = World.world.get_instance(entity_id);
      if ((entity.name!==null && entity.name.toLowerCase()===target) ||
           (entity.type.toLowerCase()===target) || 
           (target===entity_id)){
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
          (entity.type.toLowerCase()===target) || 
          (target===entity_id)){
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

  consume(entity_id){
    //We assume the entity is on the user somewhere.
    //restore health and remove the entity from the user and world.    
    this.inventory.remove_entity(entity_id);

    let entity = World.world.get_instance(entity_id);
    
    this.health= this.health + entity.restore_health_value;
    if (this.health>this.BASE_HEALTH){
      this.health= this.BASE_HEALTH;
    }

    this.counter= 0;

    Utils.msg_sender.send_status_msg_to_user(this.id, this.health);

    World.world.remove_from_world(entity_id);
  }

  remove_entity(entity_id){
    //We assume the entity is on the user somewhere.
    this.inventory.remove_entity(entity_id);
  }
}

class Candy extends Entity {
  constructor(props, id=null){
    super(props, id);

    this.description=           "A small piece of candy.";
    this.type=                  "Candy";
    this.type_string=           "A Candy";
    this.is_gettable=           true;
    this.wear_hold_slot=        "Hands";
    this.is_food=               true;
    this.restore_health_value=  10;

    this.override_props(props);
  }
}

function create_entity(type, props, id=null){
  //return entity_id or null if the type is unrecoginzed.
  let entity=null;
  type=         type.toLowerCase();
  
  switch(type){
    case "room":
      entity= new Room(props, id);
      break;

    case "dog":
      entity= new Dog(props, id);                         
      break;

    case "screwdriver":
      entity= new Screwdriver(props, id);                          
      break;

    case "candy":
      entity= new Candy(props, id);                          
      break;

    case "corpse":
      entity= new Candy(props, id);
      break;
  }

  return entity.id;
}

exports.Item=             Item;
exports.AnimatedObject=   AnimatedObject;
exports.Corpse=           Corpse;
exports.Entity=           Entity;
exports.User=             User;
exports.Dog=              Dog;
exports.Room=             Room;
exports.Screwdriver=      Screwdriver;
exports.Candy=            Candy;
exports.create_entity=    create_entity;

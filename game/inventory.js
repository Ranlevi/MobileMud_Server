class Inventory {
  constructor(num_of_slots, enable_wear=true, enable_hold=true){

    this.enable_wear= enable_wear;
    this.wear = { //position:id
      'Head':       null,
      'Torso':      null,
      'Legs':       null,
      'Left Foot':  null,
      'Right Foot': null
    }

    this.enable_hold = enable_hold;
    this.hold = { //position:id
      'Right Hand': null,
      'Left Hand':  null
    }

    this.slots = new Set();//ids
    this.num_of_slots = num_of_slots;
  }  
  
  wear(position, element_id){
    
    // let element_id = this.wear[position];
    // if (element_id===undefined){
    //   //position does not exist
    // }
  }

}

exports.Inventory = Inventory;
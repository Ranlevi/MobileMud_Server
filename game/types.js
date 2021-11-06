const World=      require('./world');

const Types = {
  Larry_Clarke: {
    props: {
      name:             "Larry Clarke",  
      type:             "Larry_Clarke",    
      description:      "A tall, thin man. His expression is blank and unreadable, but his dark eyes convey a sense of furious determinism.",      
      container_id:     null,      
      wearing: {
        Head:           null,
        Torso:          null,
        Legs:           null,
        Feet:           null
      },
      holding:          {
        Hands:          null
      },
      slots:            [],
      slots_size_limit: 10,
      is_fighting_with: null,
      state_variables:  {},
      is_killable:      false,
    },
    stm_definition: {
      initialState: "Default",
      Default: {
        action(){},
        transitions: {          
          user_enters_room: "Greeting_1",
        }
      },
      Greeting_1: {
        action(params_obj){
          let owner=  World.world.get_instance(params_obj.owner_id);
          let entity= World.world.get_instance(params_obj.sender_id);

          //Check if user already got the briefing.
          if (owner.props.state_variables[entity.id]!==undefined &&
              owner.props.state_variables[entity.id].done_greeting){
                owner.emote_cmd(`looks at you.`);  
                owner.say_cmd(
                  `No time to waste, ${entity.props.name} - `+
                  `the colony needs your help.` 
                );
            return;
          }

          //User entered the room for the first time.
          owner.emote_cmd(
            'raises his head from the screen. His penetrating '+
            `scans your face and body.`
            );

          owner.say_cmd(
            `So, ${entity.props.name}, you survived the Big Sleep. `+
            `Not everyone was so lucky.`
          );

          owner.say_cmd(
            `I'm guessing you're still having memory problems. That will `+
            `go away in time...assuming there's no permenent brain damage, of course.`+
            `<p><span class="pn_link" data-element="pn_cmd" `+
            `data-actions="Say Where am I?">Say: Where am I?</span></p>`
          );
          
        },
        transitions: {
          // tick: "Default"
          "says: where am i?": "Greeting_2"
        }
      },
      Greeting_2: {
        action(params_obj){
          let owner=  World.world.get_instance(params_obj.owner_id);                    

          owner.say_cmd(
            `You're on Planet Nine. You've been asleep for `+
            `almost twenty years: 17 years of space voyage, and 3 more `+
            `years since we arrived to our Solar System's ninth planet `+
            `and erected our very first colony.`
          );

          owner.emote_cmd('scratches his head.');

          owner.say_cmd(
            `You have a lot to catch up. We discovered some very...`+
            `unusual things on this planet. But you're probably still `+
            `tired and hungry, so this might not be the best time for `+
            `lengthy explanations.`+
            `<p><span class="pn_link" data-element="pn_cmd" `+
            `data-actions="Say what do I do now?">Say: What do I do now?</span></p>`
          );         

        },
        transitions: {
          "says: what do i do now?": "Greeting_3"
        }
      }, 
      Greeting_3: {
        action(params_obj){
          let owner=  World.world.get_instance(params_obj.owner_id);     
          let entity= World.world.get_instance(params_obj.sender_id);     

          owner.emote_cmd('points towards the door.');  
          owner.say_cmd(
            `To the North you'll find a room marked as 'Storage': take `+
            `what ever you need from it, and than head East to the tunnel `+
            `that leads to the colony. Find the Mayor and tell her that `+
            `that you just woke up. She'll set you up.`
          );

          owner.emote_cmd('points to a keycard laying on the table.');

          owner.say_cmd(
            `Take this with you: you'll need it to open the AirLock.`
          );

          owner.say_cmd(
            `Ah, and one more thing: if you a sort of a...emmm...spider-thingy `+
            `crawling around the ship, don't freak out. Her name is Lamar, and `+
            `unlike some of her kind, she's well behaved.`
          );

          owner.say_cmd(`That's it for now. Good Luck, ${entity.props.name}.`);
          owner.emote_cmd('goes back to looking at his screen.');

          if(!owner.props.state_variables[entity.id]){
              owner.props.state_variables[entity.id] = {done_greeting: true}
          }
        },
        transitions: {
          tick: "Default"
        }
      }
    }    
  },
  Keycard: {
    props: {
      name:           "A Keycard",
      type:           'Keycard',
      type_string:    "A Keycard",
      description:    "A small rectangular plastic card.",        
      container_id:   null,
      is_consumable:  false,
      hp_restored:    null,
      is_holdable:    true,
      wear_slot:      null,
      is_gettable:    true,
      key_code:       "00000000",
      expiration_counter: 0,
      expiration_limit:   100, //or null
    }
  },
  Lamar: {
    props: {
      name:             "Lamar",  
      type:             "Lamar",    
      description:      "It is a mechanical spider-like creature: 30cm tall, with 6 short legs. It is clearly made out of several types of metals, yet to call it 'a robot' wouldn't do it justice: It's various parts are tiny and intricate, not so much connecting with each other than *flowing* into one another. It is as if a clockwork mechanism came to life...You see no visible eyes on the thing, yet Lamar is clearly aware of your presence.",      
      container_id:     null,      
      wearing: null,
      holding: null,
      slots:   [],
      slots_size_limit: 1,
      is_fighting_with: null,
      state_variables:  {},
      is_killable:      false,
    },
    stm_definition: {
      initialState: "Default",
      Default: {
        action(){},
        transitions: {
          user_enters_room: "user_enters_room_reaction",
          tick:             "random_movement"
        }
      },
      user_enters_room_reaction:{
        action(params_obj){
          let owner=  World.world.get_instance(params_obj.owner_id);
          owner.emote_cmd(`turns in your direction.`);
        },
        transitions: {
          tick: "Default",
        }
      },
      random_movement: {
        action(params_obj){
          let owner=  World.world.get_instance(params_obj.owner_id);

          if (owner.props.state_variables.counter===undefined){
            owner.props.state_variables.counter = 0;
          }

          owner.props.state_variables.counter += 1;
          
          if (owner.props.state_variables.counter===5){
            owner.props.state_variables.counter = 0;

            let emotes = [
              `moves one of its legs slightly.`,
              `crouches lower.`,
              `makes a slight hissing sounds, sending a chill down your spine.`
            ];

            owner.emote_cmd(emotes[Math.floor(Math.random()*emotes.length)]);  
          }          
          
        },
        transitions: {
          tick: "Default",
        }
      }
    }    
  },
}

exports.Types = Types;
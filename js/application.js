var game;
var brain;
var info;
var ticker;
var average_container;

// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  game = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

  // create a brain with the following hyperparameters
  var opt = {
    temporal_window: 0,           // how many previous game states to use as input to the network, we use only current
    experience_size: 30000,       // how many state transitions to store in experience replay memory
    start_learn_threshold: 1000,  // how many transitions are needed in experience replay memory before starting learning
    gamma: 0.8,                   // future reward discount rate in Q-learning
    learning_steps_burnin: 3000,  // how many steps make only random moves (keep epsilon = 1) 
    learning_steps_total: 100000, // then start decreasing epsilon from 1 to epsilon_min
    epsilon_min: 0.05,            // value of exploration rate after learning_steps_total steps
    epsilon_test_time: 0.01,      // exploration rate value when learning = false (not in use)
    layer_defs: [                 // network structure
      {type:'input', out_sx:1, out_sy:1, out_depth:16},
      {type:'fc', num_neurons: 50, activation:'relu'},
      {type:'fc', num_neurons: 50, activation:'relu'},
      {type:'regression', num_neurons:4}
      // for full documentation on layers see http://cs.stanford.edu/people/karpathy/convnetjs/docs.html
    ],
    tdtrainer_options: {
      method: 'adadelta',         // options: adadelta, adagrad or sgd, for overview see http://arxiv.org/abs/1212.5701
      learning_rate: 0.01,        // learning rate for all layers - the biggest 10^-n value that didn't blow up loss
      momentum: 0,                // momentum for all layers - suggested default for adadelta
      batch_size: 100,            // SGD minibatch size - average game session size?
      l2_decay: 0.001             // L2 regularization - suggested default
    }
  };
  brain = new deepqlearn.Brain(16, 4, opt); // 16 inputs, 4 possible outputs (0,1,2,3)

  // if brain state was stored in local storage, continue from last state
  info = document.querySelector('.info');
  brain_state = game.storageManager.getBrainState();
  if (brain_state != null) {
    brain.fromJSON(brain_state);
    brain.visSelf(info);
  }

  // show the average score, if there are last scores in local storage
  average_container = document.querySelector('.average-container');
  var last_scores = game.storageManager.getLastScores();
  if (last_scores != null) {
    var scores_window = new cnnutil.Window(100, 1);
    scores_window.fromJSON(last_scores);
    average_container.textContent = Math.round(scores_window.get_average());
  }

  // connect Resume button
  var start_button  = document.querySelector('.start-button');
  start_button.addEventListener("click", function() {
    ticker = setTimeout(tick, 0); 
    start_button.style.display = 'none'; 
    stop_button.style.display = 'block';
  });

  // connect Pause button
  var stop_button   = document.querySelector('.stop-button');
  stop_button.addEventListener("click", function() {
    clearTimeout(ticker);
    start_button.style.display = 'block';
    stop_button.style.display = 'none';
  });

  // connect Reset button
  var reset_button  = document.querySelector('.reset-button');
  reset_button.addEventListener("click", function() {
    // stop player
    clearTimeout(ticker);
    // clear local storage and average score
    game.storageManager.clearBrainState();
    game.storageManager.clearLastScores();
    game.storageManager.setBestScore(0);
    average_container.textContent = 0;
    // create a new brain with the same options
    brain = new deepqlearn.Brain(16, 4, opt);
    brain.visSelf(info);
    // restart game
    game.restart();
    // set player ticking again
    ticker = setTimeout(tick, 0); 
  });

  // set the player ticking
  ticker = setTimeout(tick, 0);
});

// the main loop
function tick() {
  if (game.isGameTerminated())
  {
    console.log(game.score);
    // collect last scores and update average
    var scores_window = new cnnutil.Window(100, 1);
    var last_scores = game.storageManager.getLastScores();
    if (last_scores != null) {
      scores_window.fromJSON(last_scores); 
    }
    scores_window.add(game.score);
    game.storageManager.setLastScores(scores_window.toJSON());
    average_container.textContent = Math.round(scores_window.get_average());
    // save brain state
    game.storageManager.setBrainState(brain.toJSON());
    // show learning statistics
    brain.visSelf(info);
    // start a new game
    game.restart();
  }
  else {
    // create game state as a simple array
    var state = [];
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        state.push(game.grid.cells[i][j] != null ? game.grid.cells[i][j].value : 0);
      }
    }
    //console.log(JSON.stringify(state));
    var action = brain.forward(state);
    var previous_score = game.score;
    game.move(action);
    var reward = game.score - previous_score;
    brain.backward(reward); // <-- learning magic happens here
  }
  ticker = setTimeout(tick, 0);
}

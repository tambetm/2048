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
    temporal_window: 0,
    experience_size: 30000,
    start_learn_threshold: 1000,
    gamma: 0.8,
    learning_steps_total: 100000,
    learning_steps_burnin: 3000,
    epsilon_min: 0.05,
    epsilon_test_time: 0.01,
    hidden_layer_sizes: [100],
    tdtrainer_options: {learning_rate: 0.0001, momentum: 0.5, batch_size: 128, l2_decay: 0.01}
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
